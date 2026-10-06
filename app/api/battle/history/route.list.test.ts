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
vi.mock('@/models/Battle', () => ({ default: { find: h.find } }));

import { GET } from '@/app/api/battle/history/route';

const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
// The old GET took no request; passing one is harmless there.
const get = (qs = '') =>
  (GET as (req: NextRequest) => Promise<Response>)(
    new NextRequest(`http://localhost/api/battle/history${qs}`)
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/battle/history pages the list', () => {
  it('defaults to 20: asks for 21 rows and answers 20 plus X-Next-Cursor built from the 20th', async () => {
    const rows = makeRows(21);
    const q = fakeQuery(rows);
    h.find.mockReturnValue(q);

    const res = await get();

    expect(h.find).toHaveBeenCalledWith({ odlUserId: 'user_a' });
    expect(q.sort).toHaveBeenCalledWith({ created_at: -1, _id: -1 });
    expect(q.limit).toHaveBeenCalledWith(21);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(20);
    expect(res.headers.get('X-Next-Cursor')).toBe(cursorOf(rows[19].created_at, rows[19]._id));
  });

  it('sends no X-Next-Cursor when the 21-row query finds only 20', async () => {
    const q = fakeQuery(makeRows(20));
    h.find.mockReturnValue(q);
    const res = await get();
    expect(q.limit).toHaveBeenCalledWith(21);
    expect(await res.json()).toHaveLength(20);
    expect(res.headers.get('X-Next-Cursor')).toBeNull();
  });

  it('runs the list query lean and with maxTimeMS(5000)', async () => {
    const q = fakeQuery(makeRows(2));
    h.find.mockReturnValue(q);
    await get();
    expect(q.lean).toHaveBeenCalledTimes(1);
    expect(q.maxTimeMS).toHaveBeenCalledWith(5000);
  });

  it('puts the cursor clause beside the owner filter under $and', async () => {
    h.find.mockReturnValue(fakeQuery([]));
    await get(`?before=1759276800000_${ID}`);
    const query = h.find.mock.calls[0][0];
    expect(Object.keys(query)).toEqual(['$and']);
    const [filter, clause] = query.$and;
    expect(filter).toEqual({ odlUserId: 'user_a' });
    expect(clause.created_at.$lte).toEqual(new Date(1759276800000));
    expect(clause.$or[1]._id.$lt.toHexString()).toBe(ID);
  });

  it('answers 400 "Invalid cursor" for a malformed cursor and runs no find', async () => {
    const res = await get('?before=x');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid cursor' });
    expect(h.find).not.toHaveBeenCalled();
  });

  it('clamps limit=999 to 50', async () => {
    const q = fakeQuery([]);
    h.find.mockReturnValue(q);
    await get('?limit=999');
    expect(q.limit).toHaveBeenCalledWith(51);
  });
});
