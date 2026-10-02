// Custom providers storage with encryption for API keys
// Uses the same encryption pattern as api-keys.ts

import { encryptApiKey, decryptApiKey, EncryptedData } from './crypto';
// Import-safe and cycle-free: lib/llm/models imports only ./registry (and types).
import { normalizeBaseUrl } from '@/lib/llm/models';

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
 * Result of a custom-provider connection test. `valid`/`error` keep their
 * original meaning; `status`, `latencyMs` and `model` are additive.
 * `status` is the upstream HTTP status when the route reached the provider, the
 * route's own status when it refused the request (non-2xx), or null when no
 * response was received.
 */
export interface CustomProviderTestResult {
  valid: boolean;
  error?: string;
  status: number | null;
  latencyMs: number;
  model: string;
}

/**
 * Replace every occurrence of `key` in `text` with `[key]`. Keys under 8 chars
 * are left alone (too likely to match ordinary text). Pure; safe for the UI to
 * reuse on any string it is about to display.
 */
export function redactKey(text: string, key: string): string {
  if (typeof text !== 'string' || typeof key !== 'string' || key.length < 8) {
    return text;
  }
  return text.split(key).join('[key]');
}

/**
 * Test a custom provider through the server route. The check used to run in the
 * browser, where CORS blocks most providers and Anthropic cannot be reached at all
 * (audit V04); the route speaks both API formats and applies the SSRF guard.
 */
export async function testCustomProviderConnection(
  provider: Pick<CustomProvider, 'baseUrl' | 'apiKey' | 'modelId' | 'headerType'>
): Promise<CustomProviderTestResult> {
  // Own wall time, used only when the route does not report latencyMs.
  const startedAt = performance.now();
  const elapsedMs = () => Math.round(performance.now() - startedAt);

  try {
    const res = await fetch('/api/test-custom-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        modelId: provider.modelId,
        headerType: provider.headerType,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      valid?: boolean;
      error?: string;
      status?: number | null;
      latencyMs?: number;
      model?: string;
    };
    const latencyMs = typeof data.latencyMs === 'number' ? data.latencyMs : elapsedMs();
    const status =
      typeof data.status === 'number' || data.status === null
        ? data.status
        : res.ok
          ? null
          : res.status;
    const model = typeof data.model === 'string' && data.model ? data.model : provider.modelId;

    if (data.valid) {
      return { valid: true, status, latencyMs, model };
    }
    return {
      valid: false,
      error: redactKey(data.error || `HTTP ${res.status}`, provider.apiKey),
      status,
      latencyMs,
      model,
    };
  } catch (error) {
    return {
      valid: false,
      error: redactKey(error instanceof Error ? error.message : 'Connection failed', provider.apiKey),
      status: null,
      latencyMs: elapsedMs(),
      model: provider.modelId,
    };
  }
}

// Separator for testFingerprint: NUL cannot appear in a URL, key header or model id.
const FINGERPRINT_SEP = '\u0000';

/** Stable identity of what a connection test exercised (URL, key, model, header type; not the name). */
export function testFingerprint(input: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headerType?: 'bearer' | 'x-api-key';
}): string {
  return [
    normalizeBaseUrl(input.baseUrl),
    input.apiKey,
    input.modelId.trim(),
    input.headerType ?? 'bearer',
  ].join(FINGERPRINT_SEP);
}

/** Longest `detail` friendlyTestFailure returns (longer text is cut and ends with "…"). */
export const TEST_DETAIL_MAX = 160;

/** Plain-words reason for a failed test, the raw HTTP status, and the redacted raw error. */
export function friendlyTestFailure(
  result: CustomProviderTestResult,
  apiKey?: string
): { reason: string; statusText: string | null; detail: string | null } {
  const { status } = result;
  const rawError = typeof result.error === 'string' ? result.error : '';

  let reason: string;
  if (status === 401 || status === 403) {
    reason = 'The key was rejected';
  } else if (status === 404) {
    reason = 'Model or endpoint not found';
  } else if (status === 400 || status === 422) {
    reason = 'The provider rejected the request';
  } else if (status === 408 || status === 504 || /timed? ?out|abort/i.test(rawError)) {
    reason = 'No response in time';
  } else if (typeof status === 'number' && status >= 500 && status <= 599) {
    reason = 'The provider had a server error';
  } else if (typeof status === 'number' && status >= 300 && status <= 399) {
    reason = 'The provider tried to redirect (blocked)';
  } else if (status === null) {
    reason = 'Could not reach the provider';
  } else {
    reason = 'Connection failed';
  }

  const statusText = typeof status === 'number' ? `HTTP ${status}` : null;

  let detail: string | null = (apiKey ? redactKey(rawError, apiKey) : rawError).trim();
  if (detail.length > TEST_DETAIL_MAX) {
    detail = `${detail.slice(0, TEST_DETAIL_MAX - 1).trimEnd()}…`;
  }
  if (!detail || detail.toLowerCase() === reason.toLowerCase()) {
    detail = null;
  }

  return { reason, statusText, detail };
}

/** One-line success text: "Connected · model · 1.2 s" (model part omitted when empty). */
export function formatTestPassed(result: CustomProviderTestResult): string {
  const seconds = `${(result.latencyMs / 1000).toFixed(1)} s`;
  const model = typeof result.model === 'string' ? result.model.trim() : '';
  return model ? `Connected · ${model} · ${seconds}` : `Connected · ${seconds}`;
}

/** Save gate: valid fields and either a passing test on the current values or a name-only edit. */
export function canSaveProvider(input: {
  isValid: boolean;
  testPassed: boolean;
  nameOnlyChange: boolean;
}): boolean {
  return input.isValid && (input.testPassed || input.nameOnlyChange);
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
