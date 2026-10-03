/**
 * Server-side vault for user API keys: AES-256-GCM under a versioned key ring.
 *
 * Server-only: imports node:crypto and reads KEY_ENCRYPTION_KEYS. Import it only
 * from API routes and other server modules; never from a client component. The
 * window guard below makes an accidental client import fail loudly at load.
 *
 * Key ring: KEY_ENCRYPTION_KEYS="v2:<base64 of 32 bytes>,v1:<base64 of 32 bytes>".
 * The FIRST entry encrypts; every entry can decrypt. The ring is read lazily, at
 * the first call, never at import (an import must not fail on a missing env).
 *
 * This module never logs. Error messages are fixed strings: they never contain
 * plaintext, key material, ciphertext, AAD or any value read from the env, so
 * callers can log the error class name safely.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

if (typeof window !== 'undefined') {
  throw new Error('lib/server/key-vault is server-only');
}

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENV_NAME = 'KEY_ENCRYPTION_KEYS';
const VERSION_RE = /^v\d+$/;
// Standard base64 with padding; the decoded length is checked separately.
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** The ring is missing or malformed. The message never includes the env value. */
export class KeyVaultNotConfigured extends Error {
  constructor(reason: string) {
    super(`Key storage is not configured: ${reason}`);
    this.name = 'KeyVaultNotConfigured';
  }
}

/** The record names a key version that is not in the current ring. */
export class KeyVersionUnknown extends Error {
  constructor() {
    super('The record was encrypted under a key version that is not in the key ring');
    this.name = 'KeyVersionUnknown';
  }
}

/** Authentication failed or the record is malformed (wrong AAD, tampered ct, tag or iv). */
export class KeyVaultDecryptError extends Error {
  constructor() {
    super('The stored secret could not be decrypted');
    this.name = 'KeyVaultDecryptError';
  }
}

export interface EncryptedSecret {
  /** base64 ciphertext */
  ct: string;
  /** base64 12-byte IV */
  iv: string;
  /** base64 16-byte GCM tag */
  tag: string;
  /** ring label of the key that encrypted it, e.g. "v1" */
  keyVersion: string;
}

interface KeyRing {
  current: string;
  keys: Map<string, Buffer>;
}

// Cache keyed on the raw env string: parsed once, re-parsed only when the value
// changes, so a stale ring can never be used. A malformed ring is never cached,
// so every call keeps failing closed until the env is fixed.
let cachedRaw: string | undefined;
let cachedRing: KeyRing | undefined;

/** Test hook: forget the parsed ring. */
export function _resetKeyRingForTests(): void {
  cachedRaw = undefined;
  cachedRing = undefined;
}

function parseKeyRing(raw: string): KeyRing {
  const entries = raw.split(',').map((e) => e.trim());
  if (entries.some((e) => e === '')) {
    throw new KeyVaultNotConfigured('empty entry in the key ring');
  }
  const keys = new Map<string, Buffer>();
  let current: string | undefined;
  for (const entry of entries) {
    const sep = entry.indexOf(':');
    if (sep <= 0) {
      throw new KeyVaultNotConfigured('each entry must be <version>:<base64>');
    }
    const version = entry.slice(0, sep).trim();
    const b64 = entry.slice(sep + 1).trim();
    if (!VERSION_RE.test(version)) {
      throw new KeyVaultNotConfigured('a version label is not of the form v<digits>');
    }
    if (keys.has(version)) {
      throw new KeyVaultNotConfigured('a version label appears twice');
    }
    if (!BASE64_RE.test(b64)) {
      throw new KeyVaultNotConfigured('a key is not valid base64');
    }
    const key = Buffer.from(b64, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new KeyVaultNotConfigured('a key does not decode to exactly 32 bytes');
    }
    keys.set(version, key);
    if (current === undefined) current = version;
  }
  return { current: current as string, keys };
}

function getKeyRing(): KeyRing {
  const raw = process.env[ENV_NAME];
  if (raw === undefined || raw.trim() === '') {
    throw new KeyVaultNotConfigured(`${ENV_NAME} is not set`);
  }
  if (cachedRing && cachedRaw === raw) return cachedRing;
  const ring = parseKeyRing(raw);
  cachedRaw = raw;
  cachedRing = ring;
  return ring;
}

function requireAad(aad: unknown): asserts aad is string {
  if (typeof aad !== 'string' || aad === '') {
    throw new TypeError('aad must be a non-empty string');
  }
}

function decodeField(value: unknown, expectedBytes?: number): Buffer {
  if (typeof value !== 'string' || !BASE64_RE.test(value)) throw new KeyVaultDecryptError();
  const buf = Buffer.from(value, 'base64');
  if (expectedBytes !== undefined && buf.length !== expectedBytes) {
    throw new KeyVaultDecryptError();
  }
  return buf;
}

/**
 * The AAD every stored credential is bound to, so a ciphertext copied into
 * another user's row or another slot fails authentication. The user id may not
 * contain ':' (Clerk ids never do); the slot may (e.g. "custom:<id>"), and the
 * string stays unambiguous because the first ':' after the prefix ends the id.
 */
export function credentialAad(userId: string, slot: string): string {
  if (typeof userId !== 'string' || userId === '' || userId.includes(':')) {
    throw new TypeError('userId must be a non-empty string without ":"');
  }
  if (typeof slot !== 'string' || slot === '') {
    throw new TypeError('slot must be a non-empty string');
  }
  return `winqa-key:v1:${userId}:${slot}`;
}

/** Encrypt under the first (current) ring entry with a fresh random 12-byte IV. */
export function encryptSecret(plain: string, aad: string): EncryptedSecret {
  if (typeof plain !== 'string') throw new TypeError('plain must be a string');
  requireAad(aad);
  const ring = getKeyRing();
  const key = ring.keys.get(ring.current) as Buffer;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ct: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyVersion: ring.current,
  };
}

/**
 * Decrypt a record under the ring entry it names. Throws KeyVaultNotConfigured
 * (no usable ring), KeyVersionUnknown (version not in the ring) or
 * KeyVaultDecryptError (anything else: wrong AAD, tampered or malformed fields).
 * Never the raw Node error.
 */
export function decryptSecret(
  rec: { ct: string; iv: string; tag: string; keyVersion: string },
  aad: string
): string {
  requireAad(aad);
  const ring = getKeyRing();
  if (!rec || typeof rec !== 'object') throw new KeyVaultDecryptError();
  const key = typeof rec.keyVersion === 'string' ? ring.keys.get(rec.keyVersion) : undefined;
  if (!key) throw new KeyVersionUnknown();
  const iv = decodeField(rec.iv, IV_BYTES);
  const tag = decodeField(rec.tag, TAG_BYTES);
  const ct = decodeField(rec.ct);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    throw new KeyVaultDecryptError();
  }
}
