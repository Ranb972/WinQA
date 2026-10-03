// Client-side helpers for the custom-provider picker and the /api/chat body
// (Chat Lab, Code Testing). Pure and import-safe: type-only imports, no
// window access outside fetchServerProviders.
//
// Dual-read rules (Batch C, C13):
// - Providers saved on the account come from GET /api/keys and are sent as
//   models: 'custom:<id>' only. No customProvider, no key, no base URL.
// - Providers still in this browser (lib/custom-providers.ts) keep the legacy
//   body path until moved. A provider present on both sides shows once, as
//   the server one.
// - Built-in requests carry customApiKeys only while an un-migrated local
//   blob holds at least one key.

import type { ApiKeys } from '@/lib/api-keys';
import type { CustomProvider } from '@/lib/custom-providers';

export const IN_BROWSER_SUFFIX = ' (in this browser)';

/** The two 400 texts app/api/chat/route.ts returns for a stale provider id. */
export const PROVIDER_DISABLED_ERROR = 'This custom provider is disabled';
export const PROVIDER_NOT_FOUND_ERROR = 'Custom provider not found';

/** Public fields of a saved provider (GET /api/keys `custom`); never a key. */
export interface ServerProvider {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  enabled: boolean;
}

export interface PickerProvider {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  enabled: boolean;
  source: 'server' | 'local';
  /** Picker text: the name, plus " (in this browser)" for a local provider. */
  label: string;
  /** The legacy object, kept only for source 'local' (sent as customProvider). */
  local?: CustomProvider;
}

/** True when the legacy blob holds at least one non-empty key. */
export function shouldAttachLocalKeys(keys: ApiKeys | null | undefined): boolean {
  if (!keys || typeof keys !== 'object') return false;
  return Object.values(keys).some((v) => typeof v === 'string' && v.trim().length > 0);
}

/** Reads the `custom` list of a GET /api/keys body; anything malformed is skipped. */
export function parseServerProviders(body: unknown): ServerProvider[] {
  if (!body || typeof body !== 'object') return [];
  const list = (body as { custom?: unknown }).custom;
  if (!Array.isArray(list)) return [];
  const out: ServerProvider[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    if (
      typeof p.id !== 'string' || !p.id ||
      typeof p.name !== 'string' ||
      typeof p.baseUrl !== 'string' ||
      typeof p.modelId !== 'string' ||
      typeof p.enabled !== 'boolean'
    ) {
      continue;
    }
    out.push({ id: p.id, name: p.name, baseUrl: p.baseUrl, modelId: p.modelId, enabled: p.enabled });
  }
  return out;
}

/** GET /api/keys once; a 401, a 500 or a network error means no server providers. */
export async function fetchServerProviders(
  fetchImpl: typeof fetch = fetch
): Promise<ServerProvider[]> {
  try {
    const res = await fetchImpl('/api/keys', { cache: 'no-store' });
    if (!res.ok) return [];
    return parseServerProviders(await res.json());
  } catch {
    return [];
  }
}

function sameProviderKey(p: { baseUrl: string; modelId: string; name: string }): string {
  return [
    p.baseUrl.trim().replace(/\/+$/, '').toLowerCase(),
    p.modelId.trim(),
    p.name.trim().toLowerCase(),
  ].join('\n');
}

/**
 * Picker list: enabled server providers first, then enabled local providers
 * that have no server twin (same base URL + model id + name). The twin check
 * runs against every saved provider, disabled ones included, so a provider
 * that was moved and then switched off does not come back from the browser.
 */
export function mergeProviders(
  server: ServerProvider[],
  local: CustomProvider[]
): PickerProvider[] {
  const saved = new Set(server.map(sameProviderKey));
  const out: PickerProvider[] = [];
  for (const p of server) {
    if (!p.enabled) continue;
    out.push({ ...p, source: 'server', label: p.name });
  }
  for (const p of local) {
    if (!p.enabled || saved.has(sameProviderKey(p))) continue;
    out.push({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      modelId: p.modelId,
      enabled: p.enabled,
      source: 'local',
      label: `${p.name}${IN_BROWSER_SUFFIX}`,
      local: p,
    });
  }
  return out;
}

/**
 * The shape ModelSelector expects. It reads id and name only; the key field is
 * empty and nothing here carries the legacy key.
 */
export function toSelectorProvider(p: PickerProvider): CustomProvider {
  return {
    id: p.id,
    name: p.label,
    baseUrl: p.baseUrl,
    apiKey: '',
    modelId: p.modelId,
    enabled: p.enabled,
  };
}

/**
 * Body for POST /api/chat.
 * - 'custom:<id>' of a server provider: ids only.
 * - 'custom:<id>' of a local provider: the legacy customProvider object.
 * - a built-in model: customApiKeys only while the local blob holds a key.
 */
export function buildChatBody(
  base: Record<string, unknown>,
  opts: { model: string; localKeys?: ApiKeys | null; provider?: PickerProvider }
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...base, models: opts.model };
  if (opts.model.startsWith('custom:')) {
    if (opts.provider?.source === 'local' && opts.provider.local) {
      body.customProvider = opts.provider.local;
    }
    return body;
  }
  if (shouldAttachLocalKeys(opts.localKeys)) {
    body.customApiKeys = opts.localKeys;
  }
  return body;
}

/**
 * Latest-wins guard for async loads. begin() returns a check that is true only
 * while no later begin() or invalidate() has happened, so a slow earlier load
 * (for example the run before Clerk has a user) cannot overwrite a newer one.
 */
export function createLatestGuard(): { begin: () => () => boolean; invalidate: () => void } {
  let current = 0;
  return {
    begin() {
      const mine = ++current;
      return () => mine === current;
    },
    invalidate() {
      current++;
    },
  };
}

/** True for the two chat-route 400s that mean the provider list is out of date. */
export function isStaleProviderError(message: unknown): boolean {
  return (
    typeof message === 'string' &&
    (message.trim() === PROVIDER_DISABLED_ERROR || message.trim() === PROVIDER_NOT_FOUND_ERROR)
  );
}
