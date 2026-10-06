import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { cursorOf, fakeQuery, makeRows } from '@/lib/server/list-page.test-utils';

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
  find: vi.fn(),
  favoritesFind: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));
vi.mock('@/models/PromptLibrary', () => ({ default: { find: h.find } }));
vi.mock('@/models/UserFavorite', () => ({ default: { find: h.favoritesFind } }));

import { GET } from '@/app/api/prompts/route';

const VISIBILITY = { $or: [{ user_id: 'user_a' }, { is_public: true }] };
const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
const get = (qs = '') => GET(new NextRequest(`http://localhost/api/prompts${qs}`));
const favorites = (ids: Types.ObjectId[]) =>
  h.favoritesFind.mockReturnValue({ lean: async () => ids.map(prompt_id => ({ prompt_id })) });

beforeEach(() => {
  vi.clearAllMocks();
  favorites([]);
});

describe('GET /api/prompts pages the list', () => {
  it('defaults to 50: asks for 51 rows and answers 50 plus X-Next-Cursor built from the 50th', async () => {
    const rows = makeRows(51);
    const q = fakeQuery(rows);
    h.find.mockReturnValue(q);
    favorites([rows[0]._id]);

    const res = await get();

    expect(h.find).toHaveBeenCalledWith(VISIBILITY);
    expect(q.sort).toHaveBeenCalledWith({ created_at: -1, _id: -1 });
    expect(q.limit).toHaveBeenCalledWith(51);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(50);
    expect(body[0].is_favorite).toBe(true);
    expect(body[1].is_favorite).toBe(false);
    expect(res.headers.get('X-Next-Cursor')).toBe(cursorOf(rows[49].created_at, rows[49]._id));
  });

  it('sends no X-Next-Cursor when the 51-row query finds only 50', async () => {
    const q = fakeQuery(makeRows(50));
    h.find.mockReturnValue(q);
    const res = await get();
    expect(q.limit).toHaveBeenCalledWith(51);
    expect(await res.json()).toHaveLength(50);
    expect(res.headers.get('X-Next-Cursor')).toBeNull();
  });

  it('runs the list query lean and with maxTimeMS(5000)', async () => {
    const q = fakeQuery(makeRows(2));
    h.find.mockReturnValue(q);
    await get();
    expect(q.lean).toHaveBeenCalledTimes(1);
    expect(q.maxTimeMS).toHaveBeenCalledWith(5000);
  });

  it('puts the cursor clause beside the visibility, tag and favorite filters under $and', async () => {
    const fav = new Types.ObjectId();
    favorites([fav]);
    h.find.mockReturnValue(fakeQuery([]));
    await get(`?tag=safety&favorite=true&before=1759276800000_${ID}`);
    const query = h.find.mock.calls[0][0];
    expect(Object.keys(query)).toEqual(['$and']);
    const [filter, clause] = query.$and;
    expect(filter).toEqual({ ...VISIBILITY, tags: 'safety', _id: { $in: [fav.toHexString()] } });
    expect(clause.created_at.$lte).toEqual(new Date(1759276800000));
    expect(clause.$or[1]._id.$lt.toHexString()).toBe(ID);
  });

  it('answers 400 "Invalid cursor" for a malformed cursor and runs no find', async () => {
    const res = await get(`?before=1759276800000_${ID}x`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid cursor' });
    expect(h.find).not.toHaveBeenCalled();
    expect(h.favoritesFind).not.toHaveBeenCalled();
  });

  it('clamps limit=999 to 200', async () => {
    const q = fakeQuery([]);
    h.find.mockReturnValue(q);
    await get('?limit=999');
    expect(q.limit).toHaveBeenCalledWith(201);
  });
});
