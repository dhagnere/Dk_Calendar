import { Schema, model, type InferSchemaType } from 'mongoose';

const accessRequestSchema = new Schema(
  {
    nom: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    organisation: { type: String, default: '' },
    motif: { type: String, default: '' },
    statut: { type: String, enum: ['En attente', 'Approuvée', 'Rejetée'], default: 'En attente' },
    motifRejet: { type: String, default: '' },
  },
  { timestamps: true }
);

export type AccessRequestDoc = InferSchemaType<typeof accessRequestSchema>;
export const AccessRequestModel = model('AccessRequest', accessRequestSchema);
