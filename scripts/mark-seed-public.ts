/**
 * One-time migration: Mark all existing documents as public seed content.
 *
 * Run with: npx tsx scripts/mark-seed-public.ts
 *
 * Requires MONGODB_URI in .env.local
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';

// Load .env.local manually (no dotenv dependency needed)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local not found, rely on env vars */ }

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Add it to .env.local');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGODB_URI!);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('No database connection');
    process.exit(1);
  }

  const collections = ['bugreports', 'testcases', 'promptlibraries', 'insights'];

  for (const name of collections) {
    const collection = db.collection(name);
    const result = await collection.updateMany(
      { is_public: { $ne: true } },
      { $set: { is_public: true } }
    );
    console.log(`${name}: marked ${result.modifiedCount} documents as public`);
  }

  await mongoose.disconnect();
  console.log('Done. All existing content is now public seed data.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
