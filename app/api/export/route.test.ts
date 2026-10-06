import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';
import ProviderCredential from '@/models/ProviderCredential';

// No database: auth and dbConnect are mocked, and the model statics are spied
// on below. Creating a Mongoose model opens no connection.
const { authMock, dbConnectMock } = vi.hoisted(() => ({
  authMock: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: null })),
  dbConnectMock: vi.fn(async (): Promise<unknown> => undefined),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/mongodb', () => ({ default: dbConnectMock }));

import { GET } from './route';

const USER = 'user_2abcDEF123';

const MODELS = { bugs: BugReport, prompts: PromptLibrary, testCases: TestCase, insights: Insight };
type Collection = keyof typeof MODELS;
const COLLECTIONS = Object.keys(MODELS) as Collection[];

type Spy = ReturnType<typeof vi.fn>;
const findSpies = {} as Record<Collection, Spy>;
let credentialFind: Spy;

beforeEach(() => {
  authMock.mockReset();
  authMock.mockResolvedValue({ userId: USER });
  dbConnectMock.mockReset();
  for (const name of COLLECTIONS) {
    const row = {
      _id: { toString: () => `${name}-id` },
      user_id: USER,
      __v: 0,
      title: `${name} row`,
      is_public: false,
      created_at: '2026-09-01T10:00:00.000Z',
    };
    findSpies[name] = vi
      .spyOn(MODELS[name], 'find')
      .mockImplementation((() => ({ lean: () => Promise.resolve([row]) })) as never) as unknown as Spy;
  }
  credentialFind = vi
    .spyOn(ProviderCredential, 'find')
    .mockImplementation((() => ({ lean: () => Promise.resolve([]) })) as never) as unknown as Spy;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/export', () => {
  it('lists only the caller\'s private rows: each filter is { user_id, is_public: { $ne: true } }', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    for (const name of COLLECTIONS) {
      expect(findSpies[name]).toHaveBeenCalledTimes(1);
      expect(findSpies[name].mock.calls[0][0]).toEqual({ user_id: USER, is_public: { $ne: true } });
    }
  });

  it('never reads saved credentials and exports no key material', async () => {
    const res = await GET();
    const body = await res.json();
    expect(credentialFind).not.toHaveBeenCalled();
    expect(body.version).toBe('1.0');
    for (const name of COLLECTIONS) {
      expect(body.data[name]).toHaveLength(1);
      for (const doc of body.data[name] as Array<Record<string, unknown>>) {
        for (const key of ['ct', 'iv', 'tag', 'apiKey', 'user_id', '_id', '__v']) {
          expect(doc).not.toHaveProperty(key);
        }
        expect(doc.id).toBe(`${name}-id`);
      }
    }
  });

  it('answers 401 without a signed-in user and opens no DB connection', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(dbConnectMock).not.toHaveBeenCalled();
  });
});
