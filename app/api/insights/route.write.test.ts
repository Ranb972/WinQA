import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import Insight from '@/models/Insight';
import { INSIGHT_CAPS, tooLongText } from '@/lib/content-limits';
import { ENTRY_TOO_LARGE_ERROR } from '@/lib/server/body-limits';

/**
 * D6: the insight writes check every field's type and cap (tags at most 20 x 40)
 * before the database, read the body under the 256 KB entry cap, and answer a
 * schema ValidationError with 400 and a text that names the field, never the value.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: 'user_a' })),
  dbConnect: vi.fn(async () => undefined),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth }));
vi.mock('@/lib/mongodb', () => ({ default: h.dbConnect }));

import { POST, PUT } from '@/app/api/insights/route';

const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
const VALID = { title: 'Temperature', content: 'Lower is steadier', category: 'Tuning', tags: ['params'] };
const fill = (n: number) => 'Z'.repeat(n);
const tags = (count: number, length = 3) =>
  Array.from({ length: count }, (_, i) => `${i}`.padEnd(length, 't'));

type Handler = (request: NextRequest) => Promise<Response>;

const call = (handler: Handler, method: string, body: string) =>
  handler(
    new NextRequest('http://localhost/api/insights', {
      method,
      headers: { 'content-type': 'application/json' },
      body,
    })
  );
const post = (body: unknown) => call(POST, 'POST', JSON.stringify(body));
const put = (body: unknown) => call(PUT, 'PUT', JSON.stringify(body));

let create: MockInstance;
let update: MockInstance;

beforeEach(() => {
  h.auth.mockResolvedValue({ userId: 'user_a' });
  h.dbConnect.mockClear();
  create = vi
    .spyOn(Insight, 'create')
    .mockImplementation((async (doc: Record<string, unknown>) => ({ _id: ID, ...doc })) as never);
  update = vi
    .spyOn(Insight, 'findOneAndUpdate')
    .mockImplementation((async (_filter: unknown, data: Record<string, unknown>) => ({ _id: ID, ...data })) as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectNoWrite() {
  expect(h.dbConnect).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
}

describe('D6: POST /api/insights caps each field', () => {
  it.each(Object.entries(INSIGHT_CAPS))('%s one over its cap (%i) gives 400 naming it, no create', async (field, cap) => {
    const res = await post({ ...VALID, [field]: fill(cap + 1) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: tooLongText(field, cap) });
    expectNoWrite();
  });

  it('every field exactly at its cap, with 20 tags of 40, is created', async () => {
    const atCap = Object.fromEntries(Object.entries(INSIGHT_CAPS).map(([f, cap]) => [f, fill(cap)]));
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
});

describe('D6: PUT /api/insights caps each editable field', () => {
  it.each(Object.entries(INSIGHT_CAPS))('%s one over its cap (%i) gives 400, no findOneAndUpdate', async (field, cap) => {
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

  it('fields exactly at their caps are saved with updated_at', async () => {
    const atCap = Object.fromEntries(Object.entries(INSIGHT_CAPS).map(([f, cap]) => [f, fill(cap)]));
    const res = await put({ id: ID, ...atCap, tags: tags(20, 40) });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      { _id: ID, user_id: 'user_a', is_public: { $ne: true } },
      { ...atCap, tags: tags(20, 40), updated_at: expect.any(Date) },
      { new: true, runValidators: true }
    );
  });
});

describe('D6: a schema ValidationError answers 400, not 500', () => {
  it('POST: a rejected create names the field', async () => {
    create.mockRejectedValueOnce(new Insight({ ...VALID, content: undefined }).validateSync());
    const res = await post(VALID);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Content is required' });
  });

  it('PUT: a rejected findOneAndUpdate gives 400 with the cap sentence', async () => {
    update.mockRejectedValueOnce(new Insight({ ...VALID, content: fill(20_001) }).validateSync());
    const res = await put({ id: ID, title: 'x' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'content is longer than 20,000 characters' });
  });

  it('any other failure is still the 500 it was', async () => {
    create.mockRejectedValueOnce(new Error('connection reset'));
    const res = await post(VALID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to create insight' });
  });
});

describe('D6: the body is read under the 256 KB entry cap', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
  ] as const)('%s: 300 KB gives 413 with the entry sentence and no write', async (method, handler) => {
    const res = await call(handler, method, JSON.stringify({ id: ID, content: fill(300 * 1024) }));
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
