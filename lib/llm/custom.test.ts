import { describe, it, expect, vi, afterEach } from 'vitest';
import { callCustomProvider } from '@/lib/llm/custom';
import { COMMON_CUSTOM_PROVIDERS, getSuggestedModels } from '@/lib/llm/models';
import type { CustomProvider } from '@/lib/custom-providers';

const openrouter: CustomProvider = {
  id: 'custom_test',
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: 'test-key-not-real',
  modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
  enabled: true,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('custom OpenAI-format path', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats an OpenRouter 200 body carrying `error` as a failure, not an empty answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, {
      error: { message: 'Upstream error from Nvidia: Service temporarily overloaded', code: 502 },
    })));

    const res = await callCustomProvider(openrouter, [{ role: 'user', content: 'hi' }]);

    expect(res.content).toBe('');
    expect(res.error).toBe('API error (502): Upstream error from Nvidia: Service temporarily overloaded');
  });

  it('returns the answer on a normal 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, {
      id: 'x',
      choices: [{ message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
    })));

    const res = await callCustomProvider(openrouter, [{ role: 'user', content: 'hi' }]);

    expect(res.error).toBeUndefined();
    expect(res.content).toBe('hello');
    expect(res.specificModel).toBe('OpenRouter: nvidia/nemotron-3-super-120b-a12b:free');
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
