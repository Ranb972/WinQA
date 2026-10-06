import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import Battle from '@/models/Battle';
import Leaderboard from '@/models/Leaderboard';
import { BATTLE_CAPS, tooLongText } from '@/lib/content-limits';

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

beforeEach(() => {
  h.auth.mockResolvedValue({ userId: 'user_a' });
  h.dbConnect.mockClear();
  create = vi
    .spyOn(Battle, 'create')
    .mockImplementation((async (doc: Record<string, unknown>) => ({ _id: 'b1', ...doc })) as never);
  vi.spyOn(Leaderboard, 'findOne').mockImplementation((async () => null) as never);
  vi.spyOn(Leaderboard, 'create').mockImplementation((async () => ({})) as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectNoWrite() {
  expect(h.dbConnect).not.toHaveBeenCalled();
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
