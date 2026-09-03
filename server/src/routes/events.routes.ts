import { Router } from 'express';
import { z } from 'zod';
import { EventModel } from '../models/Event.js';
import { requireAdmin } from '../middleware/auth.js';

export const eventsRouter = Router();

/** Liste des événements, avec filtres optionnels (quartier, statut, nature, type, recherche). */
eventsRouter.get('/', async (req, res) => {
  const { quartier, statut, nature, type, searchTerm } = req.query as Record<string, string | undefined>;

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

  const items = await EventModel.find(filter).sort({ nom: 1 }).lean();
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

/** Statistiques KPI (total, validés, en attente). */
eventsRouter.get('/stats', async (_req, res) => {
  const [total, validated, byStatut, byNature] = await Promise.all([
    EventModel.countDocuments({}),
    EventModel.countDocuments({ validationTechnique: true, validationPolitique: true }),
    EventModel.aggregate([{ $group: { _id: '$statut', count: { $sum: 1 } } }]),
    EventModel.aggregate([{ $group: { _id: '$nature', count: { $sum: 1 } } }]),
  ]);

  res.json({
    total,
    validated,
    pending: total - validated,
    byStatut: byStatut.filter((r) => r._id).map((r) => ({ label: r._id, count: r.count })),
    byNature: byNature.filter((r) => r._id).map((r) => ({ label: r._id, count: r.count })),
  });
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

/** Archive automatiquement (valide) tous les événements dont la date de fin est passée. */
eventsRouter.post('/archiver-passes', requireAdmin, async (_req, res) => {
  const result = await EventModel.updateMany(
    {
      dateDeFin: { $lt: new Date() },
      $or: [{ validationTechnique: false }, { validationPolitique: false }],
    },
    { statut: 'Validée', validationTechnique: true, validationPolitique: true }
  );
  res.json({ ok: true, archived: result.modifiedCount });
});
