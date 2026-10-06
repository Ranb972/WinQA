import { describe, it, expect } from 'vitest';
import {
  NEXT_CURSOR_HEADER,
  asRow,
  changeFilters,
  emptyPaging,
  filterQuery,
  listUrl,
  loadedLabel,
  mergePage,
  prependRow,
  readNextCursor,
  receivePage,
  removeRow,
  replaceRow,
  searchScopeLabel,
} from '@/lib/list-paging';

const CURSOR = '1759276800000_65f0a1b2c3d4e5f6a7b8c9d0';
const row = (id: string, title = id) => ({ _id: id, title });
const withHeader = (value?: string) =>
  new Response('[]', value === undefined ? undefined : { headers: { [NEXT_CURSOR_HEADER]: value } });

describe('readNextCursor', () => {
  it('returns the X-Next-Cursor header the list routes send', () => {
    expect(readNextCursor(withHeader(CURSOR))).toBe(CURSOR);
  });

  it('reads the header whatever its case on the wire', () => {
    const res = new Response('[]', { headers: { 'x-next-cursor': CURSOR } });
    expect(readNextCursor(res)).toBe(CURSOR);
  });

  it('returns null when the header is missing, so paging ends', () => {
    expect(readNextCursor(withHeader())).toBeNull();
  });

  it('returns null for a value the routes would refuse as a cursor', () => {
    expect(readNextCursor(withHeader(''))).toBeNull();
    expect(readNextCursor(withHeader('not-a-cursor'))).toBeNull();
    expect(readNextCursor(withHeader(`${CURSOR}x`))).toBeNull();
    expect(readNextCursor(withHeader('1759276800000_65F0A1B2C3D4E5F6A7B8C9D0'))).toBeNull();
  });
});

describe('mergePage', () => {
  it('appends the next page after the loaded rows', () => {
    const merged = mergePage([row('a'), row('b')], [row('c'), row('d')]);
    expect(merged.map(r => r._id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops rows of an overlapping page that are already loaded, keeping the loaded copy', () => {
    const loaded = [row('a'), row('b', 'edited here'), row('c')];
    const merged = mergePage(loaded, [row('b', 'from server'), row('c'), row('d')]);
    expect(merged.map(r => r._id)).toEqual(['a', 'b', 'c', 'd']);
    expect(merged[1].title).toBe('edited here');
  });

  it('drops a row repeated inside one page', () => {
    expect(mergePage([], [row('a'), row('b'), row('a')]).map(r => r._id)).toEqual(['a', 'b']);
  });

  it('does not change its inputs', () => {
    const loaded = [row('a')];
    const page = [row('a'), row('b')];
    mergePage(loaded, page);
    expect(loaded).toEqual([row('a')]);
    expect(page).toEqual([row('a'), row('b')]);
  });
});

describe('filterQuery', () => {
  it('builds the same query string whatever order the filters are given in', () => {
    expect(filterQuery({ status: 'Open', issue_type: 'Logic' })).toBe('issue_type=Logic&status=Open');
    expect(filterQuery({ issue_type: 'Logic', status: 'Open' })).toBe('issue_type=Logic&status=Open');
  });

  it('leaves out unset filters and sends true as "true"', () => {
    expect(filterQuery({ tag: null, favorite: false, status: undefined, model: '' })).toBe('');
    expect(filterQuery({ favorite: true })).toBe('favorite=true');
  });

  it('encodes the values', () => {
    expect(filterQuery({ tag: 'Edge Cases & more' })).toBe('tag=Edge+Cases+%26+more');
  });
});

describe('listUrl', () => {
  it('is the bare path with no filters and no cursor', () => {
    expect(listUrl('/api/bugs')).toBe('/api/bugs');
    expect(listUrl('/api/bugs', { filters: {}, before: null })).toBe('/api/bugs');
  });

  it('adds the filters, the limit and the cursor', () => {
    expect(listUrl('/api/bugs', { filters: { status: 'Open' }, before: CURSOR, limit: 50 })).toBe(
      `/api/bugs?status=Open&limit=50&before=${CURSOR}`,
    );
  });

  it('takes filters already turned into a query string', () => {
    expect(listUrl('/api/prompts', { filters: filterQuery({ favorite: true, tag: 'Code' }), before: CURSOR })).toBe(
      `/api/prompts?favorite=true&tag=Code&before=${CURSOR}`,
    );
  });
});

describe('paging state', () => {
  const key = filterQuery({ status: 'Open' });

  it('a first page replaces the list and keeps its cursor', () => {
    const before = { key, rows: [row('old')], cursor: CURSOR };
    const next = receivePage(before, { key, rows: [row('a'), row('b')], cursor: null, append: false });
    expect(next).toEqual({ key, rows: [row('a'), row('b')], cursor: null });
  });

  it('a next page appends with the dedupe and takes the new cursor', () => {
    const state = { key, rows: [row('a'), row('b')], cursor: CURSOR };
    const next = receivePage(state, { key, rows: [row('b'), row('c')], cursor: '1759276700000_65f0a1b2c3d4e5f6a7b8c9d1', append: true });
    expect(next.rows.map(r => r._id)).toEqual(['a', 'b', 'c']);
    expect(next.cursor).toBe('1759276700000_65f0a1b2c3d4e5f6a7b8c9d1');
  });

  it('a page that came without a header ends paging', () => {
    const state = { key, rows: [row('a')], cursor: CURSOR };
    const cursor = readNextCursor(withHeader());
    const next = receivePage(state, { key, rows: [row('b')], cursor, append: true });
    expect(next.cursor).toBeNull();
    expect(next.rows.map(r => r._id)).toEqual(['a', 'b']);
  });

  it('a filter change clears the rows and the cursor', () => {
    const state = { key, rows: [row('a'), row('b')], cursor: CURSOR };
    const changed = changeFilters(state, filterQuery({ status: 'Resolved' }));
    expect(changed).toEqual({ key: 'status=Resolved', rows: [], cursor: null });
  });

  it('the same filters keep the list and its cursor', () => {
    const state = { key, rows: [row('a')], cursor: CURSOR };
    expect(changeFilters(state, filterQuery({ status: 'Open' }))).toBe(state);
  });

  it('a next page loaded under the old filters is dropped after a filter change', () => {
    const changed = changeFilters({ key, rows: [row('a')], cursor: CURSOR }, 'status=Resolved');
    const next = receivePage(changed, { key, rows: [row('b')], cursor: CURSOR, append: true });
    expect(next).toBe(changed);
  });

  it('starts empty with no cursor', () => {
    expect(emptyPaging('')).toEqual({ key: '', rows: [], cursor: null });
  });
});

describe('local edits on the loaded rows', () => {
  it('asRow accepts a saved row and refuses anything without a string _id', () => {
    expect(asRow({ _id: 'a', title: 't' })).toEqual({ _id: 'a', title: 't' });
    expect(asRow({ message: 'ok' })).toBeNull();
    expect(asRow({ _id: 7 })).toBeNull();
    expect(asRow(null)).toBeNull();
    expect(asRow([{ _id: 'a' }])).toBeNull();
  });

  it('prependRow puts a created row first and never twice', () => {
    expect(prependRow([row('a'), row('b')], row('c')).map(r => r._id)).toEqual(['c', 'a', 'b']);
    expect(prependRow([row('a'), row('b')], row('b', 'saved')).map(r => r.title)).toEqual(['saved', 'a']);
  });

  it('replaceRow updates the loaded copy in place and keeps fields the save did not send', () => {
    const rows = [{ _id: 'a', title: 'x', is_favorite: true }, { _id: 'b', title: 'y', is_favorite: false }];
    expect(replaceRow(rows, { _id: 'a', title: 'z' })).toEqual([
      { _id: 'a', title: 'z', is_favorite: true },
      { _id: 'b', title: 'y', is_favorite: false },
    ]);
  });

  it('removeRow drops a deleted row and leaves the rest', () => {
    expect(removeRow([row('a'), row('b'), row('c')], 'b').map(r => r._id)).toEqual(['a', 'c']);
  });
});

describe('labels while more rows exist', () => {
  it('counts what is loaded, and what of it is shown', () => {
    expect(loadedLabel(50, 50)).toBe('50 loaded');
    expect(loadedLabel(12, 50)).toBe('12 of 50 loaded');
  });

  it('says the search covers the loaded items only', () => {
    expect(searchScopeLabel(50)).toBe('Searching the 50 loaded items');
    expect(searchScopeLabel(1)).toBe('Searching the 1 loaded item');
  });
});
