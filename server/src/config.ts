import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/dk_calendar'),
  jwtSecret: required('JWT_SECRET', 'changez-moi-en-production-secret-dev-uniquement'),
  cookieName: 'dk_session',
  isProduction: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};
