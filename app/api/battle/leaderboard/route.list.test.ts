import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeQuery } from '@/lib/server/list-page.test-utils';

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
  find: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));
vi.mock('@/models/Leaderboard', () => ({ default: { find: h.find } }));

import { GET } from '@/app/api/battle/leaderboard/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/battle/leaderboard is bounded', () => {
  it('keeps the 200 most played rows, lean and with maxTimeMS(5000)', async () => {
    const q = fakeQuery([]);
    h.find.mockReturnValue(q);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(h.find).toHaveBeenCalledWith({ odlUserId: 'user_a' });
    expect(q.sort).toHaveBeenCalledWith({ totalBattles: -1 });
    expect(q.limit).toHaveBeenCalledWith(200);
    expect(q.lean).toHaveBeenCalledTimes(1);
    expect(q.maxTimeMS).toHaveBeenCalledWith(5000);
  });

  it('still re-sorts the kept rows by win rate and answers a bare array without a cursor', async () => {
    h.find.mockReturnValue(
      fakeQuery([
        { provider: 'a', modelId: 'x', totalBattles: 10, wins: 2 },
        { provider: 'b', modelId: 'y', totalBattles: 4, wins: 3 },
        { provider: 'c', modelId: 'z', totalBattles: 0, wins: 0 },
      ])
    );
    const res = await GET();
    const body = await res.json();
    expect(body.map((r: { provider: string }) => r.provider)).toEqual(['b', 'a', 'c']);
    expect(res.headers.get('X-Next-Cursor')).toBeNull();
  });
});
