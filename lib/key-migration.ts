// Helpers for moving the keys a browser still holds (localStorage) to the
// account (Batch C, C14). Pure and import-safe: no window access outside
// notifyKeysChanged / subscribeKeysChanged, no imports besides a text constant.

import { UNREACHABLE_PROVIDER_ERROR } from '@/lib/friendly-errors';

/** The two legacy browser stores. Nothing else is ever read or removed. */
export const LEGACY_API_KEYS_KEY = 'winqa_api_keys';
export const LEGACY_CUSTOM_PROVIDERS_KEY = 'winqa_custom_providers';

/** Fired on window after a wipe, so open pages reload providers and keys. */
export const KEYS_CHANGED_EVENT = 'winqa:keys-changed';

/** sessionStorage flag set by "Not now". */
export const BANNER_DISMISSED_KEY = 'winqa_key_migration_dismissed';

export const SUNSET_DATE = 'October 31, 2026';
export const BANNER_TEXT = `Your keys are stored in this browser. Move them to your account. Browser storage ends on ${SUNSET_DATE}.`;

export const OTHER_ACCOUNT_MESSAGE = 'Some keys belong to another account on this browser';
export const CHANGED_MESSAGE = 'Your browser keys changed while moving; your browser copy was kept';
export const READ_FAILED_MESSAGE = 'Could not read the keys stored in this browser';
export const NOT_SAVED_MESSAGE = 'Some providers could not be saved; your browser copy was kept';

/** Per-request caps of POST /api/keys/migrate. */
export const MAX_BUILTIN_ENTRIES = 4;
export const MAX_CUSTOM_ENTRIES = 20;

/** Skip reasons of the route that mean "try again", not "the server decided". */
const SAVE_FAILED_REASON = 'Could not save';
const RETRYABLE_SKIP_REASONS: ReadonlySet<string> = new Set([
  SAVE_FAILED_REASON,
  // The route's 5 s DNS budget can answer this for a host that is fine.
  UNREACHABLE_PROVIDER_ERROR,
]);

export interface LegacyProviderLike {
  name: string;
  baseUrl: string;
  modelId: string;
  apiKey: string;
  enabled: boolean;
  headerType?: 'bearer' | 'x-api-key';
}

export interface MigrateCustomEntry {
  name: string;
  baseUrl: string;
  modelId: string;
  headerType?: 'bearer' | 'x-api-key';
  enabled: boolean;
  apiKey: string;
}

export interface MigrateBody {
  builtin: Record<string, string>;
  custom: MigrateCustomEntry[];
}

/** One skipped item as the route reports it: a provider id or a name, and why. */
export interface MigrateSkip {
  item: string;
  reason: string;
}

/**
 * Legacy shapes to the route's body. Entries without a key are dropped, the
 * built-ins are capped at 4 and the custom providers at 20 (the route answers
 * 400 above that); `enabled` is kept. Ids and anything else are not sent.
 * A custom provider with an empty key is still sent (key trimmed to ''), so the
 * route reports it as a skip and the toast lists it instead of it vanishing.
 */
export function buildMigrateBody(
  keys: Record<string, string | undefined>,
  providers: readonly LegacyProviderLike[]
): MigrateBody {
  const builtin: Record<string, string> = {};
  let count = 0;
  for (const [provider, value] of Object.entries(keys)) {
    if (count >= MAX_BUILTIN_ENTRIES) break;
    if (typeof value !== 'string' || !value.trim()) continue;
    builtin[provider] = value.trim();
    count++;
  }

  const custom: MigrateCustomEntry[] = [];
  for (const p of providers) {
    if (custom.length >= MAX_CUSTOM_ENTRIES) break;
    custom.push({
      name: p.name,
      baseUrl: p.baseUrl,
      modelId: p.modelId,
      ...(p.headerType ? { headerType: p.headerType } : {}),
      enabled: p.enabled === true,
      apiKey: typeof p.apiKey === 'string' ? p.apiKey.trim() : '',
    });
  }
  return { builtin, custom };
}

export interface WipeDecision {
  wipe: boolean;
  /** Why the browser copy is kept (empty when wipe is true). */
  messages: string[];
}

/**
 * Whether both legacy stores may be removed after a migrate call. All must hold:
 * HTTP 200; every local entry decrypted under the current user; the stores are
 * unchanged since they were read; no skip is
 * 'Could not save' or the unreachable text. The other skips (server already has
 * it, duplicate, over the cap, a rejected entry) are the server's final answer.
 * A non-200 adds no message here: the caller shows the server's own text.
 */
export function decideWipe(input: {
  status: number;
  skipped: readonly MigrateSkip[];
  decryptFailures: number;
  /** The raw legacy entries differ from before the upload (another tab wrote). */
  storageChanged?: boolean;
}): WipeDecision {
  if (input.status !== 200) return { wipe: false, messages: [] };
  const messages: string[] = [];
  if (input.storageChanged) messages.push(CHANGED_MESSAGE);
  if (input.decryptFailures > 0) messages.push(OTHER_ACCOUNT_MESSAGE);
  if (input.skipped.some((s) => RETRYABLE_SKIP_REASONS.has(s.reason))) {
    messages.push(NOT_SAVED_MESSAGE);
  }
  return { wipe: messages.length === 0, messages };
}

/** A 200 body of the route as counts and skips; null when it is not that shape. */
export function parseMigrateResponse(
  body: unknown
): { movedCount: number; skipped: MigrateSkip[] } | null {
  if (!body || typeof body !== 'object') return null;
  const { moved, skipped } = body as { moved?: unknown; skipped?: unknown };
  if (!moved || typeof moved !== 'object' || !Array.isArray(skipped)) return null;
  const { builtin, custom } = moved as { builtin?: unknown; custom?: unknown };
  if (!Array.isArray(builtin) || !Array.isArray(custom)) return null;
  const out: MigrateSkip[] = [];
  for (const s of skipped) {
    if (!s || typeof s !== 'object') return null;
    const { item, reason } = s as { item?: unknown; reason?: unknown };
    if (typeof item !== 'string' || typeof reason !== 'string') return null;
    out.push({ item, reason });
  }
  return { movedCount: builtin.length + custom.length, skipped: out };
}

/** `item: reason`, verbatim. Reads only those two fields, so nothing else can leak. */
export function formatSkip(skip: MigrateSkip): string {
  return `${skip.item}: ${skip.reason}`;
}

/** Toast title and body for a finished move. */
export function summarizeMove(movedCount: number, skipped: readonly MigrateSkip[]): {
  title: string;
  lines: string[];
} {
  return {
    title: `Moved ${movedCount}, skipped ${skipped.length}`,
    lines: skipped.map(formatSkip),
  };
}

/** Tells the open pages in this tab to reload providers and keys. */
export function notifyKeysChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(KEYS_CHANGED_EVENT));
}

/**
 * Calls `onChange` after a wipe in this tab (KEYS_CHANGED_EVENT) or in another
 * tab (the `storage` event for either legacy key, or a full clear). Returns the
 * unsubscribe function.
 */
export function subscribeKeysChanged(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LEGACY_API_KEYS_KEY || e.key === LEGACY_CUSTOM_PROVIDERS_KEY) {
      onChange();
    }
  };
  window.addEventListener(KEYS_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(KEYS_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
