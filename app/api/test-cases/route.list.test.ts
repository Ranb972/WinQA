import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { cursorOf, fakeQuery, makeRows } from '@/lib/server/list-page.test-utils';

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
  find: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));
vi.mock('@/models/TestCase', () => ({ default: { find: h.find } }));

import { GET } from '@/app/api/test-cases/route';

const VISIBILITY = { $or: [{ user_id: 'user_a' }, { is_public: true }] };
const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
// The old GET took no request; passing one is harmless there.
const get = (qs = '') =>
  (GET as (req: NextRequest) => Promise<Response>)(new NextRequest(`http://localhost/api/test-cases${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/test-cases pages the list', () => {
  it('asks for 201 rows and answers 200 plus X-Next-Cursor built from the 200th', async () => {
    const rows = makeRows(201);
    const q = fakeQuery(rows);
    h.find.mockReturnValue(q);

    const res = await get();

    expect(h.find).toHaveBeenCalledWith(VISIBILITY);
    expect(q.sort).toHaveBeenCalledWith({ created_at: -1, _id: -1 });
    expect(q.limit).toHaveBeenCalledWith(201);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(200);
    expect(res.headers.get('X-Next-Cursor')).toBe(cursorOf(rows[199].created_at, rows[199]._id));
  });

  it('sends no X-Next-Cursor when the 201-row query finds only 200', async () => {
    const q = fakeQuery(makeRows(200));
    h.find.mockReturnValue(q);
    const res = await get();
    expect(q.limit).toHaveBeenCalledWith(201);
    expect(await res.json()).toHaveLength(200);
    expect(res.headers.get('X-Next-Cursor')).toBeNull();
  });

  it('runs the list query lean and with maxTimeMS(5000)', async () => {
    const q = fakeQuery(makeRows(2));
    h.find.mockReturnValue(q);
    await get();
    expect(q.lean).toHaveBeenCalledTimes(1);
    expect(q.maxTimeMS).toHaveBeenCalledWith(5000);
  });

  it('puts the cursor clause beside the visibility filter under $and', async () => {
    h.find.mockReturnValue(fakeQuery([]));
    await get(`?before=1759276800000_${ID}`);
    const query = h.find.mock.calls[0][0];
    expect(Object.keys(query)).toEqual(['$and']);
    const [filter, clause] = query.$and;
    expect(filter).toEqual(VISIBILITY);
    expect(clause.created_at.$lte).toEqual(new Date(1759276800000));
    expect(clause.$or[1]._id.$lt.toHexString()).toBe(ID);
  });

  it('answers 400 "Invalid cursor" for a malformed cursor and runs no find', async () => {
    const res = await get('?before=1759276800000');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid cursor' });
    expect(h.find).not.toHaveBeenCalled();
  });

  it('clamps limit=999 to 200', async () => {
    const q = fakeQuery([]);
    h.find.mockReturnValue(q);
    await get('?limit=999');
    expect(q.limit).toHaveBeenCalledWith(201);
  });
});
