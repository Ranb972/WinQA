/**
 * Read a JSON request body under a byte cap (Batch D, D5).
 *
 * `request.json()` buffers whatever the client sends. These helpers count bytes
 * instead, as readCappedBody (lib/security.ts) does for provider responses:
 *
 * - A Content-Length above the cap answers 413 before a byte is read. The body is
 *   not cancelled here: cancelling an unfinished upload can reset the connection
 *   before the 413 reaches the client, and a browser's fetch always declares
 *   the length, so this is the path a real user's oversize request takes.
 * - Otherwise the stream is read with a running count, and the reader is
 *   cancelled the moment the count passes the cap (413), so nothing past it is
 *   kept or parsed. A Content-Length can be absent (chunked) or wrong, so the
 *   count is what decides.
 * - Exactly `maxBytes` is accepted.
 * - Bytes that are not UTF-8, a body that is not JSON, or a stream that fails
 *   mid-read answer 400 with INVALID_JSON_ERROR.
 *
 * No text here echoes the submitted value, and nothing is logged.
 */

import type { BodyLimit } from './body-limits';

export const INVALID_JSON_ERROR = 'Invalid JSON body';
export const INVALID_BODY_ERROR = 'The request body must be a JSON object';

export type JsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413; error: string };

type BodyBytes = { ok: true; bytes: Uint8Array } | { ok: false; status: 400 | 413 };

async function readCappedRequestBytes(request: Request, maxBytes: number): Promise<BodyBytes> {
  const declaredHeader = request.headers.get('content-length');
  if (declaredHeader !== null) {
    const declared = Number(declaredHeader);
    if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: true, bytes: new Uint8Array(0) };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    // Already read or locked: not something a client can fix by resending.
    return { ok: false, status: 400 };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // Not awaited: a stalled source may never settle its cancel.
        reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    reader.cancel().catch(() => {});
    return { ok: false, status: 400 };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/** The parsed JSON body (any JSON value), or the status and `error` to answer with. */
export async function readJsonBody(
  request: Request,
  limit: BodyLimit
): Promise<JsonBodyResult<unknown>> {
  const read = await readCappedRequestBytes(request, limit.maxBytes);
  if (!read.ok) {
    return read.status === 413
      ? { ok: false, status: 413, error: limit.tooLarge }
      : { ok: false, status: 400, error: INVALID_JSON_ERROR };
  }

  let text: string;
  try {
    // fatal: malformed UTF-8 is refused, never replaced with U+FFFD. A leading
    // BOM is dropped, as request.json() does.
    text = new TextDecoder('utf-8', { fatal: true }).decode(read.bytes);
  } catch {
    return { ok: false, status: 400, error: INVALID_JSON_ERROR };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: INVALID_JSON_ERROR };
  }
}

/** readJsonBody for routes that take an object: arrays, null and primitives are a 400. */
export async function readJsonObject(
  request: Request,
  limit: BodyLimit
): Promise<JsonBodyResult<Record<string, unknown>>> {
  const parsed = await readJsonBody(request, limit);
  if (!parsed.ok) return parsed;
  const body = parsed.value;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: INVALID_BODY_ERROR };
  }
  return { ok: true, value: body as Record<string, unknown> };
}
