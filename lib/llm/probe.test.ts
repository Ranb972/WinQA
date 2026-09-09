import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatResponse, LLMProvider } from '@/lib/llm/types';

// The adapters are mocked as in fallback.test.ts, so the probe drives the real
// engine (one attempt, no fallback) against scripted answers.
vi.mock('@/lib/llm/cohere', () => ({ cohereChat: vi.fn() }));
vi.mock('@/lib/llm/gemini', () => ({ geminiChat: vi.fn() }));
vi.mock('@/lib/llm/groq', () => ({ groqChat: vi.fn() }));
vi.mock('@/lib/llm/mistral', () => ({ mistralChat: vi.fn() }));

import { cohereChat } from '@/lib/llm/cohere';
import { geminiChat } from '@/lib/llm/gemini';
import { groqChat } from '@/lib/llm/groq';
import { mistralChat } from '@/lib/llm/mistral';
import { defaultModels, REGISTRY_PROVIDERS } from '@/lib/llm/registry';
import { probeAppKeys, probeProvider, probeStatus, formatProbeLine, PROBE_TIMEOUT_MS } from '@/lib/llm/probe';

const adapters = {
  cohere: vi.mocked(cohereChat),
  gemini: vi.mocked(geminiChat),
  groq: vi.mocked(groqChat),
  mistral: vi.mocked(mistralChat),
} as const;

function ok(provider: LLMProvider, model: string): ChatResponse {
  return { content: '', model: provider, specificModel: model, responseTime: 5, keySource: 'app' };
}

function fail(provider: LLMProvider, model: string, error: string): ChatResponse {
  return { content: '', model: provider, specificModel: model, responseTime: 5, keySource: 'app', error };
}

beforeEach(() => {
  for (const mock of Object.values(adapters)) mock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('probeStatus', () => {
  it('reads ok, the leading HTTP status, the engine timeout, or error', () => {
    expect(probeStatus(undefined)).toBe('ok');
    expect(probeStatus('401: Invalid API Key')).toBe(401);
    expect(probeStatus('429: Rate limit exceeded')).toBe(429);
    expect(probeStatus('Request timed out after 10s')).toBe('timeout');
    expect(probeStatus('socket hang up')).toBe('error');
  });
});

describe('formatProbeLine', () => {
  it('writes the fixed field order the radar reads', () => {
    expect(formatProbeLine({ provider: 'mistral', model: 'ministral-14b-2512', status: 401, ms: 212 }))
      .toBe('[probe] provider=mistral status=401 model=ministral-14b-2512 ms=212');
    expect(formatProbeLine({ provider: 'groq', model: 'openai/gpt-oss-120b', status: 'ok', ms: 640 }))
      .toBe('[probe] provider=groq status=ok model=openai/gpt-oss-120b ms=640');
  });
});

describe('probeProvider', () => {
  it('sends one token on the chain head with no user key and one attempt', async () => {
    adapters.groq.mockImplementation(async (_m, _t, _mt, model) => ok('groq', model as string));

    const result = await probeProvider('groq');

    expect(adapters.groq).toHaveBeenCalledTimes(1);
    const [messages, temperature, maxTokens, model, userKey] = adapters.groq.mock.calls[0];
    expect(messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(temperature).toBe(0);
    expect(maxTokens).toBe(1);
    expect(model).toBe(defaultModels.groq);
    expect(userKey).toBeUndefined();
    expect(result).toMatchObject({ provider: 'groq', model: defaultModels.groq, status: 'ok' });
    expect(result.ms).toBeGreaterThanOrEqual(0);
    expect(PROBE_TIMEOUT_MS).toBe(10000);
  });

  it('never throws: a rejecting adapter becomes status=error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    adapters.cohere.mockRejectedValue(new Error('boom'));

    const result = await probeProvider('cohere');

    expect(result).toMatchObject({ provider: 'cohere', model: defaultModels.cohere, status: 'error' });
  });
});

describe('probeAppKeys', () => {
  it('probes every provider in parallel and logs one line each, failures at error level', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    adapters.cohere.mockImplementation(async (_m, _t, _mt, model) => ok('cohere', model as string));
    adapters.gemini.mockImplementation(async (_m, _t, _mt, model) => ok('gemini', model as string));
    adapters.groq.mockImplementation(async (_m, _t, _mt, model) => ok('groq', model as string));
    adapters.mistral.mockImplementation(async (_m, _t, _mt, model) => fail('mistral', model as string, '401: Invalid API Key'));

    const results = await probeAppKeys();

    expect(results.map((r) => r.provider)).toEqual([...REGISTRY_PROVIDERS]);
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'ok', 401]);
    for (const mock of Object.values(adapters)) expect(mock).toHaveBeenCalledTimes(1);

    expect(log).toHaveBeenCalledTimes(3);
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^\[probe\] provider=cohere status=ok model=command-a-03-2025 ms=\d+$/),
      expect.stringMatching(/^\[probe\] provider=gemini status=ok model=gemini-3\.5-flash-lite ms=\d+$/),
      expect.stringMatching(/^\[probe\] provider=groq status=ok model=openai\/gpt-oss-120b ms=\d+$/),
    ]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/^\[probe\] provider=mistral status=401 model=ministral-14b-2512 ms=\d+$/);
  });
});
