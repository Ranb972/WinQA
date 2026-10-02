import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';
import type * as Undici from 'undici';
import {
  isPrivateUrl,
  isPrivateAddress,
  checkProviderUrl,
  safeProviderFetch,
  resolveProviderAddress,
  pinnedLookup,
  ProviderUrlError,
  ProviderRedirectError,
  ProviderTimeoutError,
} from '@/lib/security';
import { REDIRECT_BLOCKED_ERROR } from '@/lib/friendly-errors';

// No test touches the network: DNS answers and the undici fetch are mocked. The
// one real-undici test below talks to a server on 127.0.0.1 that it starts itself.
const dnsMock = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: dnsMock.lookup, default: { lookup: dnsMock.lookup } }));

type FakeAgent = {
  options: { connect?: { lookup?: unknown } };
  close: () => Promise<void>;
  destroy: () => Promise<void>;
};
const undiciMock = vi.hoisted(() => {
  const agents: FakeAgent[] = [];
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

describe('safeProviderFetch: resolve once, vet every answer, connect to the vetted address (S4)', () => {
  const answer = (address: string, family: 4 | 6) => ({ address, family });
  // Every provider fetch states its time budget.
  const T = 10_000;

  beforeEach(() => {
    dnsMock.lookup.mockReset();
    undiciMock.fetch.mockReset();
    undiciMock.agents.length = 0;
  });

  it('rejects a host that resolves to 10.0.0.5 and never fetches', async () => {
    dnsMock.lookup.mockResolvedValueOnce([answer('10.0.0.5', 4)]);
    const err = await safeProviderFetch('https://evil.example/v1/chat/completions', { method: 'POST', timeoutMs: T }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderUrlError);
    expect(err.message).toBe('The provider address is not reachable from WinQA');
    expect(dnsMock.lookup).toHaveBeenCalledWith('evil.example', { all: true, verbatim: true });
    expect(undiciMock.fetch).not.toHaveBeenCalled();
  });

  it('rejects a host that resolves to fd00::1 (IPv6 unique local)', async () => {
    dnsMock.lookup.mockResolvedValueOnce([answer('fd00::1', 6)]);
    await expect(resolveProviderAddress('https://evil.example/v1', T)).rejects.toThrow(
      'The provider address is not reachable from WinQA'
    );
    expect(undiciMock.fetch).not.toHaveBeenCalled();
  });

  it('rejects when ANY answer is private, even if the first is public', async () => {
    dnsMock.lookup.mockResolvedValueOnce([answer('93.184.216.34', 4), answer('127.0.0.1', 4)]);
    await expect(resolveProviderAddress('https://mixed.example/v1', T)).rejects.toBeInstanceOf(ProviderUrlError);
  });

  it('rejects an empty answer', async () => {
    dnsMock.lookup.mockResolvedValueOnce([]);
    await expect(resolveProviderAddress('https://empty.example/v1', T)).rejects.toThrow(
      'The provider address is not reachable from WinQA'
    );
  });

  it('passes a resolver failure through unchanged', async () => {
    dnsMock.lookup.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND nope.example'));
    await expect(resolveProviderAddress('https://nope.example/v1', T)).rejects.toThrow(
      'getaddrinfo ENOTFOUND nope.example'
    );
  });

  it('runs checkProviderUrl first: http, private literals and over-long URLs never reach DNS', async () => {
    for (const url of ['http://api.example.com/v1', 'https://127.0.0.2/v1', 'https://x.com/' + 'a'.repeat(2100)]) {
      await expect(safeProviderFetch(url, { timeoutMs: T })).rejects.toBeInstanceOf(ProviderUrlError);
    }
    expect(dnsMock.lookup).not.toHaveBeenCalled();
    expect(undiciMock.fetch).not.toHaveBeenCalled();
  });

  it('a public IP literal is vetted without a DNS lookup', async () => {
    await expect(resolveProviderAddress('https://93.184.216.34/v1', T)).resolves.toEqual({
      hostname: '93.184.216.34',
      address: '93.184.216.34',
      family: 4,
    });
    expect(dnsMock.lookup).not.toHaveBeenCalled();
  });

  it('public answer: fetches the unchanged URL through an agent pinned to that address', async () => {
    dnsMock.lookup.mockResolvedValueOnce([answer('93.184.216.34', 4), answer('2606:2800:220:1::1', 6)]);
    undiciMock.fetch.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const url = 'https://api.example.com/v1/chat/completions';
    const res = await safeProviderFetch(url, { method: 'POST', headers: { a: 'b' }, body: '{}', timeoutMs: T });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(undiciMock.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = undiciMock.fetch.mock.calls[0];
    // URL (and so the Host header and TLS SNI) keeps the original host name.
    expect(calledUrl).toBe(url);
    expect(init).toMatchObject({ method: 'POST', headers: { a: 'b' }, body: '{}', redirect: 'manual' });
    expect(undiciMock.agents).toHaveLength(1);
    expect(init.dispatcher).toBe(undiciMock.agents[0]);

    // The agent's lookup answers with exactly the vetted first address, in both
    // the all-addresses and the single-address callback forms.
    const lookup = undiciMock.agents[0].options.connect?.lookup as LookupFunction;
    const all = vi.fn();
    lookup('api.example.com', { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: '93.184.216.34', family: 4 }]);
    const single = vi.fn();
    lookup('api.example.com', {}, single);
    expect(single).toHaveBeenCalledWith(null, '93.184.216.34', 4);

    // The agent is torn down once the body has been read.
    expect(undiciMock.agents[0].destroy).toHaveBeenCalled();
  });

  it('a 302 is a failure with the redirect reason and is never followed', async () => {
    dnsMock.lookup.mockResolvedValueOnce([answer('93.184.216.34', 4)]);
    undiciMock.fetch.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
    );
    const err = await safeProviderFetch('https://api.example.com/v1/x', { timeoutMs: T }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderRedirectError);
    expect(err.status).toBe(302);
    expect(err.message).toBe(REDIRECT_BLOCKED_ERROR);
    expect(undiciMock.fetch).toHaveBeenCalledTimes(1);
    expect(undiciMock.fetch.mock.calls[0][1].redirect).toBe('manual');
    expect(undiciMock.agents[0].destroy).toHaveBeenCalled();
  });

  it('reuses a pinned address for the same host instead of resolving again', async () => {
    undiciMock.fetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const pinned = { hostname: 'api.example.com', address: '93.184.216.34', family: 4 as const };
    await safeProviderFetch('https://api.example.com/v1/x', { pinned, timeoutMs: T });
    expect(dnsMock.lookup).not.toHaveBeenCalled();
    expect(undiciMock.agents[0].options.connect?.lookup).toBeTypeOf('function');
  });

  it('resolves again when the pinned address belongs to another host', async () => {
    dnsMock.lookup.mockResolvedValueOnce([answer('10.0.0.5', 4)]);
    const pinned = { hostname: 'other.example', address: '93.184.216.34', family: 4 as const };
    await expect(safeProviderFetch('https://evil.example/v1', { pinned, timeoutMs: T })).rejects.toBeInstanceOf(ProviderUrlError);
    expect(undiciMock.fetch).not.toHaveBeenCalled();
  });
});

describe('pinnedLookup with the real undici Agent (no external network)', () => {
  let server: Server;
  let port: number;
  let seenHost: string | undefined;

  beforeEach(async () => {
    server = createServer((req, res) => {
      seenHost = req.headers.host;
      res.end('pinned');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('connects a made-up host name to the pinned address and keeps the Host header', async () => {
    const real = await vi.importActual<typeof Undici>('undici');
    const agent = new real.Agent({
      connect: { lookup: pinnedLookup({ hostname: 'provider.invalid', address: '127.0.0.1', family: 4 }) },
    });
    try {
      // provider.invalid cannot resolve (RFC 2606); only the pinned lookup can
      // make this request land on the local server.
      const res = await real.fetch(`http://provider.invalid:${port}/v1`, { dispatcher: agent });
      expect(await res.text()).toBe('pinned');
      expect(seenHost).toBe(`provider.invalid:${port}`);
    } finally {
      await agent.close();
    }
  });
});

describe('safeProviderFetch: every provider call is bounded in time (S5)', () => {
  const PENDING = Symbol('pending');
  // Only setTimeout is faked, so setImmediate below still tells "settled" from "pending".
  const settledOrPending = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<typeof PENDING>((resolve) => setImmediate(() => resolve(PENDING)))]);

  // An upstream that never answers but honours abort, like undici does.
  const hangUntilAborted = (_url: string, init: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    dnsMock.lookup.mockReset();
    undiciMock.fetch.mockReset();
    undiciMock.agents.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a hanging upstream is aborted after timeoutMs with the engine\'s timed-out text', async () => {
    dnsMock.lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    undiciMock.fetch.mockImplementationOnce(hangUntilAborted);

    const result = safeProviderFetch('https://api.example.com/v1/x', { timeoutMs: 10_000 }).catch((e) => e);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(await settledOrPending(result)).toBe(PENDING);

    await vi.advanceTimersByTimeAsync(1);
    const err = await settledOrPending(result);
    expect(err).toBeInstanceOf(ProviderTimeoutError);
    expect((err as Error).message).toBe('Request timed out after 10s');
    expect(undiciMock.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(undiciMock.agents[0].destroy).toHaveBeenCalled();
  });

  it('a hanging DNS answer is bounded by the same budget', async () => {
    dnsMock.lookup.mockImplementationOnce(() => new Promise(() => {}));

    const result = safeProviderFetch('https://slow-dns.example/v1', { timeoutMs: 20_000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(20_000);
    const err = await settledOrPending(result);
    expect(err).toBeInstanceOf(ProviderTimeoutError);
    expect((err as Error).message).toBe('Request timed out after 20s');
    expect(undiciMock.fetch).not.toHaveBeenCalled();
  });

  it('resolveProviderAddress takes a budget too', async () => {
    dnsMock.lookup.mockImplementationOnce(() => new Promise(() => {}));
    const result = resolveProviderAddress('https://slow-dns.example/v1', 10_000).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await settledOrPending(result)).toBeInstanceOf(ProviderTimeoutError);
  });

  it('a body that stalls after the headers is aborted too', async () => {
    dnsMock.lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    undiciMock.fetch.mockImplementationOnce(async (_url: string, init: { signal: AbortSignal }) => ({
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: null,
      arrayBuffer: () =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))),
    }));

    const result = safeProviderFetch('https://api.example.com/v1/x', { timeoutMs: 10_000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await settledOrPending(result)).toBeInstanceOf(ProviderTimeoutError);
  });

  it('a fast answer clears its timer', async () => {
    dnsMock.lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    undiciMock.fetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await safeProviderFetch('https://api.example.com/v1/x', { timeoutMs: 10_000 });
    expect(res.status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });
});
