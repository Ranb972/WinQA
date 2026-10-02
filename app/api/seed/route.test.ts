import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authMock, dbConnectMock, makeModel } = vi.hoisted(() => {
  const makeModel = () => ({
    countDocuments: vi.fn(async () => 0),
    deleteMany: vi.fn(async () => ({ deletedCount: 0 })),
    insertMany: vi.fn(async (docs: unknown[]) => docs),
  });
  return {
    authMock: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: null })),
    dbConnectMock: vi.fn(async () => undefined),
    makeModel,
  };
});

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/mongodb', () => ({ default: dbConnectMock }));
vi.mock('@/models/TestCase', () => ({ default: makeModel() }));
vi.mock('@/models/PromptLibrary', () => ({ default: makeModel() }));
vi.mock('@/models/Insight', () => ({ default: makeModel() }));
vi.mock('@/models/BugReport', () => ({ default: makeModel() }));

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

beforeEach(() => {
  vi.clearAllMocks();
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

describe('PUT /api/seed — admin reseed survives unchanged', () => {
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

  it('reseeds the public set for an admin id from ADMIN_USER_IDS', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_admin' });
    const res = await routeModule.PUT();
    expect(res.status).toBe(200);
    expect(dbConnectMock).toHaveBeenCalledTimes(1);

    for (const m of Object.values(models)) {
      expect(m.deleteMany).toHaveBeenCalledWith({ is_public: true });
      const docs = m.insertMany.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(docs.every(d => d.user_id === 'user_admin' && d.is_public === true)).toBe(true);
    }

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.inserted).toEqual({
      bugs: seedBugReports.length,
      prompts: seedPrompts.length,
      testCases: seedTestCases.length,
      insights: seedInsights.length,
    });
  });
});
