import { Router } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { genererHash } from '../lib/password.js';
import { requireAdmin } from '../middleware/auth.js';
import { consigner, identiteDeRequete } from '../lib/journal.js';
import { estErreurCleDupliquee } from '../lib/mongoErrors.js';

export const accountsRouter = Router();

// Toutes les routes de gestion des comptes sont réservées aux administrateurs.
accountsRouter.use(requireAdmin);

accountsRouter.get('/', async (_req, res) => {
  const comptes = await UserModel.find({}, { hash: 0, sel: 0 }).sort({ nom: 1 }).lean();
  res.json({ comptes });
});

accountsRouter.post('/', async (req, res) => {
  const schema = z.object({
    nom: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['Administrateur', 'Consultant']),
    motDePasseTemporaire: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const existant = await UserModel.findOne({ email });
  if (existant) {
    res.json({ ok: false, message: 'Un compte existe déjà avec cette adresse e-mail' });
    return;
  }

  const { hash, sel } = await genererHash(parsed.data.motDePasseTemporaire);
  try {
    await UserModel.create({
      nom: parsed.data.nom,
      email,
      role: parsed.data.role,
      statut: 'Mot de passe à définir',
      hash,
      sel,
    });
  } catch (err) {
    if (estErreurCleDupliquee(err)) {
      res.json({ ok: false, message: 'Un compte existe déjà avec cette adresse e-mail' });
      return;
    }
    console.error('[accounts] Échec de la création du compte :', err);
    res.status(500).json({ ok: false, message: 'Échec de la création du compte, réessayez.' });
    return;
  }

  console.log(`[accounts] Compte créé pour ${email} (${parsed.data.role}) — mot de passe temporaire : ${parsed.data.motDePasseTemporaire}`);
  await consigner(identiteDeRequete(req), 'creation_compte', email, { role: parsed.data.role });
  res.json({ ok: true, message: 'Compte créé avec succès', email });
});

accountsRouter.post('/:id/statut', async (req, res) => {
  const schema = z.object({ statut: z.enum(['Actif', 'Suspendu']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }
  const updated = await UserModel.findByIdAndUpdate(req.params.id, { statut: parsed.data.statut }, { new: true });
  if (!updated) {
    res.status(404).json({ ok: false, message: 'Compte introuvable' });
    return;
  }
  await consigner(
    identiteDeRequete(req),
    parsed.data.statut === 'Suspendu' ? 'suspension_compte' : 'activation_compte',
    updated.email
  );
  res.json({ ok: true, message: `Compte ${parsed.data.statut === 'Suspendu' ? 'suspendu' : 'activé'}` });
});

/** Supprime un compte. Un administrateur ne peut pas se supprimer lui-même. */
accountsRouter.delete('/:id', async (req, res) => {
  if (req.session?.userId === req.params.id) {
    res.status(400).json({ ok: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
    return;
  }
  const supprime = await UserModel.findByIdAndDelete(req.params.id);
  if (!supprime) {
    res.status(404).json({ ok: false, message: 'Compte introuvable' });
    return;
  }
  console.log(`[accounts] Compte supprimé : ${supprime.email}`);
  await consigner(identiteDeRequete(req), 'suppression_compte', supprime.email);
  res.json({ ok: true, message: 'Compte supprimé' });
});

accountsRouter.post('/:id/reinitialiser-mot-de-passe', async (req, res) => {
  const schema = z.object({ nouveauMotDePasseTemporaire: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }
  const compte = await UserModel.findById(req.params.id);
  if (!compte) {
    res.status(404).json({ ok: false, message: 'Compte introuvable' });
    return;
  }
  const { hash, sel } = await genererHash(parsed.data.nouveauMotDePasseTemporaire);
  compte.hash = hash;
  compte.sel = sel;
  compte.statut = 'Mot de passe à définir';
  await compte.save();

  console.log(`[accounts] Mot de passe réinitialisé pour ${compte.email} — temporaire : ${parsed.data.nouveauMotDePasseTemporaire}`);
  await consigner(identiteDeRequete(req), 'reinitialisation_mot_de_passe', compte.email);
  res.json({ ok: true, message: 'Mot de passe réinitialisé' });
});
