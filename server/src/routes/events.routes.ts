import { Router } from 'express';
import { z } from 'zod';
import { EventModel } from '../models/Event.js';
import { requireAdmin } from '../middleware/auth.js';

export const eventsRouter = Router();

/** Année à partir de laquelle les événements sont chargés par défaut (voir GET /evenements). */
const ANNEE_PLANCHER_PAR_DEFAUT = 2024;

/** Date de référence pour savoir si un événement est terminé : dateDeFin, sinon dateDeDebut, sinon dateClef. */
const DATE_FIN_EFFECTIVE = { $ifNull: ['$dateDeFin', { $ifNull: ['$dateDeDebut', '$dateClef'] }] };

/**
 * Liste des événements, avec filtres optionnels (quartier, statut, nature, type, recherche).
 *
 * Par souci de rapidité, seuls les événements entre le 1er janvier ANNEE_PLANCHER_PAR_DEFAUT et le
 * 31 décembre de l'année suivant l'année en cours sont renvoyés par défaut. Passer
 * `avecEvenementsPasses=true` retire cette borne basse pour inclure aussi tout l'historique
 * antérieur. Un événement sans aucune date (ni dateDeDebut ni dateClef) est toujours renvoyé, quel
 * que soit ce paramètre.
 *
 * Tout événement déjà terminé (date de fin passée) est automatiquement validé et considéré
 * « archivé » : plus besoin de déclencher cela manuellement. Par défaut ces événements archivés sont
 * masqués ; passer `avecEvenementsArchives=true` les inclut à nouveau (déclencheur côté client).
 */
eventsRouter.get('/', async (req, res) => {
  const { quartier, statut, nature, type, searchTerm, avecEvenementsPasses, avecEvenementsArchives } =
    req.query as Record<string, string | undefined>;

  const maintenant = new Date();

  // Valide et archive automatiquement tout événement dont la date de fin est déjà passée.
  await EventModel.updateMany(
    {
      $expr: { $and: [{ $ne: [DATE_FIN_EFFECTIVE, null] }, { $lt: [DATE_FIN_EFFECTIVE, maintenant] }] },
      $or: [{ validationTechnique: false }, { validationPolitique: false }],
    },
    { statut: 'Validée', validationTechnique: true, validationPolitique: true }
  );

  const filter: Record<string, unknown> = {};
  if (quartier && quartier !== 'ALL') filter.quartier = quartier;
  if (nature && nature !== 'ALL') filter.nature = nature;
  if (type && type !== 'ALL') filter.type = type;
  if (searchTerm && searchTerm.trim().length > 0) {
    filter.nom = { $regex: searchTerm.trim(), $options: 'i' };
  }

  if (statut === 'Validée') {
    filter.validationTechnique = true;
    filter.validationPolitique = true;
  } else if (statut && statut !== 'ALL') {
    filter.statut = statut;
  }

  const anneeActuelle = maintenant.getFullYear();
  const finPeriode = new Date(anneeActuelle + 2, 0, 1); // borne haute exclusive : fin de l'année en cours + 1 an
  const contraintesDate: Record<string, unknown> = { $lt: finPeriode };
  if (avecEvenementsPasses !== 'true') {
    contraintesDate.$gte = new Date(ANNEE_PLANCHER_PAR_DEFAUT, 0, 1);
  }

  // Trie par proximité avec aujourd'hui décroissante : l'événement dont la dateDeDebut (ou dateClef
  // en repli) est la plus proche de la date du jour arrive en premier, puis on s'éloigne
  // progressivement (dans le passé comme dans le futur) vers l'événement le plus lointain. Les
  // événements sans aucune date sont placés en dernier.
  const items = await EventModel.aggregate([
    { $match: filter },
    { $addFields: { dateTri: { $ifNull: ['$dateDeDebut', '$dateClef'] }, dateFin: DATE_FIN_EFFECTIVE } },
    { $match: { $or: [{ dateTri: null }, { dateTri: contraintesDate }] } },
    ...(avecEvenementsArchives === 'true'
      ? []
      : [{ $match: { $or: [{ dateFin: null }, { dateFin: { $gte: maintenant } }] } }]),
    { $addFields: { dateTriAbsente: { $cond: [{ $eq: ['$dateTri', null] }, 1, 0] } } },
    {
      $addFields: {
        proximite: { $cond: [{ $eq: ['$dateTri', null] }, null, { $abs: { $subtract: ['$dateTri', maintenant] } }] },
      },
    },
    { $sort: { dateTriAbsente: 1, proximite: 1, nom: 1 } },
  ]);
  res.json({ items });
});

/** Options disponibles pour les filtres (quartiers/natures/statuts/types avec comptage). */
eventsRouter.get('/options-filtres', async (_req, res) => {
  const [quartiers, natures, statuts, types] = await Promise.all([
    EventModel.aggregate([{ $group: { _id: '$quartier', count: { $sum: 1 } } }]),
    EventModel.aggregate([{ $group: { _id: '$nature', count: { $sum: 1 } } }]),
    EventModel.aggregate([{ $group: { _id: '$statut', count: { $sum: 1 } } }]),
    EventModel.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
  ]);

  const format = (rows: { _id: string; count: number }[]) =>
    rows.filter((r) => r._id).map((r) => ({ label: r._id, count: r.count }));

  res.json({ quartiers: format(quartiers), natures: format(natures), statuts: format(statuts), types: format(types) });
});

/** Statistiques KPI (total, validés, en attente, année en cours, depuis 2020). */
eventsRouter.get('/stats', async (_req, res) => {
  // Date de référence d'un événement pour le comptage par année : dateDeDebut si présente, sinon dateClef.
  const dateReference = { $ifNull: ['$dateDeDebut', '$dateClef'] };
  const anneeActuelle = new Date().getFullYear();
  const debutAnneeActuelle = new Date(anneeActuelle, 0, 1);
  const debutAnneeSuivante = new Date(anneeActuelle + 1, 0, 1);
  const debut2020 = new Date(2020, 0, 1);

  const [total, validated, byStatut, byNature, anneeEnCours, depuis2020] = await Promise.all([
    EventModel.countDocuments({}),
    EventModel.countDocuments({ validationTechnique: true, validationPolitique: true }),
    EventModel.aggregate([{ $group: { _id: '$statut', count: { $sum: 1 } } }]),
    EventModel.aggregate([{ $group: { _id: '$nature', count: { $sum: 1 } } }]),
    EventModel.countDocuments({
      $expr: { $and: [{ $gte: [dateReference, debutAnneeActuelle] }, { $lt: [dateReference, debutAnneeSuivante] }] },
    }),
    EventModel.countDocuments({ $expr: { $gte: [dateReference, debut2020] } }),
  ]);

  res.json({
    total,
    validated,
    pending: total - validated,
    anneeActuelle,
    anneeEnCours,
    depuis2020,
    byStatut: byStatut.filter((r) => r._id).map((r) => ({ label: r._id, count: r.count })),
    byNature: byNature.filter((r) => r._id).map((r) => ({ label: r._id, count: r.count })),
  });
});

/** Supprime un événement (utile notamment pour nettoyer un doublon créé par un import antérieur). */
eventsRouter.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await EventModel.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  res.json({ ok: true });
});

eventsRouter.get('/:id', async (req, res) => {
  const item = await EventModel.findById(req.params.id).lean();
  if (!item) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  res.json(item);
});

/** Met à jour le statut d'un événement. */
eventsRouter.post('/:id/statut', requireAdmin, async (req, res) => {
  const schema = z.object({ statut: z.enum(['Validée', 'Annulée', 'À valider', 'Brouillon']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }
  const updated = await EventModel.findByIdAndUpdate(req.params.id, { statut: parsed.data.statut }, { new: true });
  if (!updated) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  res.json({ ok: true, item: updated });
});

/** Met à jour les validations (technique / politique). */
eventsRouter.post('/:id/validations', requireAdmin, async (req, res) => {
  const schema = z.object({ validationTechnique: z.boolean().optional(), validationPolitique: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }
  const updated = await EventModel.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  if (!updated) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  res.json({ ok: true, item: updated });
});

/** Met à jour les dates de début/fin d'un événement. */
eventsRouter.post('/:id/dates', requireAdmin, async (req, res) => {
  const schema = z.object({ dateDeDebut: z.string().nullable(), dateDeFin: z.string().nullable() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }
  const updated = await EventModel.findByIdAndUpdate(
    req.params.id,
    {
      dateDeDebut: parsed.data.dateDeDebut ? new Date(parsed.data.dateDeDebut) : null,
      dateDeFin: parsed.data.dateDeFin ? new Date(parsed.data.dateDeFin) : null,
    },
    { new: true }
  );
  if (!updated) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  res.json({ ok: true, item: updated });
});

/**
 * Valide un événement en un clic : statut "Validée" + les deux validations cochées.
 */
eventsRouter.post('/:id/valider', requireAdmin, async (req, res) => {
  const viaPastilleDateClef = z.boolean().optional().parse(req.body?.viaPastilleDateClef);
  const updated = await EventModel.findByIdAndUpdate(
    req.params.id,
    {
      statut: 'Validée',
      validationTechnique: true,
      validationPolitique: true,
      validParDateClef: viaPastilleDateClef ?? false,
    },
    { new: true }
  );
  if (!updated) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  res.json({ ok: true, item: updated });
});

/** Valide toute une série d'événements partageant le même nom exact. */
eventsRouter.post('/valider-serie', requireAdmin, async (req, res) => {
  const schema = z.object({ eventName: z.string().min(1), viaPastilleDateClef: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const result = await EventModel.updateMany(
    { nom: parsed.data.eventName },
    {
      statut: 'Validée',
      validationTechnique: true,
      validationPolitique: true,
      validParDateClef: parsed.data.viaPastilleDateClef ?? false,
    }
  );

  res.json({ ok: true, validated: result.modifiedCount, total: result.matchedCount });
});
