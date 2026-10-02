import { describe, it, expect } from 'vitest';
import { isPrivateUrl, checkProviderUrl } from '@/lib/security';

describe('isPrivateUrl (SSRF guard)', () => {
  // Contract: true = private/internal (blocked), false = public (allowed).
  // Fails closed — an unparseable URL returns true.
  it.each([
    'http://localhost',
    'http://127.0.0.1',
    'http://0.0.0.0',
    'http://10.0.0.1', // 10.0.0.0/8
    'http://172.16.0.1', // 172.16.0.0/12 (low end)
    'http://172.31.255.255', // 172.16.0.0/12 (high end)
    'http://192.168.1.1', // 192.168.0.0/16
    'http://169.254.1.1', // 169.254.0.0/16 link-local
    'http://169.254.169.254', // cloud metadata endpoint
  ])('blocks private/internal host: %s', (url) => {
    expect(isPrivateUrl(url)).toBe(true);
  });

  it('allows a normal public https URL', () => {
    expect(isPrivateUrl('https://api.cohere.ai')).toBe(false);
  });

  it('blocks an invalid / unparseable URL (fails closed)', () => {
    expect(isPrivateUrl('not a url')).toBe(true);
  });
});

describe('checkProviderUrl (custom-provider base URL guard)', () => {
  // Contract: null = acceptable; otherwise the user-facing reason.
  it('accepts a public https URL', () => {
    expect(checkProviderUrl('https://api.openai.com/v1')).toBeNull();
  });

  it.each(['http://api.openai.com/v1', 'ftp://x', '', undefined, 42])(
    'requires https and a string: %s',
    (value) => {
      expect(checkProviderUrl(value)).toBe('Base URL must use HTTPS');
    }
  );

  it('rejects a private address even over https', () => {
    expect(checkProviderUrl('https://10.0.0.1/v1')).toBe(
      'Base URL must not point to a private/internal address'
    );
  });
});

describe('checkProviderUrl length cap (F1/F2)', () => {
  const urlOfLength = (n: number): string => {
    const prefix = 'https://api.example.com/v1/';
    return prefix + 'a'.repeat(n - prefix.length);
  };

  it('accepts a base URL of exactly 2048 characters', () => {
    const url = urlOfLength(2048);
    expect(url).toHaveLength(2048);
    expect(checkProviderUrl(url)).toBeNull();
  });

  it('rejects a base URL of 2049 characters', () => {
    const url = urlOfLength(2049);
    expect(url).toHaveLength(2049);
    expect(checkProviderUrl(url)).toBe('Base URL is too long (2048 characters max)');
  });

  it('rejects a 40k-slash URL before anything parses it', () => {
    expect(checkProviderUrl('https://a.com/' + '/'.repeat(40_000) + 'x')).toBe(
      'Base URL is too long (2048 characters max)'
    );
  });
});
