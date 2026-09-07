import { EventModel } from '../models/Event.js';
import { UserModel } from '../models/User.js';
import { BackupModel } from '../models/Backup.js';

export type TypeSauvegarde =
  | 'quotidienne'
  | 'manuelle'
  | 'avant-import-evenements'
  | 'avant-import-utilisateurs'
  | 'avant-restauration';

/** Nombre de sauvegardes conservées : les plus anciennes au-delà sont purgées à chaque création. */
const RETENTION = 30;

/** Capture l'état actuel des événements et utilisateurs dans une nouvelle sauvegarde. */
export async function creerSauvegarde(type: TypeSauvegarde): Promise<void> {
  const [evenements, utilisateurs] = await Promise.all([EventModel.find({}).lean(), UserModel.find({}).lean()]);

  await BackupModel.create({
    type,
    nombreEvenements: evenements.length,
    nombreUtilisateurs: utilisateurs.length,
    evenements,
    utilisateurs,
  });

  const excedent = await BackupModel.find({}, { _id: 1 }).sort({ createdAt: -1 }).skip(RETENTION).lean();
  if (excedent.length > 0) {
    await BackupModel.deleteMany({ _id: { $in: excedent.map((b) => b._id) } });
  }
}

const UNE_HEURE_MS = 60 * 60 * 1000;

/**
 * Démarre la sauvegarde automatique quotidienne : vérifie toutes les heures (résiste ainsi aux
 * redémarrages du serveur) si une sauvegarde de type 'quotidienne' existe déjà pour la journée en
 * cours, et en crée une sinon.
 */
export function demarrerSauvegardeQuotidienne(): void {
  const verifier = async () => {
    try {
      const debutAujourdhui = new Date();
      debutAujourdhui.setHours(0, 0, 0, 0);
      const dejaFaite = await BackupModel.exists({ type: 'quotidienne', createdAt: { $gte: debutAujourdhui } });
      if (!dejaFaite) {
        await creerSauvegarde('quotidienne');
        console.log('[backup] Sauvegarde quotidienne créée');
      }
    } catch (err) {
      console.error('[backup] Échec de la sauvegarde quotidienne :', err);
    }
  };

  verifier();
  setInterval(verifier, UNE_HEURE_MS);
}
