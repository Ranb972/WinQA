import { describe, it, expect } from 'vitest';
import { errorTextFrom, MAX_ERROR_TEXT_CHARS, TOO_LARGE_TEXT } from './api-error';

const FALLBACK = 'Failed to save prompt';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('errorTextFrom (D9): the sentence a form shows when a save fails', () => {
  it("shows the server's field sentence from a JSON 400", async () => {
    const res = json(400, { error: 'model_response is longer than 30,000 characters' });
    expect(await errorTextFrom(res, FALLBACK)).toBe('model_response is longer than 30,000 characters');
  });

  it("shows the server's ceiling sentence from a JSON 409", async () => {
    const sentence =
      'You have 500 bug reports, the most WinQA keeps per account. Delete some to add more.';
    expect(await errorTextFrom(json(409, { error: sentence }), FALLBACK)).toBe(sentence);
  });

  it("shows the server's sentence from a JSON 413, even when a page has its own 413 text", async () => {
    const sentence = 'This entry is too large to save. Shorten the longest field and try again.';
    expect(await errorTextFrom(json(413, { error: sentence }), FALLBACK)).toBe(sentence);
    expect(
      await errorTextFrom(json(413, { error: sentence }), FALLBACK, { tooLarge: 'page text' })
    ).toBe(sentence);
  });

  it('answers a 413 whose body is HTML (a platform or proxy page) with a fixed sentence', async () => {
    const html = new Response('<html><body><h1>413 Request Entity Too Large</h1></body></html>', {
      status: 413,
      headers: { 'Content-Type': 'text/html' },
    });
    expect(await errorTextFrom(html, FALLBACK)).toBe(TOO_LARGE_TEXT);
  });

  it("uses the page's own sentence for a non-JSON 413 when one is given", async () => {
    const text = new Response('Request Entity Too Large', { status: 413 });
    expect(await errorTextFrom(text, FALLBACK, { tooLarge: 'This file is too big.' })).toBe(
      'This file is too big.'
    );
    expect(await errorTextFrom(new Response(null, { status: 413 }), FALLBACK)).toBe(TOO_LARGE_TEXT);
  });

  it('falls back on a non-JSON 500', async () => {
    const res = new Response('<html>Internal Server Error</html>', { status: 500 });
    expect(await errorTextFrom(res, FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(new Response(null, { status: 502 }), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back on a thrown network error or anything that is not a response', async () => {
    expect(await errorTextFrom(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(new Error('Request timed out after 45s'), FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(undefined, FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(null, FALLBACK)).toBe(FALLBACK);
  });

  it('falls back when the body cannot be read, and still names a 413', async () => {
    const broken = (status: number) => ({
      status,
      text: () => Promise.reject(new TypeError('network error')),
    });
    expect(await errorTextFrom(broken(500), FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(broken(413), FALLBACK)).toBe(TOO_LARGE_TEXT);
  });

  it('ignores a JSON body whose error is missing, empty, not a string or too long', async () => {
    expect(await errorTextFrom(json(500, {}), FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(json(500, { error: '   ' }), FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(json(400, { error: { message: 'x' } }), FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(json(400, ['error']), FALLBACK)).toBe(FALLBACK);
    expect(await errorTextFrom(json(400, null), FALLBACK)).toBe(FALLBACK);
    const long = 'x'.repeat(MAX_ERROR_TEXT_CHARS + 1);
    expect(await errorTextFrom(json(400, { error: long }), FALLBACK)).toBe(FALLBACK);
    const atCap = 'y'.repeat(MAX_ERROR_TEXT_CHARS);
    expect(await errorTextFrom(json(400, { error: atCap }), FALLBACK)).toBe(atCap);
  });

  it('reads the error field of the { success: false, error } shape too', async () => {
    expect(await errorTextFrom(json(400, { success: false, error: 'Invalid JSON body' }), FALLBACK)).toBe(
      'Invalid JSON body'
    );
  });
});
