/**
 * Server key loader: the only code path that may decrypt a stored user key.
 *
 * Server-only: imports lib/server/key-vault (node:crypto, KEY_ENCRYPTION_KEYS)
 * and the Mongoose model. Import it only from API routes and other server
 * modules; never from a client component (the vault's window guard throws).
 *
 * Rules:
 * - Ciphertext is loaded only here, with .select('+ct +iv +tag'); every record
 *   is decrypted under credentialAad(userId, slot), so a record copied into
 *   another user's row or another slot fails authentication.
 * - A decrypt failure never writes (a preview deployment with another key ring
 *   must not touch production rows, D13). The slot lands in `failed` and the
 *   caller falls back to the app key.
 * - Log lines carry the slot and the key version only: no user id, no key, no
 *   ciphertext.
 * - publicView() is the only shape a route may send to the browser. It copies
 *   named fields and never spreads the document.
 */

import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ProviderCredential, {
  BUILTIN_SLOTS,
  CUSTOM_SLOT_PREFIX,
  type CredentialHeaderType,
} from '@/models/ProviderCredential';
import {
  credentialAad,
  decryptSecret,
  encryptSecret,
  KeyVaultNotConfigured,
} from '@/lib/server/key-vault';
import type { CustomApiKeys, LLMProvider } from '@/lib/llm/types';
import type { CustomProvider } from '@/lib/custom-providers';

export const API_KEY_MIN_LENGTH = 8;
export const API_KEY_MAX_LENGTH = 512;
/** last4 is shown only for keys at least this long, so a short key is not half revealed. */
export const LAST4_MIN_KEY_LENGTH = 12;

const BUILTIN_SET: ReadonlySet<string> = new Set(BUILTIN_SLOTS);
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const KEY_VERSION_RE = /^v\d+$/;
const CUSTOM_SLOT_RE = /^custom:[0-9a-f]{24}$/;

/**
 * A built-in provider id or `custom:<24 lowercase hex>`: the only slot strings
 * the loaders ever build an AAD from. Anything else (e.g. 'Gemini' or upper-case
 * hex) would encrypt under an AAD no loader uses and lock the key away.
 */
export function isKnownSlot(slot: unknown): slot is string {
  return typeof slot === 'string' && (BUILTIN_SET.has(slot) || CUSTOM_SLOT_RE.test(slot));
}

interface StoredRecord {
  slot?: unknown;
  ct?: unknown;
  iv?: unknown;
  tag?: unknown;
  keyVersion?: unknown;
}

/** A user id the loaders accept. Anything else is treated as "no saved keys", with no DB call. */
function isUsableUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && userId !== '' && !userId.includes(':');
}

/**
 * `[keys] decrypt-failed slot=<slot> version=<keyVersion> error=<class>`.
 * The version is printed only when it looks like a ring label, so a corrupted
 * field cannot inject arbitrary text into the log.
 */
function logDecryptFailed(slot: string, keyVersion: unknown, err: unknown): void {
  const version =
    typeof keyVersion === 'string' && KEY_VERSION_RE.test(keyVersion) ? keyVersion : 'unknown';
  const name = err instanceof Error ? err.name : 'Error';
  console.error(`[keys] decrypt-failed slot=${slot} version=${version} error=${name}`);
}

function decryptRecord(userId: string, slot: string, rec: StoredRecord): string {
  return decryptSecret(
    {
      ct: rec.ct as string,
      iv: rec.iv as string,
      tag: rec.tag as string,
      keyVersion: rec.keyVersion as string,
    },
    credentialAad(userId, slot)
  );
}

/** The slot of a custom provider. The id is lower-cased, as ObjectId.toString() gives it. */
export function customSlot(id: string): string {
  return `${CUSTOM_SLOT_PREFIX}${id.toLowerCase()}`;
}

/**
 * A fresh _id and its slot for a new custom provider. The route writes both in
 * one insert, so slot === `custom:<_id>` holds from the first write and is
 * unique because the _id is.
 */
export function newCustomCredentialId(): { _id: mongoose.Types.ObjectId; slot: string } {
  const _id = new mongoose.Types.ObjectId();
  return { _id, slot: customSlot(_id.toString()) };
}

/** null when the key is acceptable, otherwise the reason to show the user. */
export function validateApiKey(key: unknown): string | null {
  if (typeof key !== 'string' || key === '') return 'Enter an API key.';
  if (/\s/.test(key)) return 'The API key must not contain spaces or line breaks.';
  if (key.length < API_KEY_MIN_LENGTH) {
    return `The API key must be at least ${API_KEY_MIN_LENGTH} characters.`;
  }
  if (key.length > API_KEY_MAX_LENGTH) {
    return `The API key must be at most ${API_KEY_MAX_LENGTH} characters.`;
  }
  return null;
}

/** The last 4 characters for display, or '' when the key is shorter than 12. */
export function last4Of(key: string): string {
  return key.length >= LAST4_MIN_KEY_LENGTH ? key.slice(-4) : '';
}

export interface EncryptedCredentialFields {
  ct: string;
  iv: string;
  tag: string;
  keyVersion: string;
  last4: string;
}

/**
 * Encrypts a key for one slot of one user and returns the fields a route
 * $sets. Routes never call the vault directly. Throws TypeError on an invalid
 * key (validate first with validateApiKey) or a slot isKnownSlot refuses, and
 * KeyVaultNotConfigured when the
 * ring is missing (the route answers 500 "Key storage is not configured").
 */
export function encryptForSlot(
  userId: string,
  slot: string,
  apiKey: string
): EncryptedCredentialFields {
  if (!isKnownSlot(slot)) throw new TypeError('encryptForSlot: unknown slot');
  if (validateApiKey(apiKey) !== null) throw new TypeError('encryptForSlot: invalid API key');
  const { ct, iv, tag, keyVersion } = encryptSecret(apiKey, credentialAad(userId, slot));
  return { ct, iv, tag, keyVersion, last4: last4Of(apiKey) };
}

/**
 * Loads and decrypts the user's saved keys for the requested built-in
 * providers only. Returns the CustomApiKeys shape the engine already takes.
 * A slot whose record does not decrypt is listed in `failed`, logged, and
 * left out of `keys`; nothing is written. When the key ring is not configured,
 * one `[keys] vault-not-configured` line is logged and every requested slot
 * that has a stored record is failed. Never throws on a vault error.
 */
export async function loadUserKeys(
  userId: string,
  providers: LLMProvider[]
): Promise<{ keys: CustomApiKeys; failed: string[] }> {
  const keys: CustomApiKeys = {};
  const failed: string[] = [];
  if (!isUsableUserId(userId) || !Array.isArray(providers)) return { keys, failed };
  const slots = [...new Set(providers)].filter((p) => BUILTIN_SET.has(p));
  if (slots.length === 0) return { keys, failed };

  await dbConnect();
  const docs = (await ProviderCredential.find({
    userId,
    kind: 'builtin',
    slot: { $in: slots },
  })
    .select('+ct +iv +tag')
    .lean()) as StoredRecord[];

  let vaultDown = false;
  for (const doc of docs) {
    const slot = doc.slot;
    if (typeof slot !== 'string' || !slots.includes(slot as LLMProvider)) continue;
    if (vaultDown) {
      failed.push(slot);
      continue;
    }
    try {
      keys[slot as LLMProvider] = decryptRecord(userId, slot, doc);
    } catch (err) {
      if (err instanceof KeyVaultNotConfigured) {
        vaultDown = true;
        console.error('[keys] vault-not-configured');
      } else {
        // KeyVaultDecryptError, KeyVersionUnknown, or anything unexpected: the
        // slot fails, the request does not.
        logDecryptFailed(slot, doc.keyVersion, err);
      }
      failed.push(slot);
    }
  }
  return { keys, failed };
}

/** Where the keys a request runs on came from: the account, the request body, both, or neither. */
export type KeyOrigin = 'server' | 'client' | 'mixed' | 'none';

/** A body key is used only when it is a string of 1-512 characters; anything else is ignored. */
function isUsableBodyKey(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 1 && v.length <= API_KEY_MAX_LENGTH;
}

/**
 * The keys an LLM call runs on, per requested built-in provider: the user's
 * saved key wins; otherwise the key the request body carried (an old tab or a
 * browser not yet migrated); otherwise none, and the engine uses the app key.
 * `keys` is undefined when no provider has a key. `origin` says where the
 * resolved keys came from, for the route's `[keys]` line; `fromServer` lists
 * the providers whose key is the saved one (the route marks only those
 * rejected); `failed` lists the saved slots that did not decrypt (already
 * logged by loadUserKeys).
 *
 * A load that throws (database error) is logged as
 * `[keys] load-failed error=<class>` and the body keys are used; it never
 * throws itself.
 */
export async function resolveUserKeys(
  userId: string,
  providers: LLMProvider[],
  bodyKeys?: CustomApiKeys
): Promise<{
  keys: CustomApiKeys | undefined;
  origin: KeyOrigin;
  fromServer: LLMProvider[];
  failed: string[];
}> {
  const wanted = Array.isArray(providers)
    ? [...new Set(providers)].filter((p) => BUILTIN_SET.has(p))
    : [];

  let saved: CustomApiKeys = {};
  let failed: string[] = [];
  if (wanted.length > 0) {
    try {
      ({ keys: saved, failed } = await loadUserKeys(userId, wanted));
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error';
      console.error(`[keys] load-failed error=${name}`);
      saved = {};
      failed = [];
    }
  }

  const body: Record<string, unknown> =
    bodyKeys && typeof bodyKeys === 'object' ? (bodyKeys as Record<string, unknown>) : {};
  const keys: CustomApiKeys = {};
  const fromServer: LLMProvider[] = [];
  let fromClient = 0;
  for (const provider of wanted) {
    const serverKey = saved[provider];
    if (typeof serverKey === 'string' && serverKey !== '') {
      keys[provider] = serverKey;
      fromServer.push(provider);
      continue;
    }
    // Own-property read only, so 'toString' and friends on the prototype never count.
    const bodyKey = Object.prototype.hasOwnProperty.call(body, provider) ? body[provider] : undefined;
    if (isUsableBodyKey(bodyKey)) {
      keys[provider] = bodyKey;
      fromClient++;
    }
  }

  const origin: KeyOrigin =
    fromServer.length > 0 && fromClient > 0
      ? 'mixed'
      : fromServer.length > 0
        ? 'server'
        : fromClient > 0
          ? 'client'
          : 'none';
  return { keys: origin === 'none' ? undefined : keys, origin, fromServer, failed };
}

/**
 * Loads one of the user's custom providers with its decrypted key, in the
 * shape the engine's callCustomProvider takes. null for a malformed id (no DB
 * call), a provider that is not the user's, or a record that does not decrypt
 * (logged; nothing written). `enabled` is returned as stored; the caller
 * decides what a disabled provider means.
 */
export async function loadCustomProvider(
  userId: string,
  id: string
): Promise<CustomProvider | null> {
  if (!isUsableUserId(userId)) return null;
  // mongoose.isValidObjectId alone also accepts any 12-character string, so the
  // 24-hex shape is checked first.
  if (typeof id !== 'string' || !OBJECT_ID_RE.test(id) || !mongoose.isValidObjectId(id)) {
    return null;
  }
  const normalizedId = id.toLowerCase();
  const slot = customSlot(normalizedId);

  await dbConnect();
  const doc = (await ProviderCredential.findOne({
    _id: normalizedId,
    userId,
    kind: 'custom',
  })
    .select('+ct +iv +tag')
    .lean()) as
    | (StoredRecord & {
        name?: unknown;
        baseUrl?: unknown;
        modelId?: unknown;
        headerType?: unknown;
        enabled?: unknown;
      })
    | null;
  if (!doc) return null;

  let apiKey: string;
  try {
    // The AAD uses the slot derived from the requested id, not the stored
    // slot, so a row whose slot was altered fails authentication.
    apiKey = decryptRecord(userId, slot, doc);
  } catch (err) {
    if (err instanceof KeyVaultNotConfigured) console.error('[keys] vault-not-configured');
    else logDecryptFailed(slot, doc.keyVersion, err);
    return null;
  }

  const headerType: CredentialHeaderType | undefined =
    doc.headerType === 'bearer' || doc.headerType === 'x-api-key' ? doc.headerType : undefined;
  return {
    id: normalizedId,
    name: typeof doc.name === 'string' ? doc.name : '',
    baseUrl: typeof doc.baseUrl === 'string' ? doc.baseUrl : '',
    apiKey,
    modelId: typeof doc.modelId === 'string' ? doc.modelId : '',
    enabled: doc.enabled === true,
    ...(headerType ? { headerType } : {}),
  };
}

export interface PublicBuiltinCredential {
  provider: LLMProvider;
  last4: string;
  updatedAt: Date | null;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastRejectedAt: Date | null;
}

export interface PublicCustomCredential {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  headerType: CredentialHeaderType | null;
  enabled: boolean;
  last4: string;
  hasKey: true;
  updatedAt: Date | null;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastRejectedAt: Date | null;
}

/** Any credential document or lean object; only the named fields are read. */
export interface CredentialLike {
  _id?: unknown;
  kind?: unknown;
  provider?: unknown;
  name?: unknown;
  baseUrl?: unknown;
  modelId?: unknown;
  headerType?: unknown;
  enabled?: unknown;
  last4?: unknown;
  updatedAt?: unknown;
  lastTestedAt?: unknown;
  lastTestOk?: unknown;
  lastRejectedAt?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const dateOrNull = (v: unknown): Date | null => (v instanceof Date ? v : null);
const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

/**
 * The client-safe view of one credential. Built field by field from an
 * explicit list, so ct, iv, tag, keyVersion, userId or a decrypted apiKey can
 * never reach a response, whatever the document holds.
 */
export function publicView(
  doc: CredentialLike
): PublicBuiltinCredential | PublicCustomCredential {
  if (doc.kind === 'builtin') {
    if (typeof doc.provider !== 'string' || !BUILTIN_SET.has(doc.provider)) {
      throw new TypeError('publicView: built-in credential without a valid provider');
    }
    return {
      provider: doc.provider as LLMProvider,
      last4: str(doc.last4),
      updatedAt: dateOrNull(doc.updatedAt),
      lastTestedAt: dateOrNull(doc.lastTestedAt),
      lastTestOk: boolOrNull(doc.lastTestOk),
      lastRejectedAt: dateOrNull(doc.lastRejectedAt),
    };
  }
  if (doc.kind === 'custom') {
    const headerType =
      doc.headerType === 'bearer' || doc.headerType === 'x-api-key' ? doc.headerType : null;
    return {
      id: doc._id === undefined || doc._id === null ? '' : String(doc._id),
      name: str(doc.name),
      baseUrl: str(doc.baseUrl),
      modelId: str(doc.modelId),
      headerType,
      enabled: doc.enabled === true,
      last4: str(doc.last4),
      hasKey: true,
      updatedAt: dateOrNull(doc.updatedAt),
      lastTestedAt: dateOrNull(doc.lastTestedAt),
      lastTestOk: boolOrNull(doc.lastTestOk),
      lastRejectedAt: dateOrNull(doc.lastRejectedAt),
    };
  }
  throw new TypeError('publicView: unknown credential kind');
}

/**
 * Records that the provider rejected the user's saved key (the engine's
 * userKeyRejected), so Settings can say so. Fire-and-forget: the returned
 * promise never rejects; a failure logs the slot and the error class only.
 * Touches only lastRejectedAt on the user's own row and never creates one.
 */
export function markRejected(userId: string, slot: string): Promise<void> {
  if (!isUsableUserId(userId) || !isKnownSlot(slot)) {
    return Promise.resolve();
  }
  return (async () => {
    try {
      await dbConnect();
      await ProviderCredential.updateOne(
        { userId, slot },
        { $set: { lastRejectedAt: new Date() } }
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error';
      console.error(`[keys] mark-rejected-failed slot=${slot} error=${name}`);
    }
  })();
}
