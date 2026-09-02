# Ce projet utilise les workspaces npm (un seul package-lock.json à la racine
# pour client/ et server/), donc `npm ci` doit être lancé depuis la racine.

# --- Étape 1 : installe toutes les dépendances + build client et serveur ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci
COPY client ./client
COPY server ./server
RUN npm run build

# --- Étape 2 : image finale, avec uniquement les dépendances de production du serveur ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev --workspace=server
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY data ./data

WORKDIR /app/server
EXPOSE 4000
CMD ["node", "dist/index.js"]
