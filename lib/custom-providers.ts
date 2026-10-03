// Custom providers: the account-backed client view, the form helpers Settings
// uses, and the read-only readers for the old browser store (winqa_custom_providers).
//
// Providers live on the server, one document each (/api/custom-providers); this
// module never writes the browser store. The readers stay for the migration banner
// (C14) and for chat while a browser still holds un-migrated providers.

import { decryptApiKey, EncryptedData } from './crypto';
import { LEGACY_CUSTOM_PROVIDERS_KEY } from './key-migration';
// Import-safe and cycle-free: lib/llm/models imports only ./registry (and types).
import { getHeaderType, normalizeBaseUrl } from '@/lib/llm/models';
// Client-safe: lib/friendly-errors has only a type import (erased at build).
import {
  ADDRESS_GUARD_ERRORS,
  CONNECT_FAILURE_ERRORS,
  PROVIDER_BODY_TOO_LARGE_ERROR,
  PROVIDER_CONNECT_TIMEOUT_ERROR,
} from '@/lib/friendly-errors';
import {
  KeysApiError,
  keyErrorText,
  testCustomProvider,
  type CustomProviderInfo,
  type TestCustomProviderPayload,
  type UpdateCustomProviderBody,
} from '@/lib/keys-client';

const STORAGE_KEY = LEGACY_CUSTOM_PROVIDERS_KEY;
export const MAX_CUSTOM_PROVIDERS = 6;

/**
 * A provider together with its key. This is the shape of the old browser store
 * (decrypted in memory by getCustomProviders) and of the provider object the chat
 * path and the engine resolve on the server. Settings never holds a key: it uses
 * CustomProviderView.
 */
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string; // Decrypted key (only in memory)
  modelId: string;
  enabled: boolean;
  headerType?: 'bearer' | 'x-api-key';
}

/**
 * A custom provider as Settings sees it: what the account stores, with no key.
 * `last4` is the saved key's last four characters ('' for a short key).
 */
export interface CustomProviderView {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  enabled: boolean;
  headerType: 'bearer' | 'x-api-key';
  hasKey: boolean;
  last4: string;
}

/** The server's record as a view. A missing header type is what the base URL implies. */
export function toCustomProviderView(info: CustomProviderInfo): CustomProviderView {
  return {
    id: info.id,
    name: info.name,
    baseUrl: info.baseUrl,
    modelId: info.modelId,
    enabled: info.enabled,
    headerType: info.headerType ?? getHeaderType(info.baseUrl),
    hasKey: info.hasKey,
    last4: info.last4,
  };
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
 * Get all custom providers from the old browser store (decrypted). Read-only.
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

    // Handle legacy unencrypted format
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

/** A provider read from the old browser store, key decrypted (the migration's input). */
export type LegacyCustomProvider = CustomProvider;

/**
 * Read-only reader for the migration (C14): the stored providers with their
 * keys decrypted under `userId`, plus how many entries could not be decrypted
 * (another account's blob, corrupted data) or read at all. A provider whose key
 * fails to decrypt is left out of `providers` and counted. getCustomProviders
 * swallows those; the move must not wipe a browser copy it could not read.
 */
export async function readLegacyCustomProviders(
  userId: string
): Promise<{ providers: LegacyCustomProvider[]; failed: number }> {
  if (typeof window === 'undefined') return { providers: [], failed: 0 };

  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { providers: [], failed: 1 };
  }
  if (!stored) return { providers: [], failed: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { providers: [], failed: 1 };
  }

  if (isEncryptedProviderFormat(parsed) && Array.isArray(parsed.providers)) {
    const providers: LegacyCustomProvider[] = [];
    let failed = 0;
    for (const provider of parsed.providers) {
      // A null or non-object entry is a damaged one: count it, never throw.
      if (typeof provider !== 'object' || provider === null) {
        failed++;
        continue;
      }
      const encryptedKey = parsed.keys?.[provider.id];
      let apiKey = '';
      if (encryptedKey) {
        try {
          apiKey = await decryptApiKey(encryptedKey, userId);
        } catch {
          failed++;
          continue;
        }
      }
      providers.push({ ...provider, apiKey });
    }
    return { providers, failed };
  }

  if (isLegacyFormat(parsed)) {
    const providers: LegacyCustomProvider[] = [];
    let failed = 0;
    for (const p of parsed.providers) {
      if (typeof p !== 'object' || p === null) {
        failed++;
        continue;
      }
      providers.push({ ...p, apiKey: p.apiKey || '' });
    }
    return { providers, failed };
  }

  // Not a shape this code wrote: keep it, and say so.
  return { providers: [], failed: 1 };
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
 * What a connection test runs on: a saved provider (the server holds its base URL
 * and key; `modelId` and `headerType` may override the saved ones) or the typed form.
 */
export type CustomProviderTestInput =
  | { providerId: string; modelId?: string; headerType?: 'bearer' | 'x-api-key' }
  | Pick<CustomProvider, 'baseUrl' | 'apiKey' | 'modelId' | 'headerType'>;

/**
 * Test a custom provider through the server route. The check used to run in the
 * browser, where CORS blocks most providers and Anthropic cannot be reached at all
 * (audit V04); the route speaks both API formats and applies the SSRF guard.
 */
export async function testCustomProviderConnection(
  provider: CustomProviderTestInput
): Promise<CustomProviderTestResult> {
  // Own wall time, used only when the route does not report latencyMs.
  const startedAt = performance.now();
  const elapsedMs = () => Math.round(performance.now() - startedAt);
  // Only a typed key can appear in the route's error text.
  const typedKey = 'apiKey' in provider ? provider.apiKey : '';
  const testedModel = provider.modelId ?? '';

  try {
    const payload: TestCustomProviderPayload =
      'providerId' in provider
        ? {
            providerId: provider.providerId,
            modelId: provider.modelId,
            headerType: provider.headerType,
          }
        : {
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            modelId: provider.modelId,
            headerType: provider.headerType,
          };
    const res = await testCustomProvider(payload);
    const data = res.data;
    const latencyMs = typeof data.latencyMs === 'number' ? data.latencyMs : elapsedMs();
    const status =
      typeof data.status === 'number' || data.status === null
        ? data.status
        : res.ok
          ? null
          : res.status;
    const model = typeof data.model === 'string' && data.model ? data.model : testedModel;

    if (data.valid) {
      return { valid: true, status, latencyMs, model };
    }
    return {
      valid: false,
      error: redactKey(data.error || `HTTP ${res.status}`, typedKey),
      status,
      latencyMs,
      model,
    };
  } catch (error) {
    return {
      valid: false,
      error: redactKey(error instanceof Error ? error.message : 'Connection failed', typedKey),
      status: null,
      latencyMs: elapsedMs(),
      model: testedModel,
    };
  }
}

// Separator for testFingerprint: NUL cannot appear in a URL, key header or model id.
const FINGERPRINT_SEP = '\u0000';

/**
 * Stable identity of what a connection test exercised (URL, key, model, header type; not the name).
 * The model id is trimmed here, so a caller must test and save the trimmed id too
 * (CustomProviderModal's effectiveModelId); otherwise "gpt-4 " would save under the
 * fingerprint of a test that ran on "gpt-4".
 *
 * The key part is the typed key. When the key field is blank on an edit, the test
 * ran on the key saved on the server, which the browser never has: `savedId` then
 * stands for it as `saved:<id>`, so a name-only edit matches the stored
 * fingerprint and a new key never does.
 */
export function testFingerprint(input: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headerType?: 'bearer' | 'x-api-key';
  savedId?: string;
}): string {
  const keyPart = input.apiKey === '' && input.savedId ? `saved:${input.savedId}` : input.apiKey;
  return [
    normalizeBaseUrl(input.baseUrl),
    keyPart,
    input.modelId.trim(),
    input.headerType ?? 'bearer',
  ].join(FINGERPRINT_SEP);
}

/**
 * Error text of the route's own 429 when the user's daily connection-test cap is
 * used up (lib/rate-limit.ts DAILY_PROVIDER_TEST_LIMIT, reset at 00:00 UTC).
 */
export const PROVIDER_TEST_LIMIT_ERROR = 'Daily connection-test limit reached';

/** Longest `detail` friendlyTestFailure returns (longer text is cut and ends with "…"). */
export const TEST_DETAIL_MAX = 160;

/** Plain-words reason for a failed test, the raw HTTP status, and the redacted raw error. */
export function friendlyTestFailure(
  result: CustomProviderTestResult,
  apiKey?: string
): { reason: string; statusText: string | null; detail: string | null } {
  const { status } = result;
  const rawError = typeof result.error === 'string' ? result.error : '';

  // WinQA's own daily cap, not the provider's: no HTTP status, just when it resets.
  if (status === 429 && rawError === PROVIDER_TEST_LIMIT_ERROR) {
    return { reason: PROVIDER_TEST_LIMIT_ERROR, statusText: null, detail: 'Resets at 00:00 UTC' };
  }

  // The route's own 400 for an address WinQA refuses (checkProviderUrl or DNS
  // vetting). That body carries no status, so the client falls back to 400; it
  // is not the provider rejecting the request.
  if (status === 400 && ADDRESS_GUARD_ERRORS.has(rawError)) {
    return { reason: 'WinQA blocks this address', statusText: null, detail: rawError };
  }

  // WinQA stopped reading an oversized answer (lib/security.ts maxBodyBytes); the
  // route reports it with status null. Not an HTTP failure, so no status text.
  if (status === null && rawError === PROVIDER_BODY_TOO_LARGE_ERROR) {
    return { reason: 'Response too large', statusText: null, detail: rawError };
  }

  // The connect failed before any answer and the route named why (lib/security.ts
  // ProviderConnectError). A connect timeout is a timeout; the rest cannot reach it.
  if (status === null && rawError === PROVIDER_CONNECT_TIMEOUT_ERROR) {
    return { reason: 'No response in time', statusText: null, detail: rawError };
  }
  if (status === null && CONNECT_FAILURE_ERRORS.has(rawError)) {
    return { reason: 'Could not reach the provider', statusText: null, detail: rawError };
  }

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
  /** An edit moved the base URL. The saved key is bound to the old host, so a blank key field cannot save. */
  baseUrlChanged?: boolean;
  keyBlank?: boolean;
}): boolean {
  if (input.baseUrlChanged && input.keyBlank) return false;
  return input.isValid && (input.testPassed || input.nameOnlyChange);
}

/** True when the form's base URL names another address than the saved one. */
export function hasBaseUrlChanged(savedBaseUrl: string, formBaseUrl: string): boolean {
  return normalizeBaseUrl(savedBaseUrl) !== normalizeBaseUrl(formBaseUrl);
}

/**
 * Whether the form relies on the key saved on the server: an edit of a provider
 * that has a key, with the key field blank and the base URL unchanged.
 */
export function usesSavedKey(
  form: { apiKey: string; baseUrl: string },
  saved: Pick<CustomProviderView, 'baseUrl' | 'hasKey'> | null
): boolean {
  return (
    saved !== null &&
    saved.hasKey &&
    form.apiKey === '' &&
    !hasBaseUrlChanged(saved.baseUrl, form.baseUrl)
  );
}

/** The fields of the modal's form that a save or a test reads. */
export interface CustomProviderForm {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headerType: 'bearer' | 'x-api-key';
}

/** What the modal hands to Settings on Save: the form, the enabled state and, on an edit, the provider's id. */
export interface CustomProviderSubmit extends CustomProviderForm {
  id?: string;
  enabled: boolean;
}

/**
 * What the modal's Test sends: the saved provider's id (with the form's model and
 * header) when the form relies on the saved key, otherwise the full typed form.
 */
export function customTestInput(
  form: CustomProviderForm,
  saved: Pick<CustomProviderView, 'id' | 'baseUrl' | 'hasKey'> | null
): CustomProviderTestInput {
  if (saved && usesSavedKey(form, saved)) {
    return { providerId: saved.id, modelId: form.modelId, headerType: form.headerType };
  }
  return {
    baseUrl: form.baseUrl,
    apiKey: form.apiKey,
    modelId: form.modelId,
    headerType: form.headerType,
  };
}

/**
 * The PATCH body for an edit: only the fields that changed. A new base URL goes
 * with the form's key and the header type for that host (the server refuses a base
 * URL without a key); a typed key alone replaces the key. `enabled` is the card's
 * switch, never part of an edit. A header type that differs from the saved one is
 * sent too, so the header tested is the header saved. An empty result means nothing changed.
 */
export function buildProviderPatch(
  saved: Pick<CustomProviderView, 'name' | 'baseUrl' | 'modelId' | 'headerType'>,
  form: CustomProviderForm
): UpdateCustomProviderBody {
  const patch: UpdateCustomProviderBody = {};
  const name = form.name.trim();
  const modelId = form.modelId.trim();
  if (name !== saved.name) patch.name = name;
  if (modelId !== saved.modelId) patch.modelId = modelId;
  if (hasBaseUrlChanged(saved.baseUrl, form.baseUrl)) {
    patch.baseUrl = normalizeBaseUrl(form.baseUrl);
    patch.headerType = getHeaderType(form.baseUrl);
    patch.apiKey = form.apiKey;
  } else {
    if (form.apiKey !== '') patch.apiKey = form.apiKey;
    // The header the form tested with is the one that gets saved.
    if (form.headerType !== saved.headerType) patch.headerType = form.headerType;
  }
  return patch;
}

/**
 * The text a failed save, edit, delete or toggle shows. The four address-guard
 * texts read as WinQA's own refusal (as in friendlyTestFailure); every other
 * server text passes through, with the sign-in and key-storage wordings of keys-client.
 */
export function customProviderErrorText(error: unknown): string {
  if (error instanceof KeysApiError && error.status === 400 && ADDRESS_GUARD_ERRORS.has(error.message)) {
    return `WinQA blocks this address. ${error.message}`;
  }
  return keyErrorText(error);
}

/** Text shown (title and status line) when a provider without a usable key cannot be turned on. */
export const MISSING_KEY_TEXT = 'Edit the provider and add a key first';

/**
 * What a click on a provider card's on/off switch does. Pure; the card acts on it.
 * - `ignore`: a test or a write is still running for this card.
 * - `turn-off`: set enabled to false (always allowed, key or not).
 * - `missing-key`: off and no usable key (e.g. decryption failed); stays off.
 * - `test-then-turn-on`: run the connection test; set enabled to true only on a pass.
 */
export type ToggleIntent = 'ignore' | 'turn-off' | 'missing-key' | 'test-then-turn-on';

export function toggleIntent(input: {
  enabled: boolean;
  hasKey: boolean;
  busy: boolean;
}): ToggleIntent {
  if (input.busy) return 'ignore';
  if (input.enabled) return 'turn-off';
  if (!input.hasKey) return 'missing-key';
  return 'test-then-turn-on';
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
