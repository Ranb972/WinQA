import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { POST } from '@/app/api/test-key/route';
import dbConnect from '@/lib/mongodb';
import { loadUserKeys } from '@/lib/server/user-keys';
import ProviderCredential from '@/models/ProviderCredential';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));

// No DB: the connection is a no-op and the loader is a mock; updateOne is spied below.
vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => ({})) }));
vi.mock('@/lib/server/user-keys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/user-keys')>();
  return { ...actual, loadUserKeys: vi.fn(async () => ({ keys: {}, failed: [] })) };
});

// The Gemini probe's SDK: the constructor records which key the check was given.
const genai = vi.hoisted(() => ({ ctor: vi.fn(), generateContent: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: genai.generateContent };
    constructor(options: { apiKey: string }) {
      genai.ctor(options);
    }
  },
}));

// Fake, test-only keys.
const SAVED_KEY = 'saved-FAKEKEY-0123456789abcdef';
const TYPED_KEY = 'typed-FAKEKEY-fedcba9876543210';

// The Mistral probe is a plain fetch.
const globalFetch = vi.fn();
let updateOne: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  genai.ctor.mockReset();
  genai.generateContent.mockReset();
  genai.generateContent.mockResolvedValue({ text: 'H' });
  vi.mocked(loadUserKeys).mockReset();
  vi.mocked(loadUserKeys).mockResolvedValue({ keys: {}, failed: [] });
  vi.mocked(dbConnect).mockClear();
  globalFetch.mockReset();
  vi.stubGlobal('fetch', globalFetch);
  updateOne = vi
    .spyOn(ProviderCredential, 'updateOne')
    .mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const makeRequest = (body: unknown): NextRequest =>
  new NextRequest('http://localhost/api/test-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const savedKeys = (keys: Record<string, string>) => ({ keys, failed: [] });

describe('POST /api/test-key — the saved key', () => {
  it('{ provider } with no saved key -> 404, no provider call, nothing recorded', async () => {
    const res = await POST(makeRequest({ provider: 'gemini' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ valid: false, error: 'No saved key for this provider' });
    expect(loadUserKeys).toHaveBeenCalledWith('user_test', ['gemini']);
    expect(genai.ctor).not.toHaveBeenCalled();
    expect(genai.generateContent).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('a saved key that does not decrypt -> the same 404, no provider call', async () => {
    vi.mocked(loadUserKeys).mockResolvedValueOnce({ keys: {}, failed: ['gemini'] });
    const res = await POST(makeRequest({ provider: 'gemini' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ valid: false, error: 'No saved key for this provider' });
    expect(genai.ctor).not.toHaveBeenCalled();
  });

  it('a saved key -> the provider check receives the decrypted key; lastTestOk true is recorded', async () => {
    vi.mocked(loadUserKeys).mockResolvedValueOnce(savedKeys({ gemini: SAVED_KEY }));
    const res = await POST(makeRequest({ provider: 'gemini' }));
    const text = await res.clone().text();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true });
    expect(genai.ctor).toHaveBeenCalledTimes(1);
    expect(genai.ctor).toHaveBeenCalledWith({ apiKey: SAVED_KEY });
    expect(text).not.toContain(SAVED_KEY);

    await vi.waitFor(() => expect(updateOne).toHaveBeenCalledTimes(1));
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ userId: 'user_test', slot: 'gemini', kind: 'builtin' });
    expect(update).toEqual({ $set: { lastTestedAt: expect.any(Date), lastTestOk: true } });
  });

  it('a saved Mistral key the provider rejects -> invalid, Bearer <saved key> sent, lastTestOk false recorded', async () => {
    vi.mocked(loadUserKeys).mockResolvedValueOnce(savedKeys({ mistral: SAVED_KEY }));
    globalFetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const res = await POST(makeRequest({ provider: 'mistral' }));
    const text = await res.clone().text();
    expect(await res.json()).toEqual({ valid: false, error: 'Invalid API key' });
    expect(text).not.toContain(SAVED_KEY);

    const [url, init] = globalFetch.mock.calls[0];
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(init.headers.Authorization).toBe(`Bearer ${SAVED_KEY}`);

    await vi.waitFor(() => expect(updateOne).toHaveBeenCalledTimes(1));
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ userId: 'user_test', slot: 'mistral', kind: 'builtin' });
    expect(update).toEqual({ $set: { lastTestedAt: expect.any(Date), lastTestOk: false } });
  });

  it('a provider error that quotes the saved key never reaches the response', async () => {
    vi.mocked(loadUserKeys).mockResolvedValueOnce(savedKeys({ gemini: SAVED_KEY }));
    genai.generateContent.mockRejectedValueOnce(new Error(`upstream echoed ${SAVED_KEY} back`));
    const res = await POST(makeRequest({ provider: 'gemini' }));
    const text = await res.text();
    expect(genai.ctor).toHaveBeenCalledWith({ apiKey: SAVED_KEY });
    expect(JSON.parse(text).valid).toBe(false);
    expect(text).not.toContain(SAVED_KEY);
  });

  it('a failed state write does not change the answer and logs no key or user id', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(loadUserKeys).mockResolvedValueOnce(savedKeys({ gemini: SAVED_KEY }));
    updateOne.mockRejectedValueOnce(new Error('db down'));
    const res = await POST(makeRequest({ provider: 'gemini' }));
    expect(await res.json()).toEqual({ valid: true });
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalled());
    const logged = errorLog.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('[keys] record-test-failed slot=gemini error=Error');
    expect(logged).not.toContain(SAVED_KEY);
    expect(logged).not.toContain('user_test');
  });
});

describe('POST /api/test-key — a typed key (unchanged)', () => {
  it.each([
    ['passes', true],
    ['fails', false],
  ])('{ provider, apiKey } that %s tests the typed key, never loads the saved one, and records nothing', async (_label, ok) => {
    if (!ok) genai.generateContent.mockRejectedValueOnce(new Error('API_KEY_INVALID'));
    const res = await POST(makeRequest({ provider: 'gemini', apiKey: TYPED_KEY }));
    const text = await res.clone().text();
    expect((await res.json()).valid).toBe(ok);
    expect(loadUserKeys).not.toHaveBeenCalled();
    expect(genai.ctor).toHaveBeenCalledWith({ apiKey: TYPED_KEY });
    expect(text).not.toContain(TYPED_KEY);

    // Let any fire-and-forget write run before asserting there was none.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(dbConnect).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('an empty apiKey is still a 400 with the existing text', async () => {
    const res = await POST(makeRequest({ provider: 'gemini', apiKey: '' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, error: 'Provider and API key are required' });
    expect(loadUserKeys).not.toHaveBeenCalled();
    expect(genai.ctor).not.toHaveBeenCalled();
  });

  it('a missing provider is a 400 with the existing text', async () => {
    const res = await POST(makeRequest({ apiKey: TYPED_KEY }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, error: 'Provider and API key are required' });
  });

  it('401 Unauthorized when auth returns no user', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as unknown as Awaited<ReturnType<typeof auth>>);
    const res = await POST(makeRequest({ provider: 'gemini' }));
    expect(res.status).toBe(401);
    expect(loadUserKeys).not.toHaveBeenCalled();
  });
});

describe('POST /api/test-key — provider names are checked against a Set', () => {
  it.each([
    [{ provider: 'toString' }],
    [{ provider: 'constructor' }],
    [{ provider: '__proto__' }],
    [{ provider: 'toString', apiKey: TYPED_KEY }],
    [{ provider: 'Gemini' }],
  ])('%j -> 400 "Invalid provider", no DB call, no provider call', async (body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, error: 'Invalid provider' });
    expect(loadUserKeys).not.toHaveBeenCalled();
    expect(dbConnect).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
    expect(genai.ctor).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
  });
});
