import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));

const consumeDailyAllowance = vi.fn(async (_userId: string) => ({ allowed: true }));
vi.mock('@/lib/rate-limit', () => ({
  consumeDailyAllowance: (userId: string) => consumeDailyAllowance(userId),
}));

import { POST } from './route';

// A plausible Judge0 CE success body: outputs are base64, status 3 = Accepted.
function judge0Success() {
  return new Response(
    JSON.stringify({
      stdout: Buffer.from('hello').toString('base64'),
      stderr: null,
      compile_output: null,
      status: { id: 3, description: 'Accepted' },
      time: '0.01',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => judge0Success());

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/execute-code', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const baseBody = { language: 'python', code: 'print(1)' };

describe('POST /api/execute-code stdin validation', () => {
  beforeEach(() => {
    consumeDailyAllowance.mockClear();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an object with a huge length field before allocating, fetching or metering', async () => {
    const res = await POST(makeRequest({ ...baseBody, stdin: { length: 2000000000 } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'stdin must be a string' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeDailyAllowance).not.toHaveBeenCalled();
  });

  it.each([
    ['a number', 123],
    ['an array', []],
    ['null', null],
  ])('rejects stdin that is %s with 400 and burns no unit', async (_label, stdin) => {
    const res = await POST(makeRequest({ ...baseBody, stdin }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'stdin must be a string' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeDailyAllowance).not.toHaveBeenCalled();
  });

  it('rejects a 10,001 character stdin with 400 and burns no unit', async () => {
    const res = await POST(makeRequest({ ...baseBody, stdin: 'a'.repeat(10001) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'stdin must be 10,000 characters or fewer' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeDailyAllowance).not.toHaveBeenCalled();
  });

  it('accepts a 10,000 character stdin, meters once and forwards it', async () => {
    const res = await POST(makeRequest({ ...baseBody, stdin: 'a'.repeat(10000) }));
    expect(res.status).toBe(200);
    expect(consumeDailyAllowance).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends an empty stdin to Judge0 CE when stdin is absent', async () => {
    const res = await POST(makeRequest(baseBody));
    expect(res.status).toBe(200);
    expect(consumeDailyAllowance).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('ce.judge0.com');
    expect(JSON.parse(String(init?.body)).stdin).toBe('');
  });

  it('base64-encodes a string stdin for Judge0 CE', async () => {
    const res = await POST(makeRequest({ ...baseBody, stdin: 'abc' }));
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body)).stdin).toBe('YWJj');
  });
});
