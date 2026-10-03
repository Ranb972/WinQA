import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import ProviderCredential from '@/models/ProviderCredential';
import { _resetKeyRingForTests, decryptSecret, credentialAad } from '@/lib/server/key-vault';
import { GET, PUT, DELETE } from '@/app/api/keys/route';

const clerk = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: clerk.auth }));

// No database: dbConnect is a spy and the model statics are spied on per test.
const db = vi.hoisted(() => ({ connect: vi.fn(async () => undefined) }));
vi.mock('@/lib/mongodb', () => ({ default: db.connect }));

const USER = 'user_2KeysRouteTest0001';
// Fake key, never a real one.
const FAKE_KEY = 'AIzaSy-route-test-fake-key-0000WXYZ';

// Test-only ring, generated per run.
const ringV1 = `v1:${randomBytes(32).toString('base64')}`;
let savedEnv: string | undefined;

type Spy = MockInstance<(...args: unknown[]) => unknown>;
let writeSpies: Record<string, Spy> = {};
let errorSpy: MockInstance<typeof console.error>;

function req(method: string, body?: string, query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/keys${query}`, {
    method,
    ...(body !== undefined ? { body, headers: { 'content-type': 'application/json' } } : {}),
  });
}

function put(body: unknown): NextRequest {
  return req('PUT', JSON.stringify(body));
}

function expectNoDb() {
  expect(db.connect).not.toHaveBeenCalled();
  for (const spy of Object.values(writeSpies)) expect(spy).not.toHaveBeenCalled();
}

function loggedText(): string {
  return errorSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
}

beforeEach(() => {
  savedEnv = process.env.KEY_ENCRYPTION_KEYS;
  process.env.KEY_ENCRYPTION_KEYS = ringV1;
  _resetKeyRingForTests();
  clerk.auth.mockReset();
  clerk.auth.mockResolvedValue({ userId: USER });
  db.connect.mockClear();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const reject = (() => Promise.reject(new Error('DB call not expected'))) as never;
  writeSpies = {
    find: vi.spyOn(ProviderCredential, 'find').mockImplementation(reject),
    findOne: vi.spyOn(ProviderCredential, 'findOne').mockImplementation(reject),
    updateOne: vi.spyOn(ProviderCredential, 'updateOne').mockImplementation(reject),
    updateMany: vi.spyOn(ProviderCredential, 'updateMany').mockImplementation(reject),
    findOneAndUpdate: vi.spyOn(ProviderCredential, 'findOneAndUpdate').mockImplementation(reject),
    deleteOne: vi.spyOn(ProviderCredential, 'deleteOne').mockImplementation(reject),
    deleteMany: vi.spyOn(ProviderCredential, 'deleteMany').mockImplementation(reject),
    create: vi.spyOn(ProviderCredential, 'create').mockImplementation(reject),
    save: vi.spyOn(ProviderCredential.prototype, 'save').mockImplementation(reject),
  } as unknown as Record<string, Spy>;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedEnv === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
  else process.env.KEY_ENCRYPTION_KEYS = savedEnv;
  _resetKeyRingForTests();
});

/** findOneAndUpdate(...).lean() resolving to what the DB would return after the upsert. */
function mockUpsert() {
  const lean = vi.fn();
  const spy = vi
    .spyOn(ProviderCredential, 'findOneAndUpdate')
    .mockImplementation(((filter: Record<string, unknown>, update: Record<string, Record<string, unknown>>) => {
      // What the default projection returns: no ct/iv/tag.
      lean.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        userId: filter.userId,
        slot: filter.slot,
        kind: update.$setOnInsert.kind,
        provider: update.$setOnInsert.provider,
        keyVersion: update.$set.keyVersion,
        last4: update.$set.last4,
        lastTestedAt: null,
        lastTestOk: null,
        lastRejectedAt: null,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-03T00:00:00Z'),
      });
      return { lean };
    }) as never);
  return { spy, lean };
}

describe('auth', () => {
  it('returns 401 without a user on GET, PUT and DELETE, with no DB call', async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    const responses = [
      await GET(),
      await PUT(put({ provider: 'gemini', apiKey: FAKE_KEY })),
      await DELETE(req('DELETE', undefined, '?provider=gemini')),
    ];
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
    }
    expectNoDb();
  });
});

describe('PUT /api/keys validation (before any DB call)', () => {
  it('a bad body without a user gives 401, not 400 (auth runs before validation)', async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    const malformed = await PUT(req('PUT', '{"provider": '));
    expect(malformed.status).toBe(401);
    const badProvider = await PUT(put({ provider: 'toString', apiKey: 'short' }));
    expect(badProvider.status).toBe(401);
    expect(await badProvider.json()).toEqual({ error: 'Unauthorized' });
    expectNoDb();
  });

  it.each(['toString', 'constructor', '__proto__', 'Gemini', 'openai', '', 42, null])(
    'provider %j gives 400',
    async (provider) => {
      const res = await PUT(put({ provider, apiKey: FAKE_KEY }));
      expect(res.status).toBe(400);
      expectNoDb();
    }
  );

  it.each([
    ['7 characters', 'abcdefg'],
    ['513 characters', 'k'.repeat(513)],
    ['a space', 'abcd efgh1234'],
    ['a tab', 'abcd\tefgh1234'],
    ['a newline', 'abcdefgh1234\n'],
  ])('a key with %s gives 400 with the reason', async (_label, apiKey) => {
    const res = await PUT(put({ provider: 'gemini', apiKey }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toMatch(/API key/);
    expectNoDb();
  });

  it('a missing key gives 400', async () => {
    const res = await PUT(put({ provider: 'gemini' }));
    expect(res.status).toBe(400);
    expectNoDb();
  });

  it('malformed JSON gives 400', async () => {
    const res = await PUT(req('PUT', '{"provider": "gemini", '));
    expect(res.status).toBe(400);
    expectNoDb();
  });

  it.each(['null', '[]', '"gemini"'])('a non-object body %s gives 400', async (raw) => {
    const res = await PUT(req('PUT', raw));
    expect(res.status).toBe(400);
    expectNoDb();
  });
});

describe('PUT /api/keys saves', () => {
  it('upserts on { userId, slot } with kind/provider only in $setOnInsert and resets test state', async () => {
    const { spy } = mockUpsert();
    const res = await PUT(put({ provider: 'gemini', apiKey: FAKE_KEY }));
    expect(res.status).toBe(200);
    expect(db.connect).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);

    const [filter, update, options] = spy.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> },
      Record<string, unknown>,
    ];
    expect(filter).toEqual({ userId: USER, slot: 'gemini' });
    expect(update.$setOnInsert).toEqual({ kind: 'builtin', provider: 'gemini' });
    expect(Object.keys(update).sort()).toEqual(['$set', '$setOnInsert']);
    for (const path of ['userId', 'slot', 'kind', 'provider']) {
      expect(update.$set).not.toHaveProperty(path);
    }
    expect(Object.keys(update.$set).sort()).toEqual(
      ['ct', 'iv', 'keyVersion', 'last4', 'lastRejectedAt', 'lastTestOk', 'lastTestedAt', 'tag'].sort()
    );
    expect(update.$set.last4).toBe('WXYZ');
    expect(update.$set.lastTestedAt).toBeNull();
    expect(update.$set.lastTestOk).toBeNull();
    expect(update.$set.lastRejectedAt).toBeNull();
    expect(options).toEqual({ upsert: true, returnDocument: 'after', runValidators: true });

    // Really encrypted under this user's AAD for this slot.
    const s = update.$set as { ct: string; iv: string; tag: string; keyVersion: string };
    expect(s.ct).not.toBe(FAKE_KEY);
    expect(decryptSecret(s, credentialAad(USER, 'gemini'))).toBe(FAKE_KEY);
  });

  it('responds with the public view only: no key, ct, iv, tag, keyVersion or user id', async () => {
    const { spy } = mockUpsert();
    const res = await PUT(put({ provider: 'gemini', apiKey: FAKE_KEY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ['provider', 'last4', 'updatedAt', 'lastTestedAt', 'lastTestOk', 'lastRejectedAt'].sort()
    );
    expect(body.provider).toBe('gemini');
    expect(body.last4).toBe('WXYZ');

    const text = JSON.stringify(body);
    const ct = (spy.mock.calls[0] as unknown as [unknown, { $set: { ct: string } }])[1].$set.ct;
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain(ct);
    expect(text).not.toContain(USER);
    for (const field of ['"ct"', '"iv"', '"tag"', '"keyVersion"', '"apiKey"', '"userId"']) {
      expect(text).not.toContain(field);
    }
    expect(loggedText()).not.toContain(FAKE_KEY);
  });

  it('vault not configured gives 500 with the exact message and no write', async () => {
    delete process.env.KEY_ENCRYPTION_KEYS;
    _resetKeyRingForTests();
    const res = await PUT(put({ provider: 'gemini', apiKey: FAKE_KEY }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Key storage is not configured' });
    expectNoDb();
    expect(loggedText()).not.toContain(USER);
    expect(loggedText()).not.toContain(FAKE_KEY);
  });

  it('a DB failure gives a generic 500 that names no user or key', async () => {
    const lean = vi.fn().mockRejectedValue(new Error(`E11000 dup ${USER}`));
    vi.spyOn(ProviderCredential, 'findOneAndUpdate').mockImplementation((() => ({ lean })) as never);
    const res = await PUT(put({ provider: 'gemini', apiKey: FAKE_KEY }));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(USER);
    expect(text).not.toContain(FAKE_KEY);
    expect(loggedText()).not.toContain(USER);
    expect(loggedText()).not.toContain(FAKE_KEY);
  });
});

describe('GET /api/keys', () => {
  it('returns masked metadata only, from a query that does not select the ciphertext', async () => {
    const otherKey = 'gsk_route_test_fake_groq_key_0000ABCD';
    const customId = new mongoose.Types.ObjectId();
    // A row as a lean query could return it; ct and an apiKey are planted to
    // prove the response is built from named fields only.
    const docs = [
      {
        _id: new mongoose.Types.ObjectId(),
        userId: USER,
        slot: 'groq',
        kind: 'builtin',
        provider: 'groq',
        ct: 'CIPHERTEXT-SHOULD-NOT-LEAK',
        apiKey: otherKey,
        keyVersion: 'v1',
        last4: 'ABCD',
        updatedAt: new Date('2026-10-02T00:00:00Z'),
        lastTestedAt: null,
        lastTestOk: null,
        lastRejectedAt: null,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        userId: USER,
        slot: 'gemini',
        kind: 'builtin',
        provider: 'gemini',
        apiKey: FAKE_KEY,
        keyVersion: 'v1',
        last4: 'WXYZ',
        updatedAt: new Date('2026-10-02T00:00:00Z'),
        lastTestedAt: new Date('2026-10-02T01:00:00Z'),
        lastTestOk: true,
        lastRejectedAt: null,
      },
      {
        _id: customId,
        userId: USER,
        slot: `custom:${customId.toString()}`,
        kind: 'custom',
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId: 'meta-llama/llama-3-8b',
        headerType: 'bearer',
        enabled: true,
        keyVersion: 'v1',
        last4: '',
        updatedAt: new Date('2026-10-02T00:00:00Z'),
      },
    ];
    const lean = vi.fn().mockResolvedValue(docs);
    const sort = vi.fn(() => ({ lean }));
    const select = vi.fn();
    const find = vi
      .spyOn(ProviderCredential, 'find')
      .mockImplementation((() => ({ sort, select, lean })) as never);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls[0]).toEqual([{ userId: USER }]);
    expect(select).not.toHaveBeenCalled();

    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['builtin', 'custom']);
    expect(body.builtin.map((b: { provider: string }) => b.provider)).toEqual(['gemini', 'groq']);
    expect(body.builtin[0]).toEqual({
      provider: 'gemini',
      last4: 'WXYZ',
      updatedAt: '2026-10-02T00:00:00.000Z',
      lastTestedAt: '2026-10-02T01:00:00.000Z',
      lastTestOk: true,
      lastRejectedAt: null,
    });
    expect(body.custom).toHaveLength(1);
    expect(body.custom[0]).toMatchObject({
      id: customId.toString(),
      name: 'OpenRouter',
      modelId: 'meta-llama/llama-3-8b',
      hasKey: true,
    });

    const text = JSON.stringify(body);
    for (const secret of [FAKE_KEY, otherKey, 'CIPHERTEXT-SHOULD-NOT-LEAK', USER]) {
      expect(text).not.toContain(secret);
    }
    for (const field of ['"ct"', '"iv"', '"tag"', '"keyVersion"', '"apiKey"', '"userId"', '"slot"']) {
      expect(text).not.toContain(field);
    }
  });

  it('skips a malformed built-in row that publicView refuses and returns the others', async () => {
    const docs = [
      {
        _id: new mongoose.Types.ObjectId(),
        userId: USER,
        slot: 'toString',
        kind: 'builtin',
        provider: 'toString',
        keyVersion: 'v1',
        last4: 'BAD1',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        userId: USER,
        slot: 'cohere',
        kind: 'builtin',
        provider: 'cohere',
        keyVersion: 'v1',
        last4: 'GOOD',
        updatedAt: new Date('2026-10-02T00:00:00Z'),
        lastTestedAt: null,
        lastTestOk: null,
        lastRejectedAt: null,
      },
    ];
    const lean = vi.fn().mockResolvedValue(docs);
    vi.spyOn(ProviderCredential, 'find').mockImplementation(
      (() => ({ sort: () => ({ lean }) })) as never
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.custom).toEqual([]);
    expect(body.builtin).toEqual([
      {
        provider: 'cohere',
        last4: 'GOOD',
        updatedAt: '2026-10-02T00:00:00.000Z',
        lastTestedAt: null,
        lastTestOk: null,
        lastRejectedAt: null,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain('BAD1');
  });

  it('an empty store gives empty lists', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    vi.spyOn(ProviderCredential, 'find').mockImplementation(
      (() => ({ sort: () => ({ lean }) })) as never
    );
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ builtin: [], custom: [] });
  });
});

describe('DELETE /api/keys', () => {
  it('scopes the delete on { userId, slot, kind: builtin }', async () => {
    const del = vi
      .spyOn(ProviderCredential, 'deleteOne')
      .mockResolvedValue({ acknowledged: true, deletedCount: 1 } as never);
    const res = await DELETE(req('DELETE', undefined, '?provider=mistral'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(del).toHaveBeenCalledTimes(1);
    expect(del.mock.calls[0][0]).toEqual({ userId: USER, slot: 'mistral', kind: 'builtin' });
  });

  it('reports deleted: false when there was nothing to delete', async () => {
    vi.spyOn(ProviderCredential, 'deleteOne').mockResolvedValue({
      acknowledged: true,
      deletedCount: 0,
    } as never);
    const res = await DELETE(req('DELETE', undefined, '?provider=cohere'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: false });
  });

  it.each(['', '?provider=toString', '?provider=__proto__', '?provider=custom:abc', '?provider=Gemini'])(
    'an invalid provider (%s) gives 400 with no DB call',
    async (query) => {
      const res = await DELETE(req('DELETE', undefined, query));
      expect(res.status).toBe(400);
      expectNoDb();
    }
  );
});
