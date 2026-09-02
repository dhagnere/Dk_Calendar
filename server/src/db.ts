import mongoose from 'mongoose';
import { config } from './config.js';

let connected = false;

export async function connectDb(): Promise<void> {
  if (connected) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  connected = true;
  console.log(`[db] Connecté à MongoDB (${config.mongoUri.replace(/\/\/.*@/, '//***@')})`);
}
