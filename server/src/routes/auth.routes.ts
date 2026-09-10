import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { UserModel } from '../models/User.js';
import { genererHash, verifierMotDePasse } from '../lib/password.js';
import { signSession, setSessionCookie, clearSessionCookie } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';
import { consigner, identiteDeRequete } from '../lib/journal.js';

export const authRouter = Router();

/** Freine les tentatives de mot de passe par force brute : 10 essais par IP toutes les 15 minutes. */
const limiteurConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Trop de tentatives de connexion, réessayez dans quelques minutes' },
});

/** Existe-t-il déjà un administrateur actif ? (contrôle affiché à l'écran de connexion) */
authRouter.get('/existe-administrateur', async (_req, res) => {
  const nombreComptes = await UserModel.countDocuments({});
  const admin = await UserModel.findOne({ role: 'Administrateur', statut: 'Actif' });
  res.json({ existe: !!admin, nombreComptes });
});

/** Initialise le tout premier compte administrateur. */
authRouter.post('/initialiser-administrateur', async (req, res) => {
  const schema = z.object({
    nom: z.string().min(1),
    email: z.string().email(),
    motDePasse: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const admin = await UserModel.findOne({ role: 'Administrateur', statut: 'Actif' });
  if (admin) {
    res.json({ ok: false, message: 'Un administrateur existe déjà' });
    return;
  }

  const { nom, motDePasse } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const { hash, sel } = await genererHash(motDePasse);

  const compte = await UserModel.create({ nom, email, role: 'Administrateur', statut: 'Actif', hash, sel });
  console.log(`[auth] Administrateur initial créé : ${email}`);
  await consigner({ userId: compte.id, nom: compte.nom, email: compte.email }, 'creation_compte', email, { role: 'Administrateur', initial: true });
  res.json({ ok: true, message: 'Compte administrateur créé avec succès' });
});

/** Authentifie un utilisateur et pose le cookie de session. */
authRouter.post('/connexion', limiteurConnexion, async (req, res) => {
  const schema = z.object({ email: z.string().email(), motDePasse: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Identifiant ou mot de passe incorrect' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const compte = await UserModel.findOne({ email });

  if (!compte) {
    console.log(`[auth] Connexion échouée (compte introuvable) : ${email}`);
    res.json({ ok: false, message: 'Identifiant ou mot de passe incorrect' });
    return;
  }

  if (compte.statut === 'Suspendu') {
    console.log(`[auth] Connexion échouée (compte suspendu) : ${email}`);
    res.json({ ok: false, message: 'Identifiant ou mot de passe incorrect' });
    return;
  }

  const motDePasseValide = await verifierMotDePasse(parsed.data.motDePasse, compte.hash, compte.sel);
  if (!motDePasseValide) {
    console.log(`[auth] Connexion échouée (mot de passe incorrect) : ${email}`);
    res.json({ ok: false, message: 'Identifiant ou mot de passe incorrect' });
    return;
  }

  compte.derniereConnexion = new Date();
  await compte.save();

  const role = compte.role as 'Administrateur' | 'Consultant';
  const token = signSession({ userId: compte.id, email: compte.email, nom: compte.nom, role });
  setSessionCookie(res, token);

  console.log(`[auth] Connexion réussie : ${email} (${role})`);
  await consigner({ userId: compte.id, nom: compte.nom, email: compte.email }, 'connexion', email);
  res.json({ ok: true, message: 'Connexion réussie', session: { email: compte.email, nom: compte.nom, role } });
});

authRouter.post('/deconnexion', async (req, res) => {
  if (req.session) await consigner(identiteDeRequete(req), 'deconnexion', req.session.email);
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Retourne la session courante (ou null si non connecté). */
authRouter.get('/moi', (req, res) => {
  res.json({ session: req.session ?? null });
});

/** Change le mot de passe de l'utilisateur connecté. */
authRouter.post('/changer-mot-de-passe', requireAuth, async (req, res) => {
  const schema = z.object({ ancienMotDePasse: z.string().min(1), nouveauMotDePasse: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const compte = await UserModel.findOne({ email: req.session!.email });
  if (!compte) {
    res.status(404).json({ ok: false, message: 'Compte introuvable' });
    return;
  }

  const ancienValide = await verifierMotDePasse(parsed.data.ancienMotDePasse, compte.hash, compte.sel);
  if (!ancienValide) {
    res.json({ ok: false, message: 'Ancien mot de passe incorrect' });
    return;
  }

  const { hash, sel } = await genererHash(parsed.data.nouveauMotDePasse);
  compte.hash = hash;
  compte.sel = sel;
  compte.statut = 'Actif';
  await compte.save();

  await consigner(identiteDeRequete(req), 'changement_mot_de_passe', compte.email);
  res.json({ ok: true, message: 'Mot de passe changé avec succès' });
});
