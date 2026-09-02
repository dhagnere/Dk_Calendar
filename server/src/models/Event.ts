import { Schema, model, type InferSchemaType } from 'mongoose';

const eventSchema = new Schema(
  {
    eventId: { type: String, index: true }, // identifiant lisible, ex: EVT-2026-0001
    nom: { type: String, required: true, index: true },
    dateDeDebut: { type: Date, default: null },
    dateDeFin: { type: Date, default: null },
    lieu: { type: String, default: '' },
    quartier: { type: String, default: '' },
    pilote: { type: String, default: '' },
    directionPilote: { type: String, default: '' },
    organisateur: { type: String, default: '' },
    nature: { type: String, default: '' },
    niveau: { type: String, default: '' },
    type: { type: String, default: '' },
    statut: { type: String, default: 'Brouillon' },
    tardive: { type: String, default: 'Non' },
    reprog: { type: String, default: 'Non' },
    validationTechnique: { type: Boolean, default: false },
    validationPolitique: { type: Boolean, default: false },
    validParDateClef: { type: Boolean, default: false },
    statutDimport: { type: String, default: '' },
  },
  { timestamps: true }
);

eventSchema.index({ quartier: 1 });
eventSchema.index({ statut: 1 });
eventSchema.index({ nature: 1 });
eventSchema.index({ dateDeDebut: 1 });

export type EventDoc = InferSchemaType<typeof eventSchema>;
export const EventModel = model('Event', eventSchema);
