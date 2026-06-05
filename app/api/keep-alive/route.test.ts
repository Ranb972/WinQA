import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// keep-alive/route.ts imports @/lib/mongodb, which THROWS at module load if
// MONGODB_URI is unset. Provide a dummy value so the module can be imported.
// The two guard branches under test (500, 401) return BEFORE dbConnect() runs,
// so no database connection is ever attempted — this is not a DB mock.
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/winqa-test';
}

// Dynamic import AFTER the env above is set (static ESM imports are hoisted
// and would execute the mongodb module first).
const { GET } = await import('@/app/api/keep-alive/route');

const url = 'http://localhost/api/keep-alive';

describe('GET /api/keep-alive — guard branches (no DB, no Clerk)', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it('returns 500 when CRON_SECRET is unset (misconfigured)', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Server misconfigured');
  });

  it('returns 401 when the Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
  });

  it('returns 401 when the Authorization Bearer token is wrong', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = await GET(
      new NextRequest(url, { headers: { Authorization: 'Bearer wrong-token' } }),
    );
    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
  });
});
