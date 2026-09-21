# Déploiement en production sur les serveurs de la CUD

Procédure complète pour faire tourner l'application sur l'infrastructure de la Communauté urbaine
de Dunkerque (CUD), avec reprise des données réelles actuelles, puis pour continuer à faire évoluer
l'application ensuite sans jamais toucher directement au serveur de production.

Sommaire :
1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis côté serveur CUD](#2-prérequis-côté-serveur-cud)
3. [Récupérer le code](#3-récupérer-le-code)
4. [Configurer les variables d'environnement](#4-configurer-les-variables-denvironnement)
5. [Construire et démarrer l'application](#5-construire-et-démarrer-lapplication)
6. [Peupler la base de données](#6-peupler-la-base-de-données)
7. [Exposer l'application publiquement (HTTPS)](#7-exposer-lapplication-publiquement-https)
8. [Vérifications post-déploiement](#8-vérifications-post-déploiement)
9. [Sauvegardes en production](#9-sauvegardes-en-production)
10. [Sécurité — à valider avant l'ouverture réelle](#10-sécurité--à-valider-avant-louverture-réelle)
11. [Continuer à développer après le passage en prod](#11-continuer-à-développer-après-le-passage-en-prod)
12. [Procédure de mise à jour de l'application en production](#12-procédure-de-mise-à-jour-de-lapplication-en-production)
13. [Annexe — récapitulatif des variables d'environnement](#13-annexe--récapitulatif-des-variables-denvironnement)

---

## 1. Vue d'ensemble

L'application est une seule image Docker (frontend React buildé + API Express, servis ensemble)
plus une base **MongoDB**. Tout est déjà décrit dans le `Dockerfile` du dépôt ; ce document ajoute
un fichier `docker-compose.prod.yml` (Mongo + app, pensé pour un vrai serveur, contrairement à
`docker-compose.yml` qui ne sert qu'à un test local rapide) et détaille chaque étape.

Le principe général :

```
Dépôt Git (GitHub) ──clone/pull──▶ Serveur CUD ──docker compose build/up──▶ Conteneurs (app + mongo)
                                                                                  │
                                                                          reverse proxy HTTPS
                                                                                  │
                                                                            Utilisateurs CUD
```

## 2. Prérequis côté serveur CUD

- Un serveur Linux (VM ou physique) avec **Docker** et **Docker Compose v2** installés
  (`docker compose version` doit fonctionner). C'est la seule dépendance système nécessaire : ni
  Node.js, ni MongoDB à installer à la main, tout est dans les conteneurs.
- Un nom de domaine (ou sous-domaine) pointant vers ce serveur, et la possibilité d'obtenir un
  certificat HTTPS (Let's Encrypt via le reverse proxy déjà en place à la CUD, ou `certbot`).
- Un accès réseau sortant vers `github.com` (pour cloner/mettre à jour le dépôt) et, uniquement le
  temps de la reprise des données (étape 6), vers la base actuelle (Atlas).
- Si le service HTTP/HTTPS de la CUD est mutualisé (reverse proxy central, pare-feu géré par une
  équipe infra dédiée), coordonnez avec elle pour l'étape 7 — ce document décrit la configuration
  côté application, pas la politique réseau interne de la CUD.

> Si l'équipe infra de la CUD préfère un autre outil que Docker Compose (Kubernetes, Portainer,
> leur propre CI/CD…), le même `Dockerfile` reste utilisable tel quel : il suffit de leur fournir
> une base MongoDB joignable et les variables d'environnement de la section 4 — l'image ne suppose
> rien d'autre sur la façon dont elle est orchestrée.

## 3. Récupérer le code

```bash
git clone https://github.com/dhagnere/Dk_Calendar.git
cd Dk_Calendar
git checkout main        # voir §11 : la branche suivie par la prod, distincte de la branche de dev
```

> À ce stade, si aucune branche `main` stable n'existe encore (tout le développement s'est fait
> jusqu'ici sur une seule branche), voir la section 11 pour la mettre en place avant ce premier
> déploiement — c'est le bon moment pour figer « ce qui part en prod » séparément de « ce qui
> continue à évoluer ».

## 4. Configurer les variables d'environnement

```bash
cp .env.prod.example .env
```

Éditez `.env` et renseignez au minimum `JWT_SECRET`, `CLIENT_ORIGIN` et `APP_URL` (voir le détail de
chaque variable en annexe, §13, et les commentaires dans `.env.prod.example`). Ce fichier `.env` (à
la racine, pas dans `server/`) reste local au serveur, n'est jamais commité (`.gitignore`), et est
lu automatiquement par `docker-compose.prod.yml`.

## 5. Construire et démarrer l'application

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs -f app   # Ctrl+C pour sortir une fois "En écoute sur..." affiché
```

À ce stade l'application tourne mais la base est vide (aucun événement, aucun compte) : passez à
l'étape suivante avant d'y accéder.

## 6. Peupler la base de données

Deux options, selon ce que vous voulez reprendre :

### Option A (recommandée) — reprise intégrale des données réelles actuelles

Conserve tout : les ~14 700 événements avec leurs statuts/validations/géolocalisation actuels, les
comptes existants, l'historique du journal d'audit, et les sauvegardes automatiques déjà
constituées. C'est un dump/restore MongoDB classique depuis l'environnement de dev/démo actuel
(Render + MongoDB Atlas) vers le Mongo du serveur CUD.

1. Sur une machine ayant accès réseau à la base actuelle (Atlas), installez les
   [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) (`mongodump` /
   `mongorestore`) — pas besoin d'installer MongoDB en entier, juste ces deux outils.
2. Récupérez l'URI de connexion Atlas actuelle (celle utilisée par `MONGODB_URI` sur l'hébergeur
   actuel), puis faites le dump :
   ```bash
   mongodump --uri="mongodb+srv://<utilisateur>:<mot-de-passe>@<cluster>.mongodb.net/dk_calendar" \
     --archive=dk_calendar.dump --gzip
   ```
3. Transférez le fichier `dk_calendar.dump` obtenu vers le serveur CUD (`scp`, ou tout autre moyen
   sécurisé habituel de la CUD).
4. Sur le serveur CUD, exposez temporairement Mongo en local uniquement (jamais publiquement) pour
   pouvoir s'y connecter avec `mongorestore` : ajoutez `ports: ["127.0.0.1:27017:27017"]` au service
   `mongo` de `docker-compose.prod.yml` (voir le commentaire déjà présent dans ce fichier), puis :
   ```bash
   docker compose -f docker-compose.prod.yml up -d mongo
   mongorestore --uri="mongodb://127.0.0.1:27017/dk_calendar" --archive=dk_calendar.dump --gzip --drop
   ```
   `--drop` supprime les collections existantes avant restauration (sans risque ici puisque la base
   du serveur CUD vient d'être créée et est vide).
5. **Retirez la ligne `ports:` ajoutée à l'étape précédente** dans `docker-compose.prod.yml` (remise
   à l'état d'origine, sans port publié), puis relancez :
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
6. Les comptes existants sont repris tels quels (mêmes emails, mêmes mots de passe déjà définis) —
   rien de plus à faire côté comptes.

### Option B — reconstruction propre depuis les CSV

Plus simple, mais ne reprend **que** les événements et les comptes (pas le journal d'audit ni les
sauvegardes historiques) : à réserver à un environnement neuf sans historique à conserver, ou en
secours si l'option A n'est pas possible.

`data/evenements.csv`, dans le dépôt, est tenu à jour automatiquement (synchronisation GitHub après
chaque import — voir §11) : il reflète donc déjà l'état réel actuel des événements, sans besoin
d'accès à Atlas. En revanche `data/utilisateurs.csv` ne contient que des **comptes d'exemple** —
ne jamais les utiliser tels quels en production réelle.

```bash
docker compose -f docker-compose.prod.yml exec app node dist/seed.js
```

Puis, depuis l'écran de connexion de l'application, cliquez sur « Créer le compte administrateur »
pour créer le ou les vrais premiers comptes (jamais les comptes d'exemple du CSV), et créez les
autres comptes ensuite depuis l'écran **Comptes**.

## 7. Exposer l'application publiquement (HTTPS)

L'application écoute en HTTP sur le port `4000` du conteneur (publié sur le serveur via
`docker-compose.prod.yml`). Un reverse proxy doit se charger du HTTPS et rediriger vers ce port —
utilisez celui déjà en place à la CUD si l'infrastructure en a un, sinon un exemple minimal avec
Caddy (gère le certificat Let's Encrypt automatiquement) :

```
calendrier.dunkerque-agglo.fr {
    reverse_proxy localhost:4000
}
```

Quel que soit le reverse proxy utilisé, vérifiez que `CLIENT_ORIGIN` et `APP_URL` dans `.env`
(étape 4) correspondent exactement à cette URL publique HTTPS finale, puis redémarrez :
`docker compose -f docker-compose.prod.yml up -d app` si vous les changez après coup.

## 8. Vérifications post-déploiement

- `curl https://<domaine>/api/health` répond `{"ok":true}`
- Connexion avec un vrai compte administrateur fonctionne
- **Calendrier** et **Liste** affichent bien les événements repris à l'étape 6
- **Carte** : les événements déjà géolocalisés affichent leurs marqueurs (le géocodage ne se
  relance pas tout seul, il faudra le déclencher pour tout nouvel événement sans lieu connu)
- **Journal** : si l'option A a été utilisée, l'historique antérieur apparaît bien
- Un import CSV de test (option Consultant → Administrateur) se déroule sans erreur
- La sauvegarde automatique quotidienne se déclenche (visible dans l'onglet **Sauvegardes** après
  24h, ou immédiatement via le bouton de sauvegarde manuelle)

## 9. Sauvegardes en production

Deux mécanismes complémentaires, à garder tous les deux :

- **Applicative** (déjà intégrée) : une sauvegarde JSON (événements + comptes) est prise
  automatiquement chaque jour, et avant chaque import/fusion/restauration, consultable et
  téléchargeable depuis l'onglet **Sauvegardes** (30 dernières conservées). Bonne pour un rollback
  rapide depuis l'interface, mais ne couvre pas le journal d'audit ni les demandes d'accès.
- **Infrastructure** (à mettre en place côté CUD, hors périmètre applicatif) : un `mongodump`
  périodique (cron) du volume `mongo_data`, exporté hors du serveur — c'est la seule protection
  contre la perte du serveur lui-même (disque défaillant, suppression accidentelle du volume…). Ce
  sont exactement les mêmes commandes qu'à l'étape 6 (`mongodump --uri="mongodb://127.0.0.1:27017/dk_calendar" ...`),
  à automatiser et stocker ailleurs que sur ce même serveur.

## 10. Sécurité — à valider avant l'ouverture réelle

- `JWT_SECRET` : une vraie valeur aléatoire propre à cet environnement (jamais celle d'un
  `.env.example`, jamais réutilisée d'un autre environnement)
- Le port Mongo (27017) n'est **jamais** publié sur une interface publique — voir la note dans
  `docker-compose.prod.yml` (uniquement `127.0.0.1:27017` le temps ponctuel d'un dump/restore,
  jamais `27017:27017` seul)
- SMTP configuré avec de vraies informations d'envoi (sinon les emails de notification restent
  seulement dans les logs du conteneur — acceptable pour une recette interne, pas pour une ouverture
  à de vrais utilisateurs externes)
- Les mots de passe temporaires (création de compte, réinitialisation, import CSV) sont pour
  l'instant **affichés dans les logs serveur** plutôt qu'envoyés par email — à garder en tête tant
  que ce point n'a pas été étendu
- `GITHUB_TOKEN` laissé **vide** sur ce serveur (voir §11) : ne configurez jamais ici le jeton de
  synchronisation GitHub utilisé côté dev
- `.env` (à la racine, celui du §4) ne doit jamais être commité ni partagé en clair — il est déjà
  couvert par `.gitignore`

## 11. Continuer à développer après le passage en prod

Le point important : **le serveur de la CUD ne doit jamais être l'endroit où l'on développe**. Deux
environnements distincts, avec un rôle clair pour chacun :

| | Environnement de développement (actuel) | Production CUD |
|---|---|---|
| Où | Hébergeur actuel (Render) + MongoDB Atlas gratuit | Serveurs de la CUD (ce document) |
| Données | Import de test, ou copie ponctuelle | Vraies données, vrais utilisateurs |
| Branche Git | branche de dev / branches de fonctionnalité | `main` (ou `production`) |
| Mise à jour | à chaque commit (déploiement continu de l'hébergeur actuel) | seulement quand décidé (§12) |
| `GITHUB_TOKEN` | activé (tient `data/evenements.csv` à jour dans le dépôt) | vide |

Workflow recommandé pour ajouter une nouvelle fonctionnalité une fois la prod CUD en place :

1. Développez et testez normalement sur l'environnement de dev actuel (comme aujourd'hui), sur une
   branche de fonctionnalité ou directement sur la branche de dev.
2. Une fois la fonctionnalité validée, fusionnez-la dans `main` (Pull Request sur GitHub, ou merge
   direct selon votre préférence) — `main` représente à tout moment « ce qui est prêt à partir en
   prod », pas forcément « ce qui tourne déjà en prod ».
3. Quand vous décidez de faire monter la version en prod, appliquez la procédure de mise à jour
   (§12) sur le serveur CUD. Rien ne s'y déploie automatiquement entre-temps : la CUD ne reçoit une
   nouvelle version que lorsque vous lancez vous-même cette procédure.

Si `main` n'existe pas encore au moment du premier déploiement (tout s'est fait sur une seule
branche jusqu'ici), créez-la à partir de l'état actuellement validé :

```bash
git checkout -b main <branche-de-dev-actuelle>
git push -u origin main
```

Puis continuez le développement quotidien sur la branche de dev (ou de nouvelles branches de
fonctionnalité), en ne fusionnant vers `main` que ce qui est prêt pour la CUD.

## 12. Procédure de mise à jour de l'application en production

Une fois une nouvelle version validée et fusionnée dans `main` (§11), sur le serveur CUD :

```bash
cd /chemin/vers/Dk_Calendar
git fetch origin
git checkout main
git merge origin/main
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
docker compose -f docker-compose.prod.yml logs -f app   # vérifie le redémarrage
```

- Mongo n'est pas touché (`up -d app` ne redémarre que le service applicatif) : aucune donnée
  n'est perdue lors d'une mise à jour.
- Pas besoin de relancer le seed (§6) à chaque mise à jour — il ne sert qu'à l'installation
  initiale, ou à une reconstruction volontaire.
- Interruption de service : quelques secondes (le temps du redémarrage du conteneur `app`), sans
  action des utilisateurs à prévoir.

**Revenir en arrière** si une mise à jour pose problème : revenir au commit/tag précédent puis
répéter les deux commandes `build`/`up` :

```bash
git checkout <commit-ou-tag-précédent>
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
```

Combiné aux sauvegardes applicatives (§9), qui permettent de restaurer les données si la version
précédente attendait un format de données différent.

> Conseil : taguez chaque version qui part réellement en prod (`git tag v1.1.0 && git push --tags`
> sur `main` juste après le merge) — un rollback devient alors un simple
> `git checkout v1.0.0` plutôt que devoir retrouver le bon commit.

## 13. Annexe — récapitulatif des variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `MONGODB_URI` | Oui (déjà fixée dans `docker-compose.prod.yml`) | Connexion MongoDB |
| `JWT_SECRET` | Oui | Signature des sessions — valeur aléatoire propre à cet environnement |
| `PORT` | Oui (déjà fixée dans `docker-compose.prod.yml`) | Port d'écoute interne du conteneur |
| `CLIENT_ORIGIN` | Oui | URL publique HTTPS (CORS + cookies de session) |
| `APP_URL` | Oui | URL publique HTTPS (liens dans les emails) — identique à `CLIENT_ORIGIN` |
| `NODE_ENV` | Oui (déjà fixée dans `docker-compose.prod.yml`) | `production` |
| `SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASS` | Non | Envoi réel des emails de notification (sinon : logs uniquement) |
| `EMAIL_FROM` | Non | Adresse expéditeur affichée dans les emails |
| `ADMIN_NOTIFICATION_EMAIL` | Non | Notifier une adresse fixe plutôt que tous les administrateurs |
| `GITHUB_TOKEN`/`REPO`/`BRANCH`/`CHEMIN_EVENEMENTS` | Non — **à laisser vide en prod CUD** | Synchronisation `data/evenements.csv` vers GitHub (dev uniquement, voir §11) |

Détail de chaque variable et exemples de valeurs : `.env.prod.example` à la racine du dépôt.
