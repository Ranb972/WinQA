// Browser-side wrappers for the account key routes (/api/keys,
// /api/custom-providers, and the two connection-test routes).
//
// A key travels from the browser only when the user types it: saveBuiltinKey,
// createCustomProvider and a typed test. Nothing returned from here ever holds a
// key. Every wrapper copies named fields out of the answer instead of passing the
// parsed JSON through, so even a server that echoed a key would not leak it into
// component state.

import type { LLMProvider } from '@/lib/llm/types';

export type HeaderType = 'bearer' | 'x-api-key';

/** One saved built-in key as the server describes it (GET /api/keys). Dates are ISO strings. */
export interface BuiltinKeyInfo {
  provider: LLMProvider;
  last4: string;
  updatedAt: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastRejectedAt: string | null;
}

/** One saved custom provider as the server describes it. There is no key field. */
export interface CustomProviderInfo {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  headerType: HeaderType | null;
  enabled: boolean;
  last4: string;
  hasKey: boolean;
  updatedAt: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastRejectedAt: string | null;
}

export interface KeysOverview {
  builtin: BuiltinKeyInfo[];
  custom: CustomProviderInfo[];
}

/** Body of POST /api/custom-providers. */
export interface CreateCustomProviderBody {
  name: string;
  baseUrl: string;
  modelId: string;
  headerType: HeaderType;
  enabled: boolean;
  apiKey: string;
}

/**
 * Body of PATCH /api/custom-providers/[id]: only the fields that changed.
 * `baseUrl` is accepted by the server only together with `apiKey` (D20), and
 * must come with `headerType` for the new host.
 */
export interface UpdateCustomProviderBody {
  name?: string;
  baseUrl?: string;
  modelId?: string;
  headerType?: HeaderType;
  enabled?: boolean;
  apiKey?: string;
}

/**
 * Payload of POST /api/test-custom-provider: a saved provider (no baseUrl or
 * apiKey field at all) or the typed form.
 */
export type TestCustomProviderPayload =
  | { providerId: string; modelId?: string; headerType?: HeaderType }
  | { baseUrl: string; apiKey: string; modelId: string; headerType?: HeaderType };

/** A non-2xx answer from one of the key routes. `message` is the server's `error` text. */
export class KeysApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'KeysApiError';
    this.status = status;
  }
}

/** Parsed body of a test route. Failure is `valid: false` plus `error`, whatever the HTTP status. */
export interface TestRouteBody {
  valid?: boolean;
  error?: string;
  status?: number | null;
  latencyMs?: number;
  model?: string;
}

/** What a test route answered: the HTTP status and its parsed body ({} when it was not JSON). */
export interface TestRouteAnswer {
  status: number;
  ok: boolean;
  data: TestRouteBody;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** Calls the route and returns the parsed JSON, or throws a KeysApiError carrying the server's text. */
async function request(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const data = await readJson(res);
  if (!res.ok) {
    const text = asRecord(data).error;
    throw new KeysApiError(
      typeof text === 'string' && text ? text : `Request failed (HTTP ${res.status})`,
      res.status
    );
  }
  return data;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

function toBuiltinInfo(raw: unknown): BuiltinKeyInfo {
  const r = asRecord(raw);
  return {
    provider: str(r.provider) as LLMProvider,
    last4: str(r.last4),
    updatedAt: strOrNull(r.updatedAt),
    lastTestedAt: strOrNull(r.lastTestedAt),
    lastTestOk: boolOrNull(r.lastTestOk),
    lastRejectedAt: strOrNull(r.lastRejectedAt),
  };
}

function toCustomInfo(raw: unknown): CustomProviderInfo {
  const r = asRecord(raw);
  return {
    id: str(r.id),
    name: str(r.name),
    baseUrl: str(r.baseUrl),
    modelId: str(r.modelId),
    headerType: r.headerType === 'bearer' || r.headerType === 'x-api-key' ? r.headerType : null,
    enabled: r.enabled === true,
    last4: str(r.last4),
    hasKey: r.hasKey === true,
    updatedAt: strOrNull(r.updatedAt),
    lastTestedAt: strOrNull(r.lastTestedAt),
    lastTestOk: boolOrNull(r.lastTestOk),
    lastRejectedAt: strOrNull(r.lastRejectedAt),
  };
}

/** GET /api/keys: every saved built-in key and custom provider, masked. */
export async function fetchKeys(): Promise<KeysOverview> {
  const data = asRecord(await request('/api/keys'));
  return {
    builtin: Array.isArray(data.builtin) ? data.builtin.map(toBuiltinInfo) : [],
    custom: Array.isArray(data.custom) ? data.custom.map(toCustomInfo) : [],
  };
}

/** PUT /api/keys: saves (or replaces) one built-in key. Resolves to the masked record, never the key. */
export async function saveBuiltinKey(provider: LLMProvider, apiKey: string): Promise<BuiltinKeyInfo> {
  const data = await request('/api/keys', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ provider, apiKey }),
  });
  return toBuiltinInfo(data);
}

/** DELETE /api/keys?provider=: removes one built-in key. Resolves to whether a record was deleted. */
export async function deleteBuiltinKey(provider: LLMProvider): Promise<boolean> {
  const data = asRecord(
    await request(`/api/keys?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' })
  );
  return data.deleted === true;
}

/**
 * POST /api/test-key. Without `apiKey` the field is left out of the body
 * entirely and the server tests the saved key; with it, the typed key. An empty
 * string is refused here rather than sent. Like the route, this resolves for any
 * HTTP status (failure is `valid: false` with the server's text) and rejects
 * only when the request itself fails.
 */
export async function testBuiltinKey(
  provider: LLMProvider,
  apiKey?: string
): Promise<{ valid: boolean; error?: string; status: number }> {
  if (apiKey === '') {
    throw new TypeError('testBuiltinKey: pass no key to test the saved one, or a non-empty key');
  }
  const body = apiKey === undefined ? { provider } : { provider, apiKey };
  const res = await fetch('/api/test-key', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  const data = asRecord(await readJson(res));
  const valid = data.valid === true;
  const error = typeof data.error === 'string' && data.error ? data.error : undefined;
  return {
    valid,
    status: res.status,
    ...(valid ? {} : { error: error ?? `Request failed (HTTP ${res.status})` }),
  };
}

/** POST /api/custom-providers. Resolves to the saved provider's masked record. */
export async function createCustomProvider(body: CreateCustomProviderBody): Promise<CustomProviderInfo> {
  const data = await request('/api/custom-providers', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return toCustomInfo(data);
}

/** PATCH /api/custom-providers/[id]: writes only the fields in `patch`. */
export async function updateCustomProvider(
  id: string,
  patch: UpdateCustomProviderBody
): Promise<CustomProviderInfo> {
  const data = await request(`/api/custom-providers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
  });
  return toCustomInfo(data);
}

/** DELETE /api/custom-providers/[id]. Resolves to whether a record was deleted. */
export async function deleteCustomProvider(id: string): Promise<boolean> {
  const data = asRecord(
    await request(`/api/custom-providers/${encodeURIComponent(id)}`, { method: 'DELETE' })
  );
  return data.deleted === true;
}

/**
 * POST /api/test-custom-provider. Resolves to the HTTP status and parsed body for
 * any answer, because lib/custom-providers maps the status itself (the route's 429
 * and address-guard 400 have their own wording); rejects only when the request fails.
 */
export async function testCustomProvider(payload: TestCustomProviderPayload): Promise<TestRouteAnswer> {
  const res = await fetch('/api/test-custom-provider', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const data = (await readJson(res)) as TestRouteBody;
  return { status: res.status, ok: res.ok, data: asRecord(data) as TestRouteBody };
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "2 Oct" for an ISO date string, or null when there is no usable date. */
export function formatKeyDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : SHORT_DATE.format(date);
}

/** The text a failed key action shows. Server texts pass through; 401 and a missing key ring get their own. */
export function keyErrorText(error: unknown): string {
  if (error instanceof KeysApiError) {
    if (error.status === 401) return 'Sign in again to manage your keys.';
    if (error.status === 500 && error.message === 'Key storage is not configured') {
      return 'Key storage is not configured on this server, so keys cannot be saved yet.';
    }
    return error.message;
  }
  return 'Could not reach the server. Check your connection and try again.';
}
