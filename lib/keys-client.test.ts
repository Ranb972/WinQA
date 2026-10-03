import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchKeys,
  saveBuiltinKey,
  deleteBuiltinKey,
  testBuiltinKey,
  createCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  testCustomProvider,
  formatKeyDate,
  keyErrorText,
  KeysApiError,
} from '@/lib/keys-client';

// Fake, test-only key.
const API_KEY = 'sk-test-FAKEKEY-0123456789abcdef';

const fetchMock = vi.fn();

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: url as string, init: (init ?? {}) as RequestInit };
};
const lastBody = () => JSON.parse(String(lastCall().init.body));

const builtinRow = {
  provider: 'groq',
  last4: 'cdef',
  updatedAt: '2026-10-02T10:00:00.000Z',
  lastTestedAt: null,
  lastTestOk: null,
  lastRejectedAt: null,
};

const customRow = {
  id: 'a'.repeat(24),
  name: 'Mine',
  baseUrl: 'https://api.example.com/v1',
  modelId: 'm-1',
  headerType: 'bearer',
  enabled: true,
  last4: 'cdef',
  hasKey: true,
  updatedAt: '2026-10-02T10:00:00.000Z',
  lastTestedAt: null,
  lastTestOk: null,
  lastRejectedAt: null,
};

describe('fetchKeys', () => {
  it('GETs /api/keys and returns the masked lists', async () => {
    fetchMock.mockResolvedValueOnce(answer({ builtin: [builtinRow], custom: [customRow] }));
    const result = await fetchKeys();
    expect(lastCall().url).toBe('/api/keys');
    expect(lastCall().init.method).toBeUndefined();
    expect(result.builtin).toEqual([builtinRow]);
    expect(result.custom).toEqual([customRow]);
  });

  it('treats missing lists as empty', async () => {
    fetchMock.mockResolvedValueOnce(answer({}));
    expect(await fetchKeys()).toEqual({ builtin: [], custom: [] });
  });
});

describe('saveBuiltinKey', () => {
  it('PUTs { provider, apiKey } as JSON to /api/keys', async () => {
    fetchMock.mockResolvedValueOnce(answer(builtinRow));
    await saveBuiltinKey('groq', API_KEY);
    const { url, init } = lastCall();
    expect(url).toBe('/api/keys');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(lastBody()).toEqual({ provider: 'groq', apiKey: API_KEY });
  });

  it('resolves to the masked record and never holds the key, even if the server echoed it', async () => {
    fetchMock.mockResolvedValueOnce(answer({ ...builtinRow, apiKey: API_KEY, ct: 'x' }));
    const result = await saveBuiltinKey('groq', API_KEY);
    expect(result).toEqual(builtinRow);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(Object.keys(result)).not.toContain('apiKey');
  });

  it('a non-2xx answer throws an Error with the server text and status', async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: 'The API key must be at least 8 characters.' }, 400));
    const err = await saveBuiltinKey('groq', 'short').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KeysApiError);
    expect((err as KeysApiError).message).toBe('The API key must be at least 8 characters.');
    expect((err as KeysApiError).status).toBe(400);
  });
});

describe('deleteBuiltinKey', () => {
  it('DELETEs /api/keys?provider= and resolves to the deleted flag', async () => {
    fetchMock.mockResolvedValueOnce(answer({ deleted: true }));
    expect(await deleteBuiltinKey('gemini')).toBe(true);
    expect(lastCall().url).toBe('/api/keys?provider=gemini');
    expect(lastCall().init.method).toBe('DELETE');
  });

  it('resolves false when nothing was deleted', async () => {
    fetchMock.mockResolvedValueOnce(answer({ deleted: false }));
    expect(await deleteBuiltinKey('gemini')).toBe(false);
  });
});

describe('testBuiltinKey', () => {
  it('without a key sends a body with no apiKey property', async () => {
    fetchMock.mockResolvedValueOnce(answer({ valid: true }));
    await testBuiltinKey('mistral');
    expect(lastCall().url).toBe('/api/test-key');
    expect(lastCall().init.method).toBe('POST');
    const body = lastBody();
    expect(body).toEqual({ provider: 'mistral' });
    expect(Object.prototype.hasOwnProperty.call(body, 'apiKey')).toBe(false);
  });

  it('with a typed key sends it', async () => {
    fetchMock.mockResolvedValueOnce(answer({ valid: true }));
    await testBuiltinKey('mistral', API_KEY);
    expect(lastBody()).toEqual({ provider: 'mistral', apiKey: API_KEY });
  });

  it('refuses an empty string instead of sending it', async () => {
    await expect(testBuiltinKey('mistral', '')).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves for a failure answer with the server text and status', async () => {
    fetchMock.mockResolvedValueOnce(answer({ valid: false, error: 'No saved key for this provider' }, 404));
    expect(await testBuiltinKey('mistral')).toEqual({
      valid: false,
      error: 'No saved key for this provider',
      status: 404,
    });
  });

  it('a pass carries no error', async () => {
    fetchMock.mockResolvedValueOnce(answer({ valid: true }));
    expect(await testBuiltinKey('mistral')).toEqual({ valid: true, status: 200 });
  });
});

describe('custom provider wrappers', () => {
  it('createCustomProvider POSTs the body to /api/custom-providers', async () => {
    const body = {
      name: 'Mine',
      baseUrl: 'https://api.example.com/v1',
      modelId: 'm-1',
      headerType: 'bearer' as const,
      enabled: true,
      apiKey: API_KEY,
    };
    fetchMock.mockResolvedValueOnce(answer(customRow, 201));
    const result = await createCustomProvider(body);
    expect(lastCall().url).toBe('/api/custom-providers');
    expect(lastCall().init.method).toBe('POST');
    expect(lastBody()).toEqual(body);
    expect(result).toEqual(customRow);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('updateCustomProvider PATCHes only the given fields to the provider path', async () => {
    fetchMock.mockResolvedValueOnce(answer({ ...customRow, enabled: false }));
    const result = await updateCustomProvider(customRow.id, { enabled: false });
    expect(lastCall().url).toBe(`/api/custom-providers/${customRow.id}`);
    expect(lastCall().init.method).toBe('PATCH');
    expect(lastBody()).toEqual({ enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('deleteCustomProvider DELETEs the provider path', async () => {
    fetchMock.mockResolvedValueOnce(answer({ deleted: true }));
    expect(await deleteCustomProvider(customRow.id)).toBe(true);
    expect(lastCall().url).toBe(`/api/custom-providers/${customRow.id}`);
    expect(lastCall().init.method).toBe('DELETE');
  });

  it('a 404 throws with the server text and status', async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: 'Custom provider not found' }, 404));
    const err = await updateCustomProvider(customRow.id, { name: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KeysApiError);
    expect((err as KeysApiError).message).toBe('Custom provider not found');
    expect((err as KeysApiError).status).toBe(404);
  });

  it('testCustomProvider with a saved id sends no baseUrl or apiKey field', async () => {
    fetchMock.mockResolvedValueOnce(answer({ valid: true, status: 200, latencyMs: 5, model: 'm-1' }));
    const result = await testCustomProvider({ providerId: customRow.id });
    expect(lastCall().url).toBe('/api/test-custom-provider');
    const body = lastBody();
    expect(body).toEqual({ providerId: customRow.id });
    expect(Object.prototype.hasOwnProperty.call(body, 'baseUrl')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(body, 'apiKey')).toBe(false);
    expect(result).toEqual({
      status: 200,
      ok: true,
      data: { valid: true, status: 200, latencyMs: 5, model: 'm-1' },
    });
  });

  it('testCustomProvider resolves for a non-2xx answer with its status and body', async () => {
    fetchMock.mockResolvedValueOnce(answer({ valid: false, error: 'Custom provider not found' }, 404));
    const result = await testCustomProvider({ providerId: customRow.id });
    expect(result.status).toBe(404);
    expect(result.ok).toBe(false);
    expect(result.data.error).toBe('Custom provider not found');
  });
});

describe('errors', () => {
  it('a non-JSON non-2xx answer still throws, with a status line', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }));
    const err = await fetchKeys().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KeysApiError);
    expect((err as KeysApiError).message).toBe('Request failed (HTTP 502)');
    expect((err as KeysApiError).status).toBe(502);
  });

  it('keyErrorText passes a 400 text through, names 401 and the missing key ring, and covers a network failure', () => {
    expect(keyErrorText(new KeysApiError('The API key must not contain spaces or line breaks.', 400))).toBe(
      'The API key must not contain spaces or line breaks.'
    );
    expect(keyErrorText(new KeysApiError('Unauthorized', 401))).toMatch(/sign in/i);
    const vault = keyErrorText(new KeysApiError('Key storage is not configured', 500));
    expect(vault).toMatch(/not configured/i);
    expect(vault).not.toBe('Key storage is not configured');
    expect(keyErrorText(new TypeError('Failed to fetch'))).toMatch(/could not reach/i);
  });
});

describe('formatKeyDate', () => {
  it('formats an ISO date as day and short month', () => {
    expect(formatKeyDate(new Date(2026, 9, 2, 12).toISOString())).toBe('2 Oct');
  });

  it('is null for missing or unusable dates', () => {
    expect(formatKeyDate(null)).toBeNull();
    expect(formatKeyDate(undefined)).toBeNull();
    expect(formatKeyDate('not a date')).toBeNull();
  });
});
