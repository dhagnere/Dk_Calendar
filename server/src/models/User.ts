import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ['Administrateur', 'Consultant'], required: true },
    statut: { type: String, default: 'Actif' }, // Actif | Suspendu | Mot de passe à définir
    hash: { type: String, required: true }, // empreinte PBKDF2
    sel: { type: String, required: true },
    derniereConnexion: { type: Date, default: null },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
