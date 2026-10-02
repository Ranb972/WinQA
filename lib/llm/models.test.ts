import { describe, it, expect } from 'vitest';
import { normalizeBaseUrl, isAnthropicProvider, getHeaderType } from '@/lib/llm/models';

describe('normalizeBaseUrl', () => {
  it('drops every trailing slash and lowercases', () => {
    expect(normalizeBaseUrl('https://API.x.com/v1///')).toBe('https://api.x.com/v1');
    expect(normalizeBaseUrl('https://api.x.com/v1/')).toBe('https://api.x.com/v1');
  });

  it('returns the input lowercased when there is no trailing slash', () => {
    expect(normalizeBaseUrl('https://API.Example.com/V1')).toBe('https://api.example.com/v1');
  });

  it('keeps inner slashes and empties an all-slash string', () => {
    expect(normalizeBaseUrl('https://a.com//v1//x')).toBe('https://a.com//v1//x');
    expect(normalizeBaseUrl('///')).toBe('');
    expect(normalizeBaseUrl('')).toBe('');
  });

  // F1/F2: the old /\/+$/ backtracked quadratically on a long run of slashes
  // followed by a non-slash (478 ms at 40k, 3.2 s at 100k on this machine).
  it.each([40_000, 100_000])('runs in linear time on %i slashes followed by a non-slash', (n) => {
    const input = 'https://a.com/' + '/'.repeat(n) + 'X';
    const startedAt = performance.now();
    const out = normalizeBaseUrl(input);
    const elapsed = performance.now() - startedAt;
    expect(out).toBe(input.toLowerCase());
    expect(elapsed).toBeLessThan(200);
  });

  it('strips a 40k-slash tail quickly', () => {
    const startedAt = performance.now();
    const out = normalizeBaseUrl('https://a.com/v1' + '/'.repeat(40_000));
    expect(performance.now() - startedAt).toBeLessThan(200);
    expect(out).toBe('https://a.com/v1');
  });

  it('callers keep their behaviour', () => {
    expect(isAnthropicProvider('https://API.anthropic.com/v1//')).toBe(true);
    expect(getHeaderType('https://api.anthropic.com/v1/')).toBe('x-api-key');
    expect(getHeaderType('https://api.openai.com/v1')).toBe('bearer');
  });
});
