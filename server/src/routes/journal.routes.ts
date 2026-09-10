import { Router } from 'express';
import { JournalActionModel } from '../models/JournalAction.js';
import { requireAdmin } from '../middleware/auth.js';
import { queryString } from '../lib/queryString.js';

export const journalRouter = Router();

// Réservé aux administrateurs : le journal expose l'activité de tous les comptes.
journalRouter.use(requireAdmin);

/** Liste paginée du journal d'audit, filtrable par utilisateur et par type d'action. */
journalRouter.get('/', async (req, res) => {
  // queryString() écarte toute valeur qui ne serait pas une chaîne simple (ex. ?utilisateur[$ne]=,
  // transformé en objet par le parseur de requête) avant de l'utiliser dans un filtre MongoDB.
  const utilisateur = queryString(req.query.utilisateur);
  const action = queryString(req.query.action);
  const page = queryString(req.query.page);
  const limit = queryString(req.query.limit);

  const filter: Record<string, unknown> = {};
  if (utilisateur) filter.utilisateurEmail = utilisateur;
  if (action) filter.action = action;

  const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));

  const [items, total] = await Promise.all([
    JournalActionModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    JournalActionModel.countDocuments(filter),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum });
});

/** Liste des comptes (email + nom) ayant au moins une entrée au journal, pour le filtre côté client. */
journalRouter.get('/utilisateurs', async (_req, res) => {
  const utilisateurs = await JournalActionModel.aggregate([
    { $match: { utilisateurEmail: { $ne: '' } } },
    { $group: { _id: '$utilisateurEmail', nom: { $last: '$utilisateurNom' } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ utilisateurs: utilisateurs.map((u) => ({ email: u._id as string, nom: u.nom as string })) });
});
