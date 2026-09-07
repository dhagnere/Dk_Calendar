import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { connectDb } from './db.js';
import { readSession } from './middleware/auth.js';
import { authRouter } from './routes/auth.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { accountsRouter } from './routes/accounts.routes.js';
import { importRouter } from './routes/import.routes.js';
import { accessRequestsRouter } from './routes/access-requests.routes.js';
import { backupsRouter } from './routes/backups.routes.js';
import { demarrerSauvegardeQuotidienne } from './lib/backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await connectDb();

  const app = express();
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(readSession);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/evenements', eventsRouter);
  app.use('/api/comptes', accountsRouter);
  app.use('/api/import', importRouter);
  app.use('/api/demandes-acces', accessRequestsRouter);
  app.use('/api/sauvegardes', backupsRouter);

  demarrerSauvegardeQuotidienne();

  // En production, le build du client (client/dist) est servi directement par ce serveur.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.listen(config.port, () => {
    console.log(`[server] En écoute sur http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('[server] Échec du démarrage :', err);
  process.exit(1);
});
