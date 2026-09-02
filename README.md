# 📅 Calendrier Événements Dunkerque

Reconstruction en application web **autonome** (indépendante de monday.com) de l'app d'origine, à partir de l'export
`reference-vibe-export/` (qui reste dans le dépôt comme référence pour les fonctionnalités non encore reconstruites).

- **Backend** : Node.js + Express + TypeScript, base de données **MongoDB** (Mongoose)
- **Frontend** : React + Vite + TypeScript + Tailwind CSS
- **Auth** : comptes Administrateur / Consultant, mot de passe haché (PBKDF2 + sel), session via cookie JWT
- **Données** : deux fichiers CSV (`data/evenements.csv`, `data/utilisateurs.csv`) servent de **base d'import/seed**

## Périmètre actuel (MVP)

Implémenté :
- Connexion / création du premier compte administrateur
- Gestion des comptes (créer, suspendre/activer, réinitialiser le mot de passe) — administrateurs uniquement
- Vue **Calendrier** mensuelle avec pastilles de validation et archivage automatique des événements passés
- Vue **Liste** avec filtres (quartier, statut, recherche), validations en un clic
- **Import / export CSV** des événements et des utilisateurs

Volontairement laissé pour une itération suivante (voir `reference-vibe-export/` pour la logique d'origine) :
- Vue Carte / géocodage, Vue Conflits, export PDF, demandes d'accès en libre-service, journal d'audit détaillé
- Envoi d'e-mails réel (pour l'instant, les mots de passe temporaires sont **affichés dans les logs serveur**, jamais envoyés)

## Arborescence

```
data/                  CSV de base (source d'import/seed) pour événements et utilisateurs
server/                API Express + MongoDB (Mongoose)
client/                Frontend React (Vite)
reference-vibe-export/ Ancien export monday Vibe, conservé comme référence fonctionnelle
Dockerfile             Image de production (build client + serveur en une seule image)
docker-compose.yml     Mongo + app pour un test local "à la prod"
```

## Installation locale

Prérequis : Node.js ≥ 20, et soit MongoDB local (via Docker), soit un cluster MongoDB Atlas gratuit.

```bash
npm install                       # installe client + serveur (workspaces npm)
cp server/.env.example server/.env
```

### Option A — MongoDB local via Docker

```bash
docker run -d --name mongo-dk -p 27017:27017 mongo:7
```

`MONGODB_URI` par défaut dans `.env` (`mongodb://127.0.0.1:27017/dk_calendar`) fonctionne tel quel.

### Option B — MongoDB Atlas (gratuit)

1. Créez un cluster gratuit **M0** sur https://www.mongodb.com/cloud/atlas/register
2. Récupérez l'URI de connexion (`mongodb+srv://...`) et collez-la dans `server/.env` → `MONGODB_URI`

### Peupler la base depuis les CSV

```bash
npm run seed
```

Relit `data/evenements.csv` et `data/utilisateurs.csv` et fait un *upsert* dans MongoDB. Les mots de passe
temporaires générés (si non fournis dans le CSV) sont affichés dans la console — notez-les.

⚠️ Le CSV `data/utilisateurs.csv` fourni contient des **comptes d'exemple** (`admin@dunkerque.example` /
`ChangezMoi123!`). Remplacez-les par vos vrais comptes avant un usage réel, ou passez directement par l'écran de
connexion (bouton "Créer le compte administrateur" au premier lancement) puis créez les autres comptes depuis
l'écran **Comptes**.

### Lancer en développement

```bash
npm run dev
```

- Frontend : http://localhost:5173 (hot-reload)
- Backend : http://localhost:4000/api

### Build de production (test local)

```bash
npm run build
npm start          # sert le client buildé + l'API sur http://localhost:4000
```

### Avec Docker (image de production, en local)

```bash
docker compose up --build
```

Démarre un MongoDB local + l'application buildée sur http://localhost:4000.

## Déploiement web — option la moins chère

**Base de données : MongoDB Atlas, palier gratuit M0 (0 €, 512 Mo)** — largement suffisant pour ce volume de données.

**Hébergement de l'application (choisir un seul, tous compatibles avec le `Dockerfile` fourni) :**

| Hébergeur | Coût indicatif | Remarque |
|---|---|---|
| **Fly.io** | Gratuit à ~2 $/mois pour une petite VM | Recommandé : `fly launch` détecte le Dockerfile automatiquement |
| **Render** | Gratuit (le service "s'endort" après inactivité) ou 7 $/mois pour rester toujours actif | Déploiement Docker direct depuis le dépôt Git |
| Railway | Palier gratuit limité puis à l'usage | Simple, mais moins prévisible en coût |
| VPS (OVH, Hetzner...) | ~4-5 $/mois | Le plus de contrôle, nécessite de gérer soi-même le serveur |

Étapes générales, quel que soit l'hébergeur :

1. Créez le cluster Atlas gratuit et récupérez son URI de connexion
2. Configurez les variables d'environnement sur l'hébergeur :
   - `MONGODB_URI` = URI Atlas
   - `JWT_SECRET` = valeur aléatoire (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `CLIENT_ORIGIN` = l'URL publique de l'app (le frontend est servi par le même serveur, donc généralement identique)
   - `PORT` = celui imposé par l'hébergeur (souvent injecté automatiquement)
   - `NODE_ENV` = `production`
3. Déployez l'image construite par le `Dockerfile` (la plupart des hébergeurs ci-dessus le détectent automatiquement)
4. Lancez `npm run seed` une fois (en local, pointé vers l'URI Atlas de prod, ou via un job ponctuel sur l'hébergeur) pour peupler la base, ou créez le compte administrateur directement depuis l'écran de connexion

## Sécurité — points à connaître avant une mise en production réelle

- Changez `JWT_SECRET` (ne gardez jamais la valeur par défaut du `.env.example`)
- Les mots de passe temporaires (création de compte, réinitialisation, import CSV) sont pour l'instant **affichés
  dans les logs serveur** au lieu d'être envoyés par e-mail — pensez à brancher un vrai service d'envoi
  (Resend, SendGrid...) avant un usage avec des utilisateurs externes
- `data/utilisateurs.csv` ne doit **jamais** contenir de vrais mots de passe en clair une fois committé dans un
  dépôt partagé — utilisez-le uniquement comme modèle, ou gardez la version réelle hors du contrôle de version
