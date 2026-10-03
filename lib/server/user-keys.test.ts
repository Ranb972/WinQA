import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import mongoose from 'mongoose';
import ProviderCredential from '@/models/ProviderCredential';
import {
  _resetKeyRingForTests,
  decryptSecret,
  credentialAad,
  KeyVaultDecryptError,
} from '@/lib/server/key-vault';
import {
  loadUserKeys,
  loadCustomProvider,
  publicView,
  encryptForSlot,
  validateApiKey,
  last4Of,
  markRejected,
  newCustomCredentialId,
  customSlot,
  isKnownSlot,
} from '@/lib/server/user-keys';

// No database: dbConnect is a spy and the model statics are spied on per test.
const db = vi.hoisted(() => ({ connect: vi.fn(async () => undefined) }));
vi.mock('@/lib/mongodb', () => ({ default: db.connect }));

const USER = 'user_2aliceABC123';
const OTHER = 'user_2bobXYZ789';
const GEMINI_KEY = 'AIzaSy-test-gemini-key-000000000001';
const GROQ_KEY = 'gsk_test_groq_key_00000000000000002';
const CUSTOM_KEY = 'sk-or-test-custom-key-0000000000003';

// Test-only ring, generated per run; nothing here is a real secret.
const ringV1 = `v1:${randomBytes(32).toString('base64')}`;
let savedEnv: string | undefined;

type Spy = MockInstance<(...args: unknown[]) => unknown>;
let writeSpies: Spy[] = [];
let errorSpy: MockInstance<typeof console.error>;

function builtinDoc(userId: string, provider: string, key: string, extra: Record<string, unknown> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    userId,
    slot: provider,
    kind: 'builtin',
    provider,
    ...encryptForSlot(userId, provider, key),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-02T00:00:00Z'),
    lastTestedAt: new Date('2026-10-02T01:00:00Z'),
    lastTestOk: true,
    lastRejectedAt: null,
    ...extra,
  };
}

function customDoc(userId: string, key: string) {
  const { _id, slot } = newCustomCredentialId();
  return {
    _id,
    userId,
    slot,
    kind: 'custom',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'meta-llama/llama-3-8b',
    headerType: 'bearer',
    enabled: true,
    ...encryptForSlot(userId, slot, key),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-02T00:00:00Z'),
    lastTestedAt: null,
    lastTestOk: null,
    lastRejectedAt: new Date('2026-10-02T02:00:00Z'),
  };
}

/** find(...).select(...).lean() resolving to docs. */
function mockFind(docs: unknown[]) {
  const lean = vi.fn().mockResolvedValue(docs);
  const select = vi.fn(() => ({ lean }));
  const find = vi.spyOn(ProviderCredential, 'find').mockImplementation((() => ({ select })) as never);
  return { find, select, lean };
}

function mockFindOne(doc: unknown) {
  const lean = vi.fn().mockResolvedValue(doc);
  const select = vi.fn(() => ({ lean }));
  const findOne = vi
    .spyOn(ProviderCredential, 'findOne')
    .mockImplementation((() => ({ select })) as never);
  return { findOne, select, lean };
}

function flipByte(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  buf[0] ^= 0x01;
  return buf.toString('base64');
}

function loggedText(): string {
  return errorSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
}

beforeEach(() => {
  savedEnv = process.env.KEY_ENCRYPTION_KEYS;
  process.env.KEY_ENCRYPTION_KEYS = ringV1;
  _resetKeyRingForTests();
  db.connect.mockClear();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const reject = (() => Promise.reject(new Error('write not expected'))) as never;
  writeSpies = [
    vi.spyOn(ProviderCredential, 'updateOne').mockImplementation(reject),
    vi.spyOn(ProviderCredential, 'updateMany').mockImplementation(reject),
    vi.spyOn(ProviderCredential, 'findOneAndUpdate').mockImplementation(reject),
    vi.spyOn(ProviderCredential, 'deleteOne').mockImplementation(reject),
    vi.spyOn(ProviderCredential, 'bulkWrite').mockImplementation(reject),
    vi.spyOn(ProviderCredential.prototype, 'save').mockImplementation(reject),
  ] as unknown as Spy[];
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedEnv === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
  else process.env.KEY_ENCRYPTION_KEYS = savedEnv;
  _resetKeyRingForTests();
});

function expectNoWrites() {
  for (const spy of writeSpies) expect(spy).not.toHaveBeenCalled();
}

describe('publicView never carries key material', () => {
  it('a full built-in document gives only the masked metadata', () => {
    const doc = { ...builtinDoc(USER, 'gemini', GEMINI_KEY), apiKey: GEMINI_KEY };
    const view = publicView(doc);
    expect(Object.keys(view).sort()).toEqual(
      ['provider', 'last4', 'updatedAt', 'lastTestedAt', 'lastTestOk', 'lastRejectedAt'].sort()
    );
    expect(view).toMatchObject({ provider: 'gemini', last4: '0001', lastTestOk: true });
    const json = JSON.stringify(view);
    for (const secret of [GEMINI_KEY, doc.ct, doc.iv, doc.tag, USER]) expect(json).not.toContain(secret);
    for (const field of ['ct', 'iv', 'tag', 'apiKey', 'keyVersion', 'userId']) {
      expect(view).not.toHaveProperty(field);
    }
  });

  it('a full custom document gives only the masked metadata', () => {
    const doc = { ...customDoc(USER, CUSTOM_KEY), apiKey: CUSTOM_KEY };
    const view = publicView(doc);
    expect(Object.keys(view).sort()).toEqual(
      [
        'id', 'name', 'baseUrl', 'modelId', 'headerType', 'enabled', 'last4', 'hasKey',
        'updatedAt', 'lastTestedAt', 'lastTestOk', 'lastRejectedAt',
      ].sort()
    );
    expect(view).toMatchObject({
      id: doc._id.toString(),
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'meta-llama/llama-3-8b',
      headerType: 'bearer',
      enabled: true,
      last4: '0003',
      hasKey: true,
    });
    const json = JSON.stringify(view);
    for (const secret of [CUSTOM_KEY, doc.ct, doc.iv, doc.tag, USER]) expect(json).not.toContain(secret);
    for (const field of ['ct', 'iv', 'tag', 'apiKey', 'keyVersion', 'userId', 'slot']) {
      expect(view).not.toHaveProperty(field);
    }
  });

  it('a hydrated Mongoose document loaded with +ct also maps cleanly', () => {
    const hydrated = new ProviderCredential(builtinDoc(USER, 'groq', GROQ_KEY));
    const json = JSON.stringify(publicView(hydrated));
    expect(json).not.toContain(hydrated.ct);
    expect(json).not.toContain(GROQ_KEY);
  });

  it('an unknown kind throws instead of guessing a shape', () => {
    expect(() => publicView({ kind: 'other' })).toThrow(TypeError);
  });
});

describe('the model', () => {
  it('ct, iv and tag are select: false and toJSON strips them', () => {
    for (const f of ['ct', 'iv', 'tag']) {
      expect((ProviderCredential.schema.path(f) as unknown as { options: { select?: boolean } }).options.select).toBe(false);
    }
    const json = JSON.stringify(new ProviderCredential(builtinDoc(USER, 'groq', GROQ_KEY)).toJSON());
    expect(json).not.toMatch(/"ct"|"iv"|"tag"/);
  });

  it('has the unique { userId, slot } index and the providercredentials collection', () => {
    const indexes = ProviderCredential.schema.indexes();
    expect(indexes).toContainEqual([{ userId: 1, slot: 1 }, expect.objectContaining({ unique: true })]);
    expect(ProviderCredential.collection.collectionName).toBe('providercredentials');
  });

  it('a custom slot must be custom:<its own _id>, a built-in slot its provider', async () => {
    await expect(new ProviderCredential(customDoc(USER, CUSTOM_KEY)).validate()).resolves.toBeUndefined();
    const wrongSlot = { ...customDoc(USER, CUSTOM_KEY), slot: customSlot(new mongoose.Types.ObjectId().toString()) };
    await expect(new ProviderCredential(wrongSlot).validate()).rejects.toThrow(/custom:<its own _id>/);
    await expect(new ProviderCredential(builtinDoc(USER, 'groq', GROQ_KEY)).validate()).resolves.toBeUndefined();
    const mismatched = { ...builtinDoc(USER, 'groq', GROQ_KEY), slot: 'gemini' };
    await expect(new ProviderCredential(mismatched).validate()).rejects.toThrow(/equal its provider/);
  });

  it('an update cannot $set userId, slot, kind or provider; $setOnInsert can', () => {
    // Real Mongoose update casting (Query#_castUpdate, the step exec runs), no DB.
    // Building a query does not execute it; use the real static here.
    writeSpies[0].mockRestore();
    type Castable = { _castUpdate(u: unknown): unknown; getUpdate(): unknown };
    const immutable = { userId: OTHER, slot: 'gemini', kind: 'custom', provider: 'groq' };
    const q = ProviderCredential.updateOne(
      { userId: USER, slot: 'groq' },
      { $set: { ...immutable, enabled: false } }
    ) as unknown as Castable;
    expect(q._castUpdate(q.getUpdate())).toEqual({ $set: { enabled: false } });

    const strict = ProviderCredential.updateOne(
      { userId: USER, slot: 'groq' },
      { $set: { slot: 'gemini' } },
      { strict: 'throw' }
    ) as unknown as Castable;
    expect(() => strict._castUpdate(strict.getUpdate())).toThrow(/immutable/);

    const upsert = ProviderCredential.updateOne(
      { userId: USER, slot: 'groq' },
      { $setOnInsert: { kind: 'builtin', provider: 'groq' } },
      { upsert: true }
    ) as unknown as Castable;
    expect(upsert._castUpdate(upsert.getUpdate())).toMatchObject({
      $setOnInsert: { kind: 'builtin', provider: 'groq' },
    });
  });

  it('enforces the name, modelId and baseUrl caps', async () => {
    const base = customDoc(USER, CUSTOM_KEY);
    await expect(new ProviderCredential({ ...base, name: 'n'.repeat(61) }).validate()).rejects.toThrow();
    await expect(new ProviderCredential({ ...base, modelId: 'm'.repeat(201) }).validate()).rejects.toThrow();
    await expect(
      new ProviderCredential({ ...base, baseUrl: `https://x.io/${'a'.repeat(2048)}` }).validate()
    ).rejects.toThrow();
  });
});

describe('loadUserKeys', () => {
  it('queries only the requested built-in slots of this user and selects +ct +iv +tag', async () => {
    const { find, select } = mockFind([]);
    await loadUserKeys(USER, ['gemini', 'groq', 'gemini']);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls[0][0]).toEqual({ userId: USER, kind: 'builtin', slot: { $in: ['gemini', 'groq'] } });
    expect(select).toHaveBeenCalledWith('+ct +iv +tag');
  });

  it('round trip: returns the plaintext under CustomApiKeys[provider]', async () => {
    mockFind([builtinDoc(USER, 'gemini', GEMINI_KEY), builtinDoc(USER, 'groq', GROQ_KEY)]);
    const result = await loadUserKeys(USER, ['gemini', 'groq', 'mistral']);
    expect(result).toEqual({ keys: { gemini: GEMINI_KEY, groq: GROQ_KEY }, failed: [] });
    expect(errorSpy).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it('no requested provider means no DB call', async () => {
    const { find } = mockFind([]);
    expect(await loadUserKeys(USER, [])).toEqual({ keys: {}, failed: [] });
    expect(await loadUserKeys(USER, ['toString' as never])).toEqual({ keys: {}, failed: [] });
    expect(await loadUserKeys('', ['gemini'])).toEqual({ keys: {}, failed: [] });
    expect(find).not.toHaveBeenCalled();
    expect(db.connect).not.toHaveBeenCalled();
  });

  it('a tampered record lands in failed, writes nothing and logs one line without the user id', async () => {
    const good = builtinDoc(USER, 'groq', GROQ_KEY);
    const bad = builtinDoc(USER, 'gemini', GEMINI_KEY);
    bad.ct = flipByte(bad.ct);
    mockFind([bad, good]);
    const result = await loadUserKeys(USER, ['gemini', 'groq']);
    expect(result).toEqual({ keys: { groq: GROQ_KEY }, failed: ['gemini'] });
    expectNoWrites();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toMatch(/^\[keys\] decrypt-failed slot=gemini version=v1 error=KeyVaultDecryptError$/);
    const text = loggedText();
    for (const s of [USER, GEMINI_KEY, bad.ct, bad.tag, bad.iv]) expect(text).not.toContain(s);
  });

  it("another user's ciphertext copied into this user's row fails (AAD) and is not returned", async () => {
    const stolen = { ...builtinDoc(OTHER, 'gemini', GEMINI_KEY), userId: USER };
    mockFind([stolen]);
    const result = await loadUserKeys(USER, ['gemini']);
    expect(result).toEqual({ keys: {}, failed: ['gemini'] });
    expectNoWrites();
  });

  it('a record under a key version not in the ring fails with its version logged', async () => {
    const doc = builtinDoc(USER, 'gemini', GEMINI_KEY, { keyVersion: 'v9' });
    mockFind([doc]);
    const result = await loadUserKeys(USER, ['gemini']);
    expect(result.failed).toEqual(['gemini']);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/^\[keys\] decrypt-failed slot=gemini version=v9/);
    expectNoWrites();
  });

  it('vault not configured: every stored requested slot fails, one log line, no throw, no write', async () => {
    const docs = [builtinDoc(USER, 'gemini', GEMINI_KEY), builtinDoc(USER, 'groq', GROQ_KEY)];
    delete process.env.KEY_ENCRYPTION_KEYS;
    _resetKeyRingForTests();
    mockFind(docs);
    const result = await loadUserKeys(USER, ['gemini', 'groq']);
    expect(result).toEqual({ keys: {}, failed: ['gemini', 'groq'] });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[keys] vault-not-configured');
    expectNoWrites();
  });
});

describe('loadCustomProvider', () => {
  it('a malformed id returns null with no DB call', async () => {
    const { findOne } = mockFindOne(null);
    for (const bad of ['not-an-id', 'aaaaaaaaaaaa', '', 'custom:abc', '0123456789abcdef0123456z']) {
      expect(await loadCustomProvider(USER, bad)).toBeNull();
    }
    expect(findOne).not.toHaveBeenCalled();
    expect(db.connect).not.toHaveBeenCalled();
  });

  it("filters on _id, this user and kind custom, selects +ct +iv +tag, and returns the engine's shape", async () => {
    const doc = customDoc(USER, CUSTOM_KEY);
    const id = doc._id.toString();
    const { findOne, select } = mockFindOne(doc);
    const provider = await loadCustomProvider(USER, id);
    expect(findOne.mock.calls[0][0]).toEqual({ _id: id, userId: USER, kind: 'custom' });
    expect(select).toHaveBeenCalledWith('+ct +iv +tag');
    expect(provider).toEqual({
      id,
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: CUSTOM_KEY,
      modelId: 'meta-llama/llama-3-8b',
      enabled: true,
      headerType: 'bearer',
    });
    expectNoWrites();
  });

  it('an upper-case id decrypts and is queried lower-case', async () => {
    const doc = customDoc(USER, CUSTOM_KEY);
    const id = doc._id.toString();
    const { findOne } = mockFindOne(doc);
    const provider = await loadCustomProvider(USER, id.toUpperCase());
    expect(provider?.apiKey).toBe(CUSTOM_KEY);
    expect(provider?.id).toBe(id);
    expect((findOne.mock.calls[0][0] as unknown as { _id: string })._id).toBe(id);
  });

  it("another user's provider is not returned: the filter carries the caller's userId", async () => {
    const theirs = customDoc(OTHER, CUSTOM_KEY);
    // The real query would not match; the mock answers as the DB would.
    const { findOne } = mockFindOne(null);
    expect(await loadCustomProvider(USER, theirs._id.toString())).toBeNull();
    expect(findOne.mock.calls[0][0]).toMatchObject({ userId: USER });
    expect(findOne.mock.calls[0][0]).not.toMatchObject({ userId: OTHER });
  });

  it('a record whose slot does not match its id fails authentication and returns null', async () => {
    const doc = customDoc(USER, CUSTOM_KEY);
    const moved = { ...doc, _id: new mongoose.Types.ObjectId() };
    mockFindOne(moved);
    expect(await loadCustomProvider(USER, moved._id.toString())).toBeNull();
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/^\[keys\] decrypt-failed slot=custom:[0-9a-f]{24} version=v1/);
    expect(loggedText()).not.toContain(USER);
    expectNoWrites();
  });

  it('a tampered tag returns null, logs without the user id, writes nothing', async () => {
    const doc = customDoc(USER, CUSTOM_KEY);
    doc.tag = flipByte(doc.tag);
    mockFindOne(doc);
    expect(await loadCustomProvider(USER, doc._id.toString())).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const text = loggedText();
    for (const s of [USER, CUSTOM_KEY, doc.ct]) expect(text).not.toContain(s);
    expectNoWrites();
  });
});

describe('validateApiKey, last4 and encryptForSlot', () => {
  it('accepts 8 and 512 characters, refuses 7 and 513', () => {
    expect(validateApiKey('a'.repeat(7))).toMatch(/at least 8/);
    expect(validateApiKey('a'.repeat(8))).toBeNull();
    expect(validateApiKey('a'.repeat(512))).toBeNull();
    expect(validateApiKey('a'.repeat(513))).toMatch(/at most 512/);
  });

  it('refuses whitespace anywhere, an empty string and a non-string', () => {
    for (const k of ['abcd efgh', ' abcdefgh', 'abcdefgh\n', 'abcd\tefgh']) {
      expect(validateApiKey(k)).toMatch(/spaces or line breaks/);
    }
    expect(validateApiKey('')).not.toBeNull();
    expect(validateApiKey(undefined)).not.toBeNull();
    expect(validateApiKey(12345678)).not.toBeNull();
  });

  it('last4 is empty for an 11-character key and the last 4 for a 12-character key', () => {
    expect(last4Of('abcdefghijk')).toBe('');
    expect(last4Of('abcdefghijkl')).toBe('ijkl');
    expect(encryptForSlot(USER, 'groq', 'abcdefghijk').last4).toBe('');
    expect(encryptForSlot(USER, 'groq', 'abcdefghijkl').last4).toBe('ijkl');
  });

  it('encryptForSlot returns only ct, iv, tag, keyVersion and last4, and refuses an invalid key', () => {
    const fields = encryptForSlot(USER, 'groq', GROQ_KEY);
    expect(Object.keys(fields).sort()).toEqual(['ct', 'iv', 'keyVersion', 'last4', 'tag']);
    expect(fields.keyVersion).toBe('v1');
    expect(decryptSecret(fields, credentialAad(USER, 'groq'))).toBe(GROQ_KEY);
    expect(() => decryptSecret(fields, credentialAad(OTHER, 'groq'))).toThrow(KeyVaultDecryptError);
    expect(() => encryptForSlot(USER, 'groq', 'short')).toThrow(TypeError);
  });

  it('encryptForSlot refuses a slot the loaders would never build an AAD from', () => {
    const upperHex = `custom:${'ABCDEF0123456789ABCDEF01'}`;
    for (const bad of ['Gemini', 'toString', upperHex, 'custom:abc', 'custom:', '']) {
      expect(isKnownSlot(bad)).toBe(false);
      expect(() => encryptForSlot(USER, bad, GROQ_KEY)).toThrow('encryptForSlot: unknown slot');
    }
    for (const good of ['cohere', 'gemini', 'groq', 'mistral', upperHex.toLowerCase()]) {
      expect(isKnownSlot(good)).toBe(true);
    }
  });

  it('customSlot lower-cases the id', () => {
    expect(customSlot('ABCDEF0123456789ABCDEF01')).toBe('custom:abcdef0123456789abcdef01');
  });

  it('newCustomCredentialId gives a slot of custom:<that _id>', () => {
    const { _id, slot } = newCustomCredentialId();
    expect(slot).toBe(`custom:${_id.toString()}`);
  });
});

describe('markRejected', () => {
  it("sets only lastRejectedAt on this user's row", async () => {
    const update = vi
      .spyOn(ProviderCredential, 'updateOne')
      .mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);
    await markRejected(USER, 'gemini');
    expect(update).toHaveBeenCalledTimes(1);
    const [filter, change] = update.mock.calls[0] as unknown as [unknown, { $set: Record<string, unknown> }];
    expect(filter).toEqual({ userId: USER, slot: 'gemini' });
    expect(Object.keys(change)).toEqual(['$set']);
    expect(Object.keys(change.$set)).toEqual(['lastRejectedAt']);
    expect(change.$set.lastRejectedAt).toBeInstanceOf(Date);
  });

  it('never rejects; a failed write logs the slot and error class only', async () => {
    vi.spyOn(ProviderCredential, 'updateOne').mockRejectedValue(new Error(`boom ${USER}`) as never);
    await expect(markRejected(USER, 'gemini')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('[keys] mark-rejected-failed slot=gemini error=Error');
    expect(loggedText()).not.toContain(USER);
  });

  it('an unknown slot or a bad user id does nothing', async () => {
    await markRejected(USER, 'toString');
    await markRejected('', 'gemini');
    expect(writeSpies[0]).not.toHaveBeenCalled();
    expect(db.connect).not.toHaveBeenCalled();
  });
});
