import { Router } from 'express';
import { z } from 'zod';
import { EventModel } from '../models/Event.js';
import { requireAdmin } from '../middleware/auth.js';
import { geocoderPlusieursAdresses } from '../lib/geocodage.js';

export const eventsRouter = Router();

/** Nombre d'adresses distinctes géocodées par appel à POST /evenements/geocoder (voir plus bas). */
const LOT_GEOCODAGE = 10;

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

/** Année à partir de laquelle porte le KPI "Total des manifestations" (voir GET /evenements/stats). */
const ANNEE_PLANCHER_TOTAL_KPI = 2015;

/** Statistiques KPI (total depuis 2015, validés, en attente, année en cours). */
eventsRouter.get('/stats', async (_req, res) => {
  // Date de référence d'un événement pour le comptage par année : dateDeDebut si présente, sinon dateClef.
  const dateReference = { $ifNull: ['$dateDeDebut', '$dateClef'] };
  const anneeActuelle = new Date().getFullYear();
  const debutAnneeActuelle = new Date(anneeActuelle, 0, 1);
  const debutAnneeSuivante = new Date(anneeActuelle + 1, 0, 1);
  const debutPlancherTotal = new Date(ANNEE_PLANCHER_TOTAL_KPI, 0, 1);
  const depuis2015: Record<string, unknown> = { $expr: { $gte: [dateReference, debutPlancherTotal] } };

  const [total, validated, byStatut, byNature, anneeEnCours] = await Promise.all([
    EventModel.countDocuments(depuis2015),
    EventModel.countDocuments({ ...depuis2015, validationTechnique: true, validationPolitique: true }),
    EventModel.aggregate([{ $group: { _id: '$statut', count: { $sum: 1 } } }]),
    EventModel.aggregate([{ $group: { _id: '$nature', count: { $sum: 1 } } }]),
    EventModel.countDocuments({
      $expr: { $and: [{ $gte: [dateReference, debutAnneeActuelle] }, { $lt: [dateReference, debutAnneeSuivante] }] },
    }),
  ]);

  res.json({
    total,
    validated,
    pending: total - validated,
    anneeActuelle,
    anneeEnCours,
    anneePlancherTotal: ANNEE_PLANCHER_TOTAL_KPI,
    byStatut: byStatut.filter((r) => r._id).map((r) => ({ label: r._id, count: r.count })),
    byNature: byNature.filter((r) => r._id).map((r) => ({ label: r._id, count: r.count })),
  });
});

/**
 * Filtre correspondant à « pas encore géocodé ». Attention : ajouter un champ avec une valeur par
 * défaut au schéma ne l'ajoute PAS rétroactivement aux documents déjà en base — un événement créé
 * avant ce champ n'a donc pas statutGeocodage: 'attente' mais littéralement AUCUN champ
 * statutGeocodage. `{ statutGeocodage: 'attente' }` ne les trouverait donc jamais : il faut aussi
 * accepter le champ absent, d'où $nin plutôt qu'une égalité stricte sur 'attente'.
 */
const NON_GEOCODE = { statutGeocodage: { $nin: ['ok', 'echec'] } };

/**
 * Géocode un lot d'événements en attente, pour la page Carte.
 * Nominatim (le service de géocodage gratuit utilisé) impose 1 requête par seconde : un seul appel
 * ne traite donc qu'un nombre limité d'adresses distinctes (LOT_GEOCODAGE) pour rester dans le délai
 * d'une requête HTTP. Le client rappelle cette route en boucle jusqu'à ce que `restants` soit à 0.
 * Les adresses partagées par plusieurs événements (un même lieu) ne sont géocodées qu'une fois.
 */
eventsRouter.post('/geocoder', requireAdmin, async (_req, res) => {
  try {
    // Un événement sans lieu du tout ne pourra jamais être géocodé : on l'écarte tout de suite.
    await EventModel.updateMany({ ...NON_GEOCODE, $or: [{ lieu: null }, { lieu: '' }] }, { statutGeocodage: 'echec' });

    const enAttente = await EventModel.find(NON_GEOCODE, { lieu: 1 }).lean();
    const adressesDistinctes = [...new Set(enAttente.map((e) => e.lieu.trim()))].slice(0, LOT_GEOCODAGE);

    let geocodes = 0;
    let echecs = 0;

    if (adressesDistinctes.length > 0) {
      const resultats = await geocoderPlusieursAdresses(adressesDistinctes);
      for (const [adresse, coords] of resultats) {
        if (coords) {
          await EventModel.updateMany(
            { lieu: adresse, ...NON_GEOCODE },
            { latitude: coords.latitude, longitude: coords.longitude, statutGeocodage: 'ok' }
          );
          geocodes++;
        } else {
          await EventModel.updateMany({ lieu: adresse, ...NON_GEOCODE }, { statutGeocodage: 'echec' });
          echecs++;
        }
      }
    }

    const restants = await EventModel.countDocuments(NON_GEOCODE);
    console.log(`[geocodage] ${geocodes} adresse(s) géocodée(s), ${echecs} échec(s), ${restants} événement(s) restant(s)`);
    res.json({ ok: true, geocodes, echecs, restants });
  } catch (err) {
    console.error('[geocodage] Échec :', err);
    res.status(500).json({
      ok: false,
      message: `Échec du géocodage : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
    });
  }
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

/**
 * Filtre identifiant tous les jours d'un même événement multi-jours : même nom et mêmes
 * dateDeDebut/dateDeFin (seule dateClef diffère d'une ligne à l'autre pour un tel événement).
 */
function filtreSerie(e: { nom: string; dateDeDebut?: Date | null; dateDeFin?: Date | null }) {
  return { nom: e.nom, dateDeDebut: e.dateDeDebut ?? null, dateDeFin: e.dateDeFin ?? null };
}

/**
 * Met à jour les validations (technique / politique). Un événement sur plusieurs jours ayant une
 * ligne par jour (dateClef), la validation d'un seul jour est répercutée sur toute la série pour que
 * tous les jours affichent le même état.
 */
eventsRouter.post('/:id/validations', requireAdmin, async (req, res) => {
  const schema = z.object({ validationTechnique: z.boolean().optional(), validationPolitique: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }
  const cible = await EventModel.findById(req.params.id);
  if (!cible) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  await EventModel.updateMany(filtreSerie(cible), parsed.data);
  const updated = await EventModel.findById(req.params.id);
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
 * Valide un événement en un clic : statut "Validée" + les deux validations cochées. Répercuté sur
 * toute la série (voir filtreSerie) pour qu'un événement sur plusieurs jours soit validé d'un bloc.
 */
eventsRouter.post('/:id/valider', requireAdmin, async (req, res) => {
  const viaPastilleDateClef = z.boolean().optional().parse(req.body?.viaPastilleDateClef);
  const cible = await EventModel.findById(req.params.id);
  if (!cible) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  await EventModel.updateMany(filtreSerie(cible), {
    statut: 'Validée',
    validationTechnique: true,
    validationPolitique: true,
    validParDateClef: viaPastilleDateClef ?? false,
  });
  const updated = await EventModel.findById(req.params.id);
  res.json({ ok: true, item: updated });
});
