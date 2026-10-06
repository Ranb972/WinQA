/**
 * C17: re-wrap every saved credential under the current key-ring version.
 *
 * Run AFTER the deployment that carries the new ring is live (so no server
 * writes the old version any more):
 *   npx tsx scripts/rewrap-keys.ts --dry-run   (counts per keyVersion, no decrypt, no writes)
 *   npx tsx scripts/rewrap-keys.ts --apply     (decrypt under the old entry, encrypt under
 *                                               the current one, save; then re-count)
 *
 * Requires MONGODB_URI and KEY_ENCRYPTION_KEYS in .env.local (or the environment).
 * The ring must hold the current entry first and every old entry after it.
 *
 * Rules (Batch C plan, "Rotation of the server secret"):
 * - Never write on a decrypt failure: the row is counted and left as it is.
 * - The update is conditional on the ciphertext it read, so a key the user
 *   re-saved in the meantime is never overwritten (counted as raced).
 * - Output is counts only: no user id, no key, no ciphertext, no URI.
 *
 * Like scripts/reassign-public-owner.ts it uses the model directly, never
 * lib/mongodb.ts (whose dbConnect() starts autoSeed() as a side effect).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import mongoose, { Types } from 'mongoose';
import ProviderCredential from '../models/ProviderCredential';
import {
  KeyVaultDecryptError,
  KeyVersionUnknown,
  credentialAad,
  decryptSecret,
  encryptSecret,
} from '../lib/server/key-vault';

export type Mode = 'dry-run' | 'apply';

export const USAGE =
  'Usage: npx tsx scripts/rewrap-keys.ts (--dry-run | --apply)\n' +
  '  --dry-run  count credentials per keyVersion; no decrypt, no writes\n' +
  '  --apply    re-encrypt every credential not under the current version, then re-count';

export const BATCH_SIZE = 100;

/** Exactly one of --dry-run / --apply, nothing else; otherwise null (usage, exit 1). */
export function parseMode(args: readonly string[]): Mode | null {
  if (args.length !== 1) return null;
  if (args[0] === '--dry-run') return 'dry-run';
  if (args[0] === '--apply') return 'apply';
  return null;
}

/** The ring entry new writes use, read from the vault itself (never parsed here). */
export function currentKeyVersion(): string {
  return encryptSecret('probe', 'winqa-key:v1:rewrap:probe').keyVersion;
}

export interface StoredCredential {
  _id: Types.ObjectId;
  userId: string;
  slot: string;
  ct: string;
  iv: string;
  tag: string;
  keyVersion: string;
}

export type RewrapOutcome =
  | { kind: 'current' }
  | { kind: 'decrypt-failed'; error: 'KeyVaultDecryptError' | 'KeyVersionUnknown' | 'other' }
  | {
      kind: 'rewrap';
      filter: { _id: Types.ObjectId; ct: string; keyVersion: string };
      update: { $set: { ct: string; iv: string; tag: string; keyVersion: string } };
    };

/**
 * Pure: decides what to do with one row. Decrypts under the row's version and,
 * on success, produces a conditional update under the current version. The
 * plaintext never leaves this function.
 */
export function planRewrap(doc: StoredCredential, current: string): RewrapOutcome {
  if (doc.keyVersion === current) return { kind: 'current' };
  const aad = credentialAad(doc.userId, doc.slot);
  let plain: string;
  try {
    plain = decryptSecret(
      { ct: doc.ct, iv: doc.iv, tag: doc.tag, keyVersion: doc.keyVersion },
      aad
    );
  } catch (err) {
    const error =
      err instanceof KeyVaultDecryptError
        ? 'KeyVaultDecryptError'
        : err instanceof KeyVersionUnknown
          ? 'KeyVersionUnknown'
          : 'other';
    return { kind: 'decrypt-failed', error };
  }
  const fresh = encryptSecret(plain, aad);
  return {
    kind: 'rewrap',
    filter: { _id: doc._id, ct: doc.ct, keyVersion: doc.keyVersion },
    update: { $set: { ct: fresh.ct, iv: fresh.iv, tag: fresh.tag, keyVersion: fresh.keyVersion } },
  };
}

export interface Counts {
  rewrapped: number;
  raced: number;
  decryptFailed: number;
  alreadyCurrent: number;
}

/** Only --apply is expected to leave no row behind on an old version. */
export function applyLeftOldVersions(mode: Mode, oldVersionRows: number): boolean {
  return mode === 'apply' && oldVersionRows !== 0;
}

function loadEnvLocal(): void {
  // Same manual loading as scripts/reassign-public-owner.ts (no dotenv dependency).
  try {
    const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* .env.local not found, rely on env vars */
  }
}

async function countPerVersion(): Promise<Record<string, number>> {
  const rows = (await ProviderCredential.aggregate([
    { $group: { _id: '$keyVersion', n: { $sum: 1 } } },
  ])) as { _id: unknown; n: number }[];
  const out: Record<string, number> = {};
  for (const r of rows) out[typeof r._id === 'string' ? r._id : 'unknown'] = r.n;
  return out;
}

function printCounts(label: string, perVersion: Record<string, number>): void {
  const parts = Object.entries(perVersion)
    .sort()
    .map(([v, n]) => `${v}=${n}`);
  console.log(`${label}: ${parts.length ? parts.join(' ') : 'none'}`);
}

async function run(mode: Mode): Promise<number> {
  loadEnvLocal();
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set. Add it to .env.local');
    return 1;
  }
  const current = currentKeyVersion(); // throws KeyVaultNotConfigured on a bad ring, before any connection

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    console.log(`Connected. Mode: ${mode}. Current key version: ${current}`);
    const before = await countPerVersion();
    printCounts('before', before);

    const counts: Counts = { rewrapped: 0, raced: 0, decryptFailed: 0, alreadyCurrent: 0 };
    if (mode === 'apply') {
      const cursor = ProviderCredential.find({ keyVersion: { $ne: current } })
        .select('+ct +iv +tag')
        .lean()
        .batchSize(BATCH_SIZE)
        .cursor();
      for await (const raw of cursor) {
        const doc = raw as unknown as StoredCredential;
        const plan = planRewrap(doc, current);
        if (plan.kind === 'current') {
          counts.alreadyCurrent += 1;
        } else if (plan.kind === 'decrypt-failed') {
          counts.decryptFailed += 1;
          console.error(`[rewrap] decrypt-failed version=${doc.keyVersion} error=${plan.error}`);
        } else {
          const res = await ProviderCredential.updateOne(plan.filter, plan.update);
          if (res.modifiedCount === 1) counts.rewrapped += 1;
          else counts.raced += 1;
        }
      }
      console.log(
        `apply: rewrapped=${counts.rewrapped} raced=${counts.raced} decrypt_failed=${counts.decryptFailed}`
      );
    }

    const after = await countPerVersion();
    printCounts('after', after);
    const oldRows = Object.entries(after)
      .filter(([v]) => v !== current)
      .reduce((n, [, c]) => n + c, 0);

    if (applyLeftOldVersions(mode, oldRows)) {
      console.error(`FAILED: ${oldRows} credential(s) remain on an old key version after --apply`);
      return 1;
    }
    console.log(
      mode === 'apply'
        ? `Done: every credential is under ${current}. The old entries can leave the ring.`
        : 'Dry run done: nothing was written.'
    );
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
    console.error(`Re-wrap failed: ${String(e?.name ?? 'Error')}${code}`);
    process.exitCode = 1;
  }
}

// Run only when executed as the script, not when the test imports the helpers.
if (/rewrap-keys\.ts$/.test(process.argv[1] ?? '')) {
  void main();
}
