# 📅 Calendrier Événements Dunkerque

Reconstruction en application web **autonome** (indépendante de monday.com) de l'app d'origine, à partir de l'export
`reference-vibe-export/` (qui reste dans le dépôt comme référence historique).

- **Backend** : Node.js + Express + TypeScript, base de données **MongoDB** (Mongoose)
- **Frontend** : React + Vite + TypeScript + Ant Design
- **Auth** : comptes Administrateur / Consultant, mot de passe haché (PBKDF2 + sel), session via cookie JWT
- **Données** : deux fichiers CSV (`data/evenements.csv`, `data/utilisateurs.csv`) servent de **base d'import/seed** —
  `evenements.csv` est tenu à jour automatiquement (voir section Synchronisation GitHub ci-dessous)

> **Déployer sur les serveurs de la CUD ?** Voir [`docs/DEPLOIEMENT-CUD.md`](docs/DEPLOIEMENT-CUD.md) : procédure
> complète pas à pas (reprise des données réelles actuelles, HTTPS, sauvegardes, sécurité, et comment continuer à
> développer de nouvelles fonctionnalités sans jamais toucher directement au serveur de production).

## Fonctionnalités

- Connexion / création du premier compte administrateur
- Gestion des comptes (créer, suspendre/activer, réinitialiser le mot de passe) — administrateurs uniquement
- **Demande d'accès en libre-service** : un utilisateur sans compte peut en demander un depuis l'écran de connexion ;
  un **vrai email** est envoyé aux administrateurs actifs à chaque nouvelle demande (voir section Emails ci-dessous) ;
  l'admin approuve (en choisissant le rôle) ou rejette depuis l'écran **Demandes d'accès**
- Séparation stricte des fonctions Administrateur / Consultant : les pages et routes API réservées aux
  administrateurs redirigent/rejettent explicitement les Consultants (pas seulement masquées dans le menu)
- Vue **Calendrier** mensuelle avec pastilles de validation (validée / non validée / Date Clef / Brouillon) et
  archivage automatique des événements passés
- Vue **Liste** avec filtres (quartier, statut, nature, recherche), validations en un clic, export PDF, et une fiche
  détaillée au clic sur un événement
- Vue **Carte** (géocodage automatique des lieux) et vue **Conflits** (jours avec plusieurs événements non arbitrés)
- **Import / export CSV** des événements et des utilisateurs, avec détection et fusion des doublons
- **Journal d'audit** : historique de toutes les actions par compte (connexions, validations, imports, suppressions,
  sauvegardes…)
- **Sauvegardes** automatiques (quotidienne + avant chaque opération sensible) et restauration depuis l'interface
- **Synchronisation GitHub** : après chaque import CSV, `data/evenements.csv` est automatiquement mis à jour et
  commité dans ce dépôt (voir `server/.env.example` — désactivée tant que `GITHUB_TOKEN` n'est pas renseigné)

Volontairement laissé de côté pour l'instant :
- Envoi par email des mots de passe temporaires (création de compte, réinitialisation) — pour l'instant ils sont
  **affichés dans les logs serveur** ; seule la notification "nouvelle demande d'accès" est un email réel

## Arborescence

```
data/                    CSV de base (source d'import/seed) pour événements et utilisateurs
docs/                    Documentation complémentaire (déploiement CUD, etc.)
server/                  API Express + MongoDB (Mongoose)
client/                  Frontend React (Vite)
reference-vibe-export/   Ancien export monday Vibe, conservé comme référence fonctionnelle
Dockerfile               Image de production (build client + serveur en une seule image)
docker-compose.yml       Mongo + app pour un test local "à la prod" (dev uniquement)
docker-compose.prod.yml  Mongo + app pour un vrai serveur (voir docs/DEPLOIEMENT-CUD.md)
.env.prod.example        Modèle de configuration pour docker-compose.prod.yml
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

### Emails (notification des administrateurs)

Chaque nouvelle demande d'accès envoie un email aux administrateurs actifs. Sans configuration SMTP, l'email est
simplement affiché dans les logs serveur (pratique en développement).

Pour l'activer réellement, renseignez dans `server/.env` (voir les exemples commentés dans `server/.env.example`) :

- **Brevo** (recommandé — gratuit jusqu'à 300 emails/jour, sans carte bancaire) :
  1. Créez un compte sur https://www.brevo.com
  2. **SMTP & API → SMTP** : récupérez l'hôte (`smtp-relay.brevo.com`), le login et la clé SMTP
  3. Renseignez `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`
- **Gmail** (si vous avez déjà un compte Gmail) : activez la validation en 2 étapes puis générez un
  "mot de passe d'application" (https://myaccount.google.com/apppasswords) à utiliser comme `SMTP_PASS`

Réglez aussi `EMAIL_FROM` (adresse expéditeur) et `APP_URL` (URL publique de l'app, utilisée dans le lien de
l'email). En production (Render), ces variables se configurent dans **Environment** — voir `render.yaml`.

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

## Déploiement — environnement de dev/démo (le moins cher)

Cette section décrit l'hébergement actuel de l'environnement de **développement/démo** (utilisé pour tester chaque
nouvelle fonctionnalité avant de la proposer en production). Pour le **déploiement en production sur les serveurs de
la CUD**, avec reprise des données réelles actuelles, voir [`docs/DEPLOIEMENT-CUD.md`](docs/DEPLOIEMENT-CUD.md).

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
   - `CLIENT_ORIGIN` et `APP_URL` = l'URL publique de l'app (le frontend est servi par le même serveur, donc identiques)
   - `PORT` = celui imposé par l'hébergeur (souvent injecté automatiquement)
   - `NODE_ENV` = `production`
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` = voir section Emails ci-dessus (sans
     ces variables, les emails sont juste loggés, l'app fonctionne quand même)
3. Déployez l'image construite par le `Dockerfile` (la plupart des hébergeurs ci-dessus le détectent automatiquement)
4. Lancez `npm run seed` une fois (en local, pointé vers l'URI Atlas de prod, ou via un job ponctuel sur l'hébergeur) pour peupler la base, ou créez le compte administrateur directement depuis l'écran de connexion

## Sécurité — points à connaître avant une mise en production réelle

- Changez `JWT_SECRET` (ne gardez jamais la valeur par défaut du `.env.example`)
- Les mots de passe temporaires (création de compte, réinitialisation, import CSV) sont pour l'instant **affichés
  dans les logs serveur** au lieu d'être envoyés par e-mail (seule la notification de nouvelle demande d'accès est
  un vrai email) — pensez à étendre l'envoi réel à ces cas avant un usage avec des utilisateurs externes
- Ne commitez jamais `SMTP_PASS`/`SMTP_USER` réels dans le dépôt — utilisez `server/.env` (ignoré par git) en local,
  et les variables d'environnement de l'hébergeur en production
- `data/utilisateurs.csv` ne doit **jamais** contenir de vrais mots de passe en clair une fois committé dans un
  dépôt partagé — utilisez-le uniquement comme modèle, ou gardez la version réelle hors du contrôle de version

Pour la checklist sécurité spécifique au déploiement en production sur les serveurs de la CUD (Mongo non exposé,
`GITHUB_TOKEN` à laisser vide, etc.), voir [`docs/DEPLOIEMENT-CUD.md` §10](docs/DEPLOIEMENT-CUD.md#10-sécurité--à-valider-avant-louverture-réelle).
