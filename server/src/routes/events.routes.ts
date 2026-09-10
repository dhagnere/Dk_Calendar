import { Router } from 'express';
import { z } from 'zod';
import { EventModel } from '../models/Event.js';
import { requireAdmin } from '../middleware/auth.js';
import { LIMITES_CUD, geocoderPlusieursAdresses } from '../lib/geocodage.js';
import { motifRechercheInsensibleAccents } from '../lib/rechercheAccents.js';
import { cleIdentite } from '../lib/identiteEvenement.js';
import { creerSauvegarde } from '../lib/backup.js';
import { consigner, identiteDeRequete } from '../lib/journal.js';
import { queryString } from '../lib/queryString.js';

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
  // Chaque valeur passe par queryString() : sans ça, une requête façonnée comme
  // ?quartier[$ne]= (que le parseur de requête d'Express transforme en objet) pourrait être
  // affectée telle quelle à un filtre MongoDB et injecter un opérateur ($ne, $regex…) au lieu
  // d'une simple comparaison d'égalité — cette route est publique, sans authentification.
  const quartier = queryString(req.query.quartier);
  const statut = queryString(req.query.statut);
  const nature = queryString(req.query.nature);
  const type = queryString(req.query.type);
  const searchTerm = queryString(req.query.searchTerm);
  const avecEvenementsPasses = queryString(req.query.avecEvenementsPasses);
  const avecEvenementsArchives = queryString(req.query.avecEvenementsArchives);

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
    // Insensible à la casse ET aux accents (« evenement » retrouve aussi bien « Événement »).
    filter.nom = { $regex: motifRechercheInsensibleAccents(searchTerm.trim()), $options: 'i' };
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

/**
 * Détecte les doublons déjà présents en base (par ex. créés par des imports antérieurs à la
 * normalisation du nom dans cleIdentite) : regroupe tous les événements par la même clé d'identité
 * que l'import (eventId, sinon nom normalisé + jour), et ne renvoie que les groupes de 2 lignes ou
 * plus. Réservé aux administrateurs, qui décident lesquelles conserver.
 */
eventsRouter.get('/doublons', requireAdmin, async (_req, res) => {
  const evenements = await EventModel.find({}).sort({ nom: 1 }).lean();
  const groupes = new Map<string, typeof evenements>();
  for (const e of evenements) {
    const cle = cleIdentite(e);
    const liste = groupes.get(cle);
    if (liste) liste.push(e);
    else groupes.set(cle, [e]);
  }
  const doublons = [...groupes.values()].filter((liste) => liste.length > 1);
  res.json({ doublons });
});

/**
 * Fusionne un groupe de doublons : supprime les lignes indiquées (les autres membres du groupe sont
 * conservés tels quels). Une sauvegarde de sécurité de l'état actuel est créée juste avant, pour
 * pouvoir annuler la fusion si le mauvais exemplaire a été supprimé par erreur.
 */
eventsRouter.post('/doublons/fusionner', requireAdmin, async (req, res) => {
  const schema = z.object({ idsASupprimer: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  await creerSauvegarde('avant-fusion-doublons');
  await EventModel.deleteMany({ _id: { $in: parsed.data.idsASupprimer } });
  await consigner(identiteDeRequete(req), 'fusion_doublons', `${parsed.data.idsASupprimer.length} exemplaire(s) supprimé(s)`, {
    idsASupprimer: parsed.data.idsASupprimer,
  });
  res.json({ ok: true, supprimes: parsed.data.idsASupprimer.length });
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
 * Géocode un lot d'événements en attente, pour la page Carte. La recherche est bornée au territoire
 * de la Communauté urbaine de Dunkerque (voir geocodage.ts) pour éviter qu'un nom de salle ambigu
 * (ex. « Salle des fêtes » sans indication de ville) ne soit localisé sur une commune homonyme
 * ailleurs en France.
 *
 * Nominatim (le service de géocodage gratuit utilisé) impose 1 requête par seconde : un seul appel
 * ne traite donc qu'un nombre limité d'adresses distinctes (LOT_GEOCODAGE) pour rester dans le délai
 * d'une requête HTTP. Le client rappelle cette route en boucle jusqu'à ce que `restants` soit à 0.
 * Les adresses partagées par plusieurs événements (un même lieu) ne sont géocodées qu'une fois.
 */
eventsRouter.post('/geocoder', requireAdmin, async (_req, res) => {
  try {
    // Événements déjà géocodés lors d'exécutions précédentes (avant la contrainte géographique
    // ci-dessus) dont les coordonnées tombent hors de la CUD : à reprendre avec la recherche bornée.
    const remis = await EventModel.updateMany(
      {
        statutGeocodage: 'ok',
        $or: [
          { latitude: { $lt: LIMITES_CUD.latMin } },
          { latitude: { $gt: LIMITES_CUD.latMax } },
          { longitude: { $lt: LIMITES_CUD.lonMin } },
          { longitude: { $gt: LIMITES_CUD.lonMax } },
        ],
      },
      { statutGeocodage: 'attente', latitude: null, longitude: null }
    );
    if (remis.modifiedCount > 0) {
      console.log(`[geocodage] ${remis.modifiedCount} événement(s) hors de la CUD remis en attente pour re-géocodage`);
    }

    // Un événement sans lieu du tout ne pourra jamais être géocodé : on l'écarte tout de suite.
    await EventModel.updateMany({ ...NON_GEOCODE, $or: [{ lieu: null }, { lieu: '' }] }, { statutGeocodage: 'echec' });

    const enAttente = await EventModel.find(NON_GEOCODE, { lieu: 1 }).lean();
    const toutesAdressesDistinctes = [...new Set(enAttente.map((e) => e.lieu.trim()))];
    const adressesDistinctes = toutesAdressesDistinctes.slice(0, LOT_GEOCODAGE);

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
    // Toutes les adresses de `adressesDistinctes` ont été résolues (ok ou échec) ci-dessus : le nombre
    // d'adresses distinctes encore à traiter est simplement le total moins celles de ce lot.
    const adressesRestantes = Math.max(0, toutesAdressesDistinctes.length - adressesDistinctes.length);
    console.log(`[geocodage] ${geocodes} adresse(s) géocodée(s), ${echecs} échec(s), ${restants} événement(s) restant(s)`);
    res.json({ ok: true, geocodes, echecs, restants, adressesRestantes });
  } catch (err) {
    console.error('[geocodage] Échec :', err);
    res.status(500).json({
      ok: false,
      message: `Échec du géocodage : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
    });
  }
});

/**
 * Supprime un événement. La Liste n'affichant plus qu'une seule ligne par événement sur plusieurs
 * jours, supprimer cette ligne doit retirer tous les jours de la série (même nom/dateDeDebut/dateDeFin,
 * mais dateClef différente de celui ciblé). Un doublon strict (même jour, dateClef identique, produit
 * par un import répété) n'est en revanche jamais supprimé automatiquement : seul le document ciblé
 * l'est, l'autre reste en base — il doit toujours en rester un.
 */
eventsRouter.delete('/:id', requireAdmin, async (req, res) => {
  const cible = await EventModel.findById(req.params.id).lean();
  if (!cible) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }
  await EventModel.deleteMany({ ...filtreSerie(cible), dateClef: { $ne: cible.dateClef } });
  await EventModel.findByIdAndDelete(cible._id);
  await consigner(identiteDeRequete(req), 'suppression_evenement', cible.nom);
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
  await consigner(identiteDeRequete(req), 'changement_statut_evenement', updated.nom, { statut: parsed.data.statut });
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
  await consigner(identiteDeRequete(req), 'changement_validation', cible.nom, parsed.data);
  res.json({ ok: true, item: updated });
});

/** Nombre maximal de jours acceptés pour la plage d'un report de date (garde-fou). */
const MAX_JOURS_REPORT = 366;

/**
 * Parse une date « civile » au format AAAA-MM-JJ (sans heure ni fuseau), telle qu'envoyée par le
 * sélecteur de dates du client. Construite à partir des composants année/mois/jour directement (et
 * non via `new Date(chaîneISO)`), pour ne dépendre d'aucune conversion de fuseau horaire : le jour
 * choisi par l'utilisateur est toujours le jour stocké, quel que soit son fuseau horaire ou celui du
 * serveur (contrairement à une date-heure complète, qui encoderait le fuseau du navigateur et serait
 * mal réinterprétée par un serveur dans un fuseau différent).
 */
function parseJourCivil(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, annee, mois, jour] = match;
  const date = new Date(Number(annee), Number(mois) - 1, Number(jour));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Change les dates d'un événement (report). Un événement sur plusieurs jours ayant une ligne par
 * jour (dateClef), reporter la date recrée l'intégralité de la série sur les nouveaux jours : toutes
 * les lignes de l'ancienne série (voir filtreSerie) sont supprimées puis remplacées par une ligne par
 * jour de la nouvelle plage, en conservant tous les autres champs (lieu, quartier, validations,
 * etc.) tels qu'ils étaient. Les identifiants Mongo des nouvelles lignes sont donc différents de
 * l'ancienne série.
 */
eventsRouter.post('/:id/dates', requireAdmin, async (req, res) => {
  const schema = z.object({ dateDeDebut: z.string().min(1), dateDeFin: z.string().nullable() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Données invalides' });
    return;
  }

  const cible = await EventModel.findById(req.params.id).lean();
  if (!cible) {
    res.status(404).json({ ok: false, message: 'Événement introuvable' });
    return;
  }

  const nouveauDebut = parseJourCivil(parsed.data.dateDeDebut);
  const nouveauFin = parsed.data.dateDeFin ? parseJourCivil(parsed.data.dateDeFin) : nouveauDebut;
  if (!nouveauDebut || !nouveauFin || nouveauFin < nouveauDebut) {
    res.status(400).json({ ok: false, message: 'Dates invalides' });
    return;
  }

  const memeJour =
    nouveauDebut.getFullYear() === nouveauFin.getFullYear() &&
    nouveauDebut.getMonth() === nouveauFin.getMonth() &&
    nouveauDebut.getDate() === nouveauFin.getDate();

  const { _id, dateClef, dateDeDebut, dateDeFin, createdAt, updatedAt, __v, ...gabarit } = cible as Record<string, unknown>;

  const nouvellesLignes: Record<string, unknown>[] = [];
  for (
    const d = new Date(nouveauDebut.getFullYear(), nouveauDebut.getMonth(), nouveauDebut.getDate());
    d <= nouveauFin && nouvellesLignes.length < MAX_JOURS_REPORT;
    d.setDate(d.getDate() + 1)
  ) {
    nouvellesLignes.push({
      ...gabarit,
      dateClef: new Date(d),
      dateDeDebut: nouveauDebut,
      dateDeFin: memeJour ? null : nouveauFin,
    });
  }

  await EventModel.deleteMany(filtreSerie(cible));
  const crees = await EventModel.insertMany(nouvellesLignes);
  await consigner(identiteDeRequete(req), 'report_date_evenement', cible.nom, {
    ancien: { dateDeDebut: cible.dateDeDebut, dateDeFin: cible.dateDeFin },
    nouveau: { dateDeDebut: nouveauDebut, dateDeFin: memeJour ? null : nouveauFin },
  });
  res.json({ ok: true, items: crees });
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
  await consigner(
    identiteDeRequete(req),
    viaPastilleDateClef ? 'marquage_date_clef' : 'validation_evenement',
    cible.nom
  );
  res.json({ ok: true, item: updated });
});
