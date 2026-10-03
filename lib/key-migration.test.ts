import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Decrypt succeeds for any entry except one whose ciphertext is 'bad'.
vi.mock('@/lib/crypto', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crypto')>('@/lib/crypto');
  return {
    ...actual,
    decryptApiKey: vi.fn(async (data: { data: string }) => {
      if (data.data === 'bad') throw new Error('Decryption failed');
      return `plain-${data.data}`;
    }),
  };
});

import {
  buildMigrateBody,
  decideWipe,
  formatSkip,
  summarizeMove,
  parseMigrateResponse,
  subscribeKeysChanged,
  KEYS_CHANGED_EVENT,
  LEGACY_API_KEYS_KEY,
  LEGACY_CUSTOM_PROVIDERS_KEY,
  OTHER_ACCOUNT_MESSAGE,
  NOT_SAVED_MESSAGE,
  CHANGED_MESSAGE,
  BANNER_TEXT,
  type LegacyProviderLike,
} from '@/lib/key-migration';
import { UNREACHABLE_PROVIDER_ERROR } from '@/lib/friendly-errors';
import {
  readLegacyApiKeys,
  hasLegacyKeyBlob,
  wipeLegacyKeyStorage,
  snapshotLegacyKeyStorage,
} from '@/lib/api-keys';
import { readLegacyCustomProviders } from '@/lib/custom-providers';

const provider = (over: Partial<LegacyProviderLike> = {}): LegacyProviderLike => ({
  name: 'My LLM',
  baseUrl: 'https://api.example.com/v1',
  modelId: 'm1',
  apiKey: 'sk-secret-1234',
  enabled: true,
  ...over,
});

describe('buildMigrateBody', () => {
  it('maps the legacy shapes to the route body and keeps enabled', () => {
    const body = buildMigrateBody(
      { groq: ' gsk-1 ', gemini: 'g-2' },
      [
        provider({ headerType: 'x-api-key', enabled: false }),
        provider({ name: 'Two', modelId: 'm2' }),
      ]
    );
    expect(body.builtin).toEqual({ groq: 'gsk-1', gemini: 'g-2' });
    expect(body.custom).toEqual([
      {
        name: 'My LLM',
        baseUrl: 'https://api.example.com/v1',
        modelId: 'm1',
        headerType: 'x-api-key',
        enabled: false,
        apiKey: 'sk-secret-1234',
      },
      {
        name: 'Two',
        baseUrl: 'https://api.example.com/v1',
        modelId: 'm2',
        enabled: true,
        apiKey: 'sk-secret-1234',
      },
    ]);
  });

  it('does not send ids or other legacy fields', () => {
    const withId = { ...provider(), id: 'custom_1_abc' } as LegacyProviderLike;
    const entry = buildMigrateBody({}, [withId]).custom[0];
    expect(Object.keys(entry).sort()).toEqual(['apiKey', 'baseUrl', 'enabled', 'modelId', 'name']);
  });

  it('drops built-in entries with an empty key', () => {
    const body = buildMigrateBody({ groq: '', gemini: '   ', claude: undefined, openai: 'k' }, []);
    expect(body.builtin).toEqual({ openai: 'k' });
  });

  it('trims custom keys and still sends empty-key providers, so the route reports them as skips', () => {
    const body = buildMigrateBody({}, [
      provider({ name: 'Padded', apiKey: '  sk-1  ' }),
      provider({ name: 'Empty', apiKey: '' }),
      provider({ name: 'Blank', apiKey: '   ' }),
    ]);
    expect(body.custom.map((c) => [c.name, c.apiKey])).toEqual([
      ['Padded', 'sk-1'],
      ['Empty', ''],
      ['Blank', ''],
    ]);
  });

  it('caps built-ins at 4 and custom providers at 20', () => {
    const keys = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`p${i}`, `k${i}`]));
    const many = Array.from({ length: 25 }, (_, i) => provider({ name: `P${i}` }));
    const body = buildMigrateBody(keys, many);
    expect(Object.keys(body.builtin)).toHaveLength(4);
    expect(body.custom).toHaveLength(20);
    expect(body.custom[19].name).toBe('P19');
  });
});

describe('decideWipe', () => {
  it('wipes on 200 with no decrypt failures and only benign skips', () => {
    const skipped = [
      { item: 'groq', reason: 'A key is already saved for this provider' },
      { item: 'A', reason: 'Already saved' },
      { item: 'B', reason: 'Duplicate in this request' },
      { item: 'C', reason: 'You can save up to 6 custom providers' },
      { item: 'D', reason: 'Base URL must use HTTPS' },
    ];
    expect(decideWipe({ status: 200, skipped, decryptFailures: 0 })).toEqual({
      wipe: true,
      messages: [],
    });
    expect(decideWipe({ status: 200, skipped: [], decryptFailures: 0 }).wipe).toBe(true);
  });

  it("keeps when any skip is 'Could not save'", () => {
    const d = decideWipe({
      status: 200,
      skipped: [
        { item: 'A', reason: 'Already saved' },
        { item: 'B', reason: 'Could not save' },
      ],
      decryptFailures: 0,
    });
    expect(d).toEqual({ wipe: false, messages: [NOT_SAVED_MESSAGE] });
  });

  it('keeps when a skip is the unreachable text (the 5 s DNS budget can be a false negative)', () => {
    const d = decideWipe({
      status: 200,
      skipped: [{ item: 'A', reason: UNREACHABLE_PROVIDER_ERROR }],
      decryptFailures: 0,
    });
    expect(UNREACHABLE_PROVIDER_ERROR).toBe('The provider address is not reachable from WinQA');
    expect(d).toEqual({ wipe: false, messages: [NOT_SAVED_MESSAGE] });
  });

  it('keeps with the other-account message when an entry failed to decrypt', () => {
    const d = decideWipe({ status: 200, skipped: [], decryptFailures: 1 });
    expect(d).toEqual({ wipe: false, messages: [OTHER_ACCOUNT_MESSAGE] });
    expect(OTHER_ACCOUNT_MESSAGE).toBe('Some keys belong to another account on this browser');
  });

  it('reports both reasons when both apply', () => {
    const d = decideWipe({
      status: 200,
      skipped: [{ item: 'A', reason: 'Could not save' }],
      decryptFailures: 2,
    });
    expect(d.wipe).toBe(false);
    expect(d.messages).toEqual([OTHER_ACCOUNT_MESSAGE, NOT_SAVED_MESSAGE]);
  });

  it('keeps when the stores changed during the upload', () => {
    const d = decideWipe({ status: 200, skipped: [], decryptFailures: 0, storageChanged: true });
    expect(d).toEqual({ wipe: false, messages: [CHANGED_MESSAGE] });
    expect(decideWipe({ status: 200, skipped: [], decryptFailures: 0, storageChanged: false }).wipe).toBe(true);
  });

  it('keeps on any non-200 status', () => {
    for (const status of [201, 204, 400, 401, 429, 500, 0]) {
      expect(decideWipe({ status, skipped: [], decryptFailures: 0 }).wipe).toBe(false);
    }
  });
});

describe('skip summary', () => {
  it('formats item and reason only, verbatim', () => {
    const skip = { item: 'Groq', reason: 'Already saved', apiKey: 'sk-leak', baseUrl: 'https://x' };
    expect(formatSkip(skip)).toBe('Groq: Already saved');
    const summary = summarizeMove(3, [skip]);
    expect(summary.title).toBe('Moved 3, skipped 1');
    expect(summary.lines).toEqual(['Groq: Already saved']);
    expect(JSON.stringify(summary)).not.toContain('sk-leak');
    expect(JSON.stringify(summary)).not.toContain('https://x');
  });

  it('parseMigrateResponse counts moved items and rejects other shapes', () => {
    expect(
      parseMigrateResponse({
        moved: { builtin: ['groq'], custom: [{ id: 'a' }, { id: 'b' }] },
        skipped: [{ item: 'x', reason: 'Already saved', extra: 1 }],
      })
    ).toEqual({ movedCount: 3, skipped: [{ item: 'x', reason: 'Already saved' }] });
    expect(parseMigrateResponse(null)).toBeNull();
    expect(parseMigrateResponse({ moved: {}, skipped: [] })).toBeNull();
    expect(
      parseMigrateResponse({ moved: { builtin: [], custom: [] }, skipped: [{ item: 1 }] })
    ).toBeNull();
  });

  it('banner text carries the sunset date', () => {
    expect(BANNER_TEXT).toBe(
      'Your keys are stored in this browser. Move them to your account. Browser storage ends on October 31, 2026.'
    );
  });
});

// A Map-backed localStorage, with window defined so the browser-only guards pass.
function installBrowserShim() {
  const store = new Map<string, string>();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe('legacy readers and wipe', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installBrowserShim();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('readLegacyApiKeys counts an entry that fails to decrypt instead of swallowing it', async () => {
    store.set(
      LEGACY_API_KEYS_KEY,
      JSON.stringify({
        encrypted: true,
        keys: {
          groq: { iv: 'i', data: 'good' },
          gemini: { iv: 'i', data: 'bad' },
        },
      })
    );
    const result = await readLegacyApiKeys('user_1');
    expect(result.failed).toBe(1);
    expect(result.keys).toEqual({ groq: 'plain-good' });
  });

  it('readLegacyApiKeys reports zero failures when everything decrypts, and for no blob', async () => {
    expect(await readLegacyApiKeys('user_1')).toEqual({ keys: {}, failed: 0 });
    store.set(
      LEGACY_API_KEYS_KEY,
      JSON.stringify({ encrypted: true, keys: { groq: { iv: 'i', data: 'ok' } } })
    );
    expect(await readLegacyApiKeys('user_1')).toEqual({ keys: { groq: 'plain-ok' }, failed: 0 });
  });

  it('readLegacyApiKeys counts an unreadable blob and never writes', async () => {
    store.set(LEGACY_API_KEYS_KEY, '{not json');
    expect((await readLegacyApiKeys('user_1')).failed).toBe(1);
    expect(store.get(LEGACY_API_KEYS_KEY)).toBe('{not json');
  });

  it('readLegacyCustomProviders counts a provider whose key fails to decrypt', async () => {
    const meta = (id: string) => ({
      id,
      name: id,
      baseUrl: 'https://a.example.com/v1',
      modelId: 'm',
      enabled: true,
    });
    store.set(
      LEGACY_CUSTOM_PROVIDERS_KEY,
      JSON.stringify({
        encrypted: true,
        providers: [meta('one'), meta('two')],
        keys: { one: { iv: 'i', data: 'good' }, two: { iv: 'i', data: 'bad' } },
      })
    );
    const result = await readLegacyCustomProviders('user_1');
    expect(result.failed).toBe(1);
    expect(result.providers.map((p) => [p.id, p.apiKey])).toEqual([['one', 'plain-good']]);
  });

  it('damaged blobs are counted as failures, never thrown', async () => {
    store.set(LEGACY_API_KEYS_KEY, JSON.stringify({ encrypted: true, keys: null }));
    expect(await readLegacyApiKeys('user_1')).toEqual({ keys: {}, failed: 1 });
    store.set(LEGACY_API_KEYS_KEY, JSON.stringify({ encrypted: true, keys: { groq: null } }));
    expect((await readLegacyApiKeys('user_1')).failed).toBe(1);

    const meta = { id: 'one', name: 'one', baseUrl: 'https://a.example.com/v1', modelId: 'm', enabled: true };
    store.set(
      LEGACY_CUSTOM_PROVIDERS_KEY,
      JSON.stringify({
        encrypted: true,
        providers: [null, meta],
        keys: { one: { iv: 'i', data: 'good' } },
      })
    );
    const encrypted = await readLegacyCustomProviders('user_1');
    expect(encrypted.failed).toBe(1);
    expect(encrypted.providers.map((p) => p.id)).toEqual(['one']);

    store.set(LEGACY_CUSTOM_PROVIDERS_KEY, JSON.stringify({ providers: [null, { ...meta, apiKey: 'k' }] }));
    const plain = await readLegacyCustomProviders('user_1');
    expect(plain.failed).toBe(1);
    expect(plain.providers).toHaveLength(1);
  });

  it('snapshotLegacyKeyStorage changes when either entry changes', () => {
    const a = snapshotLegacyKeyStorage();
    store.set(LEGACY_API_KEYS_KEY, '{}');
    const b = snapshotLegacyKeyStorage();
    store.set(LEGACY_CUSTOM_PROVIDERS_KEY, '{}');
    const c = snapshotLegacyKeyStorage();
    expect(new Set([a, b, c]).size).toBe(3);
    expect(snapshotLegacyKeyStorage()).toBe(c);
  });

  it('hasLegacyKeyBlob sees either entry; wipeLegacyKeyStorage removes exactly those two', () => {
    expect(hasLegacyKeyBlob()).toBe(false);
    store.set(LEGACY_CUSTOM_PROVIDERS_KEY, '{}');
    expect(hasLegacyKeyBlob()).toBe(true);
    store.set(LEGACY_API_KEYS_KEY, '{}');
    store.set('winqa_model_preferences', 'keep');
    wipeLegacyKeyStorage();
    expect(store.has(LEGACY_API_KEYS_KEY)).toBe(false);
    expect(store.has(LEGACY_CUSTOM_PROVIDERS_KEY)).toBe(false);
    expect(store.get('winqa_model_preferences')).toBe('keep');
    expect(hasLegacyKeyBlob()).toBe(false);
  });
});

describe('subscribeKeysChanged', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires on the custom event and on storage events for the two keys only', () => {
    const handlers = new Map<string, Set<(e: unknown) => void>>();
    vi.stubGlobal('window', {
      addEventListener: (t: string, h: (e: unknown) => void) => {
        if (!handlers.has(t)) handlers.set(t, new Set());
        handlers.get(t)!.add(h);
      },
      removeEventListener: (t: string, h: (e: unknown) => void) => handlers.get(t)?.delete(h),
    });
    const onChange = vi.fn();
    const off = subscribeKeysChanged(onChange);
    const fire = (type: string, e: unknown = {}) => handlers.get(type)?.forEach((h) => h(e));

    fire(KEYS_CHANGED_EVENT);
    fire('storage', { key: LEGACY_API_KEYS_KEY });
    fire('storage', { key: LEGACY_CUSTOM_PROVIDERS_KEY });
    fire('storage', { key: null });
    expect(onChange).toHaveBeenCalledTimes(4);

    fire('storage', { key: 'winqa_theme' });
    expect(onChange).toHaveBeenCalledTimes(4);

    off();
    fire(KEYS_CHANGED_EVENT);
    expect(onChange).toHaveBeenCalledTimes(4);
  });
});
