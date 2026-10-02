import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import-safe in node: the module (and ./crypto) touch window/localStorage
// only inside functions, never at top level.
import {
  redactKey,
  testCustomProviderConnection,
  testFingerprint,
  friendlyTestFailure,
  formatTestPassed,
  canSaveProvider,
  toggleIntent,
  MISSING_KEY_TEXT,
  TEST_DETAIL_MAX,
  type CustomProviderTestResult,
} from '@/lib/custom-providers';

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

describe('testFingerprint', () => {
  const base = {
    baseUrl: 'https://api.example.com/v1',
    apiKey: API_KEY,
    modelId: 'test-model-1',
    headerType: 'bearer' as const,
  };

  it('is stable for identical input', () => {
    expect(testFingerprint(base)).toBe(testFingerprint({ ...base }));
  });

  it('ignores trailing slashes on the base URL', () => {
    expect(testFingerprint({ ...base, baseUrl: 'https://api.example.com/v1/' })).toBe(
      testFingerprint(base)
    );
    expect(testFingerprint({ ...base, baseUrl: 'https://api.example.com/v1///' })).toBe(
      testFingerprint(base)
    );
  });

  it('ignores surrounding whitespace in the model id', () => {
    expect(testFingerprint({ ...base, modelId: '  test-model-1 \t' })).toBe(testFingerprint(base));
  });

  it('defaults the header type to bearer', () => {
    const { headerType: _omit, ...noHeader } = base;
    void _omit;
    expect(testFingerprint(noHeader)).toBe(testFingerprint(base));
    expect(testFingerprint(noHeader)).not.toBe(
      testFingerprint({ ...base, headerType: 'x-api-key' })
    );
  });

  it('changes with each of the four inputs', () => {
    const fp = testFingerprint(base);
    expect(testFingerprint({ ...base, baseUrl: 'https://api.other.com/v1' })).not.toBe(fp);
    expect(testFingerprint({ ...base, apiKey: `${API_KEY}x` })).not.toBe(fp);
    expect(testFingerprint({ ...base, modelId: 'test-model-2' })).not.toBe(fp);
    expect(testFingerprint({ ...base, headerType: 'x-api-key' })).not.toBe(fp);
  });

  it('cannot be forged by shifting text between fields', () => {
    expect(testFingerprint({ ...base, apiKey: 'ab', modelId: 'c' })).not.toBe(
      testFingerprint({ ...base, apiKey: 'a', modelId: 'bc' })
    );
  });

  it('ignores fields outside the fingerprint (name, id, enabled)', () => {
    const stored = { ...base, id: 'custom_1', name: 'Old name', enabled: false };
    const renamed = { ...stored, name: 'New name', enabled: true };
    expect(testFingerprint(stored)).toBe(testFingerprint(renamed));
  });

  // Contract CustomProviderModal relies on: the fingerprint cannot tell a raw id
  // from its trimmed form, so the modal trims effectiveModelId once and passes that
  // one string to the test, the save and the fingerprint. If the modal tested or
  // saved the raw "gpt-4 ", a pass on "gpt-4" would unlock saving it (and a stored
  // "gpt-4" would count as a name-only edit).
  it('maps a raw model id and its trimmed form to one fingerprint (the modal must test and save the trimmed id)', () => {
    const raw = 'gpt-4 ';
    const trimmed = raw.trim();
    expect(trimmed).toBe('gpt-4');
    expect(testFingerprint({ ...base, modelId: raw })).toBe(
      testFingerprint({ ...base, modelId: trimmed })
    );
    const stored = { ...base, id: 'custom_1', name: 'Stored', enabled: true, modelId: trimmed };
    expect(testFingerprint(stored)).toBe(testFingerprint({ ...base, modelId: raw }));
  });
});

describe('friendlyTestFailure', () => {
  const fail = (status: number | null, error?: string): CustomProviderTestResult => ({
    valid: false,
    error,
    status,
    latencyMs: 120,
    model: 'test-model-1',
  });

  it.each([
    [401, 'The key was rejected'],
    [403, 'The key was rejected'],
    [404, 'Model or endpoint not found'],
    [400, 'The provider rejected the request'],
    [422, 'The provider rejected the request'],
    [408, 'No response in time'],
    [504, 'No response in time'],
    [500, 'The provider had a server error'],
    [502, 'The provider had a server error'],
    [503, 'The provider had a server error'],
    [301, 'The provider tried to redirect (blocked)'],
    [307, 'The provider tried to redirect (blocked)'],
    [429, 'Connection failed'],
    [418, 'Connection failed'],
  ])('status %i -> %s, with "HTTP %i"', (status, reason) => {
    const out = friendlyTestFailure(fail(status, 'upstream said no'));
    expect(out.reason).toBe(reason);
    expect(out.statusText).toBe(`HTTP ${status}`);
  });

  it('null status: could not reach, no status text', () => {
    expect(friendlyTestFailure(fail(null, 'Failed to fetch'))).toEqual({
      reason: 'Could not reach the provider',
      statusText: null,
      detail: 'Failed to fetch',
    });
  });

  it.each(['Request timed out', 'timeout after 15000ms', 'The operation was aborted', 'TIME OUT'])(
    'timeout text "%s" -> No response in time',
    (error) => {
      expect(friendlyTestFailure(fail(null, error)).reason).toBe('No response in time');
    }
  );

  it('status classes win over timeout text', () => {
    expect(friendlyTestFailure(fail(401, 'timed out')).reason).toBe('The key was rejected');
  });

  it('detail is the raw error, trimmed', () => {
    expect(friendlyTestFailure(fail(401, '  Invalid API key  ')).detail).toBe('Invalid API key');
  });

  it('detail is cut to TEST_DETAIL_MAX chars ending in an ellipsis', () => {
    const long = 'x'.repeat(500);
    const detail = friendlyTestFailure(fail(500, long)).detail;
    expect(TEST_DETAIL_MAX).toBe(160);
    expect(detail).toHaveLength(TEST_DETAIL_MAX);
    expect(detail?.endsWith('…')).toBe(true);
    expect(friendlyTestFailure(fail(500, 'y'.repeat(160))).detail).toBe('y'.repeat(160));
  });

  it('detail is redacted when the key is supplied', () => {
    const out = friendlyTestFailure(fail(401, `bad key ${API_KEY}`), API_KEY);
    expect(out.detail).toBe('bad key [key]');
    expect(JSON.stringify(out)).not.toContain(API_KEY);
  });

  it('redaction happens before the cut, so a key at the cut point never leaks a prefix', () => {
    const error = `${'z'.repeat(150)} ${API_KEY}`;
    const out = friendlyTestFailure(fail(401, error), API_KEY);
    expect(out.detail).toBe(`${'z'.repeat(150)} [key]`);
  });

  it('detail is null when empty, whitespace or missing', () => {
    expect(friendlyTestFailure(fail(500, '')).detail).toBeNull();
    expect(friendlyTestFailure(fail(500, '   ')).detail).toBeNull();
    expect(friendlyTestFailure(fail(500)).detail).toBeNull();
  });

  it('detail is null when it repeats the reason', () => {
    expect(friendlyTestFailure(fail(418, 'Connection failed')).detail).toBeNull();
    expect(friendlyTestFailure(fail(401, ' the key was rejected ')).detail).toBeNull();
  });
});

describe('formatTestPassed', () => {
  const pass = (latencyMs: number, model: string): CustomProviderTestResult => ({
    valid: true,
    status: 200,
    latencyMs,
    model,
  });

  it('formats model and latency in seconds with one decimal', () => {
    expect(formatTestPassed(pass(1234, 'gpt-x'))).toBe('Connected · gpt-x · 1.2 s');
  });

  it('rounds latency', () => {
    expect(formatTestPassed(pass(1250, 'm'))).toBe('Connected · m · 1.3 s');
    expect(formatTestPassed(pass(49, 'm'))).toBe('Connected · m · 0.0 s');
    expect(formatTestPassed(pass(15000, 'm'))).toBe('Connected · m · 15.0 s');
  });

  it('omits the model part when empty', () => {
    expect(formatTestPassed(pass(800, ''))).toBe('Connected · 0.8 s');
    expect(formatTestPassed(pass(800, '  '))).toBe('Connected · 0.8 s');
  });
});

describe('canSaveProvider', () => {
  it.each([
    [true, true, false, true],
    [true, false, true, true],
    [true, true, true, true],
    [true, false, false, false],
    [false, true, false, false],
    [false, false, true, false],
    [false, true, true, false],
    [false, false, false, false],
  ])('isValid=%s testPassed=%s nameOnlyChange=%s -> %s', (isValid, testPassed, nameOnlyChange, want) => {
    expect(canSaveProvider({ isValid, testPassed, nameOnlyChange })).toBe(want);
  });
});

describe('toggleIntent', () => {
  // Full truth table: enabled, hasKey, busy -> intent.
  it.each([
    [false, true, false, 'test-then-turn-on'],
    [false, false, false, 'missing-key'],
    [true, true, false, 'turn-off'],
    [true, false, false, 'turn-off'],
    [false, true, true, 'ignore'],
    [false, false, true, 'ignore'],
    [true, true, true, 'ignore'],
    [true, false, true, 'ignore'],
  ] as const)('enabled=%s hasKey=%s busy=%s -> %s', (enabled, hasKey, busy, want) => {
    expect(toggleIntent({ enabled, hasKey, busy })).toBe(want);
  });

  it('missing-key text is the agreed copy', () => {
    expect(MISSING_KEY_TEXT).toBe('Edit the provider and add a key first');
  });
});

describe('daily connection-test limit (S6)', () => {
  const limitBody = {
    valid: false,
    error: 'Daily connection-test limit reached',
    status: 429,
    latencyMs: 0,
    model: 'test-model-1',
    resetsAt: '2026-10-03T00:00:00.000Z',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps the route 429 to plain words, no HTTP status, and when it resets', () => {
    const out = friendlyTestFailure(limitBody);
    expect(out).toEqual({
      reason: 'Daily connection-test limit reached',
      statusText: null,
      detail: 'Resets at 00:00 UTC',
    });
    expect(JSON.stringify(out)).not.toContain('HTTP');
    expect(JSON.stringify(out)).not.toContain('429');
  });

  it('end to end through testCustomProviderConnection: no "HTTP" reaches the user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(limitBody), { status: 429, headers: { 'content-type': 'application/json' } })
      )
    );
    const result = await testCustomProviderConnection(provider);
    expect(result).toMatchObject({ valid: false, status: 429, error: 'Daily connection-test limit reached' });
    const out = friendlyTestFailure(result, API_KEY);
    expect(out.reason).toBe('Daily connection-test limit reached');
    expect(out.statusText).toBeNull();
    expect(JSON.stringify(out)).not.toContain('HTTP');
  });

  it('an upstream 429 with any other text keeps the generic mapping', () => {
    const out = friendlyTestFailure({ ...limitBody, error: 'upstream said no' });
    expect(out.reason).toBe('Connection failed');
    expect(out.statusText).toBe('HTTP 429');
  });
});
