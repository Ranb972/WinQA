import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every write and every transaction step is appended to `h.calls` in order. A
// write logs `:start` when called and `:end` when it settles, so two writes
// that overlap (Promise.all) show up as two starts in a row. dbConnect resolves
// to { connection: <fake> }; the fake's transaction(fn) calls fn(SESSION).
const { authMock, dbConnectMock, makeModel, h } = vi.hoisted(() => {
  const h = {
    calls: [] as string[],
    inTransaction: false,
    writes: [] as Array<{ label: string; session: unknown; inside: boolean }>,
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 1));
  const record = (label: string, options: unknown) => {
    h.calls.push(`${label}:start`);
    h.writes.push({
      label,
      session: (options as { session?: unknown } | undefined)?.session,
      inside: h.inTransaction,
    });
  };
  const makeModel = (name: string) => ({
    countDocuments: vi.fn(async () => 0),
    deleteMany: vi.fn(async (_filter: unknown, options?: unknown) => {
      record(`${name}.deleteMany`, options);
      await settle();
      h.calls.push(`${name}.deleteMany:end`);
      return { deletedCount: 2 };
    }),
    insertMany: vi.fn(async (docs: unknown[], options?: unknown) => {
      record(`${name}.insertMany`, options);
      await settle();
      h.calls.push(`${name}.insertMany:end`);
      return docs;
    }),
  });
  return {
    authMock: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: null })),
    dbConnectMock: vi.fn(async (): Promise<unknown> => undefined),
    makeModel,
    h,
  };
});

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/mongodb', () => ({ default: dbConnectMock }));
vi.mock('@/models/TestCase', () => ({ default: makeModel('TestCase') }));
vi.mock('@/models/PromptLibrary', () => ({ default: makeModel('PromptLibrary') }));
vi.mock('@/models/Insight', () => ({ default: makeModel('Insight') }));
vi.mock('@/models/BugReport', () => ({ default: makeModel('BugReport') }));

// The route parses ADMIN_USER_IDS once at module load, so set it first and
// import the route dynamically (static imports are hoisted above this line).
process.env.ADMIN_USER_IDS = 'user_admin';
const routeModule = await import('@/app/api/seed/route');
const { default: TestCase } = await import('@/models/TestCase');
const { default: PromptLibrary } = await import('@/models/PromptLibrary');
const { default: Insight } = await import('@/models/Insight');
const { default: BugReport } = await import('@/models/BugReport');
const { seedTestCases, seedPrompts, seedInsights, seedBugReports } = await import(
  '@/lib/seedData'
);

type MockModel = ReturnType<typeof makeModel>;
const models = { TestCase, PromptLibrary, Insight, BugReport } as unknown as Record<
  string,
  MockModel
>;

const SESSION = { fake: 'session' };
type FakeConn = {
  db: { admin(): { command: ReturnType<typeof vi.fn> } };
  transaction: ReturnType<typeof vi.fn>;
  rejectedWith: unknown;
};
let conn: FakeConn;

function makeConn(supported: boolean): FakeConn {
  const command = vi.fn(async () => (supported ? { setName: 'rs0' } : { isWritablePrimary: true }));
  const fake: FakeConn = {
    db: { admin: () => ({ command }) },
    rejectedWith: undefined,
    transaction: vi.fn(async (fn: (s: unknown) => Promise<unknown>, opts: unknown) => {
      void opts;
      h.calls.push('txn:start');
      h.inTransaction = true;
      try {
        const result = await fn(SESSION);
        h.calls.push('txn:commit');
        return result;
      } catch (err) {
        h.calls.push('txn:abort');
        fake.rejectedWith = err;
        throw err;
      } finally {
        h.inTransaction = false;
      }
    }),
  };
  return fake;
}

// The order the route writes the four collections in, for deletes and inserts.
const ORDER = ['BugReport', 'PromptLibrary', 'TestCase', 'Insight'];

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.writes.length = 0;
  h.inTransaction = false;
  conn = makeConn(true);
  dbConnectMock.mockImplementation(async () => ({ connection: conn }));
});

describe('/api/seed route module', () => {
  it('exports no POST handler (per-user public seeding is gone)', () => {
    expect((routeModule as Record<string, unknown>).POST).toBeUndefined();
  });

  it('exports exactly the GET and admin PUT handlers', () => {
    const methods = Object.keys(routeModule)
      .filter(k => /^[A-Z]+$/.test(k))
      .sort();
    expect(methods).toEqual(['GET', 'PUT']);
  });
});

describe('PUT /api/seed — admin reseed', () => {
  it('returns 401 without a signed-in user and opens no DB connection', async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const res = await routeModule.PUT();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(dbConnectMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a signed-in non-admin and opens no DB connection', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_someone' });
    const res = await routeModule.PUT();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden: admin access required' });
    expect(dbConnectMock).not.toHaveBeenCalled();
  });

  it('reseeds the public set for an admin id from ADMIN_USER_IDS, owned by the system user', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_admin' });
    const res = await routeModule.PUT();
    expect(res.status).toBe(200);
    expect(dbConnectMock).toHaveBeenCalledTimes(1);

    for (const m of Object.values(models)) {
      expect(m.deleteMany).toHaveBeenCalledWith({ is_public: true }, { session: SESSION });
      const docs = m.insertMany.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(docs.length).toBeGreaterThan(0);
      expect(docs.every(d => d.user_id === 'system' && d.is_public === true)).toBe(true);
    }

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toEqual({ bugs: 2, prompts: 2, testCases: 2, insights: 2 });
    expect(body.inserted).toEqual({
      bugs: seedBugReports.length,
      prompts: seedPrompts.length,
      testCases: seedTestCases.length,
      insights: seedInsights.length,
    });
  });

  it('runs four deletes then four inserts in one transaction, each with the session, one at a time', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_admin' });
    const res = await routeModule.PUT();
    expect(res.status).toBe(200);
    expect(conn.transaction).toHaveBeenCalledTimes(1);
    expect(conn.transaction.mock.calls[0][1]).toEqual({ maxCommitTimeMS: 10_000 });
    expect(h.calls).toEqual([
      'txn:start',
      ...ORDER.flatMap(n => [`${n}.deleteMany:start`, `${n}.deleteMany:end`]),
      ...ORDER.flatMap(n => [`${n}.insertMany:start`, `${n}.insertMany:end`]),
      'txn:commit',
    ]);
    expect(h.writes).toHaveLength(8);
    for (const write of h.writes) {
      expect(write.session).toBe(SESSION);
      expect(write.inside).toBe(true);
    }
  });

  it('an insert that rejects answers 500 and the runner aborted', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_admin' });
    const failure = new Error('insert failed');
    models.TestCase.insertMany.mockImplementationOnce(async () => {
      throw failure;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await routeModule.PUT();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to reseed data' });
    expect(conn.rejectedWith).toBe(failure);
    expect(h.calls.at(-1)).toBe('txn:abort');
    expect(models.Insight.insertMany).not.toHaveBeenCalled();
  });

  it('answers 503 without transactions and deletes nothing', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_admin' });
    conn = makeConn(false);
    const res = await routeModule.PUT();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'Reseed is unavailable right now: the database does not support transactions. Nothing was changed.',
    });
    expect(conn.transaction).not.toHaveBeenCalled();
    for (const m of Object.values(models)) {
      expect(m.deleteMany).not.toHaveBeenCalled();
      expect(m.insertMany).not.toHaveBeenCalled();
    }
  });
});
