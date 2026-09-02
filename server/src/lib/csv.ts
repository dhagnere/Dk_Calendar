import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

/** Colonnes du CSV des événements (correspondance directe avec le modèle Event). */
export const EVENT_CSV_COLUMNS = [
  'eventId',
  'nom',
  'dateDeDebut',
  'dateDeFin',
  'lieu',
  'quartier',
  'pilote',
  'directionPilote',
  'organisateur',
  'nature',
  'niveau',
  'type',
  'statut',
  'tardive',
  'reprog',
  'validationTechnique',
  'validationPolitique',
  'validParDateClef',
  'statutDimport',
] as const;

/** Colonnes du CSV des utilisateurs. motDePasseInitial n'est utilisé qu'à l'import (jamais réexporté). */
export const USER_CSV_COLUMNS = ['nom', 'email', 'role', 'statut', 'motDePasseInitial', 'derniereConnexion'] as const;

/** Parse une date au format JJ/MM/AAAA (format attendu par l'app d'origine). */
export function parseDateFr(value: string | undefined | null): Date | null {
  if (!value || !value.trim()) return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    // Tolère aussi le format ISO (AAAA-MM-JJ) au cas où.
    const iso = new Date(value.trim());
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const [, jour, mois, annee] = match;
  const date = new Date(Number(annee), Number(mois) - 1, Number(jour));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formate une date au format JJ/MM/AAAA pour l'export CSV. */
export function formatDateFr(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()}`;
}

export function parseBoolFr(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === 'oui' || v === 'true' || v === '1' || v === 'vrai';
}

export function formatBoolFr(value: boolean | undefined | null): string {
  return value ? 'Oui' : 'Non';
}

export interface EventCsvRow {
  eventId: string;
  nom: string;
  dateDeDebut: Date | null;
  dateDeFin: Date | null;
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

/** Parse le contenu d'un CSV d'événements en lignes typées. Une ligne sans nom est ignorée. */
export function parseEventsCsv(content: string): { rows: EventCsvRow[]; errors: string[] } {
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const rows: EventCsvRow[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const nom = record.nom?.trim();
    if (!nom) {
      errors.push(`Ligne ${index + 2} ignorée : nom manquant`);
      return;
    }
    rows.push({
      eventId: record.eventId?.trim() ?? '',
      nom,
      dateDeDebut: parseDateFr(record.dateDeDebut),
      dateDeFin: parseDateFr(record.dateDeFin),
      lieu: record.lieu?.trim() ?? '',
      quartier: record.quartier?.trim() ?? '',
      pilote: record.pilote?.trim() ?? '',
      directionPilote: record.directionPilote?.trim() ?? '',
      organisateur: record.organisateur?.trim() ?? '',
      nature: record.nature?.trim() ?? '',
      niveau: record.niveau?.trim() ?? '',
      type: record.type?.trim() ?? '',
      statut: record.statut?.trim() || 'Brouillon',
      tardive: record.tardive?.trim() || 'Non',
      reprog: record.reprog?.trim() || 'Non',
      validationTechnique: parseBoolFr(record.validationTechnique),
      validationPolitique: parseBoolFr(record.validationPolitique),
      validParDateClef: parseBoolFr(record.validParDateClef),
      statutDimport: record.statutDimport?.trim() ?? '',
    });
  });

  return { rows, errors };
}

export function stringifyEventsCsv(
  events: Array<{
    eventId?: string | null;
    nom: string;
    dateDeDebut?: Date | string | null;
    dateDeFin?: Date | string | null;
    lieu?: string | null;
    quartier?: string | null;
    pilote?: string | null;
    directionPilote?: string | null;
    organisateur?: string | null;
    nature?: string | null;
    niveau?: string | null;
    type?: string | null;
    statut?: string | null;
    tardive?: string | null;
    reprog?: string | null;
    validationTechnique?: boolean | null;
    validationPolitique?: boolean | null;
    validParDateClef?: boolean | null;
    statutDimport?: string | null;
  }>
): string {
  const rows = events.map((e) => ({
    eventId: e.eventId ?? '',
    nom: e.nom,
    dateDeDebut: formatDateFr(e.dateDeDebut ?? null),
    dateDeFin: formatDateFr(e.dateDeFin ?? null),
    lieu: e.lieu ?? '',
    quartier: e.quartier ?? '',
    pilote: e.pilote ?? '',
    directionPilote: e.directionPilote ?? '',
    organisateur: e.organisateur ?? '',
    nature: e.nature ?? '',
    niveau: e.niveau ?? '',
    type: e.type ?? '',
    statut: e.statut ?? '',
    tardive: e.tardive ?? '',
    reprog: e.reprog ?? '',
    validationTechnique: formatBoolFr(e.validationTechnique),
    validationPolitique: formatBoolFr(e.validationPolitique),
    validParDateClef: formatBoolFr(e.validParDateClef),
    statutDimport: e.statutDimport ?? '',
  }));

  return stringify(rows, { header: true, columns: [...EVENT_CSV_COLUMNS] });
}

export interface UserCsvRow {
  nom: string;
  email: string;
  role: string;
  statut: string;
  motDePasseInitial: string;
  derniereConnexion: Date | null;
}

export function parseUsersCsv(content: string): { rows: UserCsvRow[]; errors: string[] } {
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const rows: UserCsvRow[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const email = record.email?.trim().toLowerCase();
    if (!email) {
      errors.push(`Ligne ${index + 2} ignorée : email manquant`);
      return;
    }
    rows.push({
      nom: record.nom?.trim() ?? email,
      email,
      role: record.role?.trim() === 'Administrateur' ? 'Administrateur' : 'Consultant',
      statut: record.statut?.trim() || 'Actif',
      motDePasseInitial: record.motDePasseInitial?.trim() ?? '',
      derniereConnexion: parseDateFr(record.derniereConnexion),
    });
  });

  return { rows, errors };
}

export function stringifyUsersCsv(
  users: Array<{ nom: string; email: string; role: string; statut: string; derniereConnexion?: Date | string | null }>
): string {
  const rows = users.map((u) => ({
    nom: u.nom,
    email: u.email,
    role: u.role,
    statut: u.statut,
    motDePasseInitial: '',
    derniereConnexion: formatDateFr(u.derniereConnexion ?? null),
  }));
  return stringify(rows, { header: true, columns: [...USER_CSV_COLUMNS] });
}
