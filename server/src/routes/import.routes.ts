import { Router } from 'express';
import multer from 'multer';
import { EventModel } from '../models/Event.js';
import { UserModel } from '../models/User.js';
import { genererHash, genererSel } from '../lib/password.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import {
  parseEventsCsv,
  stringifyEventsCsv,
  parseUsersCsv,
  stringifyUsersCsv,
} from '../lib/csv.js';
import { creerSauvegarde } from '../lib/backup.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const importRouter = Router();

/**
 * Normalise un nom d'événement pour la comparaison d'identité à l'import : majuscules, sans accents,
 * espaces superflus réduits. Insensible aux petites variations de saisie entre deux exports du même
 * événement (ex. « Marché de Noël », « MARCHE DE NOEL » ou « Marché de Noël  » avec un espace en
 * trop) : sans cette normalisation, une simple différence de casse ou d'accent fait passer la ligne
 * pour un événement distinct et la (re)crée en double, au lieu de la reconnaître comme déjà en base.
 */
function normaliserNomPourIdentite(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Clé d'identité d'un événement : eventId si présent, sinon le couple (nom normalisé, jour). La date
 * utilisée est dateClef si présente, sinon dateDeDebut en repli (un export brut sans notion de
 * « dateClef » n'a souvent qu'une date de début) : cela évite de fusionner deux événements distincts
 * qui partageraient le même nom à des dates différentes.
 *
 * Seul le JOUR calendaire compte (l'heure est ignorée) : un événement déjà en base avec une dateClef
 * à minuit et la même ligne réimportée depuis un export brut dont la « Date de début » porte une
 * heure précise (ex: 02/09/2026 14:00:00) doivent être reconnus comme le même événement, sans quoi
 * la ligne est (re)créée comme un doublon — c'est le bug rapporté (Ducasse de Rosendael en double,
 * une version validée et une non validée pour le même jour).
 */
function cleIdentite(e: {
  eventId?: string | null;
  nom: string;
  dateClef?: Date | null;
  dateDeDebut?: Date | null;
}): string {
  if (e.eventId) return `id:${e.eventId}`;
  const date = e.dateClef ?? e.dateDeDebut ?? null;
  const jour = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : '';
  return `nom:${normaliserNomPourIdentite(e.nom)}|date:${jour}`;
}

/**
 * Importe des événements depuis un fichier CSV. Un événement de plusieurs jours a une ligne par
 * jour occupé (même nom, même dateDeDebut/dateDeFin, mais dateClef différente) : l'identité d'une
 * ligne se détermine donc par eventId si présent, sinon par (nom, dateClef).
 *
 * Trois filtres s'appliquent avant toute écriture en base :
 * - une ligne au statut « Brouillon » n'est jamais importée (ni créée, ni utilisée pour mettre à
 *   jour quoi que ce soit) ;
 * - une ligne dont l'identité correspond à un événement déjà présent (en base, ou déjà rencontrée
 *   plus tôt dans le même fichier) est un doublon : elle est ignorée sans rien modifier, pour ne
 *   jamais écraser le statut, les validations ou toute autre donnée déjà saisie dans l'application ;
 * - seules les lignes qui passent ces deux filtres, c'est-à-dire les véritables nouvelles
 *   manifestations, sont créées — elles deviennent alors visibles dans le Calendrier et la Liste.
 *
 * Les identités déjà en base sont chargées en une seule requête et les nouveaux événements insérés
 * en un seul lot (au lieu de deux allers-retours base par ligne) : avec un gros fichier, la version
 * ligne par ligne pouvait dépasser le délai d'attente du serveur (erreur 502).
 */
importRouter.post('/evenements', requireAdmin, upload.single('fichier'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, message: 'Aucun fichier reçu' });
    return;
  }

  try {
    const { rows, errors } = parseEventsCsv(req.file.buffer.toString('utf-8'));

    await creerSauvegarde('avant-import-evenements');

    const existants = await EventModel.find({}, { eventId: 1, nom: 1, dateClef: 1, dateDeDebut: 1 }).lean();
    const clesExistantes = new Set(existants.map(cleIdentite));

    const clesVues = new Set<string>();
    const aCreer: typeof rows = [];
    let doublons = 0;
    let brouillonsIgnores = 0;

    for (const row of rows) {
      if (row.statut === 'Brouillon') {
        brouillonsIgnores++;
        continue;
      }

      const cle = cleIdentite(row);
      if (clesVues.has(cle) || clesExistantes.has(cle)) {
        doublons++;
        continue;
      }
      clesVues.add(cle);
      aCreer.push(row);
    }

    if (aCreer.length > 0) {
      await EventModel.insertMany(aCreer, { ordered: false });
    }

    const created = aCreer.length;
    console.log(
      `[import] Événements : ${created} créés, ${doublons} doublons ignorés, ${brouillonsIgnores} brouillons ignorés, ${errors.length} lignes ignorées`
    );
    res.json({ ok: true, created, doublons, brouillonsIgnores, errors, total: rows.length });
  } catch (err) {
    console.error("[import] Échec de l'import événements :", err);
    res.status(500).json({
      ok: false,
      message: `Échec de l'import : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
    });
  }
});

/** Exporte tous les événements au format CSV. */
importRouter.get('/evenements/export', requireAuth, async (_req, res) => {
  const events = await EventModel.find({}).sort({ nom: 1 }).lean();
  const csv = stringifyEventsCsv(events);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="evenements.csv"');
  res.send(csv);
});

/** Importe (upsert) des utilisateurs depuis un fichier CSV. */
importRouter.post('/utilisateurs', requireAdmin, upload.single('fichier'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, message: 'Aucun fichier reçu' });
    return;
  }

  try {
    const { rows, errors } = parseUsersCsv(req.file.buffer.toString('utf-8'));

    await creerSauvegarde('avant-import-utilisateurs');

    let created = 0;
    let updated = 0;
    const motsDePasseGeneres: Array<{ email: string; motDePasse: string }> = [];

    for (const row of rows) {
      const existant = await UserModel.findOne({ email: row.email });

      if (existant) {
        existant.nom = row.nom;
        existant.role = row.role as 'Administrateur' | 'Consultant';
        existant.statut = row.statut;
        if (row.motDePasseInitial) {
          const { hash, sel } = await genererHash(row.motDePasseInitial);
          existant.hash = hash;
          existant.sel = sel;
          existant.statut = 'Mot de passe à définir';
        }
        await existant.save();
        updated++;
      } else {
        const motDePasse = row.motDePasseInitial || genererSel().slice(0, 12);
        const { hash, sel } = await genererHash(motDePasse);
        await UserModel.create({
          nom: row.nom,
          email: row.email,
          role: row.role,
          statut: 'Mot de passe à définir',
          hash,
          sel,
        });
        motsDePasseGeneres.push({ email: row.email, motDePasse });
        created++;
      }
    }

    if (motsDePasseGeneres.length > 0) {
      console.log('[import] Mots de passe temporaires générés :', motsDePasseGeneres);
    }
    console.log(`[import] Utilisateurs : ${created} créés, ${updated} mis à jour, ${errors.length} lignes ignorées`);
    res.json({ ok: true, created, updated, errors, total: rows.length, motsDePasseGeneres });
  } catch (err) {
    console.error("[import] Échec de l'import utilisateurs :", err);
    res.status(500).json({
      ok: false,
      message: `Échec de l'import : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
    });
  }
});

/** Exporte tous les utilisateurs (sans mot de passe) au format CSV. */
importRouter.get('/utilisateurs/export', requireAdmin, async (_req, res) => {
  const users = await UserModel.find({}).sort({ nom: 1 }).lean();
  const csv = stringifyUsersCsv(users);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="utilisateurs.csv"');
  res.send(csv);
});
