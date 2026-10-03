import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PATCH, DELETE } from '@/app/api/custom-providers/[id]/route';
import ProviderCredential from '@/models/ProviderCredential';
import { resolveProviderAddress, ProviderUrlError } from '@/lib/security';
import {
  BASE_URL_HTTPS_ERROR,
  BASE_URL_PRIVATE_ERROR,
  UNREACHABLE_PROVIDER_ERROR,
} from '@/lib/friendly-errors';
import { DEFAULT_PROVIDER_TIMEOUT_MS } from '@/lib/llm/provider-timeout';
import { _resetKeyRingForTests, credentialAad, decryptSecret } from '@/lib/server/key-vault';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_2aliceABC123' })),
}));

const db = vi.hoisted(() => ({ connect: vi.fn(async () => undefined) }));
vi.mock('@/lib/mongodb', () => ({ default: db.connect }));

vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return { ...actual, resolveProviderAddress: vi.fn() };
});

const USER = 'user_2aliceABC123';
const ID = '65f0a1b2c3d4e5f6a7b8c9d0';
// Fake, test-only keys.
const NEW_KEY = 'sk-test-NEWKEY-0123456789abcdef';
const OLD_CT = 'b2xkLWNpcGhlcnRleHQtZmFrZQ==';
const NEW_URL = 'https://api.other-example.com/v1';
const RING = `v1:${randomBytes(32).toString('base64')}`;
const D20_TEXT = 'Enter the key again when you change the base URL';

let savedRing: string | undefined;
let updateSpy: MockInstance;
let deleteSpy: MockInstance;
let lastSet: Record<string, unknown> | undefined;
let lastUnset: Record<string, unknown> | undefined;

/** Opts in to the update: applies $set/$unset to the stored document when the filter is this user's row. */
function allowUpdate() {
  updateSpy.mockImplementation(((
    filter: Record<string, unknown>,
    update: { $set: Record<string, unknown>; $unset?: Record<string, unknown> }
  ) => {
    lastSet = update.$set;
    lastUnset = update.$unset;
    const doc = storedDoc();
    const mine = filter._id === doc._id && filter.userId === doc.userId && filter.kind === 'custom';
    if (!mine) return Promise.resolve(null);
    const next: Record<string, unknown> = { ...doc, ...update.$set };
    for (const key of Object.keys(update.$unset ?? {})) delete next[key];
    return Promise.resolve(next);
  }) as never);
}

/** Opts in to the delete. */
function allowDelete(deletedCount = 1) {
  deleteSpy.mockImplementation((() =>
    Promise.resolve({ acknowledged: true, deletedCount })) as never);
}

/** The stored document the mock "updates": it carries ciphertext, which must never leak. */
function storedDoc(): Record<string, unknown> {
  return {
    _id: ID,
    userId: USER,
    slot: `custom:${ID}`,
    kind: 'custom',
    name: 'Example',
    baseUrl: 'https://api.example.com/v1',
    modelId: 'example-model-1',
    headerType: 'bearer',
    enabled: true,
    ct: OLD_CT,
    iv: 'aXYtZmFrZQ==',
    tag: 'dGFnLWZha2U=',
    keyVersion: 'v1',
    last4: 'wxyz',
    lastTestedAt: new Date('2026-10-01T00:00:00Z'),
    lastTestOk: true,
    lastRejectedAt: new Date('2026-10-02T00:00:00Z'),
    updatedAt: new Date('2026-10-02T00:00:00Z'),
  };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patch(body: unknown, raw = false): NextRequest {
  return new NextRequest(`http://localhost/api/custom-providers/${ID}`, {
    method: 'PATCH',
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function del(): NextRequest {
  return new NextRequest(`http://localhost/api/custom-providers/${ID}`, { method: 'DELETE' });
}

beforeEach(() => {
  savedRing = process.env.KEY_ENCRYPTION_KEYS;
  process.env.KEY_ENCRYPTION_KEYS = RING;
  _resetKeyRingForTests();
  db.connect.mockClear();
  vi.mocked(auth).mockClear();
  vi.mocked(resolveProviderAddress).mockReset();
  vi.mocked(resolveProviderAddress).mockResolvedValue({
    hostname: 'api.other-example.com',
    address: '93.184.216.34',
    family: 4,
  });
  lastSet = undefined;
  lastUnset = undefined;
  // Every static rejects unless a test opts in (allowUpdate / allowDelete), so a
  // stray DB call fails instead of hanging.
  const reject = (() => Promise.reject(new Error('DB call not expected'))) as never;
  updateSpy = vi
    .spyOn(ProviderCredential, 'findOneAndUpdate')
    .mockImplementation(reject) as unknown as MockInstance;
  deleteSpy = vi
    .spyOn(ProviderCredential, 'deleteOne')
    .mockImplementation(reject) as unknown as MockInstance;
  for (const name of [
    'countDocuments',
    'create',
    'find',
    'findOne',
    'updateOne',
    'updateMany',
    'deleteMany',
  ] as const) {
    vi.spyOn(ProviderCredential, name).mockImplementation(reject);
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedRing === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
  else process.env.KEY_ENCRYPTION_KEYS = savedRing;
  _resetKeyRingForTests();
});

function expectNoDbCall() {
  expect(db.connect).not.toHaveBeenCalled();
  expect(updateSpy).not.toHaveBeenCalled();
  expect(deleteSpy).not.toHaveBeenCalled();
}

describe('PATCH /api/custom-providers/[id]', () => {
  it('401 without a user', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    const res = await PATCH(patch({ enabled: false }), ctx(ID));
    expect(res.status).toBe(401);
    expectNoDbCall();
  });

  it.each([['abc'], ['abcdefghijkl'], [`${ID}0`], ['zzf0a1b2c3d4e5f6a7b8c9d0']])(
    '404 with no DB call for the malformed id %s',
    async (id) => {
      const res = await PATCH(patch({ enabled: false }), ctx(id));
      expect(res.status).toBe(404);
      expectNoDbCall();
    }
  );

  it('lower-cases an upper-case hex id', async () => {
    allowUpdate();
    const res = await PATCH(patch({ enabled: false }), ctx(ID.toUpperCase()));
    expect(res.status).toBe(200);
    expect(updateSpy.mock.calls[0][0]).toEqual({ _id: ID, userId: USER, kind: 'custom' });
  });

  it('400 on malformed JSON, with no DB call', async () => {
    const res = await PATCH(patch('{"enabled":', true), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
    expectNoDbCall();
  });

  it('D20: { baseUrl } without apiKey is a 400, with no DNS and no DB call', async () => {
    const res = await PATCH(patch({ baseUrl: NEW_URL }), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(D20_TEXT);
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expectNoDbCall();
  });

  it('D20: { baseUrl: null } without apiKey is the same 400', async () => {
    const res = await PATCH(patch({ baseUrl: null }), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(D20_TEXT);
    expectNoDbCall();
  });

  it('400 for an array body, with no DB call', async () => {
    const res = await PATCH(patch([{ enabled: false }]), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('The request body must be a JSON object');
    expectNoDbCall();
  });

  it('a new baseUrl without headerType $unsets the stored headerType', async () => {
    allowUpdate();
    const res = await PATCH(patch({ baseUrl: NEW_URL, apiKey: NEW_KEY }), ctx(ID));
    expect(res.status).toBe(200);
    expect(lastUnset).toEqual({ headerType: 1 });
    expect(lastSet).not.toHaveProperty('headerType');
    expect((await res.json()).headerType).toBeNull();
  });

  it('a new baseUrl with a headerType $sets it and unsets nothing', async () => {
    allowUpdate();
    const res = await PATCH(
      patch({ baseUrl: NEW_URL, apiKey: NEW_KEY, headerType: 'x-api-key' }),
      ctx(ID)
    );
    expect(res.status).toBe(200);
    expect(lastUnset).toBeUndefined();
    expect(lastSet!.headerType).toBe('x-api-key');
  });

  it('D20 holds even when other fields come with the baseUrl', async () => {
    const res = await PATCH(patch({ baseUrl: NEW_URL, name: 'Renamed', enabled: true }), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(D20_TEXT);
    expectNoDbCall();
  });

  it.each([
    ['a private literal', 'https://127.0.0.2/v1', BASE_URL_PRIVATE_ERROR],
    ['an http: URL', 'http://api.other-example.com/v1', BASE_URL_HTTPS_ERROR],
  ])('400 with the guard text for %s, nothing written', async (_label, baseUrl, text) => {
    const res = await PATCH(patch({ baseUrl, apiKey: NEW_KEY }), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(text);
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expectNoDbCall();
  });

  it('400 with the unreachable text when the DNS vetting refuses the host', async () => {
    vi.mocked(resolveProviderAddress).mockRejectedValueOnce(
      new ProviderUrlError(UNREACHABLE_PROVIDER_ERROR)
    );
    const res = await PATCH(patch({ baseUrl: NEW_URL, apiKey: NEW_KEY }), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(UNREACHABLE_PROVIDER_ERROR);
    expectNoDbCall();
  });

  it('{ baseUrl, apiKey } vets the URL, re-encrypts under this slot and resets the test fields', async () => {
    allowUpdate();
    const res = await PATCH(patch({ baseUrl: `${NEW_URL}/`, apiKey: NEW_KEY }), ctx(ID));
    expect(res.status).toBe(200);
    expect(resolveProviderAddress).toHaveBeenCalledWith(NEW_URL, DEFAULT_PROVIDER_TIMEOUT_MS);

    const set = lastSet!;
    expect(Object.keys(set).sort()).toEqual(
      [
        'baseUrl',
        'ct',
        'iv',
        'tag',
        'keyVersion',
        'last4',
        'lastTestedAt',
        'lastTestOk',
        'lastRejectedAt',
      ].sort()
    );
    expect(set.baseUrl).toBe(NEW_URL);
    expect(set.lastTestedAt).toBeNull();
    expect(set.lastTestOk).toBeNull();
    expect(set.lastRejectedAt).toBeNull();
    expect(set.last4).toBe('cdef');
    expect(set.ct).not.toBe(OLD_CT);
    const plain = decryptSecret(
      {
        ct: set.ct as string,
        iv: set.iv as string,
        tag: set.tag as string,
        keyVersion: set.keyVersion as string,
      },
      credentialAad(USER, `custom:${ID}`)
    );
    expect(plain).toBe(NEW_KEY);
    expect(updateSpy.mock.calls[0][2]).toMatchObject({ runValidators: true, returnDocument: 'after' });

    const text = await res.text();
    expect(text).not.toContain(NEW_KEY);
    expect(text).not.toContain(set.ct as string);
    expect(text).not.toContain(OLD_CT);
    expect(JSON.parse(text)).toMatchObject({ id: ID, baseUrl: NEW_URL, last4: 'cdef', lastTestOk: null });
  });

  it('{ enabled: false } $sets only enabled', async () => {
    allowUpdate();
    const res = await PATCH(patch({ enabled: false }), ctx(ID));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][1]).toEqual({ $set: { enabled: false } });
    expect((await res.json()).enabled).toBe(false);
  });

  it('never $sets userId, slot, kind or provider, even when the body sends them', async () => {
    allowUpdate();
    const res = await PATCH(
      patch({
        name: '  Renamed  ',
        userId: 'user_2bobXYZ789',
        slot: 'custom:000000000000000000000000',
        kind: 'builtin',
        provider: 'gemini',
        ct: 'injected',
      }),
      ctx(ID)
    );
    expect(res.status).toBe(200);
    expect(lastSet).toEqual({ name: 'Renamed' });
  });

  it('400 "Nothing to update" for a body with no known field, with no DB call', async () => {
    const res = await PATCH(patch({ slot: 'custom:x' }), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Nothing to update');
    expectNoDbCall();
  });

  it.each([
    [{ name: '' }, 'Name must be 1 to 60 characters'],
    [{ modelId: 'm'.repeat(201) }, 'Model ID must be 1 to 200 characters'],
    [{ headerType: 'basic' }, 'Header type must be "bearer" or "x-api-key"'],
    [{ enabled: 'no' }, 'enabled must be true or false'],
    [{ apiKey: 'has space key' }, 'The API key must not contain spaces or line breaks.'],
  ])('400 for %j, with no DB call', async (body, text) => {
    const res = await PATCH(patch(body), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(text);
    expectNoDbCall();
  });

  it("another user's id is a 404: the filter carries userId and kind", async () => {
    allowUpdate();
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user_2bobXYZ789' } as never);
    const res = await PATCH(patch({ enabled: false }), ctx(ID));
    expect(res.status).toBe(404);
    expect(updateSpy.mock.calls[0][0]).toEqual({ _id: ID, userId: 'user_2bobXYZ789', kind: 'custom' });
  });

  it('{ apiKey } alone re-keys the same host without DNS', async () => {
    allowUpdate();
    const res = await PATCH(patch({ apiKey: NEW_KEY }), ctx(ID));
    expect(res.status).toBe(200);
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expect(lastSet).not.toHaveProperty('baseUrl');
    expect(await res.text()).not.toContain(NEW_KEY);
  });

  it('500 "Key storage is not configured" when a new key cannot be encrypted; nothing written', async () => {
    delete process.env.KEY_ENCRYPTION_KEYS;
    _resetKeyRingForTests();
    const res = await PATCH(patch({ apiKey: NEW_KEY }), ctx(ID));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Key storage is not configured');
    expectNoDbCall();
  });

  it('a response never carries the stored ciphertext', async () => {
    allowUpdate();
    const res = await PATCH(patch({ name: 'Renamed' }), ctx(ID));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(OLD_CT);
    expect(text).not.toContain('keyVersion');
    expect(text).not.toContain(USER);
  });
});

describe('DELETE /api/custom-providers/[id]', () => {
  it('401 without a user', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    const res = await DELETE(del(), ctx(ID));
    expect(res.status).toBe(401);
    expectNoDbCall();
  });

  it('scopes the delete on { _id, userId, kind } and reports it', async () => {
    allowDelete();
    const res = await DELETE(del(), ctx(ID.toUpperCase()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(deleteSpy).toHaveBeenCalledWith({ _id: ID, userId: USER, kind: 'custom' });
  });

  it('{ deleted: false } when nothing matched', async () => {
    allowDelete(0);
    const res = await DELETE(del(), ctx(ID));
    expect(await res.json()).toEqual({ deleted: false });
  });

  it.each([['abc'], ['abcdefghijkl']])('404 with no DB call for the malformed id %s', async (id) => {
    const res = await DELETE(del(), ctx(id));
    expect(res.status).toBe(404);
    expectNoDbCall();
  });
});
