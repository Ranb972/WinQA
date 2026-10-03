/**
 * Field checks shared by POST /api/custom-providers and PATCH/DELETE
 * /api/custom-providers/[id]. Server-only (lib/security uses node:dns). Not a
 * route file: a route.ts may export only handlers and route config, so the
 * shared code lives beside the routes.
 *
 * Every check runs before dbConnect. Each returns the message the route sends
 * with a 400, or the cleaned value.
 */

import {
  checkProviderUrl,
  resolveProviderAddress,
  ProviderUrlError,
  UNREACHABLE_PROVIDER_ERROR,
} from '@/lib/security';
import { normalizeBaseUrl } from '@/lib/llm/models';
// The chat path's and the connection test's provider deadline; the DNS vetting
// of a saved base URL gets the same budget.
import { DEFAULT_PROVIDER_TIMEOUT_MS } from '@/lib/llm/provider-timeout';
import { CREDENTIAL_LIMITS, type CredentialHeaderType } from '@/models/ProviderCredential';

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export const NAME_ERROR = `Name must be 1 to ${CREDENTIAL_LIMITS.name} characters`;
export const MODEL_ID_ERROR = `Model ID must be 1 to ${CREDENTIAL_LIMITS.modelId} characters`;
export const HEADER_TYPE_ERROR = 'Header type must be "bearer" or "x-api-key"';
export const ENABLED_ERROR = 'enabled must be true or false';
export const INVALID_JSON_ERROR = 'Invalid JSON body';
export const INVALID_BODY_ERROR = 'The request body must be a JSON object';
export const KEY_STORAGE_ERROR = 'Key storage is not configured';
/** D20: a stored key is never sent to a host it was not saved for. */
export const BASE_URL_NEEDS_KEY_ERROR = 'Enter the key again when you change the base URL';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** The lower-cased id for exactly 24 hex characters, otherwise null (the route answers 404). */
export function parseProviderId(id: unknown): string | null {
  return typeof id === 'string' && OBJECT_ID_RE.test(id) ? id.toLowerCase() : null;
}

/** The parsed JSON object body, or the 400 message. Arrays and primitives are refused. */
export async function readJsonObject(request: Request): Promise<Checked<Record<string, unknown>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: INVALID_JSON_ERROR };
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: INVALID_BODY_ERROR };
  }
  return { ok: true, value: body as Record<string, unknown> };
}

function trimmedText(value: unknown, max: number, error: string): Checked<string> {
  if (typeof value !== 'string') return { ok: false, error };
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) return { ok: false, error };
  return { ok: true, value: trimmed };
}

export function checkName(value: unknown): Checked<string> {
  return trimmedText(value, CREDENTIAL_LIMITS.name, NAME_ERROR);
}

export function checkModelId(value: unknown): Checked<string> {
  return trimmedText(value, CREDENTIAL_LIMITS.modelId, MODEL_ID_ERROR);
}

export function checkHeaderType(value: unknown): Checked<CredentialHeaderType> {
  return value === 'bearer' || value === 'x-api-key'
    ? { ok: true, value }
    : { ok: false, error: HEADER_TYPE_ERROR };
}

export function checkEnabled(value: unknown): Checked<boolean> {
  return typeof value === 'boolean' ? { ok: true, value } : { ok: false, error: ENABLED_ERROR };
}

/**
 * The base URL guards, in Batch S's order, on every write of a base URL:
 * normalizeBaseUrl, then checkProviderUrl (S2 length cap, HTTPS, S3 literal
 * private ranges), then resolveProviderAddress (S4: every DNS answer vetted)
 * within DEFAULT_PROVIDER_TIMEOUT_MS. The normalized URL is what is vetted and
 * what is stored. A host that does not resolve, or not in time, cannot be used
 * either, so it gets the unreachable text too.
 */
export async function checkBaseUrl(value: unknown): Promise<Checked<string>> {
  if (typeof value !== 'string') {
    // checkProviderUrl gives the HTTPS message for anything that is not a string.
    return { ok: false, error: checkProviderUrl(value) ?? UNREACHABLE_PROVIDER_ERROR };
  }
  const normalized = normalizeBaseUrl(value);
  const urlError = checkProviderUrl(normalized);
  if (urlError) return { ok: false, error: urlError };
  try {
    await resolveProviderAddress(normalized, DEFAULT_PROVIDER_TIMEOUT_MS);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ProviderUrlError ? error.message : UNREACHABLE_PROVIDER_ERROR,
    };
  }
  return { ok: true, value: normalized };
}

/** `[custom-providers] <op> failed error=<class>`: never a user id, key or ciphertext. */
export function logRouteError(op: string, error: unknown): void {
  const name = error instanceof Error ? error.name : 'Error';
  console.error(`[custom-providers] ${op} failed error=${name}`);
}
