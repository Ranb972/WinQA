import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import ProviderCredential from '@/models/ProviderCredential';
import { BODY_LIMITS, type BodyLimit } from '@/lib/server/body-limits';

/**
 * D5: every wired route reads its body under its cap. One body a byte over the
 * cap answers 413 with the route's sentence, and `{` answers 400, in the route's
 * own error shape, before the database, the daily allowance, the provider-test
 * allowance or any outbound fetch. Each oversize body is otherwise one the old
 * code refused field by field (400), so the status alone tells the two apart.
 */

const m = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ userId: 'user_2bodyCapsTest01' as string | null })),
  connect: vi.fn(async () => undefined),
  consumeDaily: vi.fn(async () => ({ allowed: true })),
  consumeTest: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: m.auth }));
vi.mock('@/lib/mongodb', () => ({ default: m.connect }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  consumeDailyAllowance: m.consumeDaily,
  consumeProviderTestAllowance: m.consumeTest,
}));

import { POST as chatPOST } from '@/app/api/chat/route';
import { POST as executeCodePOST } from '@/app/api/execute-code/route';
import { POST as votePOST } from '@/app/api/battle/vote/route';
import { POST as respondPOST } from '@/app/api/battle/respond/route';
import { PUT as keysPUT } from '@/app/api/keys/route';
import { POST as migratePOST } from '@/app/api/keys/migrate/route';
import { POST as testKeyPOST } from '@/app/api/test-key/route';
import { POST as customProvidersPOST } from '@/app/api/custom-providers/route';
import { PATCH as customProviderPATCH } from '@/app/api/custom-providers/[id]/route';
import { POST as testCustomProviderPOST } from '@/app/api/test-custom-provider/route';

const PROVIDER_ID = '65f0a1b2c3d4e5f6a7b8c9d0';

type Shape = 'error' | 'success' | 'valid';

interface RouteCase {
  name: string;
  method: string;
  limit: BodyLimit;
  shape: Shape;
  /** Fields that the old code refused with a 400 before any DB or network call. */
  base: Record<string, unknown>;
  call: (request: NextRequest) => Promise<Response>;
}

const cases: RouteCase[] = [
  { name: 'chat', method: 'POST', limit: BODY_LIMITS.chat, shape: 'error', base: {}, call: chatPOST },
  {
    name: 'execute-code',
    method: 'POST',
    limit: BODY_LIMITS.executeCode,
    shape: 'success',
    base: {},
    call: executeCodePOST,
  },
  { name: 'battle/vote', method: 'POST', limit: BODY_LIMITS.battleVote, shape: 'error', base: {}, call: votePOST },
  {
    name: 'battle/respond',
    method: 'POST',
    limit: BODY_LIMITS.battleRespond,
    shape: 'error',
    base: {},
    call: respondPOST,
  },
  { name: 'keys PUT', method: 'PUT', limit: BODY_LIMITS.keys, shape: 'error', base: {}, call: keysPUT },
  {
    name: 'keys/migrate',
    method: 'POST',
    limit: BODY_LIMITS.keysMigrate,
    shape: 'error',
    base: { builtin: 5 },
    call: migratePOST,
  },
  { name: 'test-key', method: 'POST', limit: BODY_LIMITS.testKey, shape: 'valid', base: {}, call: testKeyPOST },
  {
    name: 'custom-providers POST',
    method: 'POST',
    limit: BODY_LIMITS.customProviders,
    shape: 'error',
    base: {},
    call: customProvidersPOST,
  },
  {
    name: 'custom-providers/[id] PATCH',
    method: 'PATCH',
    limit: BODY_LIMITS.customProviders,
    shape: 'error',
    base: {},
    call: (request) => customProviderPATCH(request, { params: Promise.resolve({ id: PROVIDER_ID }) }),
  },
  {
    name: 'test-custom-provider',
    method: 'POST',
    limit: BODY_LIMITS.testCustomProvider,
    shape: 'valid',
    base: {},
    call: testCustomProviderPOST,
  },
];

/** `base` plus a `pad` string, serialized to exactly `bytes` bytes (ASCII). */
function paddedBody(base: Record<string, unknown>, bytes: number): string {
  const empty = JSON.stringify({ ...base, pad: '' });
  const body = JSON.stringify({ ...base, pad: 'x'.repeat(bytes - empty.length) });
  expect(Buffer.byteLength(body)).toBe(bytes);
  return body;
}

function request(method: string, body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/under-test', {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

function expectedBody(shape: Shape, error: string): Record<string, unknown> {
  if (shape === 'success') return { success: false, error };
  if (shape === 'valid') return { valid: false, error };
  return { error };
}

const fetchMock = vi.fn(async () => new Response('{}'));
let dbSpies: MockInstance[] = [];

beforeEach(() => {
  m.auth.mockResolvedValue({ userId: 'user_2bodyCapsTest01' });
  m.connect.mockClear();
  m.consumeDaily.mockClear();
  m.consumeTest.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  const reject = (() => Promise.reject(new Error('DB call not expected'))) as never;
  dbSpies = (['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'create', 'countDocuments'] as const).map(
    (name) => vi.spyOn(ProviderCredential, name).mockImplementation(reject) as unknown as MockInstance
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function expectNothingRan() {
  expect(m.connect).not.toHaveBeenCalled();
  expect(m.consumeDaily).not.toHaveBeenCalled();
  expect(m.consumeTest).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
  for (const spy of dbSpies) expect(spy).not.toHaveBeenCalled();
}

describe('D5: request bodies over the cap answer 413 before any work', () => {
  it.each(cases)('$name: one byte over the cap gives 413 with its sentence', async (c) => {
    const res = await c.call(request(c.method, paddedBody(c.base, c.limit.maxBytes + 1)));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual(expectedBody(c.shape, c.limit.tooLarge));
    expectNothingRan();
  });

  it.each(cases)('$name: a declared Content-Length over the cap gives 413', async (c) => {
    const res = await c.call(
      request(c.method, paddedBody(c.base, 64), { 'content-length': String(c.limit.maxBytes + 1) })
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual(expectedBody(c.shape, c.limit.tooLarge));
    expectNothingRan();
  });

  it.each(cases)('$name: a body of exactly the cap is not refused for its size', async (c) => {
    const res = await c.call(request(c.method, paddedBody(c.base, c.limit.maxBytes)));
    // The route's own field checks answer instead (400), as they did before D5.
    expect(res.status).toBe(400);
  });
});

describe('D5: a body that is not JSON answers 400, not 500', () => {
  it.each(cases)('$name: `{` gives 400 with the invalid-JSON text', async (c) => {
    const res = await c.call(request(c.method, '{'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expectedBody(c.shape, 'Invalid JSON body'));
    expectNothingRan();
  });
});

describe('D5: routes that destructure an object refuse other JSON with 400', () => {
  const objectRoutes = cases.filter((c) => c.name !== 'keys PUT');

  it.each(objectRoutes)('$name: `null` gives 400 with the object text', async (c) => {
    const res = await c.call(request(c.method, 'null'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(
      expectedBody(c.shape, 'The request body must be a JSON object')
    );
    expectNothingRan();
  });

  it('keys PUT keeps its own text for a non-object body', async () => {
    const res = await keysPUT(request('PUT', 'null'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body' });
  });
});

describe('D5: chat', () => {
  it('1 MB + 1 byte of real messages gives the chat sentence and burns no unit', async () => {
    const base = { messages: [{ role: 'user', content: '' }], models: 'gemini' };
    const empty = JSON.stringify(base).length;
    const body = JSON.stringify({
      ...base,
      messages: [{ role: 'user', content: 'x'.repeat(BODY_LIMITS.chat.maxBytes + 1 - empty) }],
    });
    expect(Buffer.byteLength(body)).toBe(1024 * 1024 + 1);
    const res = await chatPOST(request('POST', body));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: 'This conversation is too long to send. Start a new chat or remove earlier messages.',
    });
    expect(m.consumeDaily).not.toHaveBeenCalled();
  });
});
