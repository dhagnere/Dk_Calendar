import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Journal d'audit : une ligne par action significative effectuée par un compte (connexion,
 * suppression, validation, import, etc.), pour la traçabilité de « qui a fait quoi et quand ».
 * L'identité de l'utilisateur (nom/email) est dupliquée ici plutôt que référencée par identifiant
 * seul, pour que l'entrée reste lisible même si le compte est supprimé par la suite.
 */
const journalActionSchema = new Schema(
  {
    utilisateurId: { type: String, default: null },
    utilisateurNom: { type: String, default: '' },
    utilisateurEmail: { type: String, default: '' },
    // Type d'action, ex. 'connexion', 'suppression_evenement', 'import_evenements'…
    action: { type: String, required: true },
    // Description courte de l'élément concerné (nom de l'événement, email du compte, etc.).
    cible: { type: String, default: '' },
    // Détails complémentaires libres (ex. anciennes/nouvelles valeurs), affichés au survol.
    details: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

journalActionSchema.index({ createdAt: -1 });
journalActionSchema.index({ utilisateurEmail: 1 });
journalActionSchema.index({ action: 1 });

export type JournalActionDoc = InferSchemaType<typeof journalActionSchema>;
export const JournalActionModel = model('JournalAction', journalActionSchema);
