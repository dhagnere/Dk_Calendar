import { Router } from 'express';
import { BackupModel } from '../models/Backup.js';
import { EventModel } from '../models/Event.js';
import { UserModel } from '../models/User.js';
import { requireAdmin } from '../middleware/auth.js';
import { creerSauvegarde } from '../lib/backup.js';

export const backupsRouter = Router();

// Les sauvegardes exposent l'intégralité des données (y compris les empreintes de mots de passe des
// comptes) : réservé aux administrateurs.
backupsRouter.use(requireAdmin);

/** Liste les sauvegardes (métadonnées seulement, sans le contenu). */
backupsRouter.get('/', async (_req, res) => {
  const sauvegardes = await BackupModel.find({}, { evenements: 0, utilisateurs: 0 }).sort({ createdAt: -1 }).lean();
  res.json({ sauvegardes });
});

/** Déclenche une sauvegarde manuelle immédiate. */
backupsRouter.post('/', async (_req, res) => {
  await creerSauvegarde('manuelle');
  res.json({ ok: true, message: 'Sauvegarde créée' });
});

/** Télécharge le contenu complet d'une sauvegarde au format JSON. */
backupsRouter.get('/:id/export', async (req, res) => {
  const sauvegarde = await BackupModel.findById(req.params.id).lean();
  if (!sauvegarde) {
    res.status(404).json({ ok: false, message: 'Sauvegarde introuvable' });
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sauvegarde-${sauvegarde._id}.json"`);
  res.send(JSON.stringify(sauvegarde, null, 2));
});

/**
 * Restaure les événements et utilisateurs tels qu'ils étaient au moment de cette sauvegarde,
 * remplaçant entièrement les données actuelles. Une sauvegarde de sécurité de l'état actuel est
 * créée juste avant, pour permettre d'annuler la restauration elle-même si besoin.
 */
backupsRouter.post('/:id/restaurer', async (req, res) => {
  const sauvegarde = await BackupModel.findById(req.params.id).lean();
  if (!sauvegarde) {
    res.status(404).json({ ok: false, message: 'Sauvegarde introuvable' });
    return;
  }

  await creerSauvegarde('avant-restauration');

  await EventModel.deleteMany({});
  if (sauvegarde.evenements.length > 0) await EventModel.insertMany(sauvegarde.evenements);

  await UserModel.deleteMany({});
  if (sauvegarde.utilisateurs.length > 0) await UserModel.insertMany(sauvegarde.utilisateurs);

  console.log(
    `[backup] Restauration depuis la sauvegarde ${sauvegarde._id} (${sauvegarde.evenements.length} événements, ${sauvegarde.utilisateurs.length} utilisateurs)`
  );
  res.json({ ok: true, message: 'Restauration effectuée' });
});
