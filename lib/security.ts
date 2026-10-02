/**
 * Shared security utilities for API routes.
 *
 * Server-only: imports node:net. Imported by API routes and by lib/llm/custom.ts
 * (itself imported only by app/api/chat/route.ts); never import it from a client
 * component.
 */

import { BlockList, isIP } from 'node:net';

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
    return `Base URL is too long (${MAX_PROVIDER_URL_LENGTH} characters max)`;
  }
  if (typeof baseUrl !== 'string' || !baseUrl.startsWith('https://')) {
    return 'Base URL must use HTTPS';
  }
  if (isPrivateUrl(baseUrl)) {
    return 'Base URL must not point to a private/internal address';
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
