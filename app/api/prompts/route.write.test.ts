import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import PromptLibrary from '@/models/PromptLibrary';
import UserFavorite from '@/models/UserFavorite';
import { PROMPT_CAPS, ceilingText, tooLongText } from '@/lib/content-limits';
import { ENTRY_TOO_LARGE_ERROR } from '@/lib/server/body-limits';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';
import { fakeCount } from '@/lib/server/count-query.test-utils';

/**
 * D6: the prompt writes check every field's type and cap (tags at most 20 x 40)
 * before the database, read the body under the 256 KB entry cap, and answer a
 * schema ValidationError with 400 and a text that names the field, never the value.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));

import { POST, PUT, PATCH } from '@/app/api/prompts/route';

const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
const VALID = {
  title: 'Be specific',
  bad_prompt_example: 'bad',
  good_prompt_example: 'good',
  explanation: 'why',
  tags: ['clarity'],
};
const fill = (n: number) => 'Z'.repeat(n);
const tags = (count: number, length = 3) =>
  Array.from({ length: count }, (_, i) => `${i}`.padEnd(length, 't'));

type Handler = (request: NextRequest) => Promise<Response>;

const call = (handler: Handler, method: string, body: string) =>
  handler(
    new NextRequest('http://localhost/api/prompts', {
      method,
      headers: { 'content-type': 'application/json' },
      body,
    })
  );
const post = (body: unknown) => call(POST, 'POST', JSON.stringify(body));
const put = (body: unknown) => call(PUT, 'PUT', JSON.stringify(body));

let create: MockInstance;
let update: MockInstance;
let count: MockInstance;
let findOne: MockInstance;

beforeEach(() => {
  h.auth.mockResolvedValue({ userId: 'user_a' });
  h.dbConnect.mockClear();
  // D7: the per-user ceiling count; 0 rows unless a test says otherwise.
  count = vi.spyOn(PromptLibrary, 'countDocuments').mockImplementation((() => fakeCount(0)) as never);
  create = vi
    .spyOn(PromptLibrary, 'create')
    .mockImplementation((async (doc: Record<string, unknown>) => ({ _id: ID, ...doc })) as never);
  update = vi
    .spyOn(PromptLibrary, 'findOneAndUpdate')
    .mockImplementation((async (_filter: unknown, data: Record<string, unknown>) => ({ _id: ID, ...data })) as never);
  findOne = vi.spyOn(PromptLibrary, 'findOne').mockImplementation((async () => null) as never);
  vi.spyOn(UserFavorite, 'findOne').mockImplementation((async () => null) as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectNoWrite() {
  expect(h.dbConnect).not.toHaveBeenCalled();
  expect(count).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  expect(findOne).not.toHaveBeenCalled();
}

describe('D6: POST /api/prompts caps each field', () => {
  it.each(Object.entries(PROMPT_CAPS))('%s one over its cap (%i) gives 400 naming it, no create', async (field, cap) => {
    const res = await post({ ...VALID, [field]: fill(cap + 1) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: tooLongText(field, cap) });
    expectNoWrite();
  });

  it('every field exactly at its cap, with 20 tags of 40, is created', async () => {
    const atCap = Object.fromEntries(Object.entries(PROMPT_CAPS).map(([f, cap]) => [f, fill(cap)]));
    const res = await post({ ...atCap, tags: tags(20, 40) });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith({ user_id: 'user_a', ...atCap, tags: tags(20, 40) });
  });

  it('21 tags give 400 naming tags, no create', async () => {
    const res = await post({ ...VALID, tags: tags(21) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'tags has more than 20 entries' });
    expectNoWrite();
  });

  it('a 41-character tag gives 400, no create', async () => {
    const res = await post({ ...VALID, tags: ['ok', fill(41)] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'tags has an entry longer than 40 characters' });
    expectNoWrite();
  });
});

describe('D6: PUT /api/prompts caps each editable field', () => {
  it.each(Object.entries(PROMPT_CAPS))('%s one over its cap (%i) gives 400, no findOneAndUpdate', async (field, cap) => {
    const res = await put({ id: ID, [field]: fill(cap + 1) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: tooLongText(field, cap) });
    expectNoWrite();
  });

  it('21 tags give 400, no findOneAndUpdate', async () => {
    const res = await put({ id: ID, tags: tags(21) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'tags has more than 20 entries' });
    expectNoWrite();
  });

  it('fields exactly at their caps are saved', async () => {
    const atCap = Object.fromEntries(Object.entries(PROMPT_CAPS).map(([f, cap]) => [f, fill(cap)]));
    const res = await put({ id: ID, ...atCap, tags: tags(20, 40) });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      { _id: ID, user_id: 'user_a', is_public: { $ne: true } },
      { ...atCap, tags: tags(20, 40) },
      { new: true, runValidators: true }
    );
  });
});

describe('D6: a schema ValidationError answers 400, not 500', () => {
  it('POST: a rejected create names the field', async () => {
    create.mockRejectedValueOnce(new PromptLibrary({ ...VALID, title: undefined }).validateSync());
    const res = await post(VALID);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Title is required' });
  });

  it('PUT: a rejected findOneAndUpdate gives 400 with the cap sentence', async () => {
    update.mockRejectedValueOnce(new PromptLibrary({ ...VALID, tags: tags(21) }).validateSync());
    const res = await put({ id: ID, title: 'x' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'tags has more than 20 entries' });
  });

  it('any other failure is still the 500 it was', async () => {
    create.mockRejectedValueOnce(new Error('connection reset'));
    const res = await post(VALID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to create prompt' });
  });
});

describe('D6: the body is read under the 256 KB entry cap', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
  ] as const)('%s: 300 KB gives 413 with the entry sentence and no database call', async (method, handler) => {
    const res = await call(handler, method, JSON.stringify({ id: ID, explanation: fill(300 * 1024) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: ENTRY_TOO_LARGE_ERROR });
    expectNoWrite();
  });

  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
  ] as const)('%s: `{` as the body gives 400 Invalid JSON body', async (method, handler) => {
    const res = await call(handler, method, '{');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
    expectNoWrite();
  });

  it('PATCH still toggles with a small body', async () => {
    findOne.mockResolvedValueOnce({ _id: ID });
    const favCreate = vi.spyOn(UserFavorite, 'create').mockImplementation((async () => ({})) as never);
    const res = await call(PATCH, 'PATCH', JSON.stringify({ id: ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ is_favorite: true });
    expect(favCreate).toHaveBeenCalledWith({ user_id: 'user_a', prompt_id: ID });
  });
});

describe('D7: POST /api/prompts refuses at the per-user ceiling of 500', () => {
  it('500 private prompts: 409 with the sentence, and no create', async () => {
    count.mockImplementation((() => fakeCount(500)) as never);
    const res = await post(VALID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: ceilingText('prompts') });
    expect(create).not.toHaveBeenCalled();
  });

  it("499: created; the count filters on the caller's private rows, with the query deadline, before the create", async () => {
    const query = fakeCount(499);
    count.mockImplementation((() => query) as never);
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(count).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0][0]).toEqual({ user_id: 'user_a', is_public: { $ne: true } });
    expect(query.maxTimeMS).toHaveBeenCalledWith(DB_QUERY_MAX_TIME_MS);
    expect(count.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  });

  it("a count that fails answers the route's 500 and creates nothing", async () => {
    count.mockImplementation((() => fakeCount(new Error('operation exceeded time limit'))) as never);
    const res = await post(VALID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to create prompt' });
    expect(create).not.toHaveBeenCalled();
  });

  it('PUT does not count: an edit at the ceiling still saves', async () => {
    count.mockImplementation((() => fakeCount(500)) as never);
    const res = await put({ id: ID, title: 'New title' });
    expect(res.status).toBe(200);
    expect(count).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
