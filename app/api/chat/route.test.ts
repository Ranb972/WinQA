import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import ProviderCredential from '@/models/ProviderCredential';
import { _resetKeyRingForTests } from '@/lib/server/key-vault';
import { encryptForSlot } from '@/lib/server/user-keys';
import type { ChatResponse, CustomApiKeys } from '@/lib/llm';
import type { CustomProvider } from '@/lib/custom-providers';
import { defaultModels } from '@/lib/llm';
import { CHAT_MAX_MESSAGES, CHAT_MAX_TOTAL_CHARS, trimChatHistory } from '@/lib/content-limits';
import { historyForModel } from '@/lib/chat-history';
import { buildChatBody } from '@/lib/provider-picker';

const USER = 'user_2chatALICE42';

const m = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ userId: 'user_2chatALICE42' as string | null })),
  connect: vi.fn(async () => undefined),
  consume: vi.fn(async () => ({ allowed: true })),
  chat: vi.fn(),
  multiModelChat: vi.fn(),
  callCustomProvider: vi.fn(),
  loadCustomProvider: vi.fn(),
  markRejected: vi.fn(async () => undefined),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: m.auth }));
vi.mock('@/lib/mongodb', () => ({ default: m.connect }));
vi.mock('@/lib/rate-limit', () => ({ consumeDailyAllowance: m.consume }));
vi.mock('@/lib/llm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm')>()),
  chat: m.chat,
  multiModelChat: m.multiModelChat,
}));
vi.mock('@/lib/llm/custom', () => ({ callCustomProvider: m.callCustomProvider }));
// loadCustomProvider and markRejected are mocked. loadUserKeys stays real (it is
// called inside resolveUserKeys, where a module mock cannot reach): its DB read is
// the spied ProviderCredential.find below, and fixtures are encrypted for real under
// a test-only ring, so a decrypt failure is a real one.
vi.mock('@/lib/server/user-keys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/user-keys')>()),
  loadCustomProvider: m.loadCustomProvider,
  markRejected: m.markRejected,
}));

import { POST } from './route';

const SERVER_GEMINI = 'AIzaSy-server-gemini-key-000000000001';
const BODY_GEMINI = 'AIzaSy-body-gemini-key-0000000000002';
const SERVER_GROQ = 'gsk_server_groq_key_0000000000000003';
const BODY_GROQ = 'gsk_body_groq_key_00000000000000004';
const STORED_KEY = 'sk-stored-custom-key-000000000000005';
const BODY_CUSTOM_KEY = 'sk-body-custom-key-00000000000000006';
const CUSTOM_ID = '65f0a1b2c3d4e5f6a7b8c9d0';

const KEYS_LINE = /^\[keys\] route=chat origin=(server|client|mixed) providers=[a-z,]+$/;
const ringV1 = `v1:${randomBytes(32).toString('base64')}`;
let savedEnv: string | undefined;
let logSpy: MockInstance<typeof console.log>;
let errorSpy: MockInstance<typeof console.error>;
let find: MockInstance;

function builtinDoc(provider: string, key: string) {
  return { userId: USER, slot: provider, kind: 'builtin', provider, ...encryptForSlot(USER, provider, key) };
}

function savedKeys(docs: unknown[]) {
  const lean = vi.fn().mockResolvedValue(docs);
  const select = vi.fn(() => ({ lean }));
  find.mockImplementation((() => ({ select })) as never);
}

function flipByte(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  buf[0] ^= 0x01;
  return buf.toString('base64');
}

const okResponse = (model: string, extra: Partial<ChatResponse> = {}): ChatResponse =>
  ({ content: 'ok', model, responseTime: 1, keySource: 'app', ...extra }) as ChatResponse;

const req = (body: unknown): NextRequest =>
  new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const messages = [{ role: 'user', content: 'hi' }];

/** The CustomApiKeys the single-model engine call received (chat's 7th argument). */
const chatKeys = (): CustomApiKeys | undefined => m.chat.mock.calls[0][6] as CustomApiKeys | undefined;

const keysLines = (): string[] =>
  logSpy.mock.calls.map((c) => c.map(String).join(' ')).filter((l) => l.startsWith('[keys]'));

const allLogged = (): string =>
  [...logSpy.mock.calls, ...errorSpy.mock.calls].map((c) => c.map(String).join(' ')).join('\n');

const storedProvider = (extra: Partial<CustomProvider> = {}): CustomProvider => ({
  id: CUSTOM_ID,
  name: 'Stored Router',
  baseUrl: 'https://stored.example.com/v1',
  apiKey: STORED_KEY,
  modelId: 'stored-model',
  enabled: true,
  headerType: 'bearer',
  ...extra,
});

const bodyProvider: CustomProvider = {
  id: CUSTOM_ID,
  name: 'Body Router',
  baseUrl: 'https://attacker.example.net/v1',
  apiKey: BODY_CUSTOM_KEY,
  modelId: 'body-model',
  enabled: true,
};

beforeEach(() => {
  savedEnv = process.env.KEY_ENCRYPTION_KEYS;
  process.env.KEY_ENCRYPTION_KEYS = ringV1;
  _resetKeyRingForTests();
  m.auth.mockResolvedValue({ userId: USER });
  m.connect.mockClear();
  m.consume.mockReset().mockResolvedValue({ allowed: true });
  m.chat.mockReset().mockImplementation(async (_msgs: unknown, model: string) => okResponse(model));
  m.multiModelChat.mockReset().mockImplementation(async ({ models }: { models: string[] }) => ({
    responses: models.map((mm) => okResponse(mm)),
  }));
  m.callCustomProvider.mockReset().mockResolvedValue({ content: 'ok', model: 'custom', responseTime: 1 });
  m.loadCustomProvider.mockReset().mockResolvedValue(null);
  m.markRejected.mockClear();
  find = vi.spyOn(ProviderCredential, 'find') as unknown as MockInstance;
  savedKeys([]);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedEnv === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
  else process.env.KEY_ENCRYPTION_KEYS = savedEnv;
  _resetKeyRingForTests();
});

describe('POST /api/chat: built-in keys resolve on the server first', () => {
  it('the saved key beats a different body key for the same provider', async () => {
    savedKeys([builtinDoc('gemini', SERVER_GEMINI)]);
    const res = await POST(req({ messages, models: 'gemini', customApiKeys: { gemini: BODY_GEMINI } }));
    expect(res.status).toBe(200);
    expect(chatKeys()?.gemini).toBe(SERVER_GEMINI);
    expect(keysLines()).toEqual(['[keys] route=chat origin=server providers=gemini']);
  });

  it('the body key is used when the server has none', async () => {
    const res = await POST(req({ messages, models: 'gemini', customApiKeys: { gemini: BODY_GEMINI } }));
    expect(res.status).toBe(200);
    expect(chatKeys()?.gemini).toBe(BODY_GEMINI);
    expect(keysLines()).toEqual(['[keys] route=chat origin=client providers=gemini']);
  });

  it('neither: the engine gets no key for that provider and no [keys] line is written', async () => {
    const res = await POST(req({ messages, models: 'gemini' }));
    expect(res.status).toBe(200);
    expect(chatKeys()?.gemini).toBeUndefined();
    expect(keysLines()).toEqual([]);
  });

  it('a saved key that does not decrypt falls through to the body key, then to no key', async () => {
    const bad = builtinDoc('gemini', SERVER_GEMINI);
    bad.ct = flipByte(bad.ct);
    savedKeys([bad]);
    await POST(req({ messages, models: 'gemini', customApiKeys: { gemini: BODY_GEMINI } }));
    expect(chatKeys()?.gemini).toBe(BODY_GEMINI);
    expect(errorSpy.mock.calls.map((c) => String(c[0]))).toContainEqual(
      expect.stringMatching(/^\[keys\] decrypt-failed slot=gemini version=v1 error=KeyVaultDecryptError$/)
    );

    m.chat.mockClear();
    logSpy.mockClear();
    const res = await POST(req({ messages, models: 'gemini' }));
    expect(res.status).toBe(200);
    expect(chatKeys()?.gemini).toBeUndefined();
    expect(keysLines()).toEqual([]);
  });

  it('a key load that throws falls through to the body keys and the route still answers 200', async () => {
    find.mockImplementation((() => {
      throw new Error(`db down ${USER}`);
    }) as never);
    const res = await POST(req({ messages, models: 'groq', customApiKeys: { groq: BODY_GROQ } }));
    expect(res.status).toBe(200);
    expect(chatKeys()?.groq).toBe(BODY_GROQ);
    expect(errorSpy).toHaveBeenCalledWith('[keys] load-failed error=Error');
    expect(allLogged()).not.toContain(USER);
  });

  it('Compare: a saved key and a body key give origin=mixed; multiModelChat gets both', async () => {
    savedKeys([builtinDoc('gemini', SERVER_GEMINI)]);
    const res = await POST(
      req({ messages, models: ['gemini', 'groq'], customApiKeys: { gemini: BODY_GEMINI, groq: BODY_GROQ } })
    );
    expect(res.status).toBe(200);
    const arg = m.multiModelChat.mock.calls[0][0] as { customApiKeys?: CustomApiKeys };
    expect(arg.customApiKeys).toEqual({ gemini: SERVER_GEMINI, groq: BODY_GROQ });
    expect(keysLines()).toEqual(['[keys] route=chat origin=mixed providers=gemini,groq']);
  });

  it('keys are resolved for all four providers (cross-provider fallback on), only the called ones when it is off', async () => {
    await POST(req({ messages, models: 'gemini' }));
    expect(find.mock.calls[0][0]).toEqual({
      userId: USER,
      kind: 'builtin',
      slot: { $in: ['cohere', 'gemini', 'groq', 'mistral'] },
    });
    find.mockClear();
    savedKeys([]);
    await POST(req({ messages, models: 'gemini', crossProviderFallback: false }));
    expect(find.mock.calls[0][0]).toEqual({ userId: USER, kind: 'builtin', slot: { $in: ['gemini'] } });
  });

  it('a saved key for a fallback provider reaches the engine when cross-provider fallback is on', async () => {
    savedKeys([builtinDoc('groq', SERVER_GROQ)]);
    await POST(req({ messages, models: 'gemini' }));
    expect(chatKeys()).toEqual({ groq: SERVER_GROQ });
  });

  it('the [keys] line has the fixed shape and carries no user id and no key', async () => {
    savedKeys([builtinDoc('gemini', SERVER_GEMINI)]);
    await POST(
      req({ messages, models: ['gemini', 'groq', 'mistral'], customApiKeys: { groq: BODY_GROQ } })
    );
    const lines = keysLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(KEYS_LINE);
    for (const s of [USER, SERVER_GEMINI, BODY_GROQ]) expect(allLogged()).not.toContain(s);
  });

  it('userKeyRejected on a saved key marks that provider rejected (fire-and-forget)', async () => {
    savedKeys([builtinDoc('gemini', SERVER_GEMINI)]);
    // The engine dropped the rejected key and answered on the app key.
    m.chat.mockResolvedValue(okResponse('gemini', { keySource: 'app', userKeyRejected: true }));
    const res = await POST(req({ messages, models: 'gemini' }));
    expect(res.status).toBe(200);
    expect(m.markRejected).toHaveBeenCalledTimes(1);
    expect(m.markRejected).toHaveBeenCalledWith(USER, 'gemini');
  });

  it('a rejected saved key followed by a fallback that ran on another saved key marks nothing', async () => {
    savedKeys([builtinDoc('gemini', SERVER_GEMINI), builtinDoc('groq', SERVER_GROQ)]);
    // gemini's saved key was rejected, the app-key retry failed, and the fallback
    // answered on groq with groq's saved key: the response names groq, not gemini.
    m.chat.mockResolvedValue(okResponse('groq', { keySource: 'user', userKeyRejected: true }));
    const res = await POST(req({ messages, models: 'gemini' }));
    expect(res.status).toBe(200);
    expect(m.markRejected).not.toHaveBeenCalled();
  });

  it('no [keys] line when the daily allowance refuses the request', async () => {
    savedKeys([builtinDoc('gemini', SERVER_GEMINI)]);
    m.consume.mockResolvedValue({ allowed: false });
    const res = await POST(req({ messages, models: 'gemini' }));
    expect(res.status).toBe(429);
    expect(keysLines()).toEqual([]);
    expect(m.chat).not.toHaveBeenCalled();
  });

  it('userKeyRejected on a body key does not mark anything', async () => {
    m.chat.mockResolvedValue(okResponse('gemini', { keySource: 'app', userKeyRejected: true }));
    await POST(req({ messages, models: 'gemini', customApiKeys: { gemini: BODY_GEMINI } }));
    expect(m.markRejected).not.toHaveBeenCalled();
  });

  it('Compare: only the response whose saved key was rejected is marked', async () => {
    savedKeys([builtinDoc('gemini', SERVER_GEMINI)]);
    m.multiModelChat.mockResolvedValue({
      responses: [
        okResponse('gemini', { keySource: 'app', userKeyRejected: true }),
        okResponse('groq', { keySource: 'app', userKeyRejected: true }),
      ],
    });
    await POST(req({ messages, models: ['gemini', 'groq'], customApiKeys: { groq: BODY_GROQ } }));
    expect(m.markRejected.mock.calls).toEqual([[USER, 'gemini']]);
  });
});

describe('POST /api/chat: custom providers', () => {
  it('a stored record wins: callCustomProvider gets its baseUrl and key, the body customProvider is ignored', async () => {
    m.loadCustomProvider.mockResolvedValue(storedProvider());
    const res = await POST(req({ messages, models: `custom:${CUSTOM_ID}`, customProvider: bodyProvider }));
    expect(res.status).toBe(200);
    expect(m.loadCustomProvider).toHaveBeenCalledWith(USER, CUSTOM_ID);
    expect(m.callCustomProvider).toHaveBeenCalledTimes(1);
    const sent = m.callCustomProvider.mock.calls[0][0] as CustomProvider;
    expect(sent.baseUrl).toBe('https://stored.example.com/v1');
    expect(sent.apiKey).toBe(STORED_KEY);
    expect(JSON.stringify(m.callCustomProvider.mock.calls)).not.toContain('attacker.example.net');
    expect(keysLines()).toEqual(['[keys] route=chat origin=server providers=custom']);
    expect(allLogged()).not.toContain(CUSTOM_ID);
  });

  it('the id is looked up lower-case', async () => {
    m.loadCustomProvider.mockResolvedValue(storedProvider());
    await POST(req({ messages, models: `custom:${CUSTOM_ID.toUpperCase()}` }));
    expect(m.loadCustomProvider).toHaveBeenCalledWith(USER, CUSTOM_ID);
  });

  it('a stored but disabled provider is a 400 and burns no unit', async () => {
    m.loadCustomProvider.mockResolvedValue(storedProvider({ enabled: false }));
    const res = await POST(req({ messages, models: `custom:${CUSTOM_ID}`, customProvider: bodyProvider }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This custom provider is disabled' });
    expect(m.consume).not.toHaveBeenCalled();
    expect(m.callCustomProvider).not.toHaveBeenCalled();
  });

  it('an unknown id with no body provider is a 400 and burns no unit', async () => {
    const res = await POST(req({ messages, models: `custom:${CUSTOM_ID}` }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Custom provider not found' });
    expect(m.consume).not.toHaveBeenCalled();
    expect(m.callCustomProvider).not.toHaveBeenCalled();
  });

  it('an unknown id with a body provider uses it (legacy path, origin=client)', async () => {
    const res = await POST(req({ messages, models: `custom:${CUSTOM_ID}`, customProvider: bodyProvider }));
    expect(res.status).toBe(200);
    expect(m.callCustomProvider.mock.calls[0][0]).toEqual(bodyProvider);
    expect(keysLines()).toEqual(['[keys] route=chat origin=client providers=custom']);
  });

  it('a malformed id with no body provider is a 400 with no DB call and no unit burned', async () => {
    for (const bad of ['custom:', 'custom:abc', 'custom:aaaaaaaaaaaa', `custom:${CUSTOM_ID}0`, 'custom:65f0a1b2c3d4e5f6a7b8c9dz']) {
      const res = await POST(req({ messages, models: bad }));
      expect(res.status).toBe(400);
    }
    expect(m.loadCustomProvider).not.toHaveBeenCalled();
    expect(m.connect).not.toHaveBeenCalled();
    expect(m.consume).not.toHaveBeenCalled();
  });

  it('an old browser-store id (custom_<time>_<rand>) with its body provider still runs, with no DB call', async () => {
    const res = await POST(
      req({ messages, models: 'custom:custom_1712345678901_abc1234', customProvider: bodyProvider })
    );
    expect(res.status).toBe(200);
    expect(m.loadCustomProvider).not.toHaveBeenCalled();
    expect(m.callCustomProvider.mock.calls[0][0]).toEqual(bodyProvider);
  });

  it('a loader that throws falls through to the body provider', async () => {
    m.loadCustomProvider.mockRejectedValue(new Error('db down'));
    const res = await POST(req({ messages, models: `custom:${CUSTOM_ID}`, customProvider: bodyProvider }));
    expect(res.status).toBe(200);
    expect(m.callCustomProvider.mock.calls[0][0]).toEqual(bodyProvider);
    expect(errorSpy).toHaveBeenCalledWith('[keys] load-failed error=Error');
  });
});

describe('POST /api/chat: message count and length are capped before the charge (D8)', () => {
  const TOO_LONG = 'This conversation is too long to send. Start a new chat or remove earlier messages.';
  const msg = (content: unknown, role: unknown = 'user') => ({ role, content });

  /** Nothing past the message checks ran: no key lookup, no charge, no engine. */
  function expectRefusedEarly() {
    expect(m.consume).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
    expect(m.loadCustomProvider).not.toHaveBeenCalled();
    expect(m.chat).not.toHaveBeenCalled();
    expect(m.multiModelChat).not.toHaveBeenCalled();
    expect(m.callCustomProvider).not.toHaveBeenCalled();
  }

  it('101 messages give 400', async () => {
    const many = Array.from({ length: 101 }, (_, i) => msg(`m${i}`, i % 2 ? 'assistant' : 'user'));
    const res = await POST(req({ messages: many, models: 'gemini' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      'A conversation can have at most 100 messages. Start a new chat or remove earlier messages.'
    );
    expectRefusedEarly();
  });

  it('one message of 64,001 characters gives 413 with the chat sentence', async () => {
    const res = await POST(req({ messages: [msg('x'.repeat(64_001))], models: 'gemini' }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: TOO_LONG });
    expectRefusedEarly();
  });

  it('a total of 200,001 characters gives 413, each message within its own cap', async () => {
    const parts = [
      msg('x'.repeat(64_000)),
      msg('x'.repeat(64_000), 'assistant'),
      msg('x'.repeat(64_000)),
      msg('x'.repeat(8_001), 'assistant'),
    ];
    const res = await POST(req({ messages: parts, models: ['gemini', 'groq'] }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: TOO_LONG });
    expectRefusedEarly();
  });

  it('content: 5 gives 400', async () => {
    const res = await POST(req({ messages: [msg(5)], models: 'gemini' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Each message content must be text');
    expectRefusedEarly();
  });

  it("role: 'tool' gives 400", async () => {
    const res = await POST(req({ messages: [msg('hi', 'tool')], models: 'gemini' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Each message role must be user, assistant or system');
    expectRefusedEarly();
  });

  it.each([
    ['a string', 'hello'],
    ['an object with a length', { length: 1 }],
    ['a list holding null', [null]],
    ['a list holding a string', ['hi']],
  ])('messages that are %s give 400', async (_label, value) => {
    const res = await POST(req({ messages: value, models: 'gemini' }));
    expect(res.status).toBe(400);
    expectRefusedEarly();
  });

  it('a custom provider is refused before its record is loaded', async () => {
    const res = await POST(req({ messages: [msg('x'.repeat(64_001))], models: `custom:${CUSTOM_ID}` }));
    expect(res.status).toBe(413);
    expectRefusedEarly();
  });

  it('exactly at every cap is accepted and charged once', async () => {
    // 100 messages, one of them 64,000 characters, 200,000 in all.
    const rest = Array.from({ length: 99 }, (_, i) =>
      msg('x'.repeat(i < 98 ? 1373 : 1446), i % 2 ? 'user' : 'assistant')
    );
    const all = [msg('x'.repeat(64_000), 'system'), ...rest];
    expect(all).toHaveLength(100);
    expect(all.reduce((n, x) => n + (x.content as string).length, 0)).toBe(200_000);
    const res = await POST(req({ messages: all, models: 'gemini' }));
    expect(res.status).toBe(200);
    expect(m.consume).toHaveBeenCalledTimes(1);
    expect(m.chat).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/chat: a long Compare conversation keeps being accepted, each model sent only its own replies (D13, D15)', () => {
  type Stored = { role: 'user' | 'assistant'; content: string; model?: string; isError?: boolean };
  type Sent = { role: string; content: string };
  const BUILT_INS = ['cohere', 'gemini', 'groq', 'mistral'] as const;
  const CUSTOM_KEY = `custom:${CUSTOM_ID}`;
  const USER_CHARS = 120;
  const ENGINE_FAILURE = 'engine exploded on purpose';
  /** Every reply starts with a tag naming who wrote it and on which turn. */
  const tag = (key: string, turn: number) => `[${key} reply ${turn}]`;
  const replyTag = (key: string) => `[${key} reply `;

  type Send = {
    turn: number;
    key: string;
    outgoing: Sent[];
    dropped: number;
    status: number;
    bodyText: string;
    engineGot: unknown;
    error?: string;
  };

  /**
   * A Compare session as Chat Lab runs it (components/ChatInterface.tsx): on each
   * send, every selected model (the built-ins, then the custom provider) gets
   * historyForModel(conversation + new message, its key), trimmed with
   * trimChatHistory, posted with its Compare body. Each reply is stored with the
   * key that asked for it (`model`) and isError when data.error is set, as the
   * component stores it. `shared: true` replays the client before D15 instead:
   * one untrimmed list of every message on screen, sent to every model.
   */
  async function compareSession(
    turns: number,
    replyChars: number,
    {
      models = BUILT_INS as readonly string[],
      custom = false,
      shared = false,
      failAt,
    }: { models?: readonly string[]; custom?: boolean; shared?: boolean; failAt?: { key: string; turn: number } } = {}
  ) {
    let turn = 0;
    const replyFor = (key: string) => tag(key, turn).padEnd(replyChars, 'r');
    m.chat.mockImplementation(async (_msgs: unknown, model: string) =>
      failAt && failAt.key === model && failAt.turn === turn
        ? okResponse(model, { content: '', error: ENGINE_FAILURE })
        : okResponse(model, { content: replyFor(model) })
    );
    m.callCustomProvider.mockImplementation(async () => ({ content: replyFor(CUSTOM_KEY), model: 'custom', responseTime: 1 }));
    m.loadCustomProvider.mockResolvedValue(storedProvider());

    const keys = [...models, ...(custom ? [CUSTOM_KEY] : [])];
    const conversation: Stored[] = [];
    const sends: Send[] = [];
    for (turn = 1; turn <= turns; turn++) {
      const userMessage: Stored = { role: 'user', content: `turn ${turn} `.padEnd(USER_CHARS, 'q') };
      const onScreen = [...conversation, userMessage];
      conversation.push(userMessage);
      // Every list is built before any reply of this turn lands, as in the component.
      const lists = keys.map((key) =>
        shared
          ? { messages: onScreen.map((x) => ({ role: x.role, content: x.content })), dropped: 0 }
          : trimChatHistory(historyForModel(onScreen, key))
      );
      for (const [i, key] of keys.entries()) {
        const { messages: outgoing, dropped } = lists[i];
        m.chat.mockClear();
        m.callCustomProvider.mockClear();
        const body =
          key === CUSTOM_KEY
            ? buildChatBody({ messages: outgoing }, { model: key })
            : buildChatBody(
                {
                  messages: outgoing,
                  modelPreferences: defaultModels,
                  crossProviderFallback: false,
                  maxFallbackAttempts: 2,
                  fallbackDelay: 200,
                },
                { model: key, localKeys: {} }
              );
        const res = await POST(req(body));
        const engineGot =
          key === CUSTOM_KEY ? m.callCustomProvider.mock.calls[0]?.[1] : m.chat.mock.calls[0]?.[0];
        const data = (await res.json()) as ChatResponse;
        conversation.push({
          role: 'assistant',
          content: data.error || data.content,
          model: key,
          ...(data.error ? { isError: true } : {}),
        });
        sends.push({ turn, key, outgoing, dropped, status: res.status, bodyText: JSON.stringify(body), engineGot, error: data.error });
      }
    }
    return { sends, keys };
  }

  const total = (list: Sent[]) => list.reduce((n, x) => n + x.content.length, 0);

  it('the shared list (before D15) is refused at turn 21 with 4 models; per-model lists send 41 messages there and are accepted', async () => {
    const before = await compareSession(21, 200, { shared: true });
    expect(before.sends.filter((s) => s.turn <= 20).every((s) => s.status === 200)).toBe(true);
    const turn21 = before.sends.filter((s) => s.turn === 21);
    expect(turn21.map((s) => s.outgoing.length)).toEqual([101, 101, 101, 101]);
    expect(turn21.map((s) => s.status)).toEqual([400, 400, 400, 400]);
    // The shared list carried every model's replies to every model.
    expect(turn21[0].bodyText).toContain(replyTag('gemini'));

    const after = await compareSession(21, 200);
    const now21 = after.sends.filter((s) => s.turn === 21);
    expect(now21.map((s) => s.outgoing.length)).toEqual([41, 41, 41, 41]);
    expect(now21.map((s) => s.dropped)).toEqual([0, 0, 0, 0]);
    expect(now21.map((s) => s.status)).toEqual([200, 200, 200, 200]);
  }, 60_000);

  it("40 turns, 4 models and a custom provider: every send accepted, nothing trimmed, and no request carries another model's reply", async () => {
    const { sends, keys } = await compareSession(40, 200, { custom: true });
    expect(keys).toEqual([...BUILT_INS, CUSTOM_KEY]);
    expect(sends).toHaveLength(200);
    for (const s of sends) {
      const where = `turn ${s.turn} ${s.key}`;
      expect(s.status, where).toBe(200);
      // The engine (or the custom provider) got exactly the list that was built.
      expect(s.engineGot, where).toEqual(s.outgoing);
      // User turns and own replies, alternating: two messages a turn, never trimmed.
      expect(s.dropped, where).toBe(0);
      expect(s.outgoing, where).toHaveLength(2 * s.turn - 1);
      s.outgoing.forEach((x, i) => {
        expect(x.role, where).toBe(i % 2 === 0 ? 'user' : 'assistant');
        if (i % 2 === 0) expect(x.content.startsWith(`turn ${i / 2 + 1} `), where).toBe(true);
        else expect(x.content.startsWith(tag(s.key, (i + 1) / 2)), where).toBe(true);
      });
      for (const other of keys.filter((k) => k !== s.key)) {
        expect(s.bodyText.includes(replyTag(other)), `${where} carries ${other}`).toBe(false);
      }
      expect(s.outgoing.length).toBeLessThanOrEqual(CHAT_MAX_MESSAGES);
      expect(total(s.outgoing)).toBeLessThanOrEqual(CHAT_MAX_TOTAL_CHARS);
    }
    expect(m.consume).toHaveBeenCalledTimes(200);
  }, 60_000);

  it('an error bubble is never resent: gemini fails on turn 3, its later requests keep the user turn without a reply', async () => {
    const { sends } = await compareSession(6, 200, { failAt: { key: 'gemini', turn: 3 } });
    const failed = sends.find((s) => s.turn === 3 && s.key === 'gemini');
    expect(failed?.error).toBeTruthy();
    const errorText = failed?.error as string;
    for (const s of sends) {
      expect(s.status).toBe(200);
      expect(s.bodyText.includes(errorText), `turn ${s.turn} ${s.key}`).toBe(false);
    }
    const gemini6 = sends.find((s) => s.turn === 6 && s.key === 'gemini');
    expect(gemini6?.outgoing).toHaveLength(10);
    expect(gemini6?.outgoing.slice(4, 6).map((x) => x.role)).toEqual(['user', 'user']);
    expect(gemini6?.outgoing[4].content.startsWith('turn 3 ')).toBe(true);
    for (const key of ['cohere', 'groq', 'mistral']) {
      expect(sends.find((s) => s.turn === 6 && s.key === key)?.outgoing).toHaveLength(11);
    }
  }, 60_000);

  it('52 turns with 2 models: the 100-message cap first trims at turn 51 and keeps the 49 newest turns; every send accepted', async () => {
    const { sends } = await compareSession(52, 200, { models: ['cohere', 'gemini'] });
    for (const s of sends) {
      const where = `turn ${s.turn} ${s.key}`;
      expect(s.status, where).toBe(200);
      expect(s.engineGot, where).toEqual(s.outgoing);
      expect(s.outgoing[0].role, where).toBe('user');
      if (s.turn <= 50) {
        expect(s.dropped, where).toBe(0);
        expect(s.outgoing, where).toHaveLength(2 * s.turn - 1);
      } else {
        expect(s.dropped, where).toBe(2 * (s.turn - 50));
        expect(s.outgoing, where).toHaveLength(99);
        expect(s.outgoing[0].content.startsWith(`turn ${s.turn - 49} `), where).toBe(true);
      }
    }
  }, 60_000);

  it('25 turns with 4 replies of 10,000 characters: the 200,000-character cap trims each model from turn 21 and every send is accepted', async () => {
    // 120 + 10,000 = 10,120 characters per turn in each model's list: 19 earlier turns fit, 20 do not.
    const { sends } = await compareSession(25, 10_000);
    for (const s of sends) {
      const where = `turn ${s.turn} ${s.key}`;
      expect(s.status, where).toBe(200);
      expect(s.outgoing[0].role, where).toBe('user');
      expect(total(s.outgoing), where).toBeLessThanOrEqual(CHAT_MAX_TOTAL_CHARS);
      if (s.turn <= 20) {
        expect(s.dropped, where).toBe(0);
      } else {
        expect(s.dropped, where).toBe(2 * (s.turn - 20));
        expect(s.outgoing, where).toHaveLength(1 + 2 * 19);
      }
    }
  }, 60_000);
});
