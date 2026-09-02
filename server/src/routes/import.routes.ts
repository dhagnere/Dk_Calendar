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
 * Importe (upsert) des événements depuis un fichier CSV. Un événement de plusieurs jours a une
 * ligne par jour occupé (même nom, même dateDeDebut/dateDeFin, mais dateClef différente) : l'upsert
 * se fait donc par eventId si présent, sinon par (nom, dateClef) pour ne pas écraser les autres jours.
 */
importRouter.post('/evenements', requireAdmin, upload.single('fichier'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, message: 'Aucun fichier reçu' });
    return;
  }

  const { rows, errors } = parseEventsCsv(req.file.buffer.toString('utf-8'));

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const filter = row.eventId ? { eventId: row.eventId } : { nom: row.nom, dateClef: row.dateClef };
    const result = await EventModel.updateOne(filter, { $set: row }, { upsert: true });
    if (result.upsertedCount > 0) created++;
    else updated++;
  }

  console.log(`[import] Événements : ${created} créés, ${updated} mis à jour, ${errors.length} lignes ignorées`);
  res.json({ ok: true, created, updated, errors, total: rows.length });
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
