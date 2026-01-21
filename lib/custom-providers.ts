// Custom providers storage with encryption for API keys
// Uses the same encryption pattern as api-keys.ts

import { encryptApiKey, decryptApiKey, EncryptedData, isEncryptedFormat } from './crypto';

const STORAGE_KEY = 'winqa_custom_providers';
export const MAX_CUSTOM_PROVIDERS = 6;

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string; // Decrypted key (only in memory)
  modelId: string;
  enabled: boolean;
  headerType?: 'bearer' | 'x-api-key';
}

interface StoredCustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  enabled: boolean;
  headerType?: 'bearer' | 'x-api-key';
}

interface EncryptedStorage {
  encrypted: true;
  providers: StoredCustomProvider[];
  keys: Record<string, EncryptedData>; // id -> encrypted key
}

interface LegacyStorage {
  providers: Array<StoredCustomProvider & { apiKey: string }>;
}

/**
 * Generate a unique ID for a custom provider
 */
function generateId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all custom providers from localStorage (decrypted)
 */
export async function getCustomProviders(userId?: string): Promise<CustomProvider[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    // Handle encrypted format
    if (isEncryptedProviderFormat(parsed) && userId) {
      const providers: CustomProvider[] = [];
      for (const provider of parsed.providers) {
        const encryptedKey = parsed.keys[provider.id];
        let apiKey = '';
        if (encryptedKey) {
          try {
            apiKey = await decryptApiKey(encryptedKey, userId);
          } catch {
            // Skip providers with failed decryption
            console.warn(`Failed to decrypt key for provider ${provider.id}`);
          }
        }
        providers.push({
          ...provider,
          apiKey,
        });
      }
      return providers;
    }

    // Handle legacy unencrypted format (migrate on next save)
    if (isLegacyFormat(parsed)) {
      return parsed.providers.map((p) => ({
        ...p,
        apiKey: p.apiKey || '',
      }));
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Save all custom providers to localStorage (encrypted)
 */
export async function saveCustomProviders(
  providers: CustomProvider[],
  userId?: string
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (providers.length > MAX_CUSTOM_PROVIDERS) {
    throw new Error(`Maximum ${MAX_CUSTOM_PROVIDERS} custom providers allowed`);
  }

  // If we have a userId, encrypt the API keys
  if (userId) {
    const storedProviders: StoredCustomProvider[] = [];
    const encryptedKeys: Record<string, EncryptedData> = {};

    for (const provider of providers) {
      storedProviders.push({
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        modelId: provider.modelId,
        enabled: provider.enabled,
        headerType: provider.headerType,
      });

      if (provider.apiKey) {
        encryptedKeys[provider.id] = await encryptApiKey(provider.apiKey, userId);
      }
    }

    const storage: EncryptedStorage = {
      encrypted: true,
      providers: storedProviders,
      keys: encryptedKeys,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } else {
    // Fallback: store without encryption (not recommended)
    const storage: LegacyStorage = {
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        modelId: p.modelId,
        enabled: p.enabled,
        headerType: p.headerType,
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  }
}

/**
 * Add a new custom provider
 */
export async function addCustomProvider(
  provider: Omit<CustomProvider, 'id'>,
  userId?: string
): Promise<CustomProvider> {
  const providers = await getCustomProviders(userId);

  if (providers.length >= MAX_CUSTOM_PROVIDERS) {
    throw new Error(`Maximum ${MAX_CUSTOM_PROVIDERS} custom providers allowed`);
  }

  const newProvider: CustomProvider = {
    ...provider,
    id: generateId(),
  };

  providers.push(newProvider);
  await saveCustomProviders(providers, userId);

  return newProvider;
}

/**
 * Update an existing custom provider
 */
export async function updateCustomProvider(
  id: string,
  updates: Partial<Omit<CustomProvider, 'id'>>,
  userId?: string
): Promise<void> {
  const providers = await getCustomProviders(userId);
  const index = providers.findIndex((p) => p.id === id);

  if (index === -1) {
    throw new Error(`Provider with id ${id} not found`);
  }

  providers[index] = {
    ...providers[index],
    ...updates,
  };

  await saveCustomProviders(providers, userId);
}

/**
 * Remove a custom provider
 */
export async function removeCustomProvider(id: string, userId?: string): Promise<void> {
  const providers = await getCustomProviders(userId);
  const filtered = providers.filter((p) => p.id !== id);
  await saveCustomProviders(filtered, userId);
}

/**
 * Toggle a custom provider's enabled status
 */
export async function toggleCustomProvider(id: string, userId?: string): Promise<void> {
  const providers = await getCustomProviders(userId);
  const index = providers.findIndex((p) => p.id === id);

  if (index === -1) {
    throw new Error(`Provider with id ${id} not found`);
  }

  providers[index].enabled = !providers[index].enabled;
  await saveCustomProviders(providers, userId);
}

/**
 * Get only enabled custom providers
 */
export async function getEnabledCustomProviders(userId?: string): Promise<CustomProvider[]> {
  const providers = await getCustomProviders(userId);
  return providers.filter((p) => p.enabled);
}

/**
 * Clear all custom providers
 */
export function clearCustomProviders(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

// Type guards
function isEncryptedProviderFormat(data: unknown): data is EncryptedStorage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'encrypted' in data &&
    (data as { encrypted: unknown }).encrypted === true &&
    'providers' in data &&
    'keys' in data
  );
}

function isLegacyFormat(data: unknown): data is LegacyStorage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'providers' in data &&
    Array.isArray((data as { providers: unknown }).providers)
  );
}
