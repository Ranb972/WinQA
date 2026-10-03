import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { POST } from '@/app/api/custom-providers/route';
import ProviderCredential from '@/models/ProviderCredential';
import { resolveProviderAddress, ProviderUrlError } from '@/lib/security';
import {
  BASE_URL_HTTPS_ERROR,
  BASE_URL_PRIVATE_ERROR,
  BASE_URL_TOO_LONG_ERROR,
  UNREACHABLE_PROVIDER_ERROR,
} from '@/lib/friendly-errors';
import { DEFAULT_PROVIDER_TIMEOUT_MS } from '@/lib/llm/provider-timeout';
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
// Fake, test-only key.
const API_KEY = 'sk-test-FAKEKEY-0123456789abcdef';
const BASE_URL = 'https://api.example.com/v1';
// Test-only ring, generated per run.
const RING = `v1:${randomBytes(32).toString('base64')}`;

const VALID = {
  name: 'Example',
  baseUrl: BASE_URL,
  modelId: 'example-model-1',
  headerType: 'bearer',
  enabled: true,
  apiKey: API_KEY,
};

let savedRing: string | undefined;
let countSpy: MockInstance;
let createSpy: MockInstance;
let errorSpy: MockInstance<typeof console.error>;
const created: Array<Record<string, unknown>> = [];

function post(body: unknown, raw = false): NextRequest {
  return new NextRequest('http://localhost/api/custom-providers', {
    method: 'POST',
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/** Opts in to the count the cap check makes. */
function mockCount(n: number) {
  countSpy.mockImplementation((() => Promise.resolve(n)) as never);
}

/**
 * Opts in to the insert: a real document, validated by the schema (the
 * pre('validate') hook checks slot === `custom:<_id>`), with no database.
 */
function allowCreate() {
  createSpy.mockImplementation((async (doc: Record<string, unknown>) => {
    created.push(doc);
    const d = new ProviderCredential(doc);
    await d.validate();
    return d;
  }) as never);
}

/** Count and insert both allowed: the path of a request that reaches the database. */
function allowDb(count = 0) {
  mockCount(count);
  allowCreate();
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
  // Every static rejects unless a test opts in, so a stray DB call fails
  // instead of hanging on a connection that does not exist.
  const reject = (() => Promise.reject(new Error('DB call not expected'))) as never;
  countSpy = vi.spyOn(ProviderCredential, 'countDocuments').mockImplementation(
    reject
  ) as unknown as MockInstance;
  createSpy = vi.spyOn(ProviderCredential, 'create').mockImplementation(
    reject
  ) as unknown as MockInstance;
  for (const name of [
    'find',
    'findOne',
    'findOneAndUpdate',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
  ] as const) {
    vi.spyOn(ProviderCredential, name).mockImplementation(reject);
  }
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedRing === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
  else process.env.KEY_ENCRYPTION_KEYS = savedRing;
  _resetKeyRingForTests();
});

function expectNothingWritten() {
  expect(createSpy).not.toHaveBeenCalled();
}

describe('POST /api/custom-providers', () => {
  it('401 without a user, before anything else', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    const res = await POST(post(VALID));
    expect(res.status).toBe(401);
    expect(db.connect).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('400 for an array body, with no DB call', async () => {
    const res = await POST(post([VALID]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('The request body must be a JSON object');
    expect(db.connect).not.toHaveBeenCalled();
  });

  it('400 "Invalid custom provider" on a Mongoose ValidationError', async () => {
    mockCount(0);
    createSpy.mockImplementation((() =>
      Promise.reject(new mongoose.Error.ValidationError())) as never);
    const res = await POST(post(VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid custom provider');
  });

  it('headerType omitted: stored absent, public view says null', async () => {
    allowDb();
    const { headerType: _omit, ...rest } = VALID;
    void _omit;
    const res = await POST(post(rest));
    expect(res.status).toBe(201);
    expect(created[0]).not.toHaveProperty('headerType');
    expect((await res.json()).headerType).toBeNull();
  });

  it('400 on malformed JSON, with no DB call', async () => {
    const res = await POST(post('{"name":', true));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
    expect(db.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['a private literal', 'https://127.0.0.2/v1', BASE_URL_PRIVATE_ERROR],
    ['an http: URL', 'http://api.example.com/v1', BASE_URL_HTTPS_ERROR],
    ['an over-long URL', `https://api.example.com/${'a'.repeat(2048)}`, BASE_URL_TOO_LONG_ERROR],
  ])('400 with the guard text for %s, before DNS and the database', async (_label, baseUrl, text) => {
    const res = await POST(post({ ...VALID, baseUrl }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(text);
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expect(db.connect).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('400 with the unreachable text when the DNS vetting refuses the host', async () => {
    vi.mocked(resolveProviderAddress).mockRejectedValueOnce(
      new ProviderUrlError(UNREACHABLE_PROVIDER_ERROR)
    );
    const res = await POST(post(VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(UNREACHABLE_PROVIDER_ERROR);
    expect(db.connect).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('400 with the unreachable text when the host does not resolve', async () => {
    vi.mocked(resolveProviderAddress).mockRejectedValueOnce(
      Object.assign(new Error('getaddrinfo ENOTFOUND api.example.com'), { code: 'ENOTFOUND' })
    );
    const res = await POST(post(VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(UNREACHABLE_PROVIDER_ERROR);
    expectNothingWritten();
  });

  it('vets the normalized URL with the shared provider budget', async () => {
    allowDb();
    await POST(post({ ...VALID, baseUrl: 'https://API.Example.com/v1///' }));
    expect(resolveProviderAddress).toHaveBeenCalledWith(BASE_URL, DEFAULT_PROVIDER_TIMEOUT_MS);
    expect(created[0].baseUrl).toBe(BASE_URL);
  });

  it.each([
    ['an empty name', { name: '   ' }, 'Name must be 1 to 60 characters'],
    ['a 61-character name', { name: 'n'.repeat(61) }, 'Name must be 1 to 60 characters'],
    ['a missing modelId', { modelId: undefined }, 'Model ID must be 1 to 200 characters'],
    ['a 201-character modelId', { modelId: 'm'.repeat(201) }, 'Model ID must be 1 to 200 characters'],
    ['an unknown headerType', { headerType: 'basic' }, 'Header type must be "bearer" or "x-api-key"'],
    ['a missing enabled', { enabled: undefined }, 'enabled must be true or false'],
    ['a string enabled', { enabled: 'true' }, 'enabled must be true or false'],
    ['a missing apiKey', { apiKey: undefined }, 'Enter an API key.'],
    ['a short apiKey', { apiKey: 'short' }, 'The API key must be at least 8 characters.'],
  ])('400 for %s, before DNS and the database', async (_label, patch, text) => {
    const res = await POST(post({ ...VALID, ...patch }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(text);
    expect(resolveProviderAddress).not.toHaveBeenCalled();
    expect(db.connect).not.toHaveBeenCalled();
  });

  it('400 for a 7th provider, and nothing is inserted', async () => {
    allowDb(6);
    const res = await POST(post(VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('You can save up to 6 custom providers');
    expect(countSpy).toHaveBeenCalledWith({ userId: USER, kind: 'custom' });
    expectNothingWritten();
  });

  it('201: inserts one document with slot custom:<_id> and returns the public view only', async () => {
    allowDb(5);
    const res = await POST(post({ ...VALID, name: '  Example  ', enabled: false }));
    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledTimes(1);

    const doc = created[0];
    const id = String(doc._id);
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(doc.slot).toBe(`custom:${id}`);
    expect(doc).toMatchObject({
      userId: USER,
      kind: 'custom',
      name: 'Example',
      baseUrl: BASE_URL,
      modelId: 'example-model-1',
      headerType: 'bearer',
      enabled: false,
      keyVersion: 'v1',
      last4: 'cdef',
    });
    expect(doc).not.toHaveProperty('provider');
    expect(doc).not.toHaveProperty('apiKey');
    // The stored record decrypts under this user's AAD for this slot.
    const plain = decryptSecret(
      {
        ct: doc.ct as string,
        iv: doc.iv as string,
        tag: doc.tag as string,
        keyVersion: doc.keyVersion as string,
      },
      credentialAad(USER, `custom:${id}`)
    );
    expect(plain).toBe(API_KEY);

    const text = await res.text();
    const json = JSON.parse(text);
    expect(json).toMatchObject({
      id,
      name: 'Example',
      baseUrl: BASE_URL,
      modelId: 'example-model-1',
      headerType: 'bearer',
      enabled: false,
      last4: 'cdef',
      hasKey: true,
    });
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain(doc.ct as string);
    expect(text).not.toContain(doc.iv as string);
    expect(text).not.toContain(doc.tag as string);
    expect(json).not.toHaveProperty('userId');
    expect(json).not.toHaveProperty('slot');
  });

  it('500 "Key storage is not configured" when the ring is missing; nothing inserted', async () => {
    allowDb();
    delete process.env.KEY_ENCRYPTION_KEYS;
    _resetKeyRingForTests();
    const res = await POST(post(VALID));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Key storage is not configured');
    expectNothingWritten();
  });

  it('logs no user id, key or ciphertext on a database failure', async () => {
    mockCount(0);
    createSpy.mockImplementation((async (doc: Record<string, unknown>) => {
      created.push(doc);
      throw new Error(`write failed for ${USER}`);
    }) as never);
    const res = await POST(post(VALID));
    expect(res.status).toBe(500);
    const logged = errorSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('[custom-providers] create failed');
    expect(logged).not.toContain(USER);
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain(created[0].ct as string);
  });
});
