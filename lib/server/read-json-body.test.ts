import { describe, it, expect, vi } from 'vitest';
import {
  INVALID_BODY_ERROR,
  INVALID_JSON_ERROR,
  readJsonBody,
  readJsonObject,
} from './read-json-body';
import { BODY_LIMITS, type BodyLimit } from './body-limits';

const TOO_LARGE = 'Too large for this test.';
const limit = (maxBytes: number): BodyLimit => ({ maxBytes, tooLarge: TOO_LARGE });

const URL_ = 'http://localhost/api/anything';

function textRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request(URL_, { method: 'POST', headers, body });
}

function bytesRequest(bytes: Uint8Array): Request {
  return new Request(URL_, { method: 'POST', body: bytes as BodyInit });
}

/**
 * A request whose body is a stream with no Content-Length: `chunk` bytes per pull,
 * forever unless `chunks` is given. `cancel` records the reader's cancel.
 */
function streamRequest(chunk: Uint8Array, chunks = Infinity) {
  const cancel = vi.fn();
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulls >= chunks) {
        controller.close();
        return;
      }
      pulls += 1;
      controller.enqueue(chunk);
    },
    cancel,
  });
  const request = new Request(URL_, {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  return { request, cancel, pulls: () => pulls };
}

describe('readJsonBody: the byte cap', () => {
  it('a Content-Length above the cap answers 413 without reading the body', async () => {
    const request = textRequest('{"a":1}', { 'content-length': '11' });
    const getReader = vi.spyOn(request.body!, 'getReader');
    const result = await readJsonBody(request, limit(10));
    expect(result).toEqual({ ok: false, status: 413, error: TOO_LARGE });
    expect(getReader).not.toHaveBeenCalled();
  });

  it('a stream past the cap with no Content-Length answers 413 and cancels the reader', async () => {
    const { request, cancel, pulls } = streamRequest(new TextEncoder().encode('[1,2,'));
    const result = await readJsonBody(request, limit(12));
    expect(result).toEqual({ ok: false, status: 413, error: TOO_LARGE });
    expect(request.headers.get('content-length')).toBeNull();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    // 5 + 5 + 5 = 15 > 12: the third chunk is where it stops, nothing more is pulled
    // than the stream's own one-chunk read-ahead.
    expect(pulls()).toBeLessThanOrEqual(4);
  });

  it('a Content-Length that understates the body does not get past the running count', async () => {
    const request = textRequest(`"${'x'.repeat(20)}"`, { 'content-length': '5' });
    const result = await readJsonBody(request, limit(10));
    expect(result).toEqual({ ok: false, status: 413, error: TOO_LARGE });
  });

  it('a body of exactly the cap is accepted', async () => {
    const body = `"${'x'.repeat(8)}"`; // 10 bytes
    expect(await readJsonBody(textRequest(body), limit(10))).toEqual({ ok: true, value: 'x'.repeat(8) });
    expect(
      await readJsonBody(textRequest(body, { 'content-length': '10' }), limit(10))
    ).toEqual({ ok: true, value: 'x'.repeat(8) });
  });

  it('exactly the cap over several chunks is accepted, one byte more is not', async () => {
    const chunk = new TextEncoder().encode('1111');
    const atCap = streamRequest(chunk, 3);
    expect(await readJsonBody(atCap.request, limit(12))).toEqual({ ok: true, value: 111111111111 });
    const over = streamRequest(chunk, 3);
    expect(await readJsonBody(over.request, limit(11))).toEqual({ ok: false, status: 413, error: TOO_LARGE });
  });

  it('counts bytes, not characters', async () => {
    // 'é' is two bytes in UTF-8: 6 characters, 10 bytes with the quotes.
    const body = `"${'é'.repeat(4)}"`;
    expect(body.length).toBe(6);
    expect((await readJsonBody(textRequest(body), limit(9))).ok).toBe(false);
    expect(await readJsonBody(textRequest(body), limit(10))).toEqual({ ok: true, value: 'éééé' });
  });
});

describe('readJsonBody: parsing', () => {
  it('invalid UTF-8 answers 400 with the JSON text', async () => {
    // A lone continuation byte inside a JSON string; a lenient decoder would turn it into U+FFFD.
    const bytes = new Uint8Array([0x22, 0x61, 0x80, 0x62, 0x22]);
    const result = await readJsonBody(bytesRequest(bytes), limit(100));
    expect(result).toEqual({ ok: false, status: 400, error: INVALID_JSON_ERROR });
  });

  it('invalid JSON answers 400 with INVALID_JSON_ERROR', async () => {
    const result = await readJsonBody(textRequest('{'), limit(100));
    expect(result).toEqual({ ok: false, status: 400, error: INVALID_JSON_ERROR });
  });

  it('an empty body answers 400 with INVALID_JSON_ERROR', async () => {
    const request = new Request(URL_, { method: 'POST' });
    expect(await readJsonBody(request, limit(100))).toEqual({ ok: false, status: 400, error: INVALID_JSON_ERROR });
  });

  it('a stream that fails mid-read answers 400', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('connection reset'));
      },
    });
    const request = new Request(URL_, { method: 'POST', body: stream, duplex: 'half' } as RequestInit & {
      duplex: 'half';
    });
    expect(await readJsonBody(request, limit(100))).toEqual({ ok: false, status: 400, error: INVALID_JSON_ERROR });
  });

  it('a leading BOM is dropped, as request.json() does', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"a":1}')]);
    expect(await readJsonBody(bytesRequest(bytes), limit(100))).toEqual({ ok: true, value: { a: 1 } });
  });

  it('any JSON value is returned as parsed', async () => {
    expect(await readJsonBody(textRequest('[1,2]'), limit(100))).toEqual({ ok: true, value: [1, 2] });
    expect(await readJsonBody(textRequest('null'), limit(100))).toEqual({ ok: true, value: null });
  });

  it('no error text echoes the submitted body', async () => {
    const secret = 'sk-do-not-echo-0000000000000000';
    for (const result of [
      await readJsonBody(textRequest(`{"k":"${secret}"`), limit(1000)),
      await readJsonBody(textRequest(`{"k":"${secret}"}`), limit(10)),
      await readJsonObject(textRequest(`["${secret}"]`), limit(1000)),
    ]) {
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });
});

describe('readJsonObject', () => {
  it('returns the object', async () => {
    expect(await readJsonObject(textRequest('{"a":1}'), limit(100))).toEqual({ ok: true, value: { a: 1 } });
  });

  it.each(['null', '[]', '"text"', '5', 'true'])('refuses %s with 400 INVALID_BODY_ERROR', async (raw) => {
    expect(await readJsonObject(textRequest(raw), limit(100))).toEqual({
      ok: false,
      status: 400,
      error: INVALID_BODY_ERROR,
    });
  });

  it('passes the 413 and the invalid-JSON 400 through', async () => {
    expect(await readJsonObject(textRequest('{"a":1}'), limit(3))).toEqual({ ok: false, status: 413, error: TOO_LARGE });
    expect(await readJsonObject(textRequest('{'), limit(100))).toEqual({
      ok: false,
      status: 400,
      error: INVALID_JSON_ERROR,
    });
  });
});

describe('BODY_LIMITS', () => {
  it('has the D5 caps in bytes', () => {
    const KB = 1024;
    expect(BODY_LIMITS.bugs.maxBytes).toBe(256 * KB);
    expect(BODY_LIMITS.prompts.maxBytes).toBe(256 * KB);
    expect(BODY_LIMITS.testCases.maxBytes).toBe(256 * KB);
    expect(BODY_LIMITS.insights.maxBytes).toBe(256 * KB);
    expect(BODY_LIMITS.battleVote.maxBytes).toBe(512 * KB);
    expect(BODY_LIMITS.battleRespond.maxBytes).toBe(32 * KB);
    expect(BODY_LIMITS.chat.maxBytes).toBe(1024 * KB);
    expect(BODY_LIMITS.executeCode.maxBytes).toBe(256 * KB);
    expect(BODY_LIMITS.dataImport.maxBytes).toBe(4096 * KB);
    expect(BODY_LIMITS.keysMigrate.maxBytes).toBe(256 * KB);
    expect(BODY_LIMITS.keys.maxBytes).toBe(8 * KB);
    expect(BODY_LIMITS.testKey.maxBytes).toBe(8 * KB);
    expect(BODY_LIMITS.customProviders.maxBytes).toBe(16 * KB);
    expect(BODY_LIMITS.testCustomProvider.maxBytes).toBe(16 * KB);
  });

  it('every cap stays below the 4.5 MB platform request limit', () => {
    for (const { maxBytes, tooLarge } of Object.values(BODY_LIMITS)) {
      expect(maxBytes).toBeLessThan(4.5 * 1000 * 1000);
      expect(tooLarge).toMatch(/\.$/);
    }
  });
});
