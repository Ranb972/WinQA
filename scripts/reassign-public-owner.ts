/**
 * One-time migration: every public library document (is_public: true) in
 * testcases, promptlibraries, insights and bugreports is moved to the
 * `system` owner, so deleting a personal account can never delete the
 * public library with it.
 *
 * Run with:
 *   npx tsx scripts/reassign-public-owner.ts --dry-run   (counts only, no writes)
 *   npx tsx scripts/reassign-public-owner.ts --apply     (updateMany, then re-count)
 *
 * Requires MONGODB_URI in .env.local (or in the environment).
 *
 * Output is counts only: no user id, no document, no connection string.
 *
 * It uses the Mongoose models from models/ (each imports only mongoose), so
 * the collection names come from the models and cannot be mistyped. It does
 * NOT use lib/mongodb.ts, whose dbConnect() starts autoSeed() as a side effect.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import mongoose, { type Model } from 'mongoose';
import TestCase from '../models/TestCase';
import PromptLibrary from '../models/PromptLibrary';
import Insight from '../models/Insight';
import BugReport from '../models/BugReport';

/** Same value as SYSTEM_USER_ID in lib/autoSeed.ts (not exported there). */
export const SYSTEM_USER_ID = 'system';

export type Mode = 'dry-run' | 'apply';

export const USAGE =
  'Usage: npx tsx scripts/reassign-public-owner.ts (--dry-run | --apply)\n' +
  '  --dry-run  count public documents and those not owned by "system"; no writes\n' +
  '  --apply    reassign public documents not owned by "system" to "system", then re-count';

/**
 * Exactly one of --dry-run / --apply, and nothing else. Anything other than
 * that (no flag, both flags, a repeated flag, an unknown argument) is null,
 * which the caller turns into the usage text and exit code 1.
 */
export function parseMode(args: readonly string[]): Mode | null {
  if (args.length !== 1) return null;
  if (args[0] === '--dry-run') return 'dry-run';
  if (args[0] === '--apply') return 'apply';
  return null;
}

/** Every public document. */
export function publicFilter() {
  return { is_public: true } as const;
}

/**
 * Public documents whose owner is not `system`. `$ne` also matches a
 * document with no user_id at all, which is wanted: it is not system-owned.
 */
export function outsideSystemFilter() {
  return { is_public: true, user_id: { $ne: SYSTEM_USER_ID } } as const;
}

/** The only change the migration makes: the owner becomes `system`. */
export function reassignUpdate() {
  return { $set: { user_id: SYSTEM_USER_ID } } as const;
}

/**
 * Whether the run failed: only --apply is expected to leave no public
 * document outside system. A dry run reports what it found and succeeds.
 */
export function applyLeftDocumentsOutsideSystem(
  mode: Mode,
  remainingByCollection: readonly number[],
): boolean {
  return mode === 'apply' && remainingByCollection.some((n) => n !== 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;

export const MODELS: readonly AnyModel[] = [TestCase, PromptLibrary, Insight, BugReport];

function loadEnvLocal(): void {
  // Same manual loading as scripts/mark-seed-public.ts (no dotenv dependency).
  try {
    const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
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
}

async function run(mode: Mode): Promise<number> {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set. Add it to .env.local');
    return 1;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    console.log(`Connected. Mode: ${mode}`);
    const remaining: number[] = [];

    for (const model of MODELS) {
      const name = model.collection.collectionName;
      const publicCount = await model.countDocuments(publicFilter());
      const outsideBefore = await model.countDocuments(outsideSystemFilter());
      console.log(`${name}: public=${publicCount} outside_system=${outsideBefore}`);

      if (mode === 'apply') {
        const result = await model.updateMany(outsideSystemFilter(), reassignUpdate());
        console.log(`${name}: matched=${result.matchedCount} modified=${result.modifiedCount}`);
      }

      const outsideAfter = await model.countDocuments(outsideSystemFilter());
      remaining.push(outsideAfter);
      console.log(`${name}: outside_system_now=${outsideAfter}`);
    }

    if (applyLeftDocumentsOutsideSystem(mode, remaining)) {
      console.error('FAILED: public documents remain outside the system owner after --apply');
      return 1;
    }
    console.log(mode === 'apply' ? 'Done: every public document is system-owned.' : 'Dry run done: nothing was written.');
    return 0;
  } finally {
    await mongoose.disconnect();
  }
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (!mode) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  try {
    process.exitCode = await run(mode);
  } catch (err) {
    // Name and code only: a driver message can carry the cluster host.
    const e = err as { name?: unknown; code?: unknown };
    const code = e && e.code !== undefined ? ` (code ${String(e.code)})` : '';
    console.error(`Migration failed: ${String(e?.name ?? 'Error')}${code}`);
    process.exitCode = 1;
  }
}

// Run only when executed as the script, not when the test imports the helpers.
if (/reassign-public-owner\.ts$/.test(process.argv[1] ?? '')) {
  void main();
}
