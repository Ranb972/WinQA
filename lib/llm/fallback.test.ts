import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatMessage, ChatResponse, LLMProvider } from '@/lib/llm/types';

// The four adapters are mocked so the engine can be driven with scripted
// failures. Each mock returns the adapter's real shape: a ChatResponse whose
// `error` carries the status-prefixed string lib/llm/provider-error.ts emits.
vi.mock('@/lib/llm/cohere', () => ({ cohereChat: vi.fn() }));
vi.mock('@/lib/llm/gemini', () => ({ geminiChat: vi.fn() }));
vi.mock('@/lib/llm/groq', () => ({ groqChat: vi.fn() }));
vi.mock('@/lib/llm/mistral', () => ({ mistralChat: vi.fn() }));

import { cohereChat } from '@/lib/llm/cohere';
import { geminiChat } from '@/lib/llm/gemini';
import { groqChat } from '@/lib/llm/groq';
import { mistralChat } from '@/lib/llm/mistral';
import { chatWithFallback, classifyFailure, isAuthFailure, DEFAULT_PROVIDER_TIMEOUT_MS, MIN_SAME_PROVIDER_DELAY_MS, MIN_RETRY_AFTER_TIMEOUT_MS } from '@/lib/llm/fallback';
import { fallbackChains, defaultModels } from '@/lib/llm/registry';

const adapters = {
  cohere: vi.mocked(cohereChat),
  gemini: vi.mocked(geminiChat),
  groq: vi.mocked(groqChat),
  mistral: vi.mocked(mistralChat),
} as const;

const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

function ok(provider: LLMProvider, model: string): ChatResponse {
  return { content: `answer from ${model}`, model: provider, specificModel: model, responseTime: 5 };
}

function fail(provider: LLMProvider, model: string, error: string): ChatResponse {
  return { content: '', model: provider, specificModel: model, responseTime: 5, error };
}

/** Script one adapter: each call returns the next scripted result, keyed on the model it was asked for. */
function script(provider: LLMProvider, results: Array<(model: string) => ChatResponse | Promise<ChatResponse>>) {
  let i = 0;
  adapters[provider].mockImplementation(async (_m, _t, _mt, model) => {
    const step = results[Math.min(i, results.length - 1)];
    i++;
    return step(model as string);
  });
}

const modelArg = (call: unknown[]) => call[3] as string;

beforeEach(() => {
  for (const mock of Object.values(adapters)) mock.mockReset();
});

describe('classifyFailure', () => {
  it('retries rate limits and quotas with their own reasons', () => {
    expect(classifyFailure('429: Rate limit exceeded')).toEqual({ retry: true, reason: 'rate_limit' });
    expect(classifyFailure('Too many requests')).toEqual({ retry: true, reason: 'rate_limit' });
    expect(classifyFailure('402: Insufficient credits')).toEqual({ retry: true, reason: 'quota_exceeded' });
    expect(classifyFailure('403: quota exceeded')).toEqual({ retry: true, reason: 'quota_exceeded' });
  });

  it('retries a withdrawn model, a 5xx, an overload and a timeout as plain errors', () => {
    expect(classifyFailure('404: This model is unavailable for free. The paid version is available now')).toEqual({ retry: true, reason: 'error' });
    expect(classifyFailure('503: {"error":{"code":503,"status":"UNAVAILABLE"}}')).toEqual({ retry: true, reason: 'error' });
    expect(classifyFailure('502: Upstream error from Nvidia: Service temporarily overloaded')).toEqual({ retry: true, reason: 'error' });
    expect(classifyFailure('Request timed out after 20s')).toEqual({ retry: true, reason: 'error' });
    expect(classifyFailure('model not found')).toEqual({ retry: true, reason: 'error' });
  });

  it('stops on bad requests, bad keys and unknown failures', () => {
    expect(classifyFailure('400: thinking_level is not supported')).toEqual({ retry: false, reason: 'error' });
    expect(classifyFailure('401: No auth credentials found')).toEqual({ retry: false, reason: 'error' });
    expect(classifyFailure('socket hang up')).toEqual({ retry: false, reason: 'error' });
    expect(classifyFailure(undefined)).toEqual({ retry: false, reason: 'error' });
  });
});

describe('chatWithFallback: falling through the chain', () => {
  it('a withdrawn head (404) falls through to the next model of the same provider', async () => {
    const [head, second] = fallbackChains.mistral;
    script('mistral', [
      (m) => fail('mistral', m, '404: This model is unavailable for free.'),
      (m) => ok('mistral', m),
    ]);

    const res = await chatWithFallback(messages, 'mistral', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
    });

    expect(adapters.mistral).toHaveBeenCalledTimes(2);
    expect(modelArg(adapters.mistral.mock.calls[0])).toBe(head);
    expect(modelArg(adapters.mistral.mock.calls[1])).toBe(second);
    expect(res.error).toBeUndefined();
    expect(res.specificModel).toBe(second);
    expect(res.fallback).toEqual({ originalModel: head, usedModel: second, reason: 'error' });
  });

  it('an overloaded head (503) falls through the same way', async () => {
    const [head, second] = fallbackChains.gemini;
    script('gemini', [
      (m) => fail('gemini', m, '503: {"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}'),
      (m) => ok('gemini', m),
    ]);

    const res = await chatWithFallback(messages, 'gemini', 0.7, 4096, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
    });

    expect(adapters.gemini).toHaveBeenCalledTimes(2);
    expect(res.specificModel).toBe(second);
    expect(res.fallback?.originalModel).toBe(head);
  });

  it('a bad request (400) returns at once with no fallback badge', async () => {
    script('groq', [(m) => fail('groq', m, '400: invalid request')]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
    });

    expect(adapters.groq).toHaveBeenCalledTimes(1);
    expect(res.error).toBe('400: invalid request');
    expect(res.fallback).toBeUndefined();
  });

  it('maxAttempts 1 makes one call and never labels the failure as a fallback', async () => {
    script('cohere', [(m) => fail('cohere', m, '503: overloaded')]);

    const res = await chatWithFallback(messages, 'cohere', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 1,
      delayBetweenAttempts: 0,
    });

    expect(adapters.cohere).toHaveBeenCalledTimes(1);
    expect(res.error).toBe('503: overloaded');
    expect(res.specificModel).toBe(defaultModels.cohere);
    expect(res.fallback).toBeUndefined();
  });

  it('a requested non-head model runs first and falls through to the chain head', async () => {
    const [head, second] = fallbackChains.gemini;
    script('gemini', [
      (m) => fail('gemini', m, '503: overloaded'),
      (m) => ok('gemini', m),
    ]);

    const res = await chatWithFallback(messages, 'gemini', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      specificModel: second,
    });

    expect(modelArg(adapters.gemini.mock.calls[0])).toBe(second);
    expect(modelArg(adapters.gemini.mock.calls[1])).toBe(head);
    expect(res.fallback).toEqual({ originalModel: second, usedModel: head, reason: 'error' });
  });
});

describe('chatWithFallback: a rejected user key falls back to the app key', () => {
  // Every test here spies on console.error; restore between tests so the spy's
  // call list does not leak into the timeout-line assertions further down.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries the same model once on the app key after a 401, with no chain step and no fallback badge', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head] = fallbackChains.groq;
    script('groq', [
      (m) => fail('groq', m, '401: Invalid API Key'),
      (m) => ok('groq', m),
    ]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 1,
      delayBetweenAttempts: 0,
      customApiKeys: { groq: 'stale-user-key' },
    });

    expect(adapters.groq).toHaveBeenCalledTimes(2);
    expect(modelArg(adapters.groq.mock.calls[0])).toBe(head);
    expect(adapters.groq.mock.calls[0][4]).toBe('stale-user-key');
    expect(modelArg(adapters.groq.mock.calls[1])).toBe(head);
    expect(adapters.groq.mock.calls[1][4]).toBeUndefined();
    expect(res.error).toBeUndefined();
    expect(res.content).toBe(`answer from ${head}`);
    expect(res.keySource).toBe('app');
    expect(res.userKeyRejected).toBe(true);
    expect(res.fallback).toBeUndefined();
    expect(spy.mock.calls[0][0]).toBe(`[llm] groq ${head} user key rejected (401), retrying with the app key`);
    spy.mockRestore();
  });

  it('returns the app-key failure, still flagged, when both keys are rejected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    script('groq', [
      (m) => fail('groq', m, '401: Invalid API Key'),
      (m) => fail('groq', m, '401: Invalid API Key'),
    ]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      customApiKeys: { groq: 'stale-user-key' },
    });

    expect(adapters.groq).toHaveBeenCalledTimes(2);
    expect(res.error).toBe('401: Invalid API Key');
    expect(res.keySource).toBe('app');
    expect(res.userKeyRejected).toBe(true);
    expect(res.fallback).toBeUndefined();
  });

  it('never retries a 401 on the app key itself', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    script('groq', [(m) => fail('groq', m, '401: Invalid API Key')]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
    });

    expect(adapters.groq).toHaveBeenCalledTimes(1);
    expect(res.error).toBe('401: Invalid API Key');
    expect(res.userKeyRejected).toBeUndefined();
  });

  it('drops the rejected key for the rest of the call: 403 on both keys moves to the next model on the app key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head, second] = fallbackChains.groq;
    script('groq', [
      (m) => fail('groq', m, '403: quota exceeded'),
      (m) => fail('groq', m, '403: quota exceeded'),
      (m) => ok('groq', m),
    ]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      customApiKeys: { groq: 'stale-user-key' },
    });

    expect(adapters.groq).toHaveBeenCalledTimes(3);
    expect(adapters.groq.mock.calls.map(modelArg)).toEqual([head, head, second]);
    expect(adapters.groq.mock.calls.map((c) => c[4])).toEqual(['stale-user-key', undefined, undefined]);
    expect(res.specificModel).toBe(second);
    expect(res.fallback).toEqual({ originalModel: head, usedModel: second, reason: 'quota_exceeded' });
    expect(res.userKeyRejected).toBe(true);
  });

  it('waits the Mistral floor before the app-key retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head] = fallbackChains.mistral;
    script('mistral', [
      (m) => fail('mistral', m, '401: Invalid API Key'),
      (m) => ok('mistral', m),
    ]);

    const started = Date.now();
    const res = await chatWithFallback(messages, 'mistral', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 1,
      delayBetweenAttempts: 0,
      customApiKeys: { mistral: 'stale-user-key' },
    });
    const elapsed = Date.now() - started;

    expect(res.specificModel).toBe(head);
    expect(res.error).toBeUndefined();
    expect(res.userKeyRejected).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(950);
    expect(elapsed).toBeLessThan(1600);
  });

  it('isAuthFailure keys on the status, not on wording', () => {
    expect(isAuthFailure('401: Invalid API Key')).toBe(true);
    expect(isAuthFailure('403: This model is not available in your subscription tier')).toBe(true);
    expect(isAuthFailure('400: invalid request')).toBe(false);
    expect(isAuthFailure('Unauthorized')).toBe(false);
  });
});

describe('chatWithFallback: reasoning effort', () => {
  it('hands reasoningEffort to Groq when set, nothing when not, and never to Mistral', async () => {
    script('groq', [(m) => ok('groq', m)]);
    await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 1,
      reasoningEffort: 'lowest',
    });
    expect(adapters.groq.mock.calls[0][5]).toEqual({ reasoningEffort: 'lowest' });

    script('groq', [(m) => ok('groq', m)]);
    await chatWithFallback(messages, 'groq', 0.7, 1024, { enableCrossProviderFallback: false, maxAttempts: 1 });
    expect(adapters.groq.mock.calls[1][5]).toBeUndefined();

    // Ministral 3 rejects reasoning_effort with a 400, so the adapter takes no options.
    script('mistral', [(m) => ok('mistral', m)]);
    await chatWithFallback(messages, 'mistral', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 1,
      reasoningEffort: 'lowest',
    });
    expect(adapters.mistral.mock.calls[0].length).toBeLessThanOrEqual(5);
  });
});

describe('chatWithFallback: time budget', () => {
  const never = () => new Promise<ChatResponse>(() => {});

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caps an attempt at 20s by default and floors Mistral same-provider retries at 1s', () => {
    expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(20000);
    expect(MIN_SAME_PROVIDER_DELAY_MS.mistral).toBe(1000);
  });

  it('waits at least the provider floor before retrying on the same provider', async () => {
    const [head, second] = fallbackChains.mistral;
    script('mistral', [
      (m) => fail('mistral', m, '429: Rate limit exceeded'),
      (m) => ok('mistral', m),
    ]);

    const started = Date.now();
    const res = await chatWithFallback(messages, 'mistral', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 200,
    });
    const elapsed = Date.now() - started;

    expect(res.specificModel).toBe(second);
    expect(res.fallback?.originalModel).toBe(head);
    expect(elapsed).toBeGreaterThanOrEqual(950);
    expect(elapsed).toBeLessThan(1600);
  });

  it('keeps the caller delay for providers without a floor', async () => {
    script('groq', [
      (m) => fail('groq', m, '503: overloaded'),
      (m) => ok('groq', m),
    ]);

    const started = Date.now();
    await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
    });

    expect(Date.now() - started).toBeLessThan(400);
  });

  it('logs one [llm] line when it times an attempt out', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head] = fallbackChains.groq;
    script('groq', [never, (m) => ok('groq', m)]);

    await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      providerTimeout: 200,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(`[llm] groq ${head} timed out after 0.2s key=app`);
    spy.mockRestore();
  });

  it('names the user key in the timeout line and on the response when one was sent', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head] = fallbackChains.groq;
    script('groq', [never]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 1,
      providerTimeout: 200,
      customApiKeys: { groq: 'user-key-not-real' },
    });

    expect(spy.mock.calls[0][0]).toBe(`[llm] groq ${head} timed out after 0.2s key=user`);
    expect(res.keySource).toBe('user');
    expect(res.error).toBe('Request timed out after 0.2s');
    spy.mockRestore();
  });

  it('a hung provider times out per attempt and the next model gets only what is left of totalTimeout', async () => {
    const [head, second] = fallbackChains.mistral;
    script('mistral', [never, never]);

    const started = Date.now();
    const res = await chatWithFallback(messages, 'mistral', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      providerTimeout: 1200,
      totalTimeout: 1500,
    });
    const elapsed = Date.now() - started;

    // The remaining ~300ms is under the 1s minimum, so the second attempt is skipped.
    expect(adapters.mistral).toHaveBeenCalledTimes(1);
    expect(modelArg(adapters.mistral.mock.calls[0])).toBe(head);
    expect(res.error).toMatch(/timed out/);
    expect(res.specificModel).toBe(head);
    expect(res.specificModel).not.toBe(second);
    expect(res.fallback).toBeUndefined();
    expect(elapsed).toBeLessThan(1500 + 400);
  });

  it('a second attempt runs when enough budget remains and is capped by it', async () => {
    const [, second] = fallbackChains.groq;
    script('groq', [
      (m) => fail('groq', m, '503: overloaded'),
      never,
    ]);

    const started = Date.now();
    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      providerTimeout: 5000,
      totalTimeout: 1300,
    });
    const elapsed = Date.now() - started;

    expect(adapters.groq).toHaveBeenCalledTimes(2);
    expect(res.specificModel).toBe(second);
    expect(res.error).toMatch(/timed out/);
    expect(res.fallback?.usedModel).toBe(second);
    // Bounded by totalTimeout, not by providerTimeout.
    expect(elapsed).toBeLessThan(1300 + 400);
  });

  it('without totalTimeout each attempt gets the full providerTimeout', async () => {
    script('groq', [never, (m) => ok('groq', m)]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      providerTimeout: 200,
    });

    expect(adapters.groq).toHaveBeenCalledTimes(2);
    expect(res.error).toBeUndefined();
    expect(res.fallback?.reason).toBe('error');
  });

  it('does not retry into a short budget after a timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head] = fallbackChains.groq;
    script('groq', [never, (m) => ok('groq', m)]);

    const started = Date.now();
    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      providerTimeout: 300,
      totalTimeout: 3000,
    });

    // About 2.7s remain after the timeout, under MIN_RETRY_AFTER_TIMEOUT_MS:
    // the timeout comes back at once instead of a second call that cannot answer.
    expect(MIN_RETRY_AFTER_TIMEOUT_MS).toBe(8000);
    expect(adapters.groq).toHaveBeenCalledTimes(1);
    expect(res.specificModel).toBe(head);
    expect(res.error).toBe('Request timed out after 0.3s');
    expect(res.fallback).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(300 + 400);
  });

  it('retries after a timeout when at least MIN_RETRY_AFTER_TIMEOUT_MS remains', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head, second] = fallbackChains.groq;
    script('groq', [never, (m) => ok('groq', m)]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 0,
      providerTimeout: 200,
      totalTimeout: 20000,
    });

    expect(adapters.groq).toHaveBeenCalledTimes(2);
    expect(res.specificModel).toBe(second);
    expect(res.error).toBeUndefined();
    expect(res.fallback).toEqual({ originalModel: head, usedModel: second, reason: 'error' });
  });

  it('a timeout on the second model of a chain still carries the fallback badge when it stops', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [head, second] = fallbackChains.groq;
    script('groq', [(m) => fail('groq', m, '503: overloaded'), never]);

    const res = await chatWithFallback(messages, 'groq', 0.7, 1024, {
      enableCrossProviderFallback: false,
      maxAttempts: 3,
      delayBetweenAttempts: 0,
      providerTimeout: 300,
      totalTimeout: 3000,
    });

    expect(adapters.groq).toHaveBeenCalledTimes(2);
    expect(res.specificModel).toBe(second);
    expect(res.error).toMatch(/timed out/);
    expect(res.fallback).toEqual({ originalModel: head, usedModel: second, reason: 'error' });
  });
});
