import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { makeRows, memoryModel } from '@/lib/server/list-page.test-utils';
import type { FakeRow } from '@/lib/server/list-page.test-utils';

// A collection seeded above the page size: the route must hand out the cursor
// header, the next page must continue where the last one stopped with no row
// repeated or skipped, and the last page must send no cursor. Production data
// is below the page size, so this is the only place paging past a page is proven.
const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
  find: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));
vi.mock('@/models/BugReport', () => ({ default: { find: (filter: unknown) => h.find(filter) } }));

import { GET } from '@/app/api/bugs/route';

const get = (qs = '') => GET(new NextRequest(`http://localhost/api/bugs${qs}`));
const ids = (rows: { _id: string }[]) => rows.map(r => r._id);

// 120 rows; every fourth belongs to someone else and is private (never visible),
// every tenth is public (visible to everyone). Pairs share a millisecond.
const all: FakeRow[] = makeRows(120).map((r, i) => ({
  ...r,
  user_id: i % 4 === 0 ? 'user_other' : 'user_a',
  is_public: i % 10 === 0,
}));
const visible = all.filter(r => r.user_id === 'user_a' || r.is_public).map(r => r._id.toHexString());

beforeEach(() => {
  vi.clearAllMocks();
  const model = memoryModel(all, 'created_at');
  h.find.mockImplementation((filter: unknown) => model.find(filter as Record<string, unknown>));
});

describe('GET /api/bugs over a collection larger than one page', () => {
  it(`has ${visible.length} visible rows, more than the default page of 50`, () => {
    expect(visible.length).toBeGreaterThan(50);
  });

  it('page 1 is 50 rows with a cursor; page 2 continues with no overlap; the last page has no cursor', async () => {
    const first = await get();
    expect(first.status).toBe(200);
    const page1: { _id: string }[] = await first.json();
    expect(page1).toHaveLength(50);
    const cursor1 = first.headers.get('X-Next-Cursor');
    expect(cursor1).toMatch(/^[0-9]{13}_[0-9a-f]{24}$/);

    const second = await get(`?before=${cursor1}`);
    expect(second.status).toBe(200);
    const page2: { _id: string }[] = await second.json();
    expect(page2.length).toBeGreaterThan(0);
    expect(page2.length).toBeLessThanOrEqual(50);
    const overlap = ids(page1).filter(id => ids(page2).includes(id));
    expect(overlap).toEqual([]);

    const seen = [...ids(page1), ...ids(page2)];
    let cursor = second.headers.get('X-Next-Cursor');
    for (let guard = 0; cursor && guard < 10; guard++) {
      const res = await get(`?before=${cursor}`);
      expect(res.status).toBe(200);
      const rows: { _id: string }[] = await res.json();
      expect(rows.length).toBeGreaterThan(0);
      seen.push(...ids(rows));
      cursor = res.headers.get('X-Next-Cursor');
    }
    expect(cursor).toBeNull();
    expect(seen).toEqual(visible);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('a page that holds the whole collection sends no cursor', async () => {
    const res = await get('?limit=200');
    expect(res.status).toBe(200);
    const rows: { _id: string }[] = await res.json();
    expect(ids(rows)).toEqual(visible);
    expect(res.headers.get('X-Next-Cursor')).toBeNull();
  });

  it('a collection below the page size sends no cursor on the default page', async () => {
    const small = memoryModel(all.slice(0, 30), 'created_at');
    h.find.mockImplementation((filter: unknown) => small.find(filter as Record<string, unknown>));
    const res = await get();
    expect(res.status).toBe(200);
    const rows: { _id: string }[] = await res.json();
    expect(rows.length).toBeLessThan(50);
    expect(res.headers.get('X-Next-Cursor')).toBeNull();
  });
});
