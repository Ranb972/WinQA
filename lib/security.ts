/**
 * Shared security utilities for API routes.
 *
 * Server-only: imports node:net, node:dns and undici. Imported by API routes and by
 * lib/llm/custom.ts (itself imported only by app/api/chat/route.ts); never import
 * it from a client component.
 */

import { BlockList, isIP, type LookupFunction } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import {
  Agent,
  fetch as undiciFetch,
  type RequestInit as UndiciRequestInit,
  type Response as UndiciResponse,
} from 'undici';
import {
  REDIRECT_BLOCKED_ERROR,
  PROVIDER_BODY_TOO_LARGE_ERROR,
  UNREACHABLE_PROVIDER_ERROR,
  BASE_URL_HTTPS_ERROR,
  BASE_URL_PRIVATE_ERROR,
  BASE_URL_TOO_LONG_ERROR,
  PROVIDER_CONNECT_TIMEOUT_ERROR,
  PROVIDER_CONNECT_REFUSED_ERROR,
  PROVIDER_CONNECT_UNREACHABLE_ERROR,
  PROVIDER_CONNECT_RESET_ERROR,
} from '@/lib/friendly-errors';

/**
 * Strip Mongo operator-syntax characters ($ prefix and any . in the string)
 * from a query-param value before placing it into a filter object.
 *
 * This is NOT a complete NoSQL-injection defense — the real protection is
 * Mongoose schema coercion, which casts incoming values to the field's
 * declared type. This helper just removes the cheapest injection vectors
 * (leading $ to switch operators, . to traverse subdocuments).
 */
export function stripMongoOperators(value: string): string {
  return value.replace(/^\$/, '').replace(/\./g, '');
}

/** Pick only allowed fields from an object, dropping anything else. */
export function pickAllowedFields<T extends Record<string, unknown>>(
  obj: T,
  allowed: string[]
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result as Partial<T>;
}

/** Validate a rating value is a number between 0 and 5. */
export function validateRating(value: unknown): boolean {
  return typeof value === 'number' && value >= 0 && value <= 5;
}

/** Validate a value is one of the allowed enum values. */
export function validateEnum(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

/**
 * Longest custom-provider base URL accepted. Real provider base URLs are well under
 * 100 characters; 2048 is the de-facto URL limit of browsers and CDNs. The cap bounds
 * the work every later string operation on the URL can do (scan F1/F2).
 */
export const MAX_PROVIDER_URL_LENGTH = 2048;

/**
 * Validate a custom-provider base URL the way every server-side caller must:
 * at most MAX_PROVIDER_URL_LENGTH characters, HTTPS only, and never a
 * private/internal address. Returns the message to show the user, or null when the
 * URL is acceptable. One helper shared by the chat path and the test-connection
 * route so the two guards cannot drift (audit CR-14).
 */
export function checkProviderUrl(baseUrl: unknown): string | null {
  if (typeof baseUrl === 'string' && baseUrl.length > MAX_PROVIDER_URL_LENGTH) {
    return BASE_URL_TOO_LONG_ERROR;
  }
  if (typeof baseUrl !== 'string' || !baseUrl.startsWith('https://')) {
    return BASE_URL_HTTPS_ERROR;
  }
  if (isPrivateUrl(baseUrl)) {
    return BASE_URL_PRIVATE_ERROR;
  }
  return null;
}

/**
 * Every address range a custom-provider request must never reach: private,
 * loopback, link-local, shared (CGNAT), documentation, benchmarking, multicast,
 * reserved and the IPv6 equivalents (RFC 1122, 1918, 3927, 4193, 4291, 5737, 6052,
 * 6598, 6666, 2544, 3849, 5771, 1112, 919).
 *
 * IPv4-mapped IPv6 (::ffff:a.b.c.d) is NOT listed as a range on purpose:
 * BlockList.check() compares a mapped address against the IPv4 rules itself, and
 * a ::ffff:0:0/96 rule would also match every plain IPv4 address (BlockList maps
 * IPv4 into that prefix when it checks IPv6 rules), blocking the whole internet.
 */
const PRIVATE_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this network" (RFC 1122)
  ['10.0.0.0', 8], // private (RFC 1918)
  ['100.64.0.0', 10], // shared address space / CGNAT (RFC 6598)
  ['127.0.0.0', 8], // loopback (RFC 1122)
  ['169.254.0.0', 16], // link-local, cloud metadata (RFC 3927)
  ['172.16.0.0', 12], // private (RFC 1918)
  ['192.0.0.0', 24], // IETF protocol assignments (RFC 6890)
  ['192.0.2.0', 24], // TEST-NET-1 (RFC 5737)
  ['192.168.0.0', 16], // private (RFC 1918)
  ['198.18.0.0', 15], // benchmarking (RFC 2544)
  ['198.51.100.0', 24], // TEST-NET-2 (RFC 5737)
  ['203.0.113.0', 24], // TEST-NET-3 (RFC 5737)
  ['224.0.0.0', 4], // multicast (RFC 5771)
  ['240.0.0.0', 4], // reserved, includes 255.255.255.255 broadcast (RFC 1112, 919)
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128], // unspecified (RFC 4291)
  ['::1', 128], // loopback (RFC 4291)
  ['64:ff9b::', 96], // NAT64, reaches IPv4 through a translator (RFC 6052)
  ['100::', 64], // discard-only (RFC 6666)
  ['2001:db8::', 32], // documentation (RFC 3849)
  ['fc00::', 7], // unique local (RFC 4193)
  ['fe80::', 10], // link-local (RFC 4291)
  ['ff00::', 8], // multicast (RFC 4291)
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv6');
}

/**
 * True when `ip` (a bare IPv4 or IPv6 address, no brackets) is private, internal
 * or otherwise not a public unicast address. One classifier for URL literals and
 * for DNS answers. Fails closed: anything that is not an IP address is blocked.
 */
export function isPrivateAddress(ip: string): boolean {
  // A zone index (fe80::1%eth0) is not part of the address.
  const address = typeof ip === 'string' ? ip.split('%')[0] : '';
  const family = isIP(address);
  if (family === 4) return PRIVATE_ADDRESSES.check(address, 'ipv4');
  if (family === 6) return PRIVATE_ADDRESSES.check(address, 'ipv6');
  return true;
}

// Host names that only ever mean "this machine" or "this private network".
const INTERNAL_NAME_SUFFIXES = ['.localhost', '.local', '.internal'];

// Dot-separated decimal or 0x-hex parts: the shapes the WHATWG URL parser turns
// into an IPv4 address for http(s). Anything this shape that is not already a
// dotted quad was left unnormalised (non-special scheme) and is refused outright.
const NUMERIC_HOST = /^(?:0x[0-9a-f]*|[0-9]+)(?:\.(?:0x[0-9a-f]*|[0-9]+))*$/i;

/**
 * Check if a URL's host is an internal name or a private/internal IP literal.
 * Names are not resolved here; this is the pure, synchronous half of the SSRF
 * guard. Fails closed on an unparseable URL.
 */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // URL has already lowercased the host and normalised hex, octal, decimal and
    // short IPv4 forms (0x7f000001, 2130706433, 127.1) to dotted quads for http(s).
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }
    // "localhost." and "localhost" are the same name to a resolver.
    let end = hostname.length;
    while (end > 0 && hostname.charCodeAt(end - 1) === 46 /* '.' */) end--;
    hostname = hostname.slice(0, end);

    if (!hostname) return true;

    if (isIP(hostname)) {
      return isPrivateAddress(hostname);
    }

    if (hostname === 'localhost' || INTERNAL_NAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
      return true;
    }

    if (NUMERIC_HOST.test(hostname)) {
      return true;
    }

    return false;
  } catch {
    return true; // Invalid URL = block it
  }
}

// Shown when a custom-provider host resolves to a private/internal address. Defined
// in lib/friendly-errors.ts (client-safe) so the UI can map it without importing
// this server-only module; re-exported for server callers.
export { UNREACHABLE_PROVIDER_ERROR };

/** The base URL failed the URL guard or its host resolved to a blocked address. */
export class ProviderUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUrlError';
  }
}

/** The provider answered with a 3xx. Never followed; `status` is the upstream status. */
export class ProviderRedirectError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(REDIRECT_BLOCKED_ERROR);
    this.name = 'ProviderRedirectError';
    this.status = status;
  }
}

/**
 * The provider call (DNS, connect, headers or body) used up its budget. The message
 * is the fallback engine's own wording ("Request timed out after 20s", see
 * runAttempt in lib/llm/fallback.ts), so friendlyErrorMessage and
 * friendlyTestFailure treat it exactly like an engine timeout.
 */
export class ProviderTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Request timed out after ${Math.round(timeoutMs / 100) / 10}s`);
    this.name = 'ProviderTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * The provider's response body is longer than the caller's maxBodyBytes. The message
 * is the PROVIDER_BODY_TOO_LARGE_ERROR sentinel; the body itself is never kept,
 * logged or shown.
 */
export class ProviderBodyTooLargeError extends Error {
  readonly maxBodyBytes: number;
  constructor(maxBodyBytes: number) {
    super(PROVIDER_BODY_TOO_LARGE_ERROR);
    this.name = 'ProviderBodyTooLargeError';
    this.maxBodyBytes = maxBodyBytes;
  }
}

/**
 * The connection to the provider failed before any response: undici rejected with
 * the opaque "fetch failed" and its cause named a connection-level code. The message is one
 * of the CONNECT_FAILURE_ERRORS sentinels (lib/friendly-errors.ts); `code` is the
 * Node/undici code that chose it, for the server log only.
 */
export class ProviderConnectError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ProviderConnectError';
    this.code = code;
  }
}

/**
 * Which sentinel each connect-level code reads as. ETIMEDOUT is the kernel giving up
 * on SYN retransmits (about 15 s on Linux with tcp_syn_retries 4, before a 20 s
 * budget); UND_ERR_CONNECT_TIMEOUT is undici's own connect timer. A code not listed
 * here leaves the original "fetch failed" error untouched.
 */
const CONNECT_FAILURE_BY_CODE: Readonly<Record<string, string>> = {
  ETIMEDOUT: PROVIDER_CONNECT_TIMEOUT_ERROR,
  UND_ERR_CONNECT_TIMEOUT: PROVIDER_CONNECT_TIMEOUT_ERROR,
  ECONNREFUSED: PROVIDER_CONNECT_REFUSED_ERROR,
  ENETUNREACH: PROVIDER_CONNECT_UNREACHABLE_ERROR,
  EHOSTUNREACH: PROVIDER_CONNECT_UNREACHABLE_ERROR,
  ENOTFOUND: PROVIDER_CONNECT_UNREACHABLE_ERROR,
  // ENOTFOUND and EAI_AGAIN cannot occur behind the pinned lookup; kept for completeness.
  EAI_AGAIN: PROVIDER_CONNECT_UNREACHABLE_ERROR,
  ECONNRESET: PROVIDER_CONNECT_RESET_ERROR,
  EPIPE: PROVIDER_CONNECT_RESET_ERROR,
  UND_ERR_SOCKET: PROVIDER_CONNECT_RESET_ERROR,
};

// How deep connectFailure follows cause / errors[]; undici nests two levels at most.
const MAX_CAUSE_DEPTH = 4;

/**
 * A ProviderConnectError for undici's generic `TypeError: fetch failed` whose cause
 * (or the cause's cause, or an AggregateError's errors[], as Node's happy-eyeballs
 * connect reports; the pinned lookup gives one address, so that path cannot occur
 * today and is kept for completeness) carries a code from CONNECT_FAILURE_BY_CODE; otherwise null. The
 * first listed code met, outermost first, decides.
 */
function connectFailure(error: unknown): ProviderConnectError | null {
  if (!(error instanceof TypeError) || error.message !== 'fetch failed') return null;
  let level: unknown[] = [error.cause];
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && level.length > 0; depth++) {
    const next: unknown[] = [];
    for (const candidate of level) {
      if (!candidate || typeof candidate !== 'object') continue;
      const { code, cause, errors } = candidate as { code?: unknown; cause?: unknown; errors?: unknown };
      if (typeof code === 'string' && Object.hasOwn(CONNECT_FAILURE_BY_CODE, code)) {
        return new ProviderConnectError(CONNECT_FAILURE_BY_CODE[code], code);
      }
      if (cause !== undefined) next.push(cause);
      if (Array.isArray(errors)) next.push(...errors);
    }
    level = next;
  }
  return null;
}

/**
 * Most bytes of a custom provider's chat response safeProviderFetch buffers
 * (lib/llm/custom.ts). A long chat answer is well under 1 MiB of JSON.
 */
export const CHAT_PROVIDER_MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Most bytes of the connection test's response (app/api/test-custom-provider):
 * a 10-token reply or a provider's error body is a few hundred bytes.
 */
export const TEST_PROVIDER_MAX_BODY_BYTES = 64 * 1024;

/**
 * How much longer than the request deadline the undici Agent's connect timeout is.
 * The two must not be equal: two timers of the same length race, and whichever
 * fires first decides the error. The deadline gives ProviderTimeoutError ("Request
 * timed out after Ns", shown as "No response in time"); undici's connect timer gives
 * UND_ERR_CONNECT_TIMEOUT, surfaced as the connect-timeout sentinel (also "No
 * response in time", but not the deadline's text). undici runs connect timeouts over 1 s on its coarse fast timers
 * (lib/util/timers.js, 499 ms ticks); when other fast timers are active, one can
 * fire early by less than one tick, so equal values let undici win. The margin is
 * longer than a tick, so the deadline always fires first. Its abort ends the
 * request at the deadline, so the response is never delayed; the TCP connect is not
 * torn down by it, and the pending socket is closed by the connect timer up to
 * about 1.5 s later.
 */
export const CONNECT_TIMEOUT_MARGIN_MS = 1000;

/** A host name and the one vetted address a request to it may connect to. */
export interface PinnedAddress {
  hostname: string;
  address: string;
  family: 4 | 6;
}

/** URL host without IPv6 brackets, as the resolver and isIP expect it. */
function hostOf(url: string): string {
  const { hostname } = new URL(url);
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/** Settle with `work`, or reject with the signal's reason as soon as it aborts. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

/** An AbortSignal that fires with a ProviderTimeoutError after `timeoutMs`; call clear() when done. */
function providerDeadline(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ProviderTimeoutError(timeoutMs)), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function resolveVetted(url: string, signal: AbortSignal): Promise<PinnedAddress> {
  const urlError = checkProviderUrl(url);
  if (urlError) throw new ProviderUrlError(urlError);

  const hostname = hostOf(url);
  const literalFamily = isIP(hostname);
  // dns.lookup cannot be cancelled; the race only stops waiting for it.
  const answers = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await untilAborted(dnsLookup(hostname, { all: true, verbatim: true }), signal);

  if (answers.length === 0) {
    console.warn(`[custom-provider] blocked ${hostname}: no address in the DNS answer`);
    throw new ProviderUrlError(UNREACHABLE_PROVIDER_ERROR);
  }
  const blocked = answers.find((answer) => isPrivateAddress(answer.address));
  if (blocked) {
    console.warn(`[custom-provider] blocked ${hostname}: resolves to private address ${blocked.address}`);
    throw new ProviderUrlError(UNREACHABLE_PROVIDER_ERROR);
  }

  const first = answers[0];
  return { hostname, address: first.address, family: first.family === 6 ? 6 : 4 };
}

/**
 * Vet a custom-provider URL and resolve its host once, within `timeoutMs`:
 * checkProviderUrl (length, HTTPS, literal ranges), then every DNS answer through
 * isPrivateAddress. Any private answer rejects the host, so a name with one public
 * and one internal record cannot be steered. Throws ProviderUrlError with the
 * user-facing message, ProviderTimeoutError when the resolver does not answer in
 * time; a resolver failure (ENOTFOUND) is rethrown as is.
 */
export async function resolveProviderAddress(url: string, timeoutMs: number): Promise<PinnedAddress> {
  const deadline = providerDeadline(timeoutMs);
  try {
    return await resolveVetted(url, deadline.signal);
  } finally {
    deadline.clear();
  }
}

/**
 * A socket lookup that answers every query with the pinned address, in both
 * callback forms net.connect uses (all: true since autoSelectFamily, single
 * address otherwise). Given to an undici Agent as connect.lookup.
 */
export function pinnedLookup(pinned: PinnedAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options?.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
    } else {
      callback(null, pinned.address, pinned.family);
    }
  };
}

export type ProviderFetchInit = Pick<RequestInit, 'method' | 'headers' | 'body'> & {
  /**
   * Budget for the whole call (DNS, connect, headers and body), in ms. Required:
   * a custom-provider request with no deadline holds its route until maxDuration.
   */
  timeoutMs: number;
  /**
   * Most response-body bytes to read. Required, like timeoutMs: an uncapped body is
   * buffered in full in server memory. Over it, ProviderBodyTooLargeError.
   */
  maxBodyBytes: number;
  /** An address vetted earlier for this URL's host (resolveProviderAddress); skips a second lookup. */
  pinned?: PinnedAddress;
};

// Statuses whose Response must be built with a null body.
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * Read a response body into memory, at most `maxBodyBytes` of it. A Content-Length
 * above the cap fails before reading; the bytes are counted as they stream in either
 * way (a header can understate the body, and undici decompresses), and the read is
 * cancelled the moment the count passes the cap. Each read also races the deadline,
 * so a stalled body ends on the deadline's reason. Nothing read is kept on failure.
 */
async function readCappedBody(
  response: Pick<UndiciResponse, 'headers' | 'body'>,
  maxBodyBytes: number,
  signal: AbortSignal
): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    response.body?.cancel().catch(() => {});
    throw new ProviderBodyTooLargeError(maxBodyBytes);
  }
  if (!response.body) return new ArrayBuffer(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await untilAborted(reader.read(), signal);
      if (done) break;
      total += value.byteLength;
      if (total > maxBodyBytes) throw new ProviderBodyTooLargeError(maxBodyBytes);
      chunks.push(value);
    }
  } catch (error) {
    // Not awaited: a stalled source may never settle its cancel.
    reader.cancel().catch(() => {});
    throw error;
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer.buffer;
}

/**
 * The only way the server may call a user-supplied provider URL.
 *
 * 1. checkProviderUrl, then one DNS resolution with every answer vetted
 *    (resolveProviderAddress), unless the caller passes `pinned` for this host.
 * 2. The request runs on a fresh undici Agent whose connect.lookup returns the
 *    vetted address, so the socket goes exactly where the check looked: a second
 *    resolution at connect time (DNS rebinding) cannot happen. The URL is passed
 *    unchanged, so the Host header and TLS SNI/certificate check use the name.
 * 3. redirect: 'manual'; a 3xx throws ProviderRedirectError and is never followed.
 * 4. One deadline of `timeoutMs` covers resolution, connect, headers and body;
 *    when it fires the request is aborted and ProviderTimeoutError is thrown. A
 *    connect that fails before it ("fetch failed" with a connect-level cause code)
 *    throws ProviderConnectError with a sentinel naming the cause.
 * 5. The body is read in full here, at most `maxBodyBytes` of it (over the cap:
 *    ProviderBodyTooLargeError), and returned as a plain Response, so the Agent
 *    (and its socket) is destroyed before this function returns; callers use
 *    .json()/.text() as on any Response and need no cleanup.
 */
export async function safeProviderFetch(url: string, init: ProviderFetchInit): Promise<Response> {
  const { timeoutMs, maxBodyBytes, pinned: pinnedHint, method, headers, body } = init;

  const urlError = checkProviderUrl(url);
  if (urlError) throw new ProviderUrlError(urlError);

  const deadline = providerDeadline(timeoutMs);
  let agent: Agent | undefined;
  try {
    const pinned =
      pinnedHint && pinnedHint.hostname === hostOf(url) && !isPrivateAddress(pinnedHint.address)
        ? pinnedHint
        : await resolveVetted(url, deadline.signal);

    // connect.timeout: undici's default is 10 s, shorter than a 20 s chat budget; a
    // blackholed port must end on the deadline (timeout text), not as "fetch failed".
    // Strictly longer than the deadline (CONNECT_TIMEOUT_MARGIN_MS): equal timers race
    // and undici's can win. The abort ends the request at the deadline; a pending
    // socket is closed by the connect timer up to about 1.5 s later.
    agent = new Agent({
      connect: { lookup: pinnedLookup(pinned), timeout: timeoutMs + CONNECT_TIMEOUT_MARGIN_MS },
    });
    const response = await undiciFetch(url, {
      method,
      headers,
      body,
      dispatcher: agent,
      redirect: 'manual',
      signal: deadline.signal,
    } as UndiciRequestInit);

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => {});
      throw new ProviderRedirectError(response.status);
    }

    const buffered = NULL_BODY_STATUSES.has(response.status)
      ? null
      : await readCappedBody(response, maxBodyBytes, deadline.signal);
    return new Response(buffered, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });
  } catch (error) {
    // Whatever undici rejected with once the deadline fired, the cause is the deadline.
    if (deadline.signal.aborted) throw deadline.signal.reason;
    // Otherwise "fetch failed" says nothing; its cause code names what went wrong.
    throw connectFailure(error) ?? error;
  } finally {
    deadline.clear();
    if (agent) await agent.destroy().catch(() => {});
  }
}
