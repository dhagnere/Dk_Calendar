export interface Evenement {
  _id: string;
  eventId?: string;
  nom: string;
  dateDeDebut: string | null;
  dateDeFin: string | null;
  lieu: string;
  quartier: string;
  pilote: string;
  directionPilote: string;
  organisateur: string;
  nature: string;
  niveau: string;
  type: string;
  statut: string;
  tardive: string;
  reprog: string;
  validationTechnique: boolean;
  validationPolitique: boolean;
  validParDateClef: boolean;
  statutDimport: string;
}

export interface Compte {
  _id: string;
  nom: string;
  email: string;
  role: 'Administrateur' | 'Consultant';
  statut: string;
  derniereConnexion: string | null;
}

export function estValide(e: Pick<Evenement, 'validationTechnique' | 'validationPolitique'>): boolean {
  return e.validationTechnique && e.validationPolitique;
}

export interface DemandeAcces {
  _id: string;
  nom: string;
  email: string;
  organisation: string;
  motif: string;
  statut: 'En attente' | 'Approuvée' | 'Rejetée';
  createdAt: string;
}
