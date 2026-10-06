import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import Battle from '@/models/Battle';
import Leaderboard from '@/models/Leaderboard';
import { BATTLE_CAPS, tooLongText } from '@/lib/content-limits';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';
import { fakeCount } from '@/lib/server/count-query.test-utils';

/**
 * A stand-in for the roll-off lookup, Battle.find(...).sort().limit().select()
 * .lean().maxTimeMS(): every step returns the same query, and awaiting it yields
 * `rows`, or rejects when `rows` is an Error.
 */
function fakeFind(rows: { _id: string }[] | Error) {
  const q = {
    sort: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
    lean: vi.fn(),
    maxTimeMS: vi.fn(),
    then<A = { _id: string }[], B = never>(
      onFulfilled?: ((value: { _id: string }[]) => A | PromiseLike<A>) | null,
      onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      const settled = rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
      return settled.then(onFulfilled, onRejected);
    },
  };
  for (const step of [q.sort, q.limit, q.select, q.lean, q.maxTimeMS]) step.mockReturnValue(q);
  return q;
}

/**
 * D6: a vote checks every stored text against its cap, at most four rankings and
 * the ratings object before the database, and answers a schema ValidationError
 * with 400 and a text that names the field, never the value. (The 512 KB body cap
 * and the `{` case are D5's, in app/api/request-body-caps.test.ts.)
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));

import { POST } from '@/app/api/battle/vote/route';

const RATING = { accuracy: 4, creativity: 3, clarity: 5, total: 12 };
const RANKING = { model: 'm', provider: 'groq', rank: 1, score: 12 };
const VOTE = {
  challengeId: 'c1',
  challengeName: 'Challenge',
  prompt: 'Write a haiku',
  battleType: 'standard',
  modelA: { provider: 'groq', model: 'a' },
  modelB: { provider: 'gemini', model: 'b' },
  responseA: { content: 'A', responseTime: 10, specificModel: 'a-1' },
  responseB: { content: 'B', responseTime: 20 },
  ratings: { modelA: RATING, modelB: RATING },
  winner: 'modelA',
};
const fill = (n: number) => 'Z'.repeat(n);

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/battle/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

type Body = Record<string, unknown>;
const withPart = (part: string, field: string) => (body: Body, value: string) => {
  body[part] = { ...(body[part] as object), [field]: value };
};
const FIELDS: { path: string; cap: number; set: (body: Body, value: string) => void }[] = [
  { path: 'challengeId', cap: BATTLE_CAPS.challengeId, set: (b, v) => (b.challengeId = v) },
  { path: 'challengeName', cap: BATTLE_CAPS.challengeName, set: (b, v) => (b.challengeName = v) },
  { path: 'prompt', cap: BATTLE_CAPS.prompt, set: (b, v) => (b.prompt = v) },
  { path: 'modelA.provider', cap: BATTLE_CAPS.provider, set: withPart('modelA', 'provider') },
  { path: 'modelB.model', cap: BATTLE_CAPS.model, set: withPart('modelB', 'model') },
  { path: 'responseA.content', cap: BATTLE_CAPS.content, set: withPart('responseA', 'content') },
  { path: 'responseB.content', cap: BATTLE_CAPS.content, set: withPart('responseB', 'content') },
  { path: 'responseA.specificModel', cap: BATTLE_CAPS.specificModel, set: withPart('responseA', 'specificModel') },
  { path: 'responseB.error', cap: BATTLE_CAPS.error, set: withPart('responseB', 'error') },
  { path: 'rankings.0.model', cap: BATTLE_CAPS.model, set: (b, v) => (b.rankings = [{ ...RANKING, model: v }]) },
  { path: 'rankings.0.provider', cap: BATTLE_CAPS.provider, set: (b, v) => (b.rankings = [{ ...RANKING, provider: v }]) },
];

let create: MockInstance;
let count: MockInstance;
let find: MockInstance;
let deleteMany: MockInstance;

beforeEach(() => {
  h.auth.mockResolvedValue({ userId: 'user_a' });
  h.dbConnect.mockClear();
  // D7: the per-user battle count; 0 battles unless a test says otherwise.
  count = vi.spyOn(Battle, 'countDocuments').mockImplementation((() => fakeCount(0)) as never);
  // D14: the roll-off lookup and delete; a test at the ceiling sets what they find.
  find = vi.spyOn(Battle, 'find').mockImplementation((() => fakeFind([])) as never);
  deleteMany = vi
    .spyOn(Battle, 'deleteMany')
    .mockImplementation((async () => ({ acknowledged: true, deletedCount: 0 })) as never);
  // A saved document serialises through toJSON, as a Mongoose document does.
  create = vi.spyOn(Battle, 'create').mockImplementation((async (doc: Record<string, unknown>) => {
    const saved = { _id: 'b1', ...doc };
    return { ...saved, toJSON: () => saved };
  }) as never);
  vi.spyOn(Leaderboard, 'findOne').mockImplementation((async () => null) as never);
  vi.spyOn(Leaderboard, 'create').mockImplementation((async () => ({})) as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectNoWrite() {
  expect(h.dbConnect).not.toHaveBeenCalled();
  expect(count).not.toHaveBeenCalled();
  expect(deleteMany).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
}

describe('D6: POST /api/battle/vote caps every stored text', () => {
  it.each(FIELDS)('$path one over its cap ($cap) gives 400 naming it, no create', async ({ path, cap, set }) => {
    const body: Body = structuredClone(VOTE);
    set(body, fill(cap + 1));
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: tooLongText(path, cap) });
    expectNoWrite();
  });

  it('every text exactly at its cap, in a four-fighter royale with four rankings, is saved', async () => {
    const atCap = (n: number) => fill(n);
    const fighter = { provider: atCap(BATTLE_CAPS.provider), model: atCap(BATTLE_CAPS.model) };
    const response = {
      content: atCap(BATTLE_CAPS.content),
      responseTime: 5,
      specificModel: atCap(BATTLE_CAPS.specificModel),
      error: atCap(BATTLE_CAPS.error),
    };
    const ranking = { model: atCap(BATTLE_CAPS.model), provider: atCap(BATTLE_CAPS.provider), rank: 1, score: 9 };
    const body = {
      ...VOTE,
      battleType: 'royale',
      challengeId: atCap(BATTLE_CAPS.challengeId),
      challengeName: atCap(BATTLE_CAPS.challengeName),
      prompt: atCap(BATTLE_CAPS.prompt),
      modelA: fighter,
      modelB: fighter,
      modelC: fighter,
      modelD: fighter,
      responseA: response,
      responseB: response,
      responseC: response,
      responseD: response,
      ratings: { modelA: RATING, modelB: RATING, modelC: RATING, modelD: RATING },
      rankings: [ranking, ranking, ranking, ranking],
    };
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
    expect(Leaderboard.create).toHaveBeenCalledTimes(4);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        odlUserId: 'user_a',
        prompt: body.prompt,
        responseD: response,
        rankings: body.rankings,
      })
    );
  });

  it('five rankings give 400 naming rankings, no create', async () => {
    const res = await post({ ...VOTE, rankings: Array(5).fill(RANKING) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'rankings has more than 4 entries' });
    expectNoWrite();
  });

  it('a missing ratings object gives 400, not the 500 a TypeError gave', async () => {
    const { ratings: _ratings, ...body } = VOTE;
    void _ratings;
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ratings must be an object' });
    expectNoWrite();
  });

  it('the existing enum checks now answer before the database', async () => {
    const res = await post({ ...VOTE, winner: 'nobody' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid winner value' });
    expectNoWrite();
  });
});

describe('D6: a schema ValidationError answers 400, not 500', () => {
  it('a rejected create names the path and never echoes the value', async () => {
    const invalid = new Battle({
      ...VOTE,
      odlUserId: 'user_a',
      responseA: { content: 'A', responseTime: 'SECRET_VALUE' },
    }).validateSync();
    create.mockRejectedValueOnce(invalid);
    const res = await post(VOTE);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'responseA.responseTime is not a valid value' });
    expect(JSON.stringify(body)).not.toContain('SECRET_VALUE');
  });

  it('a missing required text gives the schema sentence', async () => {
    create.mockRejectedValueOnce(new Battle({ ...VOTE, odlUserId: 'user_a', challengeId: undefined }).validateSync());
    const res = await post(VOTE);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Path `challengeId` is required.' });
  });

  it('any other failure is still the 500 it was', async () => {
    create.mockRejectedValueOnce(new Error('connection reset'));
    const res = await post(VOTE);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to save battle' });
  });
});

describe('D14: at the per-user ceiling of 500 the oldest battle rolls off; a vote is never refused for it', () => {
  const OLD = ['65f0a1b2c3d4e5f6a7b8c901', '65f0a1b2c3d4e5f6a7b8c902', '65f0a1b2c3d4e5f6a7b8c903'];
  const LEADERBOARD_ROW = {
    _id: 'lb1',
    totalBattles: 2,
    avgAccuracy: 3,
    avgCreativity: 3,
    avgClarity: 3,
    avgTotal: 9,
  };

  function atCount(n: number, oldest: { _id: string }[] = []) {
    count.mockImplementation((() => fakeCount(n)) as never);
    const lookup = fakeFind(oldest);
    find.mockImplementation((() => lookup) as never);
    deleteMany.mockImplementation((async () => ({ acknowledged: true, deletedCount: oldest.length })) as never);
    return lookup;
  }

  it('499 saved battles: nothing is looked up or deleted; 201 with rolledOff 0', async () => {
    const query = fakeCount(499);
    count.mockImplementation((() => query) as never);
    const res = await post(VOTE);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.rolledOff).toBe(0);
    expect(body.odlUserId).toBe('user_a');
    expect(count).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0][0]).toEqual({ odlUserId: 'user_a' });
    expect(query.maxTimeMS).toHaveBeenCalledWith(DB_QUERY_MAX_TIME_MS);
    expect(find).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("500: the owner's oldest battle is deleted, then the vote is saved; 201 with rolledOff 1", async () => {
    const lookup = atCount(500, [{ _id: OLD[0] }]);
    const res = await post(VOTE);
    expect(res.status).toBe(201);
    expect((await res.json()).rolledOff).toBe(1);

    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls[0][0]).toEqual({ odlUserId: 'user_a' });
    expect(lookup.sort).toHaveBeenCalledWith({ created_at: 1, _id: 1 });
    expect(lookup.limit).toHaveBeenCalledWith(1);
    expect(lookup.select).toHaveBeenCalledWith('_id');
    expect(lookup.maxTimeMS).toHaveBeenCalledWith(DB_QUERY_MAX_TIME_MS);

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany.mock.calls[0][0]).toEqual({ _id: { $in: [OLD[0]] }, odlUserId: 'user_a' });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ odlUserId: 'user_a', prompt: VOTE.prompt }));
    const order = [count, find, deleteMany, create].map((spy) => spy.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('502 (saved before the ceiling): the three oldest go, leaving 500 with the new one', async () => {
    const lookup = atCount(502, OLD.map((_id) => ({ _id })));
    const res = await post(VOTE);
    expect(res.status).toBe(201);
    expect((await res.json()).rolledOff).toBe(3);
    expect(lookup.limit).toHaveBeenCalledWith(3);
    expect(deleteMany.mock.calls[0][0]).toEqual({ _id: { $in: OLD }, odlUserId: 'user_a' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rolledOff reports what the delete removed, not what the lookup found', async () => {
    atCount(500, [{ _id: OLD[0] }]);
    deleteMany.mockImplementation((async () => ({ acknowledged: true, deletedCount: 0 })) as never);
    const res = await post(VOTE);
    expect(res.status).toBe(201);
    expect((await res.json()).rolledOff).toBe(0);
  });

  it('the leaderboard sees the same calls at the ceiling as below it, and no leaderboard row is deleted', async () => {
    const leaderboardCalls = async (n: number) => {
      const findOne = vi
        .spyOn(Leaderboard, 'findOne')
        .mockImplementation((async (filter: { provider: string }) =>
          filter.provider === 'groq' ? LEADERBOARD_ROW : null) as never);
      const updateOne = vi.spyOn(Leaderboard, 'updateOne').mockImplementation((async () => ({})) as never);
      const lbCreate = vi.spyOn(Leaderboard, 'create').mockImplementation((async () => ({})) as never);
      atCount(n, n >= 500 ? [{ _id: OLD[0] }] : []);
      expect((await post(VOTE)).status).toBe(201);
      const calls = {
        findOne: structuredClone(findOne.mock.calls),
        updateOne: structuredClone(updateOne.mock.calls).map(([filter, update]) => [
          filter,
          { ...(update as Record<string, unknown>), $set: { ...(update as { $set: object }).$set, updated_at: 'now' } },
        ]),
        create: structuredClone(lbCreate.mock.calls),
      };
      findOne.mockClear();
      updateOne.mockClear();
      lbCreate.mockClear();
      return calls;
    };
    const lbDeletes = (['deleteOne', 'deleteMany', 'findOneAndDelete', 'updateMany'] as const).map((name) =>
      vi.spyOn(Leaderboard, name).mockImplementation((async () => ({})) as never)
    );

    const below = await leaderboardCalls(0);
    const atCeiling = await leaderboardCalls(500);
    expect(below.findOne).toHaveLength(2);
    expect(below.updateOne).toHaveLength(1);
    expect(below.create).toHaveLength(1);
    expect(atCeiling).toEqual(below);
    for (const spy of lbDeletes) expect(spy).not.toHaveBeenCalled();
  });

  it('a count that fails answers 500: nothing is looked up, deleted or saved', async () => {
    count.mockImplementation((() => fakeCount(new Error('operation exceeded time limit'))) as never);
    const res = await post(VOTE);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to save battle' });
    expect(find).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(Leaderboard.findOne).not.toHaveBeenCalled();
  });

  it('a lookup that fails answers 500: nothing is deleted or saved', async () => {
    atCount(500);
    find.mockImplementation((() => fakeFind(new Error('operation exceeded time limit'))) as never);
    const res = await post(VOTE);
    expect(res.status).toBe(500);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(Leaderboard.findOne).not.toHaveBeenCalled();
  });

  it('a delete that fails answers 500: the vote is not saved and the leaderboard is untouched', async () => {
    atCount(500, [{ _id: OLD[0] }]);
    deleteMany.mockImplementation((async () => {
      throw new Error('connection reset');
    }) as never);
    const res = await post(VOTE);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to save battle' });
    expect(create).not.toHaveBeenCalled();
    expect(Leaderboard.findOne).not.toHaveBeenCalled();
    expect(Leaderboard.create).not.toHaveBeenCalled();
  });

  it('the log line on a failure carries no user id or vote content', async () => {
    atCount(500, [{ _id: OLD[0] }]);
    deleteMany.mockImplementation((async () => {
      throw new Error('connection reset');
    }) as never);
    await post(VOTE);
    const logged = JSON.stringify((console.error as unknown as MockInstance).mock.calls);
    expect(logged).not.toContain('user_a');
    expect(logged).not.toContain(VOTE.prompt);
  });
});
