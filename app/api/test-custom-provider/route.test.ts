import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LookupFunction } from 'node:net';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { POST } from '@/app/api/test-custom-provider/route';
import { resolveProviderAddress, safeProviderFetch, TEST_PROVIDER_MAX_BODY_BYTES } from '@/lib/security';
import {
  PROVIDER_BODY_TOO_LARGE_ERROR,
  PROVIDER_CONNECT_REFUSED_ERROR,
  PROVIDER_CONNECT_TIMEOUT_ERROR,
} from '@/lib/friendly-errors';
import { DEFAULT_PROVIDER_TIMEOUT_MS } from '@/lib/llm/fallback';
import { friendlyTestFailure } from '@/lib/custom-providers';
import { consumeDailyAllowance, consumeProviderTestAllowance } from '@/lib/rate-limit';
import dbConnect from '@/lib/mongodb';
import { loadCustomProvider } from '@/lib/server/user-keys';
import ProviderCredential from '@/models/ProviderCredential';

// auth() is mocked to a valid user so requests clear the auth gate; single
// tests override it with mockResolvedValueOnce.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));

// The real lib/security runs (URL checks, DNS vetting, pinning); safeProviderFetch
// and resolveProviderAddress are wrapped in spies so the tests can see that the
// route goes through them, and with which budget.
vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return {
    ...actual,
    safeProviderFetch: vi.fn(actual.safeProviderFetch),
    resolveProviderAddress: vi.fn(actual.resolveProviderAddress),
  };
});

// Metering is mocked (no DB): allowed unless a test says otherwise. The LLM
// allowance is mocked too, only to prove the route never touches it.
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    ...actual,
    consumeDailyAllowance: vi.fn(async () => ({ allowed: true })),
    consumeProviderTestAllowance: vi.fn(async () => ({ allowed: true })),
  };
});

// No DB: the connection is a no-op and the saved-provider loader is a mock (null =
// not found, not this user's, or not decryptable). ProviderCredential.updateOne is
// spied on in the saved-provider tests.
vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => ({})) }));
vi.mock('@/lib/server/user-keys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/user-keys')>();
  return { ...actual, loadCustomProvider: vi.fn(async () => null) };
});

// No real DNS and no network: every host resolves to the public answer below
// unless a test says otherwise, and undici's fetch is the upstream mock.
const PUBLIC_ADDRESS = '93.184.216.34';
const dnsMock = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: dnsMock.lookup, default: { lookup: dnsMock.lookup } }));

const undiciMock = vi.hoisted(() => {
  const agents: Array<{ options: { connect?: { lookup?: unknown } } }> = [];
  class Agent {
    options: { connect?: { lookup?: unknown } };
    close = vi.fn(async () => {});
    destroy = vi.fn(async () => {});
    constructor(options: { connect?: { lookup?: unknown } }) {
      this.options = options;
      agents.push(this);
    }
  }
  return { fetch: vi.fn(), Agent, agents };
});
vi.mock('undici', () => ({ fetch: undiciMock.fetch, Agent: undiciMock.Agent }));

const BASE_URL = 'https://api.example.com/v1';
// Fake, test-only key (long enough for redaction to apply).
const API_KEY = 'sk-test-FAKEKEY-0123456789abcdef';
const MODEL = 'test-model-1';

// The upstream call: undici's fetch through the pinned agent.
const fetchMock = undiciMock.fetch;
// The platform fetch must never carry a custom-provider request any more.
const globalFetch = vi.fn(async () => {
  throw new Error('global fetch must not be used for a custom provider');
});

beforeEach(() => {
  fetchMock.mockReset();
  globalFetch.mockClear();
  undiciMock.agents.length = 0;
  dnsMock.lookup.mockReset();
  dnsMock.lookup.mockResolvedValue([{ address: PUBLIC_ADDRESS, family: 4 }]);
  vi.mocked(safeProviderFetch).mockClear();
  vi.mocked(resolveProviderAddress).mockClear();
  vi.mocked(consumeProviderTestAllowance).mockReset();
  vi.mocked(consumeProviderTestAllowance).mockResolvedValue({ allowed: true });
  vi.mocked(consumeDailyAllowance).mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeRequest = (body: unknown): NextRequest =>
  new NextRequest('http://localhost/api/test-custom-provider', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const validBody = { baseUrl: BASE_URL, apiKey: API_KEY, modelId: MODEL };

const upstream = (status: number, body: unknown = {}, statusText = ''): Response =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'content-type': 'application/json' },
  });

describe('POST /api/test-custom-provider — additive status/latencyMs/model', () => {
  it('upstream 200 -> valid, status 200, integer latency, model echoed', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ valid: true, status: 200, latencyMs: expect.any(Number), model: MODEL });
    expect(Number.isInteger(json.latencyMs)).toBe(true);
    expect(json.latencyMs).toBeGreaterThanOrEqual(0);
    // OpenAI-compatible path, redirects never followed (unchanged guard).
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/chat/completions`);
    expect(init.redirect).toBe('manual');
  });

  it('upstream 401 -> invalid, "Invalid API key", status 401', async () => {
    fetchMock.mockResolvedValueOnce(upstream(401, { error: { message: 'bad key' } }));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: false,
      error: 'Invalid API key',
      status: 401,
      latencyMs: expect.any(Number),
      model: MODEL,
    });
  });

  it('upstream 403 -> invalid, "Invalid API key", status 403', async () => {
    fetchMock.mockResolvedValueOnce(upstream(403));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toMatchObject({ valid: false, error: 'Invalid API key', status: 403, model: MODEL });
  });

  it('upstream 429 -> valid (rate limited, key accepted), status 429', async () => {
    fetchMock.mockResolvedValueOnce(upstream(429));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toEqual({ valid: true, status: 429, latencyMs: expect.any(Number), model: MODEL });
    expect(json.error).toBeUndefined();
  });

  it('upstream 3xx -> invalid, redirect error text unchanged, status 302', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
    );
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toEqual({
      valid: false,
      error: 'Provider attempted an HTTP redirect — blocked for security.',
      status: 302,
      latencyMs: expect.any(Number),
      model: MODEL,
    });
  });

  it('upstream 500 without a body message -> invalid, "HTTP 500: ..." text, status 500', async () => {
    fetchMock.mockResolvedValueOnce(upstream(500, {}, 'Internal Server Error'));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toMatchObject({
      valid: false,
      error: 'HTTP 500: Internal Server Error',
      status: 500,
      model: MODEL,
    });
  });

  it('fetch rejects -> invalid, status null, error message kept', async () => {
    fetchMock.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.example.com'));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toEqual({
      valid: false,
      error: 'getaddrinfo ENOTFOUND api.example.com',
      status: null,
      latencyMs: expect.any(Number),
      model: MODEL,
    });
  });

  it('upstream error body echoing the key -> error has [key], never the key', async () => {
    fetchMock.mockResolvedValueOnce(
      upstream(400, { error: { message: `Incorrect API key provided: ${API_KEY}. Check it.` } })
    );
    const res = await POST(makeRequest(validBody));
    const text = await res.clone().text();
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.status).toBe(400);
    expect(json.error).toBe('Incorrect API key provided: [key]. Check it.');
    expect(text).not.toContain(API_KEY);
  });

  it('thrown error echoing the key -> redacted, status null', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError(`invalid header value "Bearer ${API_KEY}"`));
    const res = await POST(makeRequest(validBody));
    const text = await res.clone().text();
    const json = await res.json();
    expect(json).toMatchObject({ valid: false, status: null, error: 'invalid header value "Bearer [key]"' });
    expect(text).not.toContain(API_KEY);
  });

  it('Anthropic base URL -> /messages, same additive fields', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, { content: [] }));
    const json = await (
      await POST(makeRequest({ ...validBody, baseUrl: 'https://api.anthropic.com/v1' }))
    ).json();
    expect(json).toEqual({ valid: true, status: 200, latencyMs: expect.any(Number), model: MODEL });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.redirect).toBe('manual');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('Anthropic 401 -> invalid, status 401', async () => {
    fetchMock.mockResolvedValueOnce(upstream(401));
    const json = await (
      await POST(makeRequest({ ...validBody, baseUrl: 'https://api.anthropic.com/v1' }))
    ).json();
    expect(json).toMatchObject({ valid: false, error: 'Invalid API key', status: 401, model: MODEL });
  });
});

describe('POST /api/test-custom-provider — guards unchanged', () => {
  it('400 with the existing body when fields are missing (no upstream call)', async () => {
    const res = await POST(makeRequest({ baseUrl: BASE_URL, modelId: MODEL }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: 'Base URL, API key, and model ID are required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400 with the existing body for a non-https or private base URL (no upstream call)', async () => {
    const http = await POST(makeRequest({ ...validBody, baseUrl: 'http://api.example.com/v1' }));
    expect(http.status).toBe(400);
    expect(await http.json()).toEqual({ valid: false, error: 'Base URL must use HTTPS' });

    const priv = await POST(makeRequest({ ...validBody, baseUrl: 'https://192.168.1.10/v1' }));
    expect(priv.status).toBe(400);
    expect(await priv.json()).toEqual({
      valid: false,
      error: 'Base URL must not point to a private/internal address',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400 for a base URL over 2048 characters (no upstream call)', async () => {
    const longUrl = 'https://api.example.com/v1/' + 'a'.repeat(3000);
    const res = await POST(makeRequest({ ...validBody, baseUrl: longUrl }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: 'Base URL is too long (2048 characters max)',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 Unauthorized unchanged when auth returns no user (no upstream call)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as unknown as Awaited<ReturnType<typeof auth>>);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/test-custom-provider — resolved address is vetted and pinned (S4)', () => {
  it('400 when the host resolves to 10.0.0.5; nothing is fetched', async () => {
    dnsMock.lookup.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    const res = await POST(makeRequest({ ...validBody, baseUrl: 'https://evil.example/v1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: 'The provider address is not reachable from WinQA',
    });
    expect(dnsMock.lookup).toHaveBeenCalledWith('evil.example', { all: true, verbatim: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('400 when the host resolves to fd00::1; nothing is fetched', async () => {
    dnsMock.lookup.mockResolvedValueOnce([{ address: 'fd00::1', family: 6 }]);
    const res = await POST(makeRequest({ ...validBody, baseUrl: 'https://evil6.example/v1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('The provider address is not reachable from WinQA');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('public answer: one lookup, then safeProviderFetch connects to exactly that address', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toMatchObject({ valid: true, status: 200 });

    expect(dnsMock.lookup).toHaveBeenCalledTimes(1);
    expect(safeProviderFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(safeProviderFetch).mock.calls[0][0]).toBe(`${BASE_URL}/chat/completions`);

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).hostname).toBe('api.example.com');
    expect(init.dispatcher).toBe(undiciMock.agents[0]);
    const lookup = undiciMock.agents[0].options.connect?.lookup as LookupFunction;
    const cb = vi.fn();
    lookup('api.example.com', { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [{ address: PUBLIC_ADDRESS, family: 4 }]);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('a host that does not resolve -> result with status null, nothing fetched', async () => {
    dnsMock.lookup.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND nope.example'));
    const res = await POST(makeRequest({ ...validBody, baseUrl: 'https://nope.example/v1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: false,
      error: 'getaddrinfo ENOTFOUND nope.example',
      status: null,
      latencyMs: expect.any(Number),
      model: MODEL,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/test-custom-provider — one 20 s budget, the chat path deadline (S5)', () => {
  const PENDING = Symbol('pending');
  const settledOrPending = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<typeof PENDING>((resolve) => setImmediate(() => resolve(PENDING)))]);

  // performance is faked too, so the route's budget clock moves only with the timers.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Never settles on its own; rejects with the deadline's reason when it fires.
  const hangUntilAborted = (_url: string, init: { signal: AbortSignal }) =>
    new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));

  it('the test budget is DEFAULT_PROVIDER_TIMEOUT_MS (20 000 ms), the chat path deadline', async () => {
    expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(20_000);
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest(validBody));
    expect(resolveProviderAddress).toHaveBeenCalledWith(BASE_URL, DEFAULT_PROVIDER_TIMEOUT_MS);
    // An instant DNS answer leaves the whole budget for the request.
    expect(vi.mocked(safeProviderFetch).mock.calls[0][1]).toMatchObject({ timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS });
  });

  it('resolution and request share one budget: a 5 s DNS answer leaves 15 s for the request', async () => {
    dnsMock.lookup.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve([{ address: PUBLIC_ADDRESS, family: 4 }]), 5_000))
    );
    fetchMock.mockImplementationOnce(hangUntilAborted);

    const pending = POST(makeRequest(validBody));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(safeProviderFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(safeProviderFetch).mock.calls[0][1]).toMatchObject({ timeoutMs: 15_000 });

    // 19 999 ms in total: still waiting; 20 000 ms: over, reported against the whole budget.
    await vi.advanceTimersByTimeAsync(14_999);
    expect(await settledOrPending(pending)).toBe(PENDING);
    await vi.advanceTimersByTimeAsync(1);
    const res = await settledOrPending(pending);
    expect(res).not.toBe(PENDING);
    expect(await (res as Response).json()).toMatchObject({
      valid: false,
      error: 'Request timed out after 20s',
      status: null,
    });
  });

  it('a provider that answers after 15 s passes (it would fail the old 10 s test, yet works in chat)', async () => {
    // Answers after 15 s unless the deadline aborts it first, as undici's fetch does.
    fetchMock.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(upstream(200, { choices: [] })), 15_000);
          init.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(init.signal.reason);
          });
        })
    );
    const pending = POST(makeRequest(validBody));
    await vi.advanceTimersByTimeAsync(15_000);
    const res = await settledOrPending(pending);
    expect(res).not.toBe(PENDING);
    expect(await (res as Response).json()).toMatchObject({ valid: true, status: 200 });
  });

  it('a provider that never answers -> status null, timed-out text, "No response in time"', async () => {
    fetchMock.mockImplementationOnce(hangUntilAborted);

    const pending = POST(makeRequest(validBody));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(await settledOrPending(pending)).toBe(PENDING);

    await vi.advanceTimersByTimeAsync(1);
    const res = await settledOrPending(pending);
    expect(res).not.toBe(PENDING);
    const json = await (res as Response).json();
    expect(json).toEqual({
      valid: false,
      error: 'Request timed out after 20s',
      status: null,
      latencyMs: expect.any(Number),
      model: MODEL,
    });
    expect(friendlyTestFailure(json).reason).toBe('No response in time');
  });

  it('a DNS answer that never comes -> the same timed-out result after 20 s, nothing fetched', async () => {
    dnsMock.lookup.mockImplementationOnce(() => new Promise(() => {}));
    const pending = POST(makeRequest(validBody));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(await settledOrPending(pending)).toBe(PENDING);
    await vi.advanceTimersByTimeAsync(1);
    const res = await settledOrPending(pending);
    expect(res).not.toBe(PENDING);
    expect(await (res as Response).json()).toMatchObject({
      valid: false,
      error: 'Request timed out after 20s',
      status: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no budget left after the resolution and metering -> timed out without contacting the provider', async () => {
    vi.mocked(consumeProviderTestAllowance).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ allowed: true }), DEFAULT_PROVIDER_TIMEOUT_MS))
    );
    const pending = POST(makeRequest(validBody));
    await vi.advanceTimersByTimeAsync(DEFAULT_PROVIDER_TIMEOUT_MS);
    const res = await settledOrPending(pending);
    expect(res).not.toBe(PENDING);
    expect(await (res as Response).json()).toEqual({
      valid: false,
      error: 'Request timed out after 20s',
      status: null,
      latencyMs: 0,
      model: MODEL,
    });
    expect(safeProviderFetch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/test-custom-provider — metered per user per day (S6)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allowance exhausted -> 429 with the limit body, upstream never called', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T15:30:00Z'));
    vi.mocked(consumeProviderTestAllowance).mockResolvedValueOnce({ allowed: false });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toEqual({
      valid: false,
      error: 'Daily connection-test limit reached',
      status: 429,
      latencyMs: 0,
      model: MODEL,
      resetsAt: '2026-10-03T00:00:00.000Z',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(safeProviderFetch).not.toHaveBeenCalled();

    // What Settings shows for it: plain words, never a raw "HTTP 429".
    const shown = friendlyTestFailure(json);
    expect(shown).toEqual({
      reason: 'Daily connection-test limit reached',
      statusText: null,
      detail: 'Resets at 00:00 UTC',
    });
    expect(JSON.stringify(shown)).not.toContain('HTTP');
  });

  it('the happy path consumes exactly one provider-test unit and no LLM unit', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json.valid).toBe(true);
    expect(consumeProviderTestAllowance).toHaveBeenCalledTimes(1);
    expect(consumeProviderTestAllowance).toHaveBeenCalledWith('user_test');
    expect(consumeDailyAllowance).not.toHaveBeenCalled();
  });

  it('a failing upstream answer still costs one unit (the call was made)', async () => {
    fetchMock.mockResolvedValueOnce(upstream(401));
    await POST(makeRequest(validBody));
    expect(consumeProviderTestAllowance).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing field', { baseUrl: BASE_URL, modelId: MODEL }],
    ['http URL', { ...validBody, baseUrl: 'http://api.example.com/v1' }],
    ['private literal', { ...validBody, baseUrl: 'https://10.0.0.1/v1' }],
    ['over-long URL', { ...validBody, baseUrl: 'https://api.example.com/' + 'a'.repeat(3000) }],
  ])('a 400 (%s) consumes nothing', async (_label, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
  });

  it('a host resolving to a private address is a 400 that consumes nothing', async () => {
    dnsMock.lookup.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    const res = await POST(makeRequest({ ...validBody, baseUrl: 'https://evil.example/v1' }));
    expect(res.status).toBe(400);
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
  });

  it('401 Unauthorized consumes nothing', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as unknown as Awaited<ReturnType<typeof auth>>);
    await POST(makeRequest(validBody));
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
  });
});

describe('POST /api/test-custom-provider — the provider answer is capped at 64 KiB (S13)', () => {
  it.each([
    ['OpenAI format', BASE_URL],
    ['Anthropic format', 'https://api.anthropic.com/v1'],
  ])('%s: passes TEST_PROVIDER_MAX_BODY_BYTES (64 KiB) to safeProviderFetch', async (_label, baseUrl) => {
    expect(TEST_PROVIDER_MAX_BODY_BYTES).toBe(64 * 1024);
    fetchMock.mockResolvedValueOnce(upstream(200, {}));
    await POST(makeRequest({ ...validBody, baseUrl }));
    expect(vi.mocked(safeProviderFetch).mock.calls[0][1]).toMatchObject({
      maxBodyBytes: TEST_PROVIDER_MAX_BODY_BYTES,
    });
  });

  it('an answer of exactly 64 KiB still passes', async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(TEST_PROVIDER_MAX_BODY_BYTES), { status: 200 }));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toMatchObject({ valid: true, status: 200 });
  });

  it('one byte more -> invalid with the sentinel, status null; Settings says "Response too large", no HTTP', async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(TEST_PROVIDER_MAX_BODY_BYTES + 1), { status: 200 }));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toEqual({
      valid: false,
      error: PROVIDER_BODY_TOO_LARGE_ERROR,
      status: null,
      latencyMs: expect.any(Number),
      model: MODEL,
    });

    const shown = friendlyTestFailure(json, API_KEY);
    expect(shown).toEqual({ reason: 'Response too large', statusText: null, detail: PROVIDER_BODY_TOO_LARGE_ERROR });
    expect(JSON.stringify(shown)).not.toContain('HTTP');
  });
});

describe('POST /api/test-custom-provider — a failed connect names its cause', () => {
  const PENDING = Symbol('pending');
  const settledOrPending = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<typeof PENDING>((resolve) => setImmediate(() => resolve(PENDING)))]);

  // undici's rejection when connect() fails: the opaque "fetch failed", the code in the cause.
  const fetchFailed = (code: string, text: string) =>
    new TypeError('fetch failed', { cause: Object.assign(new Error(text), { code }) });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('the kernel gives up on the SYN at 15.4 s, inside the 20 s budget -> the timeout sentinel, "No response in time"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    // A blackholed port as production saw it: ETIMEDOUT after ~15.4 s, before the deadline.
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(fetchFailed('ETIMEDOUT', 'connect ETIMEDOUT 93.184.216.34:81')), 15_400)
        )
    );

    const pending = POST(makeRequest({ ...validBody, baseUrl: 'https://example.com:81/v1' }));
    await vi.advanceTimersByTimeAsync(15_400);
    const res = await settledOrPending(pending);
    expect(res).not.toBe(PENDING);
    const json = await (res as Response).json();
    expect(json).toEqual({
      valid: false,
      error: PROVIDER_CONNECT_TIMEOUT_ERROR,
      status: null,
      latencyMs: 15_400,
      model: MODEL,
    });
    expect(friendlyTestFailure(json, API_KEY)).toEqual({
      reason: 'No response in time',
      statusText: null,
      detail: PROVIDER_CONNECT_TIMEOUT_ERROR,
    });

    const lines = errorLog.mock.calls.map((call) => call.join(' '));
    expect(lines).toContain(`[llm] custom-test ${MODEL} ${PROVIDER_CONNECT_TIMEOUT_ERROR} code=ETIMEDOUT key=user`);
    for (const line of lines) {
      expect(line).not.toContain(API_KEY);
      expect(line).not.toContain('Say "OK"');
      expect(line).not.toContain('93.184.216.34');
    }
  });

  it('a refused connection -> the refused sentinel, "Could not reach the provider", code in the log', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(fetchFailed('ECONNREFUSED', 'connect ECONNREFUSED 93.184.216.34:443'));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toMatchObject({ valid: false, error: PROVIDER_CONNECT_REFUSED_ERROR, status: null });
    expect(friendlyTestFailure(json).reason).toBe('Could not reach the provider');
    expect(errorLog.mock.calls.map((call) => call.join(' '))).toContain(
      `[llm] custom-test ${MODEL} ${PROVIDER_CONNECT_REFUSED_ERROR} code=ECONNREFUSED key=user`
    );
  });

  it('"fetch failed" with a code WinQA does not name stays "fetch failed", "Could not reach the provider"', async () => {
    fetchMock.mockRejectedValueOnce(fetchFailed('ERR_TLS_CERT_ALTNAME_INVALID', 'Hostname/IP does not match'));
    const json = await (await POST(makeRequest(validBody))).json();
    expect(json).toMatchObject({ valid: false, error: 'fetch failed', status: null });
    expect(friendlyTestFailure(json)).toEqual({
      reason: 'Could not reach the provider',
      statusText: null,
      detail: 'fetch failed',
    });
  });
});

describe('POST /api/test-custom-provider — a saved provider ({ providerId })', () => {
  const PROVIDER_ID = '0123456789abcdef01234567';
  const SAVED_BASE_URL = 'https://saved.example/v1';
  // Fake, test-only key, distinct from API_KEY.
  const SAVED_KEY = 'sk-saved-FAKEKEY-fedcba9876543210';
  const SAVED_MODEL = 'saved-model-1';
  const saved = (overrides: Record<string, unknown> = {}) => ({
    id: PROVIDER_ID,
    name: 'Saved',
    baseUrl: SAVED_BASE_URL,
    apiKey: SAVED_KEY,
    modelId: SAVED_MODEL,
    enabled: true,
    ...overrides,
  });

  let updateOne: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(loadCustomProvider).mockReset();
    vi.mocked(loadCustomProvider).mockResolvedValue(null);
    vi.mocked(dbConnect).mockClear();
    updateOne = vi
      .spyOn(ProviderCredential, 'updateOne')
      .mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);
  });

  afterEach(() => {
    updateOne.mockRestore();
  });

  it.each([
    ['baseUrl', { providerId: PROVIDER_ID, baseUrl: 'https://attacker.example/v1' }],
    ['apiKey', { providerId: PROVIDER_ID, apiKey: API_KEY }],
    ['both', { providerId: PROVIDER_ID, baseUrl: BASE_URL, apiKey: API_KEY, modelId: MODEL }],
  ])('providerId with %s -> 400 before any DB or network call', async (_label, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: 'Send either providerId or baseUrl and apiKey, not both',
    });
    expect(loadCustomProvider).not.toHaveBeenCalled();
    expect(dbConnect).not.toHaveBeenCalled();
    expect(dnsMock.lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
  });

  it('fetches ONLY the saved host, with the saved key as Bearer, and the saved model', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    const res = await POST(makeRequest({ providerId: PROVIDER_ID }));
    const text = await res.clone().text();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, status: 200, latencyMs: expect.any(Number), model: SAVED_MODEL });
    expect(text).not.toContain(SAVED_KEY);

    expect(loadCustomProvider).toHaveBeenCalledWith('user_test', PROVIDER_ID);
    expect(dnsMock.lookup).toHaveBeenCalledTimes(1);
    expect(dnsMock.lookup).toHaveBeenCalledWith('saved.example', { all: true, verbatim: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SAVED_BASE_URL}/chat/completions`);
    expect(init.headers.Authorization).toBe(`Bearer ${SAVED_KEY}`);
    expect(init.headers['x-api-key']).toBeUndefined();
    expect(JSON.parse(init.body).model).toBe(SAVED_MODEL);
    expect(init.redirect).toBe('manual');
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('a saved x-api-key provider sends the saved key in x-api-key; headerType is overridable', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved({ headerType: 'x-api-key' }));
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest({ providerId: PROVIDER_ID }));
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe(SAVED_KEY);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();

    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved({ headerType: 'x-api-key' }));
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest({ providerId: PROVIDER_ID, headerType: 'bearer' }));
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${SAVED_KEY}`);
    expect(fetchMock.mock.calls[1][1].headers['x-api-key']).toBeUndefined();
  });

  it('a modelId in the body overrides the saved one', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    const json = await (await POST(makeRequest({ providerId: PROVIDER_ID, modelId: 'override-model' }))).json();
    expect(json).toMatchObject({ valid: true, model: 'override-model' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('override-model');
    expect(fetchMock.mock.calls[0][0]).toBe(`${SAVED_BASE_URL}/chat/completions`);
  });

  it('an empty modelId override is validated as today (400, nothing fetched, nothing metered)', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    const res = await POST(makeRequest({ providerId: PROVIDER_ID, modelId: '' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, error: 'Base URL, API key, and model ID are required' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
  });

  it('an upper-case id is looked up lower-case and its state recorded on the lower-case slot', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest({ providerId: PROVIDER_ID.toUpperCase() }));
    expect(loadCustomProvider).toHaveBeenCalledWith('user_test', PROVIDER_ID);
    await vi.waitFor(() => expect(updateOne).toHaveBeenCalledTimes(1));
    expect(updateOne.mock.calls[0][0]).toEqual({ userId: 'user_test', slot: `custom:${PROVIDER_ID}`, kind: 'custom' });
  });

  it('an unknown providerId (loader null) -> 404, nothing fetched, nothing metered, nothing recorded', async () => {
    const res = await POST(makeRequest({ providerId: PROVIDER_ID }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ valid: false, error: 'Custom provider not found' });
    expect(loadCustomProvider).toHaveBeenCalledTimes(1);
    expect(dnsMock.lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('a saved key that does not decrypt (loader null) -> the same 404, nothing fetched', async () => {
    // The real loader logs `[keys] decrypt-failed` and returns null; the client
    // cannot tell that apart from not found.
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ providerId: 'abcdefabcdefabcdefabcdef', modelId: MODEL }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ valid: false, error: 'Custom provider not found' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(safeProviderFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['too short', 'abc'],
    ['12 characters', 'aaaaaaaaaaaa'],
    ['25 hex', `${PROVIDER_ID}0`],
    ['non-hex', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
    ['a number', 123],
    ['null', null],
    ['an object', { $ne: null }],
  ])('a malformed providerId (%s) -> 404 with no DB call and no fetch', async (_label, providerId) => {
    const res = await POST(makeRequest({ providerId }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ valid: false, error: 'Custom provider not found' });
    expect(loadCustomProvider).not.toHaveBeenCalled();
    expect(dbConnect).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('metering is consumed exactly once, after the load and the guards, before the request', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest({ providerId: PROVIDER_ID }));
    expect(consumeProviderTestAllowance).toHaveBeenCalledTimes(1);
    expect(consumeProviderTestAllowance).toHaveBeenCalledWith('user_test');
    expect(consumeDailyAllowance).not.toHaveBeenCalled();

    const order = (fn: unknown) => vi.mocked(fn as () => unknown).mock.invocationCallOrder[0];
    expect(order(loadCustomProvider)).toBeLessThan(order(resolveProviderAddress));
    expect(order(resolveProviderAddress)).toBeLessThan(order(consumeProviderTestAllowance));
    expect(order(consumeProviderTestAllowance)).toBeLessThan(order(safeProviderFetch));
  });

  it('the saved base URL passes the same guards: resolving to a private address is a 400 that consumes nothing', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    dnsMock.lookup.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    const res = await POST(makeRequest({ providerId: PROVIDER_ID }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, error: 'The provider address is not reachable from WinQA' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('the saved test uses the same 20 s budget and the 64 KiB cap', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest({ providerId: PROVIDER_ID }));
    expect(resolveProviderAddress).toHaveBeenCalledWith(SAVED_BASE_URL, DEFAULT_PROVIDER_TIMEOUT_MS);
    expect(vi.mocked(safeProviderFetch).mock.calls[0][1]).toMatchObject({
      maxBodyBytes: TEST_PROVIDER_MAX_BODY_BYTES,
      timeoutMs: expect.any(Number),
    });
    const { timeoutMs } = vi.mocked(safeProviderFetch).mock.calls[0][1] as { timeoutMs: number };
    expect(timeoutMs).toBeLessThanOrEqual(DEFAULT_PROVIDER_TIMEOUT_MS);
    expect(timeoutMs).toBeGreaterThan(DEFAULT_PROVIDER_TIMEOUT_MS - 1_000);
  });

  it('the limit reached -> 429, no request, nothing recorded', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    vi.mocked(consumeProviderTestAllowance).mockResolvedValueOnce({ allowed: false });
    const res = await POST(makeRequest({ providerId: PROVIDER_ID }));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('an upstream error that echoes the saved key -> [key], never the key', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(
      upstream(400, { error: { message: `Incorrect API key provided: ${SAVED_KEY}. Check it.` } })
    );
    const res = await POST(makeRequest({ providerId: PROVIDER_ID }));
    const text = await res.clone().text();
    expect((await res.json()).error).toBe('Incorrect API key provided: [key]. Check it.');
    expect(text).not.toContain(SAVED_KEY);
  });

  it('records lastTestOk true after a passing test (only lastTestedAt and lastTestOk are set)', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest({ providerId: PROVIDER_ID }));
    await vi.waitFor(() => expect(updateOne).toHaveBeenCalledTimes(1));
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ userId: 'user_test', slot: `custom:${PROVIDER_ID}`, kind: 'custom' });
    expect(update).toEqual({ $set: { lastTestedAt: expect.any(Date), lastTestOk: true } });
  });

  it('records lastTestOk false after a rejected key', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved());
    fetchMock.mockResolvedValueOnce(upstream(401));
    const json = await (await POST(makeRequest({ providerId: PROVIDER_ID }))).json();
    expect(json).toMatchObject({ valid: false, error: 'Invalid API key', status: 401 });
    await vi.waitFor(() => expect(updateOne).toHaveBeenCalledTimes(1));
    expect(updateOne.mock.calls[0][1]).toEqual({ $set: { lastTestedAt: expect.any(Date), lastTestOk: false } });
  });

  // Lets any fire-and-forget write run before asserting there was none.
  const settleWrites = () => new Promise((resolve) => setTimeout(resolve, 20));

  it.each([
    ['a different modelId', { modelId: 'trial-model' }, {}],
    ['a different headerType', { headerType: 'x-api-key' }, {}],
  ])('a test with %s is not recorded on the saved provider', async (_label, override, savedOverrides) => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved(savedOverrides));
    fetchMock.mockResolvedValueOnce(upstream(404, { error: { message: 'model not found' } }));
    const json = await (await POST(makeRequest({ providerId: PROVIDER_ID, ...override }))).json();
    expect(json).toMatchObject({ valid: false, status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await settleWrites();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('an override equal to the saved values is recorded like no override', async () => {
    vi.mocked(loadCustomProvider).mockResolvedValueOnce(saved({ headerType: 'bearer' }));
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest({ providerId: PROVIDER_ID, modelId: SAVED_MODEL, headerType: 'bearer' }));
    await vi.waitFor(() => expect(updateOne).toHaveBeenCalledTimes(1));
    expect(updateOne.mock.calls[0][1]).toEqual({ $set: { lastTestedAt: expect.any(Date), lastTestOk: true } });
  });

  it('a loader that throws (DB down) -> 500 with the generic text; the DB message is neither sent nor logged', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbMessage = 'connect ECONNREFUSED cluster0-shard-00-01.secret-host.mongodb.net:27017';
    vi.mocked(loadCustomProvider).mockRejectedValueOnce(new Error(dbMessage));
    const res = await POST(makeRequest({ providerId: PROVIDER_ID }));
    const text = await res.clone().text();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ valid: false, error: 'Something went wrong. Please try again.' });
    expect(text).not.toContain('secret-host');
    const logged = errorLog.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('[keys] load-failed error=Error');
    expect(logged).not.toContain('secret-host');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeProviderTestAllowance).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('the typed form never loads a saved provider and records nothing', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, { choices: [] }));
    await POST(makeRequest(validBody));
    await settleWrites();
    expect(loadCustomProvider).not.toHaveBeenCalled();
    expect(dbConnect).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/chat/completions`);
  });
});
