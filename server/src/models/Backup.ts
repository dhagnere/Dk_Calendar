import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Instantané complet des événements et utilisateurs à un instant donné, pour permettre un retour
 * en arrière (rollback) en cas de problème — notamment après un import CSV. Le disque de l'hébergeur
 * (Render) étant éphémère, les sauvegardes sont stockées directement dans MongoDB plutôt que sur
 * disque, afin de survivre aux redéploiements.
 */
const backupSchema = new Schema(
  {
    // 'quotidienne' (créée automatiquement une fois par jour), 'manuelle' (déclenchée par un admin),
    // 'avant-import-evenements' / 'avant-import-utilisateurs' (juste avant un import CSV),
    // 'avant-restauration' (filet de sécurité créé juste avant d'écraser les données lors d'un rollback).
    type: { type: String, required: true },
    nombreEvenements: { type: Number, required: true },
    nombreUtilisateurs: { type: Number, required: true },
    evenements: { type: Schema.Types.Mixed, required: true },
    utilisateurs: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

backupSchema.index({ createdAt: -1 });

export type BackupDoc = InferSchemaType<typeof backupSchema>;
export const BackupModel = model('Backup', backupSchema);
