import { LLMProvider } from './llm/types';
import { REGISTRY_PROVIDERS } from './llm/registry';
import {
  encryptApiKeys,
  decryptApiKey,
  decryptApiKeys,
  isEncryptedFormat,
  EncryptedData,
} from './crypto';
import { LEGACY_API_KEYS_KEY, LEGACY_CUSTOM_PROVIDERS_KEY } from './key-migration';

const STORAGE_KEY = LEGACY_API_KEYS_KEY;

export type ApiKeys = Partial<Record<LLMProvider, string>>;

interface EncryptedStorage {
  encrypted: true;
  keys: Record<string, EncryptedData>;
}

type LegacyStorage = Record<string, unknown>;

/**
 * Keep only non-empty keys for providers in the current registry. Stored keys
 * outlive lineups (localStorage): a key saved for a provider that has since left
 * the built-ins (OpenRouter, Batch E3) is dropped here on read, silently, instead
 * of riding along on every request.
 */
function keepRegistered(keys: Record<string, unknown>): ApiKeys {
  const filtered: ApiKeys = {};
  for (const provider of REGISTRY_PROVIDERS) {
    const value = keys[provider];
    if (typeof value === 'string' && value.trim()) {
      filtered[provider] = value.trim();
    }
  }
  return filtered;
}

/**
 * Get all stored API keys from localStorage (decrypted)
 * @param userId - Clerk user ID for decryption
 */
export async function getApiKeys(userId?: string): Promise<ApiKeys> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored);

    // Check if data is in encrypted format
    if (isEncryptedFormat(parsed)) {
      if (!userId) {
        // Can't decrypt without userId, return empty
        return {};
      }
      return keepRegistered(await decryptApiKeys(parsed.keys, userId));
    }

    // Legacy unencrypted format - migrate if we have userId
    const legacyData = parsed as LegacyStorage;
    const filtered = keepRegistered(legacyData);
    if (userId && Object.keys(legacyData).length > 0) {
      // Migrate to encrypted format
      if (Object.keys(filtered).length > 0) {
        await setApiKeys(filtered, userId);
      }
      return filtered;
    }

    // No userId: legacy data, filtered to the current providers
    return filtered;
  } catch {
    // Invalid JSON or decryption failed, return empty
    return {};
  }
}

/**
 * Read-only reader for the migration (C14): the stored keys, decrypted under
 * `userId`, plus how many entries could not be decrypted (another account's
 * blob, corrupted data) or read at all. getApiKeys swallows those; the move
 * must not wipe a browser copy it could not read. Never writes.
 */
export async function readLegacyApiKeys(
  userId: string
): Promise<{ keys: Record<string, string>; failed: number }> {
  if (typeof window === 'undefined') return { keys: {}, failed: 0 };

  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { keys: {}, failed: 1 };
  }
  if (!stored) return { keys: {}, failed: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { keys: {}, failed: 1 };
  }
  if (typeof parsed !== 'object' || parsed === null) return { keys: {}, failed: 1 };

  if (isEncryptedFormat(parsed)) {
    // A damaged blob ({"encrypted":true,"keys":null}) is one unreadable entry, not a throw.
    if (typeof parsed.keys !== 'object' || parsed.keys === null) return { keys: {}, failed: 1 };
    const decrypted: Record<string, string> = {};
    let failed = 0;
    for (const [provider, data] of Object.entries(parsed.keys)) {
      try {
        decrypted[provider] = await decryptApiKey(data, userId);
      } catch {
        failed++;
      }
    }
    return { keys: keepRegistered(decrypted) as Record<string, string>, failed };
  }

  // Old unencrypted format: nothing to decrypt.
  return { keys: keepRegistered(parsed as LegacyStorage) as Record<string, string>, failed: 0 };
}

/** True when this browser still holds either legacy key store (keys or custom providers). */
export function hasLegacyKeyBlob(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      !!localStorage.getItem(LEGACY_API_KEYS_KEY) ||
      !!localStorage.getItem(LEGACY_CUSTOM_PROVIDERS_KEY)
    );
  } catch {
    return false;
  }
}

/**
 * The raw text of both legacy entries, for a before/after compare around the
 * upload: a change in between (another tab) means the copy must not be wiped.
 */
export function snapshotLegacyKeyStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    return JSON.stringify([
      localStorage.getItem(LEGACY_API_KEYS_KEY),
      localStorage.getItem(LEGACY_CUSTOM_PROVIDERS_KEY),
    ]);
  } catch {
    return '';
  }
}

/** Removes exactly the two legacy key entries; no other storage is touched. */
export function wipeLegacyKeyStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_API_KEYS_KEY);
    localStorage.removeItem(LEGACY_CUSTOM_PROVIDERS_KEY);
  } catch {
    // Storage blocked: nothing to remove.
  }
}

/**
 * Save all API keys to localStorage (encrypted)
 * @param keys - Plain text API keys
 * @param userId - Clerk user ID for encryption
 */
export async function setApiKeys(keys: ApiKeys, userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Filter out empty strings
  const filtered = keepRegistered(keys);

  // If no keys to save, clear storage
  if (Object.keys(filtered).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  // Encrypt if we have a userId
  if (userId) {
    const encrypted = await encryptApiKeys(filtered as Record<string, string>, userId);
    const storage: EncryptedStorage = {
      encrypted: true,
      keys: encrypted,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } else {
    // Fallback to unencrypted (should rarely happen)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
}

/**
 * Get a single API key for a specific provider
 * @param provider - The LLM provider
 * @param userId - Clerk user ID for decryption
 */
export async function getApiKey(
  provider: LLMProvider,
  userId?: string
): Promise<string | undefined> {
  const keys = await getApiKeys(userId);
  return keys[provider];
}

/**
 * Set a single API key for a specific provider
 * @param provider - The LLM provider
 * @param key - The API key value
 * @param userId - Clerk user ID for encryption
 */
export async function setApiKey(
  provider: LLMProvider,
  key: string,
  userId?: string
): Promise<void> {
  const keys = await getApiKeys(userId);
  if (key && key.trim()) {
    keys[provider] = key.trim();
  } else {
    delete keys[provider];
  }
  await setApiKeys(keys, userId);
}

/**
 * Clear a single API key
 * @param provider - The LLM provider
 * @param userId - Clerk user ID for re-encryption
 */
export async function clearApiKey(
  provider: LLMProvider,
  userId?: string
): Promise<void> {
  const keys = await getApiKeys(userId);
  delete keys[provider];
  await setApiKeys(keys, userId);
}

/**
 * Check if a custom API key is configured for a provider
 * @param provider - The LLM provider
 * @param userId - Clerk user ID for decryption
 */
export async function hasApiKey(
  provider: LLMProvider,
  userId?: string
): Promise<boolean> {
  const key = await getApiKey(provider, userId);
  return !!key && key.trim().length > 0;
}

/**
 * Get all providers that have custom keys configured
 * @param userId - Clerk user ID for decryption
 */
export async function getConfiguredProviders(
  userId?: string
): Promise<LLMProvider[]> {
  const keys = await getApiKeys(userId);
  return (Object.keys(keys) as LLMProvider[]).filter(
    (provider) => keys[provider] && keys[provider]!.trim().length > 0
  );
}

/**
 * Clear all API keys from localStorage
 */
export function clearAllApiKeys(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Mask an API key for display (show last 4 characters)
 * @param key - The API key to mask
 * @returns Masked key like "••••••••abc1"
 */
export function maskApiKey(key: string): string {
  if (!key || key.length <= 4) return '••••••••';
  const lastFour = key.slice(-4);
  return `••••••••${lastFour}`;
}
