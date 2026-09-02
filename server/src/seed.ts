import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { connectDb } from './db.js';
import { EventModel } from './models/Event.js';
import { UserModel } from './models/User.js';
import { parseEventsCsv, parseUsersCsv } from './lib/csv.js';
import { genererHash, genererSel } from './lib/password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

async function seedEvents(): Promise<void> {
  const filePath = path.join(DATA_DIR, 'evenements.csv');
  if (!existsSync(filePath)) {
    console.log(`[seed] Fichier introuvable, ignoré : ${filePath}`);
    return;
  }

  const { rows, errors } = parseEventsCsv(readFileSync(filePath, 'utf-8'));
  errors.forEach((e) => console.warn(`[seed] ${e}`));

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const filter = row.eventId ? { eventId: row.eventId } : { nom: row.nom, dateDeDebut: row.dateDeDebut };
    const result = await EventModel.updateOne(filter, { $set: row }, { upsert: true });
    if (result.upsertedCount > 0) created++;
    else updated++;
  }
  console.log(`[seed] Événements : ${created} créés, ${updated} mis à jour (${rows.length} lignes lues)`);
}

async function seedUsers(): Promise<void> {
  const filePath = path.join(DATA_DIR, 'utilisateurs.csv');
  if (!existsSync(filePath)) {
    console.log(`[seed] Fichier introuvable, ignoré : ${filePath}`);
    return;
  }

  const { rows, errors } = parseUsersCsv(readFileSync(filePath, 'utf-8'));
  errors.forEach((e) => console.warn(`[seed] ${e}`));

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
        statut: row.motDePasseInitial ? row.statut : 'Mot de passe à définir',
        hash,
        sel,
      });
      if (!row.motDePasseInitial) motsDePasseGeneres.push({ email: row.email, motDePasse });
      created++;
    }
  }

  if (motsDePasseGeneres.length > 0) {
    console.log('[seed] Mots de passe temporaires générés (aucun fourni dans le CSV) :');
    motsDePasseGeneres.forEach(({ email, motDePasse }) => console.log(`  - ${email} : ${motDePasse}`));
  }
  console.log(`[seed] Utilisateurs : ${created} créés, ${updated} mis à jour (${rows.length} lignes lues)`);
}

async function main() {
  await connectDb();
  await seedEvents();
  await seedUsers();
  console.log('[seed] Terminé.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Échec :', err);
  process.exit(1);
});
