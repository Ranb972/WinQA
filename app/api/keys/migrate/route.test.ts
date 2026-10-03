import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { POST } from '@/app/api/keys/migrate/route';
import ProviderCredential from '@/models/ProviderCredential';
import { resolveProviderAddress, ProviderUrlError } from '@/lib/security';
import {
  BASE_URL_HTTPS_ERROR,
  BASE_URL_PRIVATE_ERROR,
  UNREACHABLE_PROVIDER_ERROR,
} from '@/lib/friendly-errors';
import { _resetKeyRingForTests, credentialAad, decryptSecret } from '@/lib/server/key-vault';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_2aliceABC123' })),
}));

// No database: dbConnect is a spy and the model statics are spied on per test.
const db = vi.hoisted(() => ({ connect: vi.fn(async () => undefined) }));
vi.mock('@/lib/mongodb', () => ({ default: db.connect }));

// The real URL checks run; only the DNS vetting is replaced, with a public answer
// unless a test says otherwise.
vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return { ...actual, resolveProviderAddress: vi.fn() };
});

const USER = 'user_2aliceABC123';
// Fake, test-only keys.
const GEMINI_KEY = 'AIza-FAKE-gemini-0123456789abcdef';
const GROQ_KEY = 'gsk_FAKE-groq-0123456789abcdef';
const CUSTOM_KEY = 'sk-FAKE-custom-0123456789abcdef';
const CUSTOM_KEY_2 = 'sk-FAKE-custom-2-0123456789abcdef';
const ALL_KEYS = [GEMINI_KEY, GROQ_KEY, CUSTOM_KEY, CUSTOM_KEY_2];
// Test-only ring, generated per run.
const RING = `v1:${randomBytes(32).toString('base64')}`;

function customEntry(over: Record<string, unknown> = {}) {
  return {
    name: 'Example',
    baseUrl: 'https://api.example.com/v1',
    modelId: 'example-model-1',
    headerType: 'bearer',
    enabled: true,
    apiKey: CUSTOM_KEY,
    ...over,
  };
}

let savedRing: string | undefined;
let findSpy: MockInstance;
let countSpy: MockInstance;
let createSpy: MockInstance;
let upsertSpy: MockInstance;
let errorSpy: MockInstance<typeof console.error>;
let logSpy: MockInstance<typeof console.log>;
const created: Array<Record<string, unknown>> = [];
const upserts: Array<{ filter: unknown; update: Record<string, Record<string, unknown>>; options: unknown }> = [];

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/keys/migrate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/** find({ userId }).lean() resolves to these rows (default projection: no ciphertext). */
function mockRows(rows: Array<Record<string, unknown>>) {
  findSpy.mockImplementation((() => ({ lean: () => Promise.resolve(rows) })) as never);
}

function mockCount(n: number) {
  countSpy.mockImplementation((() => Promise.resolve(n)) as never);
}

/** A real document validated by the schema (slot === custom:<_id>), with no database. */
function allowCreate() {
  createSpy.mockImplementation((async (doc: Record<string, unknown>) => {
    created.push(doc);
    const d = new ProviderCredential(doc);
    await d.validate();
    return d;
  }) as never);
}

function allowUpsert() {
  upsertSpy.mockImplementation(((
    filter: unknown,
    update: Record<string, Record<string, unknown>>,
    options: unknown
  ) => {
    upserts.push({ filter, update, options });
    return { lean: () => Promise.resolve({ kind: 'builtin', provider: update.$setOnInsert.provider }) };
  }) as never);
}

function allowDb(rows: Array<Record<string, unknown>> = [], count = 0) {
  mockRows(rows);
  mockCount(count);
  allowCreate();
  allowUpsert();
}

function expectNoDb() {
  expect(db.connect).not.toHaveBeenCalled();
  expect(findSpy).not.toHaveBeenCalled();
  expect(countSpy).not.toHaveBeenCalled();
  expectNothingWritten();
}

function expectNothingWritten() {
  expect(createSpy).not.toHaveBeenCalled();
  expect(upsertSpy).not.toHaveBeenCalled();
}

beforeEach(() => {
  savedRing = process.env.KEY_ENCRYPTION_KEYS;
  process.env.KEY_ENCRYPTION_KEYS = RING;
  _resetKeyRingForTests();
  db.connect.mockClear();
  vi.mocked(auth).mockClear();
  vi.mocked(resolveProviderAddress).mockReset();
  vi.mocked(resolveProviderAddress).mockResolvedValue({
    hostname: 'api.example.com',
    address: '93.184.216.34',
    family: 4,
  });
  created.length = 0;
  upserts.length = 0;
  // Every static rejects unless a test opts in, so a stray DB call fails loudly.
  const reject = (() => Promise.reject(new Error('DB call not expected'))) as never;
  findSpy = vi.spyOn(ProviderCredential, 'find').mockImplementation(reject) as unknown as MockInstance;
  countSpy = vi
    .spyOn(ProviderCredential, 'countDocuments')
    .mockImplementation(reject) as unknown as MockInstance;
  createSpy = vi.spyOn(ProviderCredential, 'create').mockImplementation(reject) as unknown as MockInstance;
  upsertSpy = vi
    .spyOn(ProviderCredential, 'findOneAndUpdate')
    .mockImplementation(reject) as unknown as MockInstance;
  for (const name of ['findOne', 'exists', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'] as const) {
    vi.spyOn(ProviderCredential, name).mockImplementation(reject);
  }
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedRing === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
  else process.env.KEY_ENCRYPTION_KEYS = savedRing;
  _resetKeyRingForTests();
});

/** The response text and every log line hold no key, ciphertext or user id. */
function expectNoSecrets(text: string) {
  for (const key of ALL_KEYS) expect(text).not.toContain(key);
  for (const doc of created) {
    expect(text).not.toContain(doc.ct as string);
  }
  for (const u of upserts) expect(text).not.toContain(u.update.$set.ct as string);
  expect(text).not.toContain(USER);
  expect(text).not.toMatch(/"(ct|iv|tag|keyVersion|apiKey|userId)"/);
  const logged = [...errorSpy.mock.calls, ...logSpy.mock.calls]
    .map((c) => c.map(String).join(' '))
    .join('\n');
  for (const key of ALL_KEYS) expect(logged).not.toContain(key);
  expect(logged).not.toContain(USER);
}

describe('POST /api/keys/migrate: request checks', () => {
  it('401 without a user, before anything else', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    const res = await POST(post({ builtin: { gemini: GEMINI_KEY } }));
    expect(res.status).toBe(401);
    expectNoDb();
  });

  it('400 for 50 custom entries, before any DNS or DB call', async () => {
    const custom = Array.from({ length: 50 }, (_, i) => customEntry({ name: `P${i}` }));
    const res = await POST(post({ custom }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Too many custom providers in one request');
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expectNoDb();
  });

  it('20 custom entries are accepted; 21 are refused before any DNS or DB call', async () => {
    allowDb([], 0);
    const twenty = Array.from({ length: 20 }, (_, i) => customEntry({ name: `P${i}` }));
    const ok = await POST(post({ custom: twenty }));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.moved.custom).toHaveLength(6);
    expect(body.skipped).toHaveLength(14);
    expect(resolveProviderAddress).toHaveBeenCalledTimes(20);

    vi.mocked(resolveProviderAddress).mockClear();
    db.connect.mockClear();
    findSpy.mockClear();
    countSpy.mockClear();
    createSpy.mockClear();
    upsertSpy.mockClear();
    const res = await POST(post({ custom: [...twenty, customEntry({ name: 'P20' })] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Too many custom providers in one request');
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expectNoDb();
  });

  it('4 built-in entries are accepted; 5 are refused with no DB call', async () => {
    allowDb();
    const four = { cohere: GROQ_KEY, gemini: GEMINI_KEY, groq: GROQ_KEY, mistral: GROQ_KEY };
    const ok = await POST(post({ builtin: four }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).moved.builtin).toEqual(['cohere', 'gemini', 'groq', 'mistral']);

    db.connect.mockClear();
    findSpy.mockClear();
    countSpy.mockClear();
    createSpy.mockClear();
    upsertSpy.mockClear();
    const res = await POST(post({ builtin: { ...four, openai: GROQ_KEY } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Too many built-in keys in one request');
    expectNoDb();
  });

  it.each([
    ['an array body', [], 'The request body must be a JSON object'],
    ['builtin as an array', { builtin: [GEMINI_KEY] }, 'builtin must be an object'],
    ['builtin as null', { builtin: null }, 'builtin must be an object'],
    ['custom as an object', { custom: {} }, 'custom must be an array'],
    [
      'five built-in entries',
      { builtin: { gemini: GEMINI_KEY, groq: GROQ_KEY, cohere: GROQ_KEY, mistral: GROQ_KEY, x: GROQ_KEY } },
      'Too many built-in keys in one request',
    ],
  ])('400 for %s, with no DB call', async (_label, body, error) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
    expectNoDb();
  });
});

describe('POST /api/keys/migrate: built-in keys', () => {
  it('server wins: an existing slot is skipped with the reason and not written', async () => {
    allowDb([{ kind: 'builtin', slot: 'gemini', provider: 'gemini' }]);
    const res = await POST(post({ builtin: { gemini: GEMINI_KEY } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      moved: { builtin: [], custom: [] },
      skipped: [{ item: 'gemini', reason: 'A key is already saved for this provider' }],
    });
    expect(findSpy).toHaveBeenCalledWith({ userId: USER });
    expectNothingWritten();
  });

  it('a new slot is upserted like PUT /api/keys and decrypts under the user AAD', async () => {
    allowDb([{ kind: 'builtin', slot: 'gemini', provider: 'gemini' }]);
    const res = await POST(post({ builtin: { gemini: GEMINI_KEY, groq: GROQ_KEY } }));
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.moved.builtin).toEqual(['groq']);
    expect(upserts).toHaveLength(1);
    const { filter, update, options } = upserts[0];
    expect(filter).toEqual({ userId: USER, slot: 'groq' });
    expect(update.$setOnInsert).toEqual({ kind: 'builtin', provider: 'groq' });
    expect(Object.keys(update.$set).sort()).toEqual(
      ['ct', 'iv', 'keyVersion', 'last4', 'lastRejectedAt', 'lastTestOk', 'lastTestedAt', 'tag'].sort()
    );
    expect(options).toEqual({ upsert: true, returnDocument: 'after', runValidators: true });
    const s = update.$set as { ct: string; iv: string; tag: string; keyVersion: string };
    expect(decryptSecret(s, credentialAad(USER, 'groq'))).toBe(GROQ_KEY);
    expect(() => decryptSecret(s, credentialAad('user_other', 'groq'))).toThrow();
    expectNoSecrets(text);
  });

  it('an unknown provider is skipped, not a 400; a key-like name is not echoed', async () => {
    allowDb();
    const res = await POST(
      post({ builtin: { openai: GROQ_KEY, [GEMINI_KEY]: GROQ_KEY, toString: GROQ_KEY } })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.skipped).toEqual([
      { item: 'openai', reason: 'Unknown provider' },
      { item: 'unknown provider', reason: 'Unknown provider' },
      { item: 'unknown provider', reason: 'Unknown provider' },
    ]);
    expect(body.moved).toEqual({ builtin: [], custom: [] });
    // Nothing valid: no DB call at all.
    expectNoDb();
    expectNoSecrets(text);
  });

  it('an invalid apiKey is skipped with the validateApiKey reason', async () => {
    allowDb();
    const res = await POST(post({ builtin: { gemini: 'short', groq: 'has space 0123456789' } }));
    const body = await res.json();
    expect(body.skipped).toEqual([
      { item: 'gemini', reason: 'The API key must be at least 8 characters.' },
      { item: 'groq', reason: 'The API key must not contain spaces or line breaks.' },
    ]);
    expectNoDb();
  });
});

describe('POST /api/keys/migrate: custom providers', () => {
  it('inserts like POST /api/custom-providers, keeps enabled, returns the public view only', async () => {
    allowDb();
    const res = await POST(
      post({
        custom: [
          customEntry({ enabled: false, baseUrl: 'https://API.Example.com/v1/' }),
          customEntry({ name: 'Other', apiKey: CUSTOM_KEY_2, headerType: undefined }),
        ],
      })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(created).toHaveLength(2);
    const [a, b] = created;
    expect(a.slot).toBe(`custom:${String(a._id)}`);
    expect(a.userId).toBe(USER);
    expect(a.kind).toBe('custom');
    expect(a.enabled).toBe(false);
    expect(a.baseUrl).toBe('https://api.example.com/v1');
    expect(b).not.toHaveProperty('headerType');
    const rec = a as { ct: string; iv: string; tag: string; keyVersion: string; slot: string };
    expect(decryptSecret(rec, credentialAad(USER, rec.slot))).toBe(CUSTOM_KEY);
    expect(body.moved.custom.map((c: { id: string }) => c.id)).toEqual([String(a._id), String(b._id)]);
    expect(body.moved.custom[0].enabled).toBe(false);
    expect(body.moved.custom[1].headerType).toBeNull();
    expect(body.skipped).toEqual([]);
    expect(countSpy).toHaveBeenCalledWith({ userId: USER, kind: 'custom' });
    expectNoSecrets(text);
    expect(logSpy.mock.calls.map((c) => String(c[0]))).toContain('[keys] route=migrate moved=2 skipped=0');
  });

  it('de-duplicates within the request (normalized URL) and against saved rows', async () => {
    allowDb([
      { kind: 'custom', name: 'Saved', baseUrl: 'https://saved.example.com/v1', modelId: 'm1' },
    ]);
    const res = await POST(
      post({
        custom: [
          customEntry(),
          customEntry({ baseUrl: 'https://API.EXAMPLE.com/v1//', apiKey: CUSTOM_KEY_2 }),
          customEntry({ name: 'Saved', baseUrl: 'https://saved.example.com/v1/', modelId: 'm1' }),
          customEntry({ name: 'Example', modelId: 'another-model' }),
        ],
      })
    );
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.moved.custom.map((c: { name: string; modelId: string }) => [c.name, c.modelId])).toEqual([
      ['Example', 'example-model-1'],
      ['Example', 'another-model'],
    ]);
    expect(body.skipped).toEqual([
      { item: 'Example', reason: 'Duplicate in this request' },
      { item: 'Saved', reason: 'Already saved' },
    ]);
    // The in-request duplicate costs no DNS lookup.
    expect(resolveProviderAddress).toHaveBeenCalledTimes(3);
    expect(created).toHaveLength(2);
    expectNoSecrets(text);
  });

  it('cap 6: with 5 saved, one is inserted and the rest skipped', async () => {
    allowDb([], 5);
    const res = await POST(
      post({ custom: [1, 2, 3].map((i) => customEntry({ name: `P${i}` })) })
    );
    const body = await res.json();
    expect(created).toHaveLength(1);
    expect(body.moved.custom.map((c: { name: string }) => c.name)).toEqual(['P1']);
    expect(body.skipped).toEqual([
      { item: 'P2', reason: 'You can save up to 6 custom providers' },
      { item: 'P3', reason: 'You can save up to 6 custom providers' },
    ]);
  });

  it('a private literal URL and a DNS refusal are skipped with the guard text, nothing inserted', async () => {
    allowDb();
    vi.mocked(resolveProviderAddress).mockRejectedValueOnce(
      new ProviderUrlError(UNREACHABLE_PROVIDER_ERROR)
    );
    const res = await POST(
      post({
        custom: [
          customEntry({ name: 'Private', baseUrl: 'https://127.0.0.2/v1' }),
          customEntry({ name: 'Rebinding', baseUrl: 'https://rebind.example.com/v1' }),
          customEntry({ name: 'Plain', baseUrl: 'http://api.example.com/v1' }),
        ],
      })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.skipped).toEqual([
      { item: 'Private', reason: BASE_URL_PRIVATE_ERROR },
      { item: 'Plain', reason: BASE_URL_HTTPS_ERROR },
      { item: 'Rebinding', reason: UNREACHABLE_PROVIDER_ERROR },
    ]);
    // Only the host that passed the literal checks reached DNS, with the 5 s budget.
    expect(resolveProviderAddress).toHaveBeenCalledTimes(1);
    expect(resolveProviderAddress).toHaveBeenCalledWith('https://rebind.example.com/v1', 5000);
    expectNoDb();
    // No URL reaches the response.
    expect(text).not.toContain('rebind.example.com');
    expect(text).not.toContain('127.0.0.2');
  });

  it('a resolver error that is not a ProviderUrlError gives the unreachable text', async () => {
    allowDb();
    vi.mocked(resolveProviderAddress).mockRejectedValueOnce(
      Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    );
    const body = await (await POST(post({ custom: [customEntry()] }))).json();
    expect(body.skipped).toEqual([{ item: 'Example', reason: UNREACHABLE_PROVIDER_ERROR }]);
    expectNoDb();
  });

  it('invalid fields are skipped with the POST route texts; a bad name is not echoed', async () => {
    allowDb();
    const res = await POST(
      post({
        custom: [
          customEntry({ name: '' }),
          customEntry({ name: 'NoModel', modelId: '' }),
          customEntry({ name: 'BadHeader', headerType: 'basic' }),
          customEntry({ name: 'NoEnabled', enabled: 'yes' }),
          customEntry({ name: 'BadKey', apiKey: 'short' }),
          'not an object',
        ],
      })
    );
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.skipped).toEqual([
      { item: 'custom provider 1', reason: 'Name must be 1 to 60 characters' },
      { item: 'NoModel', reason: 'Model ID must be 1 to 200 characters' },
      { item: 'BadHeader', reason: 'Header type must be "bearer" or "x-api-key"' },
      { item: 'NoEnabled', reason: 'enabled must be true or false' },
      { item: 'BadKey', reason: 'The API key must be at least 8 characters.' },
      { item: 'custom provider 6', reason: 'Invalid custom provider' },
    ]);
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expectNoDb();
    expectNoSecrets(text);
  });

  it('one failing insert is skipped with "Could not save"; the others continue', async () => {
    mockRows([]);
    mockCount(0);
    let calls = 0;
    createSpy.mockImplementation((async (doc: Record<string, unknown>) => {
      calls++;
      created.push(doc);
      if (calls === 2) throw new Error(`write failed for ${USER}`);
      const d = new ProviderCredential(doc);
      await d.validate();
      return d;
    }) as never);
    const res = await POST(
      post({ custom: [1, 2, 3].map((i) => customEntry({ name: `P${i}` })) })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.moved.custom.map((c: { name: string }) => c.name)).toEqual(['P1', 'P3']);
    expect(body.skipped).toEqual([{ item: 'P2', reason: 'Could not save' }]);
    expectNoSecrets(text);
    const logged = errorSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('[keys] route=migrate op=create error=Error');
  });
});

describe('POST /api/keys/migrate: failures', () => {
  it('500 "Key storage is not configured" when the ring is missing, with no DB call or write', async () => {
    allowDb();
    delete process.env.KEY_ENCRYPTION_KEYS;
    _resetKeyRingForTests();
    const res = await POST(post({ builtin: { gemini: GEMINI_KEY }, custom: [customEntry()] }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error).toBe('Key storage is not configured');
    expectNoDb();
    expectNoSecrets(text);
  });

  it('a failing read is a 500 with nothing written', async () => {
    findSpy.mockImplementation((() => ({
      lean: () => Promise.reject(new Error(`read failed for ${USER}`)),
    })) as never);
    const res = await POST(post({ builtin: { gemini: GEMINI_KEY } }));
    expect(res.status).toBe(500);
    expectNothingWritten();
    expectNoSecrets(await res.text());
  });

  it('a failing built-in upsert skips that provider only', async () => {
    mockRows([]);
    upsertSpy.mockImplementation(((_f: unknown, update: Record<string, Record<string, unknown>>) => ({
      lean: () =>
        update.$setOnInsert.provider === 'gemini'
          ? Promise.reject(new Error('boom'))
          : Promise.resolve({ kind: 'builtin', provider: update.$setOnInsert.provider }),
    })) as never);
    const res = await POST(post({ builtin: { gemini: GEMINI_KEY, groq: GROQ_KEY } }));
    const body = await res.json();
    expect(body.moved.builtin).toEqual(['groq']);
    expect(body.skipped).toEqual([{ item: 'gemini', reason: 'Could not save' }]);
  });

  it('the response for a full mixed migration holds no key or ciphertext', async () => {
    allowDb([{ kind: 'builtin', slot: 'groq', provider: 'groq' }]);
    const res = await POST(
      post({
        builtin: { gemini: GEMINI_KEY, groq: GROQ_KEY },
        custom: [customEntry(), customEntry({ name: 'Two', apiKey: CUSTOM_KEY_2 })],
      })
    );
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.moved.builtin).toEqual(['gemini']);
    expect(body.moved.custom).toHaveLength(2);
    expect(created.length + upserts.length).toBe(3);
    expectNoSecrets(text);
  });
});
