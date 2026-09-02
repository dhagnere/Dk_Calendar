import { Router } from 'express';
import { z } from 'zod';
import { AccessRequestModel } from '../models/AccessRequest.js';
import { UserModel } from '../models/User.js';
import { genererHash } from '../lib/password.js';
import { notifierNouvelleDemandeAcces } from '../lib/email.js';
import { requireAdmin } from '../middleware/auth.js';

export const accessRequestsRouter = Router();

/** Dépose une demande d'accès. Public : aucune authentification requise. */
accessRequestsRouter.post('/', async (req, res) => {
  const schema = z.object({
    nom: z.string().min(1),
    email: z.string().email(),
    organisation: z.string().optional(),
    motif: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const email = parsed.data.email.toLowerCase();

  const compteExistant = await UserModel.findOne({ email });
  if (compteExistant) {
    res.json({ ok: false, message: 'Un compte existe déjà avec cette adresse e-mail' });
    return;
  }

  const demandeExistante = await AccessRequestModel.findOne({ email, statut: 'En attente' });
  if (demandeExistante) {
    res.json({ ok: false, message: 'Une demande est déjà en attente pour cette adresse e-mail' });
    return;
  }

  await AccessRequestModel.create({
    nom: parsed.data.nom,
    email,
    organisation: parsed.data.organisation ?? '',
    motif: parsed.data.motif ?? '',
  });

  console.log(`[demandes-acces] Nouvelle demande d'accès : ${email} (${parsed.data.nom})`);

  notifierNouvelleDemandeAcces({
    nom: parsed.data.nom,
    email,
    organisation: parsed.data.organisation,
    motif: parsed.data.motif,
  }).catch((err) => console.error("[demandes-acces] Échec de la notification par email :", err));
  res.json({ ok: true, message: 'Votre demande a été envoyée. Un administrateur vous contactera.' });
});

// Tout ce qui suit est réservé aux administrateurs.
accessRequestsRouter.use(requireAdmin);

/** Liste les demandes en attente. */
accessRequestsRouter.get('/', async (_req, res) => {
  const demandes = await AccessRequestModel.find({ statut: 'En attente' }).sort({ createdAt: 1 }).lean();
  res.json({ demandes });
});

/** Approuve une demande : crée le compte utilisateur avec le rôle choisi par l'administrateur. */
accessRequestsRouter.post('/:id/approuver', async (req, res) => {
  const schema = z.object({
    role: z.enum(['Administrateur', 'Consultant']),
    motDePasseTemporaire: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const demande = await AccessRequestModel.findById(req.params.id);
  if (!demande || demande.statut !== 'En attente') {
    res.status(404).json({ ok: false, message: 'Demande introuvable ou déjà traitée' });
    return;
  }

  const compteExistant = await UserModel.findOne({ email: demande.email });
  if (compteExistant) {
    demande.statut = 'Approuvée';
    await demande.save();
    res.json({ ok: false, message: 'Un compte existe déjà avec cette adresse e-mail' });
    return;
  }

  const { hash, sel } = await genererHash(parsed.data.motDePasseTemporaire);
  await UserModel.create({
    nom: demande.nom,
    email: demande.email,
    role: parsed.data.role,
    statut: 'Mot de passe à définir',
    hash,
    sel,
  });

  demande.statut = 'Approuvée';
  await demande.save();

  console.log(`[demandes-acces] Demande approuvée pour ${demande.email} (${parsed.data.role}) — mot de passe temporaire : ${parsed.data.motDePasseTemporaire}`);
  res.json({ ok: true, message: 'Compte créé avec succès', email: demande.email });
});

/** Rejette une demande d'accès. */
accessRequestsRouter.post('/:id/rejeter', async (req, res) => {
  const schema = z.object({ motifRejet: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const demande = await AccessRequestModel.findByIdAndUpdate(
    req.params.id,
    { statut: 'Rejetée', motifRejet: parsed.data.motifRejet ?? '' },
    { new: true }
  );
  if (!demande) {
    res.status(404).json({ ok: false, message: 'Demande introuvable' });
    return;
  }

  res.json({ ok: true, message: 'Demande rejetée' });
});
