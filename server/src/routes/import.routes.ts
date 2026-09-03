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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const importRouter = Router();

/**
 * Importe des événements depuis un fichier CSV. Un événement de plusieurs jours a une ligne par
 * jour occupé (même nom, même dateDeDebut/dateDeFin, mais dateClef différente) : l'identité d'une
 * ligne se détermine donc par eventId si présent, sinon par (nom, dateClef).
 *
 * Seules les lignes correspondant à un événement qui n'existe pas encore sont créées. Une ligne
 * dont l'identité correspond à un événement déjà présent (dans la base, ou déjà rencontré plus tôt
 * dans le même fichier) est un doublon : elle est ignorée sans rien modifier, pour ne jamais écraser
 * le statut, les validations ou toute autre donnée déjà saisie dans l'application.
 */
importRouter.post('/evenements', requireAdmin, upload.single('fichier'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, message: 'Aucun fichier reçu' });
    return;
  }

  const { rows, errors } = parseEventsCsv(req.file.buffer.toString('utf-8'));

  let created = 0;
  let doublons = 0;
  const clesVues = new Set<string>();

  for (const row of rows) {
    const cle = row.eventId ? `id:${row.eventId}` : `nom:${row.nom}|date:${row.dateClef?.toISOString() ?? ''}`;

    if (clesVues.has(cle)) {
      doublons++;
      continue;
    }
    clesVues.add(cle);

    const filter = row.eventId ? { eventId: row.eventId } : { nom: row.nom, dateClef: row.dateClef };
    const existant = await EventModel.exists(filter);
    if (existant) {
      doublons++;
      continue;
    }

    await EventModel.create(row);
    created++;
  }

  console.log(`[import] Événements : ${created} créés, ${doublons} doublons ignorés, ${errors.length} lignes ignorées`);
  res.json({ ok: true, created, doublons, errors, total: rows.length });
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

  const { rows, errors } = parseUsersCsv(req.file.buffer.toString('utf-8'));

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
});

/** Exporte tous les utilisateurs (sans mot de passe) au format CSV. */
importRouter.get('/utilisateurs/export', requireAdmin, async (_req, res) => {
  const users = await UserModel.find({}).sort({ nom: 1 }).lean();
  const csv = stringifyUsersCsv(users);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="utilisateurs.csv"');
  res.send(csv);
});
