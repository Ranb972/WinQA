import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/battle/respond/route';

// auth() is mocked to a valid user so requests clear the auth gate; the route's
// import graph is DB- and client-free at load time (verified), so a static
// import is safe and no dummy MONGODB_URI is needed.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'test-user' })),
}));

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
