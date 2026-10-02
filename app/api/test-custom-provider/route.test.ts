import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LookupFunction } from 'node:net';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { POST } from '@/app/api/test-custom-provider/route';
import { safeProviderFetch } from '@/lib/security';

// auth() is mocked to a valid user so requests clear the auth gate; single
// tests override it with mockResolvedValueOnce.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));

// The real lib/security runs (URL checks, DNS vetting, pinning); safeProviderFetch
// is wrapped in a spy so the tests can see that the route goes through it.
vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return { ...actual, safeProviderFetch: vi.fn(actual.safeProviderFetch) };
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
