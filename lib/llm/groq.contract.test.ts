// Wire contract for every Groq call: the chat adapter (lib/llm/groq.ts) and the key
// test (app/api/test-key/route.ts). The real groq-sdk runs; only its fetch is replaced,
// through the test-only seam in lib/llm/groq-fetch.ts, by a recording fetch that keeps
// the URL, method, headers and parsed JSON body of every request and answers with a
// scripted Response. Written against groq-sdk 0.37.0 (node-fetch) so that the 1.x
// bump (Batch H H14, global fetch) is proven by this file passing unchanged.
//
// Robust by design: headers are read through a Headers object (any casing, plain
// object or Headers instance), and only the headers listed here are asserted, so the
// SDK may add its own (x-stainless-*, user-agent) without breaking the contract.
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import { groqChat } from '@/lib/llm/groq';
import { GroqFetch, setGroqFetchForTests } from '@/lib/llm/groq-fetch';
import { defaultModels } from '@/lib/llm/registry';
import { POST } from '@/app/api/test-key/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));
// The key tests below send a typed key, which never touches the DB; mocked anyway so
// a regression there cannot open a connection.
vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => ({})) }));

// Fake, test-only keys.
const USER_KEY = 'gsk_FAKEUSERKEY0123456789abcdef';
const APP_KEY = 'gsk_FAKEAPPKEY0123456789abcdef';

const CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
  signal: AbortSignal | null | undefined;
}

type Responder = (request: RecordedRequest, call: number) => Response | Promise<Response>;

/** A fetch that records each request and answers with `respond`. */
function recordingFetch(respond: Responder) {
  const requests: RecordedRequest[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const isRequest = typeof Request !== 'undefined' && input instanceof Request;
    const url = isRequest ? input.url : String(input);
    const method = (init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
    const headers = new Headers((init?.headers ?? (isRequest ? input.headers : undefined)) as HeadersInit | undefined);
    let rawBody: unknown = init?.body;
    if (rawBody === undefined && isRequest) rawBody = await input.clone().text();
    const body = typeof rawBody === 'string' && rawBody.length > 0 ? JSON.parse(rawBody) : rawBody;
    const signal = init?.signal ?? (isRequest ? input.signal : undefined);
    const request: RecordedRequest = { url, method, headers, body, signal };
    requests.push(request);
    return respond(request, requests.length);
  });
  return { fetchMock, requests };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const completion = (content: string) => ({
  id: 'chatcmpl-test',
  object: 'chat.completion',
  created: 0,
  model: 'openai/gpt-oss-20b',
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
});

// Groq's 401 body for a bad key.
const INVALID_KEY_BODY = {
  error: { message: 'Invalid API Key', type: 'invalid_request_error', code: 'invalid_api_key' },
};
const SERVER_ERROR_BODY = { error: { message: 'Internal Server Error', type: 'internal_server_error' } };

const messages = [
  { role: 'system' as const, content: 'Be brief.' },
  { role: 'user' as const, content: 'Say hi' },
];
const wireMessages = [
  { role: 'system', content: 'Be brief.' },
  { role: 'user', content: 'Say hi' },
];

function install(respond: Responder) {
  const recorder = recordingFetch(respond);
  setGroqFetchForTests(recorder.fetchMock as unknown as GroqFetch);
  return recorder;
}

let errorLog: MockInstance<typeof console.error>;

beforeEach(() => {
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setGroqFetchForTests(undefined);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const loggedText = () => errorLog.mock.calls.map((c) => c.join(' ')).join('\n');

describe('groqChat on the wire', () => {
  it('POSTs model, messages, temperature and max_tokens with the user key, and reads choices[0].message.content', async () => {
    const { fetchMock, requests } = install(() => jsonResponse(200, completion('hi')));

    const res = await groqChat(messages, 0.3, 256, 'openai/gpt-oss-20b', USER_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [req] = requests;
    expect(req.url).toBe(CHAT_URL);
    expect(req.method).toBe('POST');
    expect(req.headers.get('authorization')).toBe(`Bearer ${USER_KEY}`);
    expect(req.headers.get('content-type')).toMatch(/^application\/json/);
    // Exactly these four fields: no reasoning_effort unless the caller asks.
    expect(req.body).toEqual({
      model: 'openai/gpt-oss-20b',
      messages: wireMessages,
      temperature: 0.3,
      max_tokens: 256,
    });

    expect(res).toEqual({
      content: 'hi',
      model: 'groq',
      specificModel: 'openai/gpt-oss-20b',
      responseTime: expect.any(Number),
      keySource: 'user',
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("adds reasoning_effort: 'low' only for reasoningEffort 'lowest'", async () => {
    const { requests } = install(() => jsonResponse(200, completion('hi')));

    await groqChat(messages, 0.7, 8, 'openai/gpt-oss-120b', USER_KEY, { reasoningEffort: 'lowest' });
    await groqChat(messages, 0.7, 8, 'openai/gpt-oss-120b', USER_KEY, {});

    expect(requests).toHaveLength(2);
    expect(requests[0].body).toEqual({
      model: 'openai/gpt-oss-120b',
      messages: wireMessages,
      temperature: 0.7,
      max_tokens: 8,
      reasoning_effort: 'low',
    });
    expect(requests[1].body).not.toHaveProperty('reasoning_effort');
  });

  it('defaults to the registry model and the app key from GROQ_API_KEY', async () => {
    vi.stubEnv('GROQ_API_KEY', APP_KEY);
    const { requests } = install(() => jsonResponse(200, completion('hi')));

    const res = await groqChat(messages);

    expect(requests[0].headers.get('authorization')).toBe(`Bearer ${APP_KEY}`);
    expect(requests[0].body).toEqual({
      model: defaultModels.groq,
      messages: wireMessages,
      temperature: 0.7,
      max_tokens: 1024,
    });
    expect(res.keySource).toBe('app');
    expect(res.specificModel).toBe(defaultModels.groq);
    expect(res.content).toBe('hi');
  });

  it('turns a 401 into a status-401 error through reportProviderError: one call, one log line, no key', async () => {
    const { fetchMock } = install(() => jsonResponse(401, INVALID_KEY_BODY));

    const res = await groqChat(messages, 0.7, 64, 'openai/gpt-oss-20b', USER_KEY);

    // The SDK does not retry a 401.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.content).toBe('');
    expect(res.model).toBe('groq');
    expect(res.specificModel).toBe('openai/gpt-oss-20b');
    expect(res.keySource).toBe('user');
    expect(res.error).toBe(`401 ${JSON.stringify(INVALID_KEY_BODY)}`);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog.mock.calls[0][0]).toMatch(/^\[llm\] groq openai\/gpt-oss-20b failed: status=401 key=user 401 /);
    expect(res.error).not.toContain(USER_KEY);
    expect(loggedText()).not.toContain(USER_KEY);
  });

  it('on a 500 makes 3 fetch calls (the SDK default of 2 retries; the adapter sets none), then reports 500', async () => {
    // retry-after-ms keeps the SDK's backoff to 1 ms per retry; a version that ignored
    // it would wait its default backoff (about 1.5 s in all) and still pass.
    const { fetchMock, requests } = install(() => jsonResponse(500, SERVER_ERROR_BODY, { 'retry-after-ms': '1' }));

    const res = await groqChat(messages, 0.7, 64, 'openai/gpt-oss-20b', USER_KEY);

    // Pinned for Batch H H14: groq-sdk 1.x must show the same count. Changing the
    // adapter's retry policy is Batch G's job, not the SDK bump's.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const req of requests) {
      expect(req.url).toBe(CHAT_URL);
      expect(req.method).toBe('POST');
      expect(req.headers.get('authorization')).toBe(`Bearer ${USER_KEY}`);
    }
    expect(res.content).toBe('');
    expect(res.error).toBe(`500 ${JSON.stringify(SERVER_ERROR_BODY)}`);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog.mock.calls[0][0]).toMatch(/failed: status=500 key=user /);
    expect(res.error).not.toContain(USER_KEY);
    expect(loggedText()).not.toContain(USER_KEY);
  });
});

const keyTest = (apiKey: string) =>
  POST(
    new NextRequest('http://localhost/api/test-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'groq', apiKey }),
    })
  );

describe('POST /api/test-key, Groq, on the wire', () => {
  it('sends a one-token probe to the registry default with the typed key; 200 -> valid', async () => {
    const { fetchMock, requests } = install(() => jsonResponse(200, completion('H')));

    const res = await keyTest(USER_KEY);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [req] = requests;
    expect(req.url).toBe(CHAT_URL);
    expect(req.method).toBe('POST');
    expect(req.headers.get('authorization')).toBe(`Bearer ${USER_KEY}`);
    expect(req.headers.get('content-type')).toMatch(/^application\/json/);
    expect(req.body).toEqual({
      model: defaultModels.groq,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1,
    });
  });

  it('401 -> "Invalid API key", one call, the key not echoed', async () => {
    const { fetchMock } = install(() => jsonResponse(401, INVALID_KEY_BODY));

    const res = await keyTest(USER_KEY);
    const text = await res.text();

    expect(JSON.parse(text)).toEqual({ valid: false, error: 'Invalid API key' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(text).not.toContain(USER_KEY);
  });

  it('500 -> exactly one fetch call (maxRetries: 0), a friendly error, the key not echoed', async () => {
    // No retry-after header, and the body quotes the key: a retry would wait the SDK's
    // default backoff and show in the count, and an echo would show in the text.
    const { fetchMock } = install(() =>
      jsonResponse(500, { error: { message: `upstream saw ${USER_KEY}`, type: 'internal_server_error' } })
    );

    const res = await keyTest(USER_KEY);
    const text = await res.text();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(text)).toEqual({ valid: false, error: 'This model is temporarily unavailable. Try a different one.' });
    expect(text).not.toContain(USER_KEY);
  });

  it("the route's 10 s deadline aborts the request and takes the isAbortError path", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // A provider that never answers: the fetch settles only when its signal aborts.
    const { fetchMock, requests } = install(
      (req) =>
        new Promise<Response>((_resolve, reject) => {
          const abort = () => reject(new DOMException('This operation was aborted', 'AbortError'));
          if (req.signal?.aborted) abort();
          else req.signal?.addEventListener('abort', abort);
        })
    );

    const pending = keyTest(USER_KEY);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requests[0].signal).toBeTruthy();
    // The route's timer was set before the SDK's own 10 s timeout, so it fires first.
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await pending;
    const text = await res.text();

    expect(JSON.parse(text)).toEqual({ valid: false, error: 'Provider took too long to respond. Try again.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(text).not.toContain(USER_KEY);
  });

  it('a fetch that rejects with an AbortError on its own (not the route deadline) reads as a timeout, not the abort path', async () => {
    // Pinned as today's behaviour on groq-sdk 0.37: an AbortError the caller's signal did
    // not cause becomes APIConnectionTimeoutError ("Request timed out."), which
    // isAbortError does not match, so the answer comes from friendlyErrorMessage.
    // Either way the user reads a timeout.
    const { fetchMock } = install(() => Promise.reject(new DOMException('This operation was aborted', 'AbortError')));

    const res = await keyTest(USER_KEY);
    const text = await res.text();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(text)).toEqual({ valid: false, error: 'This model took too long to respond. Try again.' });
    expect(text).not.toContain(USER_KEY);
  });
});
