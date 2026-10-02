import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import-safe in node: the module (and ./crypto) touch window/localStorage
// only inside functions, never at top level.
import { redactKey, testCustomProviderConnection } from '@/lib/custom-providers';

// Fake, test-only key (long enough for redaction to apply).
const API_KEY = 'sk-test-FAKEKEY-0123456789abcdef';
const provider = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: API_KEY,
  modelId: 'test-model-1',
  headerType: 'bearer' as const,
};

describe('redactKey', () => {
  it('replaces every occurrence of the key with [key]', () => {
    expect(redactKey(`a ${API_KEY} b ${API_KEY}`, API_KEY)).toBe('a [key] b [key]');
  });

  it('leaves text without the key unchanged', () => {
    expect(redactKey('Invalid API key', API_KEY)).toBe('Invalid API key');
  });

  it('does nothing for keys shorter than 8 chars', () => {
    expect(redactKey('the key is abc1234', 'abc1234')).toBe('the key is abc1234');
  });

  it('applies at exactly 8 chars', () => {
    expect(redactKey('key=abcd1234;', 'abcd1234')).toBe('key=[key];');
  });

  it('does nothing for an empty key or empty text', () => {
    expect(redactKey('some text', '')).toBe('some text');
    expect(redactKey('', API_KEY)).toBe('');
  });

  it('treats regex metacharacters in the key literally', () => {
    const key = 'a.b*c+d?(e)[f]$';
    expect(redactKey(`x ${key} y`, key)).toBe('x [key] y');
    expect(redactKey('x aXbbbcd y', key)).toBe('x aXbbbcd y');
  });
});

describe('testCustomProviderConnection', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const routeAnswer = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('posts the provider to the server route', async () => {
    fetchMock.mockResolvedValueOnce(
      routeAnswer({ valid: true, status: 200, latencyMs: 5, model: 'test-model-1' })
    );
    await testCustomProviderConnection(provider);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/test-custom-provider');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      baseUrl: provider.baseUrl,
      apiKey: API_KEY,
      modelId: provider.modelId,
      headerType: 'bearer',
    });
  });

  it('new shape, valid: passes status, latencyMs and model through', async () => {
    fetchMock.mockResolvedValueOnce(
      routeAnswer({ valid: true, status: 200, latencyMs: 1234, model: 'route-model' })
    );
    expect(await testCustomProviderConnection(provider)).toEqual({
      valid: true,
      status: 200,
      latencyMs: 1234,
      model: 'route-model',
    });
  });

  it('new shape, invalid: upstream 401 status and error kept', async () => {
    fetchMock.mockResolvedValueOnce(
      routeAnswer({ valid: false, error: 'Invalid API key', status: 401, latencyMs: 87, model: 'test-model-1' })
    );
    expect(await testCustomProviderConnection(provider)).toEqual({
      valid: false,
      error: 'Invalid API key',
      status: 401,
      latencyMs: 87,
      model: 'test-model-1',
    });
  });

  it('new shape with status null (route could not reach the provider) stays null', async () => {
    fetchMock.mockResolvedValueOnce(
      routeAnswer({ valid: false, error: 'fetch failed', status: null, latencyMs: 30001, model: 'test-model-1' })
    );
    const result = await testCustomProviderConnection(provider);
    expect(result.status).toBeNull();
    expect(result.latencyMs).toBe(30001);
  });

  it('old shape on a 2xx route answer: status null, latency measured, model echoed', async () => {
    fetchMock.mockResolvedValueOnce(routeAnswer({ valid: false, error: 'x' }));
    const result = await testCustomProviderConnection(provider);
    expect(result).toEqual({
      valid: false,
      error: 'x',
      status: null,
      latencyMs: expect.any(Number),
      model: 'test-model-1',
    });
    expect(Number.isInteger(result.latencyMs)).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('old shape on a non-2xx route answer (guard 400): status falls back to res.status', async () => {
    fetchMock.mockResolvedValueOnce(
      routeAnswer({ valid: false, error: 'Base URL must use HTTPS' }, 400)
    );
    expect(await testCustomProviderConnection(provider)).toEqual({
      valid: false,
      error: 'Base URL must use HTTPS',
      status: 400,
      latencyMs: expect.any(Number),
      model: 'test-model-1',
    });
  });

  it('non-JSON route answer: error falls back to "HTTP {status}"', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 502 }));
    expect(await testCustomProviderConnection(provider)).toEqual({
      valid: false,
      error: 'HTTP 502',
      status: 502,
      latencyMs: expect.any(Number),
      model: 'test-model-1',
    });
  });

  it('redacts the key from a route error string', async () => {
    fetchMock.mockResolvedValueOnce(
      routeAnswer({ valid: false, error: `bad key ${API_KEY}`, status: 400, latencyMs: 10, model: 'm' })
    );
    const result = await testCustomProviderConnection(provider);
    expect(result.error).toBe('bad key [key]');
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('thrown fetch: invalid, status null, latency measured, model echoed, key redacted', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError(`Failed to fetch ${API_KEY}`));
    const result = await testCustomProviderConnection(provider);
    expect(result).toEqual({
      valid: false,
      error: 'Failed to fetch [key]',
      status: null,
      latencyMs: expect.any(Number),
      model: 'test-model-1',
    });
    expect(Number.isInteger(result.latencyMs)).toBe(true);
  });

  it('thrown non-Error: "Connection failed"', async () => {
    fetchMock.mockRejectedValueOnce('boom');
    const result = await testCustomProviderConnection(provider);
    expect(result).toMatchObject({ valid: false, error: 'Connection failed', status: null });
  });
});
