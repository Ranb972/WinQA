import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import TestCase from '@/models/TestCase';
import { TEST_CASE_CAPS, ceilingText, tooLongText } from '@/lib/content-limits';
import { ENTRY_TOO_LARGE_ERROR } from '@/lib/server/body-limits';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';
import { fakeCount } from '@/lib/server/count-query.test-utils';

/**
 * D6: the test case writes check every field's type and cap before the database,
 * read the body under the 256 KB entry cap, and answer a schema ValidationError
 * with 400 and a text that names the field, never the value.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));

import { POST, PUT } from '@/app/api/test-cases/route';

const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
const VALID = {
  title: 'Refuses politely',
  description: 'd',
  initial_prompt: 'p',
  expected_outcome: 'o',
  category: 'Safety',
  difficulty: 'Easy',
};
const fill = (n: number) => 'Z'.repeat(n);

type Handler = (request: NextRequest) => Promise<Response>;

const call = (handler: Handler, method: string, body: string) =>
  handler(
    new NextRequest('http://localhost/api/test-cases', {
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

beforeEach(() => {
  h.auth.mockResolvedValue({ userId: 'user_a' });
  h.dbConnect.mockClear();
  // D7: the per-user ceiling count; 0 rows unless a test says otherwise.
  count = vi.spyOn(TestCase, 'countDocuments').mockImplementation((() => fakeCount(0)) as never);
  create = vi
    .spyOn(TestCase, 'create')
    .mockImplementation((async (doc: Record<string, unknown>) => ({ _id: ID, ...doc })) as never);
  update = vi
    .spyOn(TestCase, 'findOneAndUpdate')
    .mockImplementation((async (_filter: unknown, data: Record<string, unknown>) => ({ _id: ID, ...data })) as never);
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
}

describe('D6: POST /api/test-cases caps each field', () => {
  it.each(Object.entries(TEST_CASE_CAPS))('%s one over its cap (%i) gives 400 naming it, no create', async (field, cap) => {
    const res = await post({ ...VALID, [field]: fill(cap + 1) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: tooLongText(field, cap) });
    expectNoWrite();
  });

  it('every field exactly at its cap is created', async () => {
    const atCap = Object.fromEntries(Object.entries(TEST_CASE_CAPS).map(([f, cap]) => [f, fill(cap)]));
    const res = await post(atCap);
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith({ user_id: 'user_a', ...atCap });
  });

  it('a field that is not text gives 400 before the database', async () => {
    const res = await post({ ...VALID, difficulty: 3 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'difficulty must be text' });
    expectNoWrite();
  });
});

describe('D6: PUT /api/test-cases caps each editable field', () => {
  it.each(Object.entries(TEST_CASE_CAPS))('%s one over its cap (%i) gives 400, no findOneAndUpdate', async (field, cap) => {
    const res = await put({ id: ID, [field]: fill(cap + 1) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: tooLongText(field, cap) });
    expectNoWrite();
  });

  it('fields exactly at their caps are saved', async () => {
    const atCap = Object.fromEntries(Object.entries(TEST_CASE_CAPS).map(([f, cap]) => [f, fill(cap)]));
    const res = await put({ id: ID, ...atCap });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      { _id: ID, user_id: 'user_a', is_public: { $ne: true } },
      atCap,
      { returnDocument: 'after', runValidators: true }
    );
  });
});

describe('D6: a schema ValidationError answers 400, not 500', () => {
  it('POST: a rejected create names the field', async () => {
    create.mockRejectedValueOnce(new TestCase({ ...VALID, initial_prompt: undefined }).validateSync());
    const res = await post(VALID);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Initial prompt is required' });
  });

  it('PUT: a rejected findOneAndUpdate gives 400 with the cap sentence', async () => {
    update.mockRejectedValueOnce(new TestCase({ ...VALID, category: fill(101) }).validateSync());
    const res = await put({ id: ID, title: 'x' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'category is longer than 100 characters' });
  });

  it('any other failure is still the 500 it was', async () => {
    update.mockRejectedValueOnce(new Error('connection reset'));
    const res = await put({ id: ID, title: 'x' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to update test case' });
  });
});

describe('D6: the body is read under the 256 KB entry cap', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
  ] as const)('%s: 300 KB gives 413 with the entry sentence and no write', async (method, handler) => {
    const res = await call(handler, method, JSON.stringify({ id: ID, description: fill(300 * 1024) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: ENTRY_TOO_LARGE_ERROR });
    expectNoWrite();
  });

  it.each([
    ['POST', POST],
    ['PUT', PUT],
  ] as const)('%s: `{` as the body gives 400 Invalid JSON body', async (method, handler) => {
    const res = await call(handler, method, '{');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
    expectNoWrite();
  });
});

describe('D7: POST /api/test-cases refuses at the per-user ceiling of 500', () => {
  it('500 private test cases: 409 with the sentence, and no create', async () => {
    count.mockImplementation((() => fakeCount(500)) as never);
    const res = await post(VALID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: ceilingText('testCases') });
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
    expect(await res.json()).toEqual({ error: 'Failed to create test case' });
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
