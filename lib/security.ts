/**
 * Shared security utilities for API routes.
 */

/** Sanitize a query param to prevent NoSQL injection (strip $ and . prefixes). */
export function sanitizeQueryParam(value: string): string {
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

/** Check if a URL points to a private/internal IP address. */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
      return true;
    }

    // Block 0.0.0.0
    if (hostname === '0.0.0.0') {
      return true;
    }

    // Block private IP ranges
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      // 10.0.0.0/8
      if (parts[0] === 10) return true;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
      // 169.254.0.0/16 (link-local)
      if (parts[0] === 169 && parts[1] === 254) return true;
    }

    // Block metadata endpoints (cloud providers)
    if (hostname === '169.254.169.254') return true;

    return false;
  } catch {
    return true; // Invalid URL = block it
  }
}
