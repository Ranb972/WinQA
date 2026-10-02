import { describe, it, expect } from 'vitest';
import { isPrivateUrl, isPrivateAddress, checkProviderUrl } from '@/lib/security';

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

describe('isPrivateUrl: every internal IPv4 and IPv6 literal (S3, F3-F5 literal half, V01)', () => {
  // Each row is a host the guard must block. "old: let through" marks the rows the
  // pre-S3 prefix list returned false for.
  it.each([
    ['127.0.0.2', 'loopback 127/8 (old: let through)'],
    ['127.255.255.254', 'loopback 127/8 (old: let through)'],
    ['0.1.2.3', '"this network" 0/8 (old: let through)'],
    ['0.0.0.0', 'unspecified'],
    ['100.64.0.1', 'CGNAT 100.64/10 (old: let through)'],
    ['100.127.255.255', 'CGNAT 100.64/10 top (old: let through)'],
    ['169.254.169.254', 'link-local metadata'],
    ['169.254.0.1', 'link-local 169.254/16'],
    ['10.255.255.255', 'RFC 1918 10/8'],
    ['172.16.0.1', 'RFC 1918 172.16/12'],
    ['192.168.0.1', 'RFC 1918 192.168/16'],
    ['192.0.0.1', 'IETF protocol assignments 192.0.0/24 (old: let through)'],
    ['192.0.2.1', 'TEST-NET-1 (old: let through)'],
    ['198.18.0.1', 'benchmarking 198.18/15 (old: let through)'],
    ['198.19.255.255', 'benchmarking 198.18/15 top (old: let through)'],
    ['198.51.100.7', 'TEST-NET-2 (old: let through)'],
    ['203.0.113.9', 'TEST-NET-3 (old: let through)'],
    ['224.0.0.1', 'multicast 224/4 (old: let through)'],
    ['239.255.255.250', 'multicast 224/4 top (old: let through)'],
    ['240.0.0.1', 'reserved 240/4 (old: let through)'],
    ['255.255.255.255', 'limited broadcast (old: let through)'],
    ['[::]', 'IPv6 unspecified (old: let through)'],
    ['[::1]', 'IPv6 loopback'],
    ['[0:0:0:0:0:0:0:1]', 'IPv6 loopback, long form'],
    ['[::ffff:127.0.0.1]', 'IPv4-mapped loopback (old: let through)'],
    ['[::ffff:10.0.0.1]', 'IPv4-mapped RFC 1918 (old: let through)'],
    ['[::ffff:169.254.169.254]', 'IPv4-mapped metadata (old: let through)'],
    ['[64:ff9b::7f00:1]', 'NAT64 64:ff9b::/96 (old: let through)'],
    ['[100::1]', 'discard-only 100::/64 (old: let through)'],
    ['[2001:db8::1]', 'documentation 2001:db8::/32 (old: let through)'],
    ['[fc00::1]', 'unique local fc00::/7 (old: let through)'],
    ['[fd00::1]', 'unique local fc00::/7 (old: let through)'],
    ['[fe80::1]', 'link-local fe80::/10 (old: let through)'],
    ['[febf::1]', 'link-local fe80::/10 top (old: let through)'],
    ['[ff02::1]', 'multicast ff00::/8 (old: let through)'],
    ['localhost', 'localhost'],
    ['LOCALHOST', 'localhost, upper case'],
    ['localhost.', 'localhost with a trailing dot (old: let through)'],
    ['api.localhost', '*.localhost (old: let through)'],
    ['api.localhost.', '*.localhost with a trailing dot (old: let through)'],
    ['printer.local', '*.local mDNS (old: let through)'],
    ['metadata.google.internal', '*.internal (old: let through)'],
    ['127.0.0.1.', 'IPv4 literal with a trailing dot'],
    ['0x7f000001', 'hex IPv4, normalised by URL'],
    ['2130706433', 'decimal IPv4, normalised by URL'],
    ['017700000001', 'octal IPv4, normalised by URL'],
    ['0x7f.1', 'mixed short IPv4, normalised by URL'],
    ['127.1', 'short IPv4, normalised by URL'],
  ])('blocks https://%s (%s)', (host) => {
    expect(isPrivateUrl(`https://${host}/v1`)).toBe(true);
    expect(checkProviderUrl(`https://${host}/v1`)).toBe(
      'Base URL must not point to a private/internal address'
    );
  });

  it('relies on URL normalising non-canonical IPv4 to dotted form for https', () => {
    expect(new URL('https://0x7f000001/').hostname).toBe('127.0.0.1');
    expect(new URL('https://2130706433/').hostname).toBe('127.0.0.1');
    expect(new URL('https://017700000001/').hostname).toBe('127.0.0.1');
  });

  it.each(['foo://0x7f000001/', 'foo://2130706433/', 'foo://127.1/', 'foo://0x7f.0x0.0x0.0x1/'])(
    'blocks a numeric-looking host that URL did not normalise (non-special scheme): %s (old: let through)',
    (url) => {
      expect(isPrivateUrl(url)).toBe(true);
    }
  );

  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '[2606:4700:4700::1111]',
    '[::ffff:8.8.8.8]',
    'api.openai.com',
    'api.openai.com.',
    '172.32.0.1',
    '172.15.255.255',
    '192.169.0.1',
    '11.0.0.1',
    '100.128.0.1',
    '100.63.255.255',
    '198.20.0.1',
    'deadbeef.cafe',
    'localhost.example.com',
  ])('allows the public host https://%s', (host) => {
    expect(isPrivateUrl(`https://${host}/v1`)).toBe(false);
    expect(checkProviderUrl(`https://${host}/v1`)).toBeNull();
  });
});

describe('isPrivateAddress (shared classifier for literals and DNS answers)', () => {
  it.each(['10.0.0.5', '127.0.0.1', '::1', 'fd00::1', 'fe80::1%eth0', '::ffff:192.168.1.1', '::ffff:c0a8:101'])(
    'blocks %s',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  );

  it.each(['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it('fails closed on a string that is not an IP address', () => {
    expect(isPrivateAddress('example.com')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});
