import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST, maxDuration } from '@/app/api/webhooks/clerk/route';
import { purgeUserData } from '@/lib/server/purge-user';

// The real verifyWebhook (@clerk/nextjs/webhooks -> standardwebhooks) checks
// every request: the tests sign them the way Svix does. Only the purge is
// mocked (no database); isClerkUserId stays real.
vi.mock('@/lib/server/purge-user', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/purge-user')>();
  return { ...actual, purgeUserData: vi.fn() };
});

// Test-only signing secret, never a real one: 'whsec_' + base64 of fixed bytes.
const TEST_SECRET = `whsec_${Buffer.from('winqa-test-only-signing-key-0001').toString('base64')}`;
const USER = 'user_2TestOnly0123456789';

const COUNTS = {
  dailyusages: { deleted: 3, reassigned: 0 },
  leaderboards: { deleted: 2, reassigned: 0 },
  battles: { deleted: 5, reassigned: 0 },
  userfavorites: { deleted: 0, reassigned: 0 },
  bugreports: { deleted: 1, reassigned: 1 },
  promptlibraries: { deleted: 0, reassigned: 0 },
  testcases: { deleted: 0, reassigned: 0 },
  insights: { deleted: 0, reassigned: 0 },
};

// Svix's scheme: base64 HMAC-SHA256 of `${id}.${timestamp}.${body}`, keyed with
// the base64-decoded part of the secret after 'whsec_'.
function sign(id: string, ts: number, body: string, secret = TEST_SECRET): string {
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const mac = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return `v1,${mac}`;
}

interface Delivery {
  body: string;
  headers: Record<string, string>;
}

function delivery(event: unknown, opts: { id?: string; ts?: number } = {}): Delivery {
  const id = opts.id ?? 'msg_2TestDelivery0001';
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const body = JSON.stringify(event);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sign(id, ts, body),
    },
  };
}

function request({ body, headers }: Delivery): NextRequest {
  return new NextRequest('https://www.winqa.ai/api/webhooks/clerk', { method: 'POST', body, headers });
}

const userDeleted = (data: Record<string, unknown> = { id: USER, object: 'user', deleted: true }) => ({
  type: 'user.deleted',
  object: 'event',
  data,
});

const purge = vi.mocked(purgeUserData);
type ConsoleSpy = MockInstance<(...args: unknown[]) => void>;
let logSpy: ConsoleSpy;
let errorSpy: ConsoleSpy;

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = TEST_SECRET;
  purge.mockReset();
  purge.mockResolvedValue(COUNTS);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as ConsoleSpy;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as ConsoleSpy;
});

afterEach(() => {
  // Whatever the test did, the user id must not have reached a log line.
  for (const spy of [logSpy, errorSpy]) {
    for (const args of spy.mock.calls) expect(JSON.stringify(args)).not.toContain(USER);
  }
  delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  vi.restoreAllMocks();
});

describe('POST /api/webhooks/clerk', () => {
  it('declares a 30 s budget', () => {
    expect(maxDuration).toBe(30);
  });

  it('a valid user.deleted purges that user once and answers 200 with the counts', async () => {
    const res = await POST(request(delivery(userDeleted())));
    expect(res.status).toBe(200);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(purge).toHaveBeenCalledWith(USER);
    expect(await res.json()).toEqual({ received: true, counts: COUNTS });
  });

  it('logs the svix id and the counts, never the user id', async () => {
    await POST(request(delivery(userDeleted(), { id: 'msg_2LogCheck0001' })));
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0][0]);
    expect(line).toBe(
      '[account] user.deleted svix=msg_2LogCheck0001 dailyusages=3 leaderboards=2 battles=5 ' +
        'userfavorites=0 bugreports=1 bugreports_reassigned=1 promptlibraries=0 testcases=0 insights=0'
    );
    expect(line).not.toContain(USER);
  });

  it('a tampered body answers 400 and purges nothing', async () => {
    const d = delivery(userDeleted());
    const tampered = { ...d, body: d.body.replace(USER, 'user_2SomeoneElse0000000') };
    const res = await POST(request(tampered));
    expect(res.status).toBe(400);
    expect(purge).not.toHaveBeenCalled();
  });

  it('a signature made with another secret answers 400', async () => {
    const d = delivery(userDeleted());
    const other = `whsec_${Buffer.from('a-different-test-only-key-000002').toString('base64')}`;
    d.headers['svix-signature'] = sign(d.headers['svix-id'], Number(d.headers['svix-timestamp']), d.body, other);
    const res = await POST(request(d));
    expect(res.status).toBe(400);
    expect(purge).not.toHaveBeenCalled();
  });

  it('a request without the svix signature header answers 400', async () => {
    const d = delivery(userDeleted());
    delete d.headers['svix-signature'];
    const res = await POST(request(d));
    expect(res.status).toBe(400);
    expect(purge).not.toHaveBeenCalled();
  });

  it.each([
    ['10 minutes old', -600],
    ['10 minutes ahead', 600],
  ])('a correctly signed timestamp %s answers 400', async (_label, offset) => {
    const ts = Math.floor(Date.now() / 1000) + offset;
    const res = await POST(request(delivery(userDeleted(), { ts })));
    expect(res.status).toBe(400);
    expect(purge).not.toHaveBeenCalled();
  });

  it('a valid user.created answers 200 and purges nothing', async () => {
    const event = { type: 'user.created', object: 'event', data: { id: USER, object: 'user' } };
    const res = await POST(request(delivery(event)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, ignored: 'user.created' });
    expect(purge).not.toHaveBeenCalled();
  });

  it.each([
    ['no id', { deleted: true }],
    ['the system owner as id', { id: 'system', deleted: true }],
    ['a bare prefix as id', { id: 'user_', deleted: true }],
  ])('a valid user.deleted with %s answers 400 and purges nothing', async (_label, data) => {
    const res = await POST(request(delivery(userDeleted(data))));
    expect(res.status).toBe(400);
    expect(purge).not.toHaveBeenCalled();
  });

  it('the test-only secret has the format the route requires', () => {
    expect(TEST_SECRET).toMatch(/^whsec_[A-Za-z0-9+/]{32,}={0,2}$/);
  });

  it('with the secret unset it answers 500 (fail closed), not 400, and purges nothing', async () => {
    const d = delivery(userDeleted());
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const res = await POST(request(d));
    expect(res.status).toBe(500);
    expect(purge).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CLERK_WEBHOOK_SIGNING_SECRET is not set'));
  });

  it.each([
    ['whitespace only', '   '],
    ['a bare whsec_ prefix (empty HMAC key)', 'whsec_'],
    ['a short placeholder', 'whsec_short'],
  ])('a secret that is %s answers 500 and purges nothing', async (_label, value) => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = value;
    const res = await POST(request(delivery(userDeleted())));
    expect(res.status).toBe(500);
    expect(purge).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CLERK_WEBHOOK_SIGNING_SECRET is not set'));
  });

  it('a bare whsec_ secret is refused even for a delivery signed with the empty key', async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'whsec_';
    const d = delivery(userDeleted());
    d.headers['svix-signature'] = sign(d.headers['svix-id'], Number(d.headers['svix-timestamp']), d.body, 'whsec_');
    const res = await POST(request(d));
    expect(res.status).toBe(500);
    expect(purge).not.toHaveBeenCalled();
  });

  it('a failed purge answers 500 so Svix retries, and the log names the error class only', async () => {
    purge.mockRejectedValueOnce(new Error(`write failed for { user_id: "${USER}" }`));
    const res = await POST(request(delivery(userDeleted())));
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith(
      '[account] user.deleted svix=msg_2TestDelivery0001 purge failed: Error'
    );
  });

  it('the same signed event delivered twice answers 200 both times', async () => {
    const d = delivery(userDeleted());
    const first = await POST(request(d));
    purge.mockResolvedValueOnce(
      Object.fromEntries(Object.keys(COUNTS).map((k) => [k, { deleted: 0, reassigned: 0 }]))
    );
    const second = await POST(request(d));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(purge).toHaveBeenCalledTimes(2);
    expect(purge).toHaveBeenNthCalledWith(2, USER);
  });
});
