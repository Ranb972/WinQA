import { describe, it, expect, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: null })),
}));

// stats imports @/lib/mongodb, which throws at module load if MONGODB_URI is
// unset. Set a dummy value, then import the route dynamically (after the env).
// The 401 branch returns before dbConnect(), so no connection is opened.
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/winqa-test';
}
const { GET } = await import('@/app/api/stats/route');

describe('GET /api/stats — auth guard (auth mocked, no DB)', () => {
  it('returns 401 when there is no authenticated user', async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });
});
