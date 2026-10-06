// Client side of the list paging (D10/D11). The list routes answer a bare array
// and, when more rows exist, an X-Next-Cursor header naming the last row sent.
// The pages keep that cursor, ask for `?before=<cursor>` on "Load more", and
// append the next page. Pure helpers only: no fetch, no React, no DOM.

export const NEXT_CURSOR_HEADER = 'X-Next-Cursor';

// The form lib/server/list-page.ts builds and accepts: <13-digit ms>_<24-hex _id>.
const CURSOR_RE = /^\d{13}_[0-9a-f]{24}$/;

/**
 * The next-page cursor from a list response, or null when there is no next page.
 * A missing header, or a value the routes would refuse, ends paging.
 */
export function readNextCursor(response: { headers: { get(name: string): string | null } }): string | null {
  const value = response.headers.get(NEXT_CURSOR_HEADER);
  return value !== null && CURSOR_RE.test(value) ? value : null;
}

/**
 * The loaded rows followed by the rows of `page` not already loaded (by `_id`).
 * A row loaded twice keeps its loaded copy, so a local edit is not overwritten.
 */
export function mergePage<T extends { _id: string }>(existing: readonly T[], page: readonly T[]): T[] {
  const seen = new Set(existing.map(row => row._id));
  const merged = existing.slice();
  for (const row of page) {
    if (seen.has(row._id)) continue;
    seen.add(row._id);
    merged.push(row);
  }
  return merged;
}

/** Server-side filters by query parameter name; null, undefined, '' and false are "not set". */
export type ListFilters = Record<string, string | boolean | null | undefined>;

/**
 * The filters as a query string, names sorted so equal filters give equal
 * strings. The string doubles as the key that tells a page its filters changed.
 */
export function filterQuery(filters: ListFilters): string {
  const params = new URLSearchParams();
  for (const name of Object.keys(filters).sort()) {
    const value = filters[name];
    if (value === null || value === undefined || value === false || value === '') continue;
    params.set(name, value === true ? 'true' : value);
  }
  return params.toString();
}

/** A list route URL with its filters, then `limit` and the `before` cursor when given. */
export function listUrl(
  path: string,
  {
    filters = '',
    before = null,
    limit,
  }: { filters?: ListFilters | string; before?: string | null; limit?: number } = {},
): string {
  const params = new URLSearchParams(typeof filters === 'string' ? filters : filterQuery(filters));
  if (limit !== undefined) params.set('limit', String(limit));
  if (before) params.set('before', before);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** What a page holds: the rows loaded under the filters `key`, and the next cursor. */
export interface PagingState<T> {
  key: string;
  rows: T[];
  cursor: string | null;
}

export function emptyPaging<T>(key: string): PagingState<T> {
  return { key, rows: [], cursor: null };
}

/**
 * The filters are now `key`. Rows and cursor loaded under other filters no
 * longer describe the list, so both are dropped; the same key keeps the state.
 */
export function changeFilters<T>(state: PagingState<T>, key: string): PagingState<T> {
  return state.key === key ? state : emptyPaging<T>(key);
}

/**
 * A page arrived. A first page (`append: false`) replaces the list. A next page
 * appends with the `_id` dedupe and carries the new cursor (null ends paging);
 * one fetched under filters the state no longer has is dropped.
 */
export function receivePage<T extends { _id: string }>(
  state: PagingState<T>,
  page: { key: string; rows: readonly T[]; cursor: string | null; append: boolean },
): PagingState<T> {
  if (!page.append) return { key: page.key, rows: mergePage([], page.rows), cursor: page.cursor };
  if (page.key !== state.key) return state;
  return { key: state.key, rows: mergePage(state.rows, page.rows), cursor: page.cursor };
}

// Local edits. The pages apply a delete, a create or a save to the rows they
// have loaded instead of reloading the first page, which would drop every page
// loaded after it.

/** The row a create or save answered with, when it has the string `_id` a list row needs. */
export function asRow<T extends { _id: string }>(data: unknown): T | null {
  return data !== null && typeof data === 'object' && typeof (data as { _id?: unknown })._id === 'string'
    ? (data as T)
    : null;
}

/** `row` first (the lists are newest first), with any loaded copy of it removed. */
export function prependRow<T extends { _id: string }>(rows: readonly T[], row: T): T[] {
  return [row, ...rows.filter(r => r._id !== row._id)];
}

/** The loaded copy of `row` updated in place with the fields it carries. */
export function replaceRow<T extends { _id: string }>(rows: readonly T[], row: Partial<T> & { _id: string }): T[] {
  return rows.map(r => (r._id === row._id ? { ...r, ...row } : r));
}

export function removeRow<T extends { _id: string }>(rows: readonly T[], id: string): T[] {
  return rows.filter(r => r._id !== id);
}

// Labels. While a cursor exists the page holds only part of the list, so counts
// and the browser-side search say what they cover.

/** "N loaded", or "S of N loaded" when browser-side filters or search show S of them. */
export function loadedLabel(shown: number, loaded: number): string {
  return shown === loaded ? `${loaded} loaded` : `${shown} of ${loaded} loaded`;
}

/** The line under a search box while more rows exist on the server. */
export function searchScopeLabel(loaded: number): string {
  return `Searching the ${loaded} loaded ${loaded === 1 ? 'item' : 'items'}`;
}
