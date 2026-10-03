import { describe, it, expect, vi } from 'vitest';
import {
  shouldAttachLocalKeys,
  parseServerProviders,
  fetchServerProviders,
  mergeProviders,
  toSelectorProvider,
  buildChatBody,
  isStaleProviderError,
  createLatestGuard,
  IN_BROWSER_SUFFIX,
  type ServerProvider,
} from '@/lib/provider-picker';
import type { CustomProvider } from '@/lib/custom-providers';

const HEX = 'a'.repeat(24);
const server = (over: Partial<ServerProvider> = {}): ServerProvider => ({
  id: HEX,
  name: 'My LLM',
  baseUrl: 'https://api.example.com/v1',
  modelId: 'm1',
  enabled: true,
  ...over,
});
const local = (over: Partial<CustomProvider> = {}): CustomProvider => ({
  id: 'custom_1700000000000_abc1234',
  name: 'Local LLM',
  baseUrl: 'https://local.example.com/v1',
  apiKey: 'sk-local-FAKE-0123456789',
  modelId: 'm2',
  enabled: true,
  ...over,
});

describe('shouldAttachLocalKeys', () => {
  it('is true only when the legacy blob holds a non-empty key', () => {
    expect(shouldAttachLocalKeys({ gemini: 'AIza-FAKE-key-1234' })).toBe(true);
    expect(shouldAttachLocalKeys({})).toBe(false);
    expect(shouldAttachLocalKeys({ groq: '' })).toBe(false);
    expect(shouldAttachLocalKeys({ groq: '   ' })).toBe(false);
    expect(shouldAttachLocalKeys(null)).toBe(false);
    expect(shouldAttachLocalKeys(undefined)).toBe(false);
  });
});

describe('parseServerProviders / fetchServerProviders', () => {
  it('keeps only well-formed rows and never copies other fields', () => {
    const rows = parseServerProviders({
      builtin: [],
      custom: [
        { ...server(), last4: '1234', hasKey: true, apiKey: 'leak' },
        { id: 5, name: 'x', baseUrl: 'u', modelId: 'm', enabled: true },
        null,
        { ...server({ id: 'b'.repeat(24) }), enabled: 'yes' },
      ],
    });
    expect(rows).toEqual([server()]);
    expect(JSON.stringify(rows)).not.toContain('leak');
  });

  it('gives an empty list for a malformed body', () => {
    expect(parseServerProviders(null)).toEqual([]);
    expect(parseServerProviders({ custom: 'no' })).toEqual([]);
  });

  it('tolerates 401, 500 and a network error', async () => {
    const res = (status: number) =>
      vi.fn().mockResolvedValue(new Response('{}', { status })) as unknown as typeof fetch;
    expect(await fetchServerProviders(res(401))).toEqual([]);
    expect(await fetchServerProviders(res(500))).toEqual([]);
    expect(
      await fetchServerProviders(vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch)
    ).toEqual([]);
  });

  it('reads /api/keys on 200', async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ builtin: [], custom: [server()] }), { status: 200 })
    );
    expect(await fetchServerProviders(f as unknown as typeof fetch)).toEqual([server()]);
    expect(f.mock.calls[0][0]).toBe('/api/keys');
  });
});

describe('mergeProviders', () => {
  it('lists enabled server providers, then local ones marked "in this browser"', () => {
    const merged = mergeProviders(
      [server(), server({ id: 'c'.repeat(24), enabled: false, name: 'Off' })],
      [local()]
    );
    expect(merged.map((p) => [p.id, p.source, p.label])).toEqual([
      [HEX, 'server', 'My LLM'],
      ['custom_1700000000000_abc1234', 'local', `Local LLM${IN_BROWSER_SUFFIX}`],
    ]);
    expect(IN_BROWSER_SUFFIX).toBe(' (in this browser)');
  });

  it('shows the server one only when both sides match on base URL + model + name', () => {
    const twin = local({ name: 'my llm', baseUrl: 'https://API.example.com/v1/', modelId: 'm1' });
    const merged = mergeProviders([server()], [twin]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('server');
  });

  it('keeps a local provider whose model differs', () => {
    const other = local({ name: 'My LLM', baseUrl: server().baseUrl, modelId: 'other' });
    expect(mergeProviders([server()], [other])).toHaveLength(2);
  });

  it('does not bring back a moved provider that was disabled on the server', () => {
    const twin = local({ name: 'My LLM', baseUrl: server().baseUrl, modelId: 'm1' });
    expect(mergeProviders([server({ enabled: false })], [twin])).toEqual([]);
  });

  it('drops disabled local providers', () => {
    expect(mergeProviders([], [local({ enabled: false })])).toEqual([]);
  });

  it('the selector copy carries the label and no key', () => {
    const [p] = mergeProviders([], [local()]);
    const item = toSelectorProvider(p);
    expect(item.name).toBe(`Local LLM${IN_BROWSER_SUFFIX}`);
    expect(item.apiKey).toBe('');
  });
});

describe('buildChatBody', () => {
  const base = { messages: [{ role: 'user', content: 'hi' }], modelPreferences: {} };
  const keys = { gemini: 'AIza-FAKE-key-1234' };
  const [srv] = mergeProviders([server()], []);
  const [loc] = mergeProviders([], [local()]);

  it('a server provider sends the id only: no customProvider, no customApiKeys', () => {
    const body = buildChatBody(base, { model: `custom:${HEX}`, localKeys: keys, provider: srv });
    expect(body.models).toBe(`custom:${HEX}`);
    expect('customProvider' in body).toBe(false);
    expect('customApiKeys' in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain('api.example.com');
  });

  it('a legacy local provider keeps the customProvider object and no customApiKeys', () => {
    const body = buildChatBody(base, { model: `custom:${loc.id}`, localKeys: keys, provider: loc });
    expect(body.customProvider).toEqual(local());
    expect('customApiKeys' in body).toBe(false);
  });

  it('a built-in request omits customApiKeys when there is no local blob', () => {
    expect('customApiKeys' in buildChatBody(base, { model: 'gemini', localKeys: {} })).toBe(false);
    expect('customApiKeys' in buildChatBody(base, { model: 'gemini' })).toBe(false);
  });

  it('a built-in request attaches the local keys while a blob exists', () => {
    expect(buildChatBody(base, { model: 'gemini', localKeys: keys }).customApiKeys).toEqual(keys);
  });

  it('keeps the other fields of the base', () => {
    const body = buildChatBody({ ...base, crossProviderFallback: false }, { model: 'groq' });
    expect(body.crossProviderFallback).toBe(false);
    expect(body.messages).toEqual(base.messages);
  });
});

describe('createLatestGuard', () => {
  it('a later load makes the earlier one stale', () => {
    const g = createLatestGuard();
    const first = g.begin();
    const second = g.begin();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('invalidate (effect cleanup) makes the in-flight load stale', () => {
    const g = createLatestGuard();
    const run = g.begin();
    g.invalidate();
    expect(run()).toBe(false);
  });
});

describe('isStaleProviderError', () => {
  it('matches exactly the two chat-route 400 texts', () => {
    expect(isStaleProviderError('This custom provider is disabled')).toBe(true);
    expect(isStaleProviderError('Custom provider not found')).toBe(true);
    expect(isStaleProviderError('Invalid model specified')).toBe(false);
    expect(isStaleProviderError(undefined)).toBe(false);
  });
});
