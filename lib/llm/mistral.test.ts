import { describe, it, expect, vi, afterEach } from 'vitest';
import { mistralChat, mistralText } from '@/lib/llm/mistral';

function jsonResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(JSON.stringify(body), { status, statusText, headers: { 'content-type': 'application/json' } });
}

const messages = [{ role: 'user' as const, content: 'hi' }];

describe('mistralText', () => {
  it('returns a plain string as is', () => {
    expect(mistralText('hello')).toBe('hello');
  });

  it('joins text chunks and skips thinking chunks of an array-form content', () => {
    expect(mistralText([
      { type: 'thinking', text: 'let me think' },
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' there' },
    ])).toBe('Hello there');
  });

  it('is empty for null, undefined or unknown shapes', () => {
    expect(mistralText(null)).toBe('');
    expect(mistralText(undefined)).toBe('');
    expect(mistralText([{ type: 'image_url' }])).toBe('');
  });
});

describe('mistralChat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the chat-completions body and reads the answer', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, {
      choices: [{ message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await mistralChat(messages, 0.7, 1024, 'ministral-8b-2512', 'key-not-real');

    expect(res.error).toBeUndefined();
    expect(res.content).toBe('Hello');
    expect(res.model).toBe('mistral');
    expect(res.specificModel).toBe('ministral-8b-2512');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
    const body = JSON.parse(init.body as string);
    // Exactly these four fields: Ministral 3 answers 400 to reasoning_effort.
    expect(body).toEqual({ model: 'ministral-8b-2512', messages, temperature: 0.7, max_tokens: 1024 });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key-not-real');
  });

  it('turns a 429 with a {message} body into a status-prefixed error and one log line', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(429, {
      object: 'error', message: 'Rate limit exceeded', type: 'rate_limited', code: '1300',
    }, 'Too Many Requests')));

    const res = await mistralChat(messages, 0.7, 1024, 'ministral-14b-2512', 'key-not-real');

    expect(res.content).toBe('');
    expect(res.error).toBe('429: Rate limit exceeded');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('[llm] mistral ministral-14b-2512 failed: status=429 429: Rate limit exceeded');
  });

  it('reads the 422 {detail:[{msg}]} and the {error:{message}} shapes too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(422, { detail: [{ msg: 'Invalid model: nope' }] })));
    expect((await mistralChat(messages, 0.7, 1024, 'ministral-3b-2512', 'k')).error).toBe('422: Invalid model: nope');

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(403, { error: { message: 'This model is not available in your subscription tier' } })));
    expect((await mistralChat(messages, 0.7, 1024, 'ministral-3b-2512', 'k')).error).toBe('403: This model is not available in your subscription tier');
  });
});
