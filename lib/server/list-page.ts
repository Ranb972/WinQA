import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';

// Keyset pagination for the list routes. Rows are ordered newest first on a
// date field, with _id breaking ties (seed rows are inserted in one batch and
// can share a millisecond). The cursor names the last row of the previous page
// as `<ms>_<_id>`; the next page holds the rows strictly before it in that order.
//
// The response body stays a bare array (the pages do `Array.isArray(data)`);
// the cursor travels in the X-Next-Cursor header, sent only when more rows exist.

export const NEXT_CURSOR_HEADER = 'X-Next-Cursor';

const CURSOR_RE = /^(\d{13})_([0-9a-f]{24})$/;
const LIMIT_RE = /^\d+$/;

export interface PageCursor {
  at: Date;
  id: Types.ObjectId;
}

export interface PageParams {
  limit: number;
  before: PageCursor | null;
}

export type ParsePageResult =
  | { ok: true; page: PageParams }
  | { ok: false; response: NextResponse };

/**
 * Reads `limit` and `before` from the query string. `limit` is an integer from 1
 * to `max`; a larger value is clamped to `max` and anything else falls back to
 * `def`. A `before` that is not `<13-digit ms>_<24-hex _id>` is a 400 whose text
 * does not echo the submitted value.
 */
export function parsePage(
  searchParams: URLSearchParams,
  { def, max }: { def: number; max: number },
): ParsePageResult {
  let limit = def;
  const rawLimit = searchParams.get('limit');
  if (rawLimit !== null && LIMIT_RE.test(rawLimit)) {
    const n = Number(rawLimit);
    if (n >= 1) limit = Math.min(n, max);
  }

  const rawBefore = searchParams.get('before');
  if (rawBefore === null) return { ok: true, page: { limit, before: null } };

  const match = CURSOR_RE.exec(rawBefore);
  const at = match ? new Date(Number(match[1])) : null;
  if (!match || !at || Number.isNaN(at.getTime())) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid cursor' }, { status: 400 }),
    };
  }
  return { ok: true, page: { limit, before: { at, id: new Types.ObjectId(match[2]) } } };
}

/** `<ms>_<_id>` for a row, or null when its sort value is not a usable date. */
export function encodeCursor(at: unknown, id: unknown): string | null {
  if (!(at instanceof Date)) return null;
  const ms = at.getTime();
  // Only dates from 1970 to 2286 fit the 13-digit form; a row outside that
  // range ends paging instead of producing a cursor parsePage would refuse.
  if (!Number.isInteger(ms) || ms < 0 || ms > 9_999_999_999_999) return null;
  const hex = String(id);
  if (!/^[0-9a-f]{24}$/.test(hex)) return null;
  return `${String(ms).padStart(13, '0')}_${hex}`;
}

/**
 * The strict "before" condition on (sortField, _id) for a descending sort:
 * sortField < at, or sortField == at and _id < id. Written as a range plus an
 * $or so the index on (..., sortField, _id) gets a bound on sortField.
 */
export function cursorClause(sortField: string, before: PageCursor): Record<string, unknown> {
  return {
    [sortField]: { $lte: before.at },
    $or: [{ [sortField]: { $lt: before.at } }, { _id: { $lt: before.id } }],
  };
}

type Filter = Record<string, unknown>;

// The query chain pageQuery drives, typed structurally so one helper serves every
// model and a test can pass a fake.
interface PageableQuery {
  sort(spec: Record<string, 1 | -1>): PageableQuery;
  limit(n: number): PageableQuery;
  lean(): { maxTimeMS(ms: number): PromiseLike<unknown> };
}

export interface PageableModel {
  find(filter: Filter): PageableQuery;
}

export type LeanRow = Record<string, unknown> & { _id: Types.ObjectId };

/**
 * One page of `model` matching `filter`, newest first on `sortField`. The caller's
 * filter (with its visibility $or) and the cursor clause are joined under $and,
 * so neither overwrites the other. Fetches limit + 1 rows to learn whether a
 * next page exists without a count.
 */
export async function pageQuery<Row extends { _id: unknown } = LeanRow>(
  model: PageableModel,
  filter: Filter,
  sortField: string,
  page: PageParams,
): Promise<{ rows: Row[]; nextCursor: string | null }> {
  const query = page.before ? { $and: [filter, cursorClause(sortField, page.before)] } : filter;

  const found = (await model
    .find(query)
    .sort({ [sortField]: -1, _id: -1 })
    .limit(page.limit + 1)
    .lean()
    .maxTimeMS(DB_QUERY_MAX_TIME_MS)) as Row[];

  if (found.length <= page.limit) return { rows: found, nextCursor: null };

  const rows = found.slice(0, page.limit);
  const last = rows[rows.length - 1] as Record<string, unknown>;
  return { rows, nextCursor: encodeCursor(last[sortField], last._id) };
}

/** A bare-array JSON response, with X-Next-Cursor when another page exists. */
export function pageResponse(body: unknown[], nextCursor: string | null): NextResponse {
  return NextResponse.json(
    body,
    nextCursor ? { headers: { [NEXT_CURSOR_HEADER]: nextCursor } } : undefined,
  );
}
