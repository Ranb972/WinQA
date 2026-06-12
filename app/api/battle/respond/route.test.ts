import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

// auth() is mocked to a valid user so requests clear the auth gate.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'test-user' })),
}));

// The route imports @/lib/rate-limit -> @/lib/mongodb, which throws at IMPORT
// time when MONGODB_URI is unset (tracked testability debt, see DEP-003 notes).
// Set a dummy URI and import the route dynamically; the validation branches
// under test return before the rate-limit check, so no real connection opens.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test-dummy';

type RouteModule = typeof import('@/app/api/battle/respond/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('@/app/api/battle/respond/route'));
});

const url = 'http://localhost/api/battle/respond';
const makeRequest = (body: unknown): NextRequest =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/battle/respond — validation branches (auth mocked, no LLM)', () => {
  it('400 when provider or prompt is missing', async () => {
    const res = await POST(makeRequest({ prompt: 'hello' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Provider and prompt are required' });
  });

  it('400 for an invalid provider', async () => {
    const res = await POST(makeRequest({ provider: 'invalid-provider', prompt: 'hello' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid provider' });
  });

  it('400 when the prompt exceeds the 5000-char cap', async () => {
    const res = await POST(makeRequest({ provider: 'cohere', prompt: 'x'.repeat(5001) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Prompt too long' });
  });
});
