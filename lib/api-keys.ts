import { LLMProvider } from './llm/types';
import {
  encryptApiKeys,
  decryptApiKeys,
  isEncryptedFormat,
  EncryptedData,
} from './crypto';

const STORAGE_KEY = 'winqa_api_keys';

export interface ApiKeys {
  cohere?: string;
  gemini?: string;
  groq?: string;
  openrouter?: string;
}

interface EncryptedStorage {
  encrypted: true;
  keys: Record<string, EncryptedData>;
}

interface LegacyStorage {
  cohere?: string;
  gemini?: string;
  groq?: string;
  openrouter?: string;
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
      return await decryptApiKeys(parsed.keys, userId);
    }

    // Legacy unencrypted format - migrate if we have userId
    const legacyData = parsed as LegacyStorage;
    if (userId && Object.keys(legacyData).length > 0) {
      // Migrate to encrypted format
      const filtered: ApiKeys = {};
      for (const [key, value] of Object.entries(legacyData)) {
        if (value && typeof value === 'string' && value.trim()) {
          filtered[key as keyof ApiKeys] = value.trim();
        }
      }
      if (Object.keys(filtered).length > 0) {
        await setApiKeys(filtered, userId);
      }
      return filtered;
    }

    // Return legacy data as-is if no userId
    return legacyData;
  } catch {
    // Invalid JSON or decryption failed, return empty
    return {};
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
  const filtered: ApiKeys = {};
  for (const [key, value] of Object.entries(keys)) {
    if (value && value.trim()) {
      filtered[key as keyof ApiKeys] = value.trim();
    }
  }

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
