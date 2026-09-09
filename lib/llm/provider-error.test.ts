import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  providerErrorStatus,
  formatProviderError,
  redactSecrets,
  reportProviderError,
} from '@/lib/llm/provider-error';

function withStatus(message: string, fields: Record<string, unknown>): Error {
  return Object.assign(new Error(message), fields);
}

describe('providerErrorStatus', () => {
  it('reads fetch / groq-sdk / @google/genai style `status`', () => {
    expect(providerErrorStatus(withStatus('x', { status: 503 }))).toBe(503);
  });

  it('reads cohere-ai style `statusCode`', () => {
    expect(providerErrorStatus(withStatus('x', { statusCode: 429 }))).toBe(429);
  });

  it('ignores non-HTTP values and non-objects', () => {
    expect(providerErrorStatus(withStatus('x', { status: 'UNAVAILABLE' }))).toBeUndefined();
    expect(providerErrorStatus(withStatus('x', { status: 7 }))).toBeUndefined();
    expect(providerErrorStatus('boom')).toBeUndefined();
    expect(providerErrorStatus(null)).toBeUndefined();
  });
});

describe('formatProviderError', () => {
  it('prefixes the status so friendly-errors and the engine can see it', () => {
    const raw = 'This model is unavailable for free. The paid version is available now - use this slug instead: minimax/minimax-m3';
    expect(formatProviderError(withStatus(raw, { status: 404 }))).toBe(`404: ${raw}`);
  });

  it('does not double a status the SDK already leads with', () => {
    const raw = '503 Service Unavailable';
    expect(formatProviderError(withStatus(raw, { status: 503 }))).toBe(raw);
  });

  it('leaves the message alone when no status is known', () => {
    expect(formatProviderError(new Error('socket hang up'))).toBe('socket hang up');
    expect(formatProviderError('not an error')).toBe('Unknown error occurred');
  });
});

describe('redactSecrets', () => {
  it('masks bearer tokens, key query params and vendor-prefixed keys', () => {
    expect(redactSecrets('Authorization: Bearer abcdefghijklmnop failed')).toBe('Authorization: Bearer <redacted> failed');
    expect(redactSecrets('GET /v1/models?key=AIzaSyExample123&x=1')).toBe('GET /v1/models?key=<redacted>&x=1');
    expect(redactSecrets('key sk-or-v1-0123456789abcdef rejected')).toBe('key <redacted> rejected');
  });
});

describe('reportProviderError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the formatted string and logs one sanitized, truncated line', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const long = 'x'.repeat(500);
    const result = reportProviderError('mistral', 'some/model:free', withStatus(`Bearer abcdefghijklmnop ${long}`, { status: 502 }), 'user');

    expect(result).toBe(`502: Bearer abcdefghijklmnop ${long}`);
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line.startsWith('[llm] mistral some/model:free failed: status=502 key=user ')).toBe(true);
    expect(line).not.toContain('abcdefghijklmnop');
    expect(line.length).toBeLessThan(300);
  });

  it('logs status=n/a for errors without a status, and the key source either way', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportProviderError('gemini', 'gemini-2.5-flash', new Error('socket hang up'), 'app');
    expect(spy.mock.calls[0][0]).toBe('[llm] gemini gemini-2.5-flash failed: status=n/a key=app socket hang up');
  });
});
