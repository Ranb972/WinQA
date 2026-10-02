import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LookupFunction } from 'node:net';
import { callCustomProvider } from '@/lib/llm/custom';
import { COMMON_CUSTOM_PROVIDERS, getSuggestedModels } from '@/lib/llm/models';
import { safeProviderFetch } from '@/lib/security';
import { REDIRECT_BLOCKED_ERROR, friendlyErrorMessage } from '@/lib/friendly-errors';
import { DEFAULT_PROVIDER_TIMEOUT_MS } from '@/lib/llm/fallback';
import type { CustomProvider } from '@/lib/custom-providers';

// The real lib/security runs; safeProviderFetch is wrapped in a spy so the tests
// can see that the chat path goes through it.
vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return { ...actual, safeProviderFetch: vi.fn(actual.safeProviderFetch) };
});

// No real DNS and no network.
const PUBLIC_ADDRESS = '104.18.2.115';
const dnsMock = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: dnsMock.lookup, default: { lookup: dnsMock.lookup } }));

const undiciMock = vi.hoisted(() => {
  const agents: Array<{ options: { connect?: { lookup?: unknown } } }> = [];
  class Agent {
    options: { connect?: { lookup?: unknown } };
    close = vi.fn(async () => {});
    destroy = vi.fn(async () => {});
    constructor(options: { connect?: { lookup?: unknown } }) {
      this.options = options;
      agents.push(this);
    }
  }
  return { fetch: vi.fn(), Agent, agents };
});
vi.mock('undici', () => ({ fetch: undiciMock.fetch, Agent: undiciMock.Agent }));

const openrouter: CustomProvider = {
  id: 'custom_test',
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: 'test-key-not-real',
  modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
  enabled: true,
};

const anthropic: CustomProvider = {
  id: 'custom_claude',
  name: 'Claude',
  baseUrl: 'https://api.anthropic.com/v1',
  apiKey: 'test-key-not-real',
  modelId: 'claude-sonnet-5',
  enabled: true,
  headerType: 'x-api-key',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// The platform fetch must never carry a custom-provider request any more.
const globalFetch = vi.fn(async () => {
  throw new Error('global fetch must not be used for a custom provider');
});

beforeEach(() => {
  undiciMock.fetch.mockReset();
  undiciMock.agents.length = 0;
  dnsMock.lookup.mockReset();
  dnsMock.lookup.mockResolvedValue([{ address: PUBLIC_ADDRESS, family: 4 }]);
  vi.mocked(safeProviderFetch).mockClear();
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('custom OpenAI-format path', () => {
  it('treats an OpenRouter 200 body carrying `error` as a failure, not an empty answer', async () => {
    undiciMock.fetch.mockResolvedValueOnce(jsonResponse(200, {
      error: { message: 'Upstream error from Nvidia: Service temporarily overloaded', code: 502 },
    }));

    const res = await callCustomProvider(openrouter, [{ role: 'user', content: 'hi' }]);

    expect(res.content).toBe('');
    expect(res.error).toBe('API error (502): Upstream error from Nvidia: Service temporarily overloaded');
  });

  it('returns the answer on a normal 200', async () => {
    undiciMock.fetch.mockResolvedValueOnce(jsonResponse(200, {
      id: 'x',
      choices: [{ message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
    }));

    const res = await callCustomProvider(openrouter, [{ role: 'user', content: 'hi' }]);

    expect(res.error).toBeUndefined();
    expect(res.content).toBe('hello');
    expect(res.specificModel).toBe('OpenRouter: nvidia/nemotron-3-super-120b-a12b:free');
  });
});

describe('custom path: resolved address is vetted and pinned (S4)', () => {
  it('a host resolving to a private address gives an error and nothing is fetched', async () => {
    dnsMock.lookup.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    const res = await callCustomProvider(
      { ...openrouter, baseUrl: 'https://evil.example/v1' },
      [{ role: 'user', content: 'hi' }]
    );
    expect(res.content).toBe('');
    expect(res.error).toBe('The provider address is not reachable from WinQA');
    expect(undiciMock.fetch).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('the OpenAI-format call goes through safeProviderFetch and connects to the vetted address', async () => {
    undiciMock.fetch.mockResolvedValueOnce(jsonResponse(200, {
      id: 'x',
      choices: [{ message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
    }));
    await callCustomProvider(openrouter, [{ role: 'user', content: 'hi' }]);

    expect(safeProviderFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(safeProviderFetch).mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const [url, init] = undiciMock.fetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.redirect).toBe('manual');
    expect(init.dispatcher).toBe(undiciMock.agents[0]);
    const lookup = undiciMock.agents[0].options.connect?.lookup as LookupFunction;
    const cb = vi.fn();
    lookup('openrouter.ai', { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [{ address: PUBLIC_ADDRESS, family: 4 }]);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('the Anthropic-format call goes through safeProviderFetch too', async () => {
    undiciMock.fetch.mockResolvedValueOnce(jsonResponse(200, {
      id: 'x',
      content: [{ type: 'text', text: 'hi there' }],
      stop_reason: 'end_turn',
    }));
    const res = await callCustomProvider(anthropic, [{ role: 'user', content: 'hi' }]);

    expect(res.content).toBe('hi there');
    expect(safeProviderFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(safeProviderFetch).mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(undiciMock.fetch.mock.calls[0][1].dispatcher).toBe(undiciMock.agents[0]);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('a 302 is the redirect-blocked error, never followed', async () => {
    undiciMock.fetch.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
    );
    const res = await callCustomProvider(openrouter, [{ role: 'user', content: 'hi' }]);
    expect(res.error).toBe(REDIRECT_BLOCKED_ERROR);
    expect(undiciMock.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('custom path: the provider call times out with the engine budget (S5)', () => {
  const PENDING = Symbol('pending');
  const settledOrPending = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<typeof PENDING>((resolve) => setImmediate(() => resolve(PENDING)))]);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes DEFAULT_PROVIDER_TIMEOUT_MS (the engine\'s per-attempt cap) to safeProviderFetch', async () => {
    undiciMock.fetch.mockResolvedValueOnce(jsonResponse(200, { id: 'x', choices: [] }));
    await callCustomProvider(openrouter, [{ role: 'user', content: 'hi' }]);
    expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(20_000);
    expect(vi.mocked(safeProviderFetch).mock.calls[0][1]).toMatchObject({ timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS });
  });

  it.each([
    ['OpenAI format', openrouter],
    ['Anthropic format', anthropic],
  ])('%s: a provider that never answers is aborted at 20 s with the timed-out error', async (_label, provider) => {
    undiciMock.fetch.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
    );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const pending = callCustomProvider(provider, [{ role: 'user', content: 'hi' }]);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(await settledOrPending(pending)).toBe(PENDING);

    await vi.advanceTimersByTimeAsync(1);
    const res = await settledOrPending(pending);
    expect(res).not.toBe(PENDING);
    const { error, content } = res as Awaited<typeof pending>;
    expect(content).toBe('');
    expect(error).toBe('Request timed out after 20s');
    // The chat route maps it to the same text as an engine timeout.
    expect(friendlyErrorMessage(error)).toBe('This model took too long to respond. Try again.');
    // Same log line shape as the engine's timeout ([llm] ... timed out after Ns key=...).
    expect(errorLog).toHaveBeenCalledWith(
      `[llm] custom:${provider.id} ${provider.modelId} timed out after 20s key=user`
    );
    errorLog.mockRestore();
  });
});

describe('OpenRouter preset', () => {
  it('exists with the OpenAI-compatible base URL and quick-fills the free Nemotron ids', () => {
    const preset = COMMON_CUSTOM_PROVIDERS.find((p) => p.name === 'OpenRouter');
    expect(preset?.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(getSuggestedModels('https://openrouter.ai/api/v1/')).toEqual(preset?.models);
    expect(preset?.models[0]).toBe('nvidia/nemotron-3.5-lightning:free');
  });
});
