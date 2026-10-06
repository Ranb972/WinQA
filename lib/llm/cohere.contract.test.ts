// Wire contract for every Cohere call: the chat adapter (lib/llm/cohere.ts) and the key
// test (app/api/test-key/route.ts). The real cohere-ai runs; only its fetch is replaced,
// through the test-only seam in lib/llm/cohere-fetch.ts, by a recording fetch that keeps
// the URL, method, headers and parsed JSON body of every request and answers with a
// scripted Response. Written against cohere-ai 7.20.0 so that the 8.x bump (Batch H
// H16) is proven by this file passing unchanged.
//
// Robust by design: headers are read through a Headers object (any casing, plain
// object or Headers instance), and only the headers listed here are asserted, so the
// SDK may add its own (X-Fern-*, User-Agent, X-Client-Name) without breaking the
// contract. The global fetch throws in every test: cohere-ai falls back to it when no
// fetch is injected, so a bypassed seam fails loudly instead of reaching the network.
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import { cohereChat } from '@/lib/llm/cohere';
import { CohereFetch, setCohereFetchForTests } from '@/lib/llm/cohere-fetch';
import { defaultModels } from '@/lib/llm/registry';
import { POST } from '@/app/api/test-key/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));
// The key tests below send a typed key, which never touches the DB; mocked anyway so
// a regression there cannot open a connection.
vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => ({})) }));

// Fake, test-only keys, shaped so redactSecrets (co_ prefix) recognises them.
const USER_KEY = 'co_FAKEUSERKEY0123456789abcdef';
const APP_KEY = 'co_FAKEAPPKEY0123456789abcdef';

const CHAT_URL = 'https://api.cohere.com/v1/chat';

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

// A v1 /chat answer (NonStreamedChatResponse); the adapter reads `text` only.
const chatAnswer = (text: string) => ({
  response_id: 'resp-test',
  text,
  generation_id: 'gen-test',
  chat_history: [],
  finish_reason: 'COMPLETE',
  meta: { api_version: { version: '1' }, billed_units: { input_tokens: 3, output_tokens: 1 } },
});

// Cohere's 401 body for a bad key.
const INVALID_KEY_BODY = { message: 'invalid api token' };
// The key in a 500 body: what the SDK puts in the error message must not reach a log
// line or the key test's answer.
const KEY_QUOTING_SERVER_ERROR = { message: `internal server error, upstream saw ${USER_KEY}` };

// cohere-ai's message for a mapped status error (UnauthorizedError, InternalServerError,
// ...): "<class name>\nStatus code: <n>\nBody: <JSON, 2-space>".
const sdkStatusMessage = (name: string, status: number, body: unknown) =>
  `${name}\nStatus code: ${status}\nBody: ${JSON.stringify(body, null, 2)}`;

// A system turn is sent as USER: the adapter maps every non-assistant role to USER.
const messages = [
  { role: 'system' as const, content: 'Be brief.' },
  { role: 'user' as const, content: 'Say hi' },
  { role: 'assistant' as const, content: 'Hi!' },
  { role: 'user' as const, content: 'Again' },
];
const wireHistory = [
  { role: 'USER', message: 'Be brief.' },
  { role: 'USER', message: 'Say hi' },
  { role: 'CHATBOT', message: 'Hi!' },
];

function install(respond: Responder) {
  const recorder = recordingFetch(respond);
  setCohereFetchForTests(recorder.fetchMock as unknown as CohereFetch);
  return recorder;
}

let errorLog: MockInstance<typeof console.error>;

beforeEach(() => {
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', () => {
    throw new Error('cohere.contract.test: the global fetch was called; the test seam was bypassed');
  });
});

afterEach(() => {
  setCohereFetchForTests(undefined);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const loggedText = () => errorLog.mock.calls.map((c) => c.join(' ')).join('\n');

describe('cohereChat on the wire', () => {
  it('POSTs model, message, chat_history, temperature and max_tokens with the user key, and reads text', async () => {
    const { fetchMock, requests } = install(() => jsonResponse(200, chatAnswer('hi')));

    const res = await cohereChat(messages, 0.3, 256, 'command-r-plus-08-2024', USER_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [req] = requests;
    expect(req.url).toBe(CHAT_URL);
    expect(req.method).toBe('POST');
    expect(req.headers.get('authorization')).toBe(`Bearer ${USER_KEY}`);
    expect(req.headers.get('content-type')).toMatch(/^application\/json/);
    // Exactly these fields, snake_case on the wire; stream: false is the SDK's own.
    expect(req.body).toEqual({
      model: 'command-r-plus-08-2024',
      message: 'Again',
      chat_history: wireHistory,
      temperature: 0.3,
      max_tokens: 256,
      stream: false,
    });

    expect(res).toEqual({
      content: 'hi',
      model: 'cohere',
      specificModel: 'command-r-plus-08-2024',
      responseTime: expect.any(Number),
      keySource: 'user',
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('defaults to the registry model and the app key from COHERE_API_KEY; one turn sends chat_history: null', async () => {
    vi.stubEnv('COHERE_API_KEY', APP_KEY);
    const { requests } = install(() => jsonResponse(200, chatAnswer('hi')));

    const res = await cohereChat([{ role: 'user', content: 'Say hi' }]);

    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get('authorization')).toBe(`Bearer ${APP_KEY}`);
    expect(requests[0].body).toEqual({
      model: defaultModels.cohere,
      message: 'Say hi',
      // The adapter passes chatHistory: undefined; cohere-ai 7.20 sends it as null.
      chat_history: null,
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    });
    expect(res.keySource).toBe('app');
    expect(res.specificModel).toBe(defaultModels.cohere);
    expect(res.content).toBe('hi');
  });

  it('turns a 401 into a status-401 error through reportProviderError: one call, one log line, no key', async () => {
    const { fetchMock } = install(() => jsonResponse(401, INVALID_KEY_BODY));

    const res = await cohereChat(messages, 0.7, 64, 'command-a-03-2025', USER_KEY);

    // The SDK does not retry a 401.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.content).toBe('');
    expect(res.model).toBe('cohere');
    expect(res.specificModel).toBe('command-a-03-2025');
    expect(res.keySource).toBe('user');
    expect(res.error).toBe(`401: ${sdkStatusMessage('UnauthorizedError', 401, INVALID_KEY_BODY)}`);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog.mock.calls[0][0]).toBe(
      '[llm] cohere command-a-03-2025 failed: status=401 key=user 401: UnauthorizedError Status code: 401 Body: { "message": "invalid api token" }'
    );
    expect(res.error).not.toContain(USER_KEY);
    expect(loggedText()).not.toContain(USER_KEY);
  });

  it('on a 500 makes 3 fetch calls (the SDK default of 2 retries; the adapter sets none), then reports 500', async () => {
    // cohere-ai 7.20 reads Retry-After only in whole seconds (or as an HTTP date), so the
    // default backoff (about 1 s, then 2 s) runs on fake timers instead of the wall clock.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { fetchMock, requests } = install(() => jsonResponse(500, KEY_QUOTING_SERVER_ERROR));

    const pending = cohereChat(messages, 0.7, 64, 'command-a-03-2025', USER_KEY);
    await vi.runAllTimersAsync();
    const res = await pending;

    // Pinned for Batch H H16: cohere-ai 8.x must show the same count. Changing the
    // adapter's retry policy is Batch G's job, not the SDK bump's.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const req of requests) {
      expect(req.url).toBe(CHAT_URL);
      expect(req.method).toBe('POST');
      expect(req.headers.get('authorization')).toBe(`Bearer ${USER_KEY}`);
    }
    expect(res.content).toBe('');
    // The raw error string carries the provider's body as-is (the chat routes pass it
    // through friendlyErrorMessage before it reaches a client); the log line is redacted.
    expect(res.error).toBe(`500: ${sdkStatusMessage('InternalServerError', 500, KEY_QUOTING_SERVER_ERROR)}`);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog.mock.calls[0][0]).toBe(
      '[llm] cohere command-a-03-2025 failed: status=500 key=user 500: InternalServerError Status code: 500 Body: { "message": "internal server error, upstream saw <redacted>" }'
    );
    expect(loggedText()).not.toContain(USER_KEY);
  });
});

const keyTest = (apiKey: string) =>
  POST(
    new NextRequest('http://localhost/api/test-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'cohere', apiKey }),
    })
  );

describe('POST /api/test-key, Cohere, on the wire', () => {
  it('sends a one-token probe to the registry default with the typed key; 200 -> valid', async () => {
    const { fetchMock, requests } = install(() => jsonResponse(200, chatAnswer('H')));

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
      model: defaultModels.cohere,
      message: 'Hi',
      max_tokens: 1,
      stream: false,
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

  it('429 -> valid (the key works, it is rate limited), one call (maxRetries: 0)', async () => {
    const { fetchMock } = install(() =>
      jsonResponse(429, { message: 'You are using a Trial key, which is limited to 20 API calls / minute.' })
    );

    const res = await keyTest(USER_KEY);

    expect(await res.json()).toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('500 -> exactly one fetch call (maxRetries: 0), a friendly error, the key not echoed', async () => {
    // Real timers and no Retry-After: a retry would wait the SDK's default backoff and
    // show in the count; the body quotes the key, so an echo would show in the text.
    const { fetchMock } = install(() => jsonResponse(500, KEY_QUOTING_SERVER_ERROR));

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
    // The route's timer was set before the SDK's own 10 s timeout, so it fires first and
    // the SDK reports "The user aborted a request", which isAbortError matches.
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await pending;
    const text = await res.text();

    expect(JSON.parse(text)).toEqual({ valid: false, error: 'Provider took too long to respond. Try again.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(text).not.toContain(USER_KEY);
  });

  it('a fetch that rejects with an AbortError on its own (not the route deadline) reads as a timeout, not the abort path', async () => {
    // Pinned as today's behaviour on cohere-ai 7.20: an AbortError the caller's signal did
    // not cause becomes CohereTimeoutError ("Timeout exceeded when calling POST
    // /v1/chat."), which isAbortError does not match, so the answer comes from
    // friendlyErrorMessage. Either way the user reads a timeout.
    const { fetchMock } = install(() => Promise.reject(new DOMException('This operation was aborted', 'AbortError')));

    const res = await keyTest(USER_KEY);
    const text = await res.text();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(text)).toEqual({ valid: false, error: 'This model took too long to respond. Try again.' });
    expect(text).not.toContain(USER_KEY);
  });
});
