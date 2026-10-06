import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * D14: DELETE /api/battle/history?id= removes one of the caller's battles. The
 * battle document is the vote record (winner, ratings, rankings live on it), so
 * the delete removes that one document; the leaderboard rows are aggregates and
 * are never touched.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
  deleteOne: vi.fn(),
  leaderboard: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    findOneAndDelete: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));
vi.mock('@/models/Battle', () => ({ default: { deleteOne: h.deleteOne } }));
vi.mock('@/models/Leaderboard', () => ({ default: h.leaderboard }));

import * as route from '@/app/api/battle/history/route';

const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
// The old route has no DELETE export; reading it off the module lets each case
// fail on its own there instead of the import failing the whole file.
const del = (qs = '') =>
  (route as unknown as { DELETE: (req: NextRequest) => Promise<Response> }).DELETE(
    new NextRequest(`http://localhost/api/battle/history${qs}`, { method: 'DELETE' })
  );

function expectLeaderboardUntouched() {
  for (const spy of Object.values(h.leaderboard)) expect(spy).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ userId: 'user_a' });
  h.deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 1 });
});

describe('D14: DELETE /api/battle/history removes one of your battles', () => {
  it('401 without a user, before the database', async () => {
    h.auth.mockResolvedValue({ userId: null });
    const res = await del(`?id=${ID}`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(h.dbConnect).not.toHaveBeenCalled();
    expect(h.deleteOne).not.toHaveBeenCalled();
  });

  it.each(['', '?id='])('400 "Battle ID is required" for %j, before the database', async (qs) => {
    const res = await del(qs);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Battle ID is required' });
    expect(h.dbConnect).not.toHaveBeenCalled();
    expect(h.deleteOne).not.toHaveBeenCalled();
  });

  it.each(['not-an-id', 'abcdefghijkl', `${ID}0`, ID.slice(1), '{"$ne":null}'])(
    '400 "Invalid battle ID" for a malformed id (%s), never echoing it',
    async (bad) => {
      const res = await del(`?id=${encodeURIComponent(bad)}`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Invalid battle ID' });
      expect(JSON.stringify(body)).not.toContain(bad);
      expect(h.dbConnect).not.toHaveBeenCalled();
      expect(h.deleteOne).not.toHaveBeenCalled();
    }
  );

  it("404 when nothing matched (another user's battle, or one already gone)", async () => {
    h.deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    const res = await del(`?id=${ID}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Battle not found' });
    expectLeaderboardUntouched();
  });

  it('200 { success: true }: one deleteOne scoped to the owner; the leaderboard is never called', async () => {
    const res = await del(`?id=${ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(h.dbConnect).toHaveBeenCalledTimes(1);
    expect(h.deleteOne).toHaveBeenCalledTimes(1);
    expect(h.deleteOne).toHaveBeenCalledWith({ _id: ID, odlUserId: 'user_a' });
    expectLeaderboardUntouched();
  });

  it('a failed delete answers 500 with a fixed sentence and logs no id', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.deleteOne.mockRejectedValue(new Error('connection reset'));
    const res = await del(`?id=${ID}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to delete battle' });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('user_a');
    expect(logged).not.toContain(ID);
    log.mockRestore();
  });
});
