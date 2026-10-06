import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  consumeDailyAllowance,
  consumeProviderTestAllowance,
  DAILY_PROVIDER_TEST_LIMIT,
  nextUtcMidnightIso,
} from '@/lib/rate-limit';

// No database: dbConnect resolves and DailyUsage.findOneAndUpdate returns the
// document the test chooses.
const db = vi.hoisted(() => ({
  connect: vi.fn(async () => undefined),
  findOneAndUpdate: vi.fn(),
}));
vi.mock('@/lib/mongodb', () => ({ default: db.connect }));
vi.mock('@/models/DailyUsage', () => ({ default: { findOneAndUpdate: db.findOneAndUpdate } }));

const returns = (doc: unknown) => ({ lean: async () => doc });

beforeEach(() => {
  db.connect.mockReset();
  db.connect.mockResolvedValue(undefined);
  db.findOneAndUpdate.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T23:59:30Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('consumeProviderTestAllowance (S6)', () => {
  it('counts on its own field of the UTC-day document, not on the LLM counter', async () => {
    db.findOneAndUpdate.mockReturnValueOnce(returns({ count: 299, providerTests: 1 }));
    expect(await consumeProviderTestAllowance('user_1')).toEqual({ allowed: true });
    expect(db.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user_1', date: '2026-10-02' },
      { $inc: { providerTests: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  });

  it('allows up to 100 tests a day and refuses the next', async () => {
    expect(DAILY_PROVIDER_TEST_LIMIT).toBe(100);
    db.findOneAndUpdate.mockReturnValueOnce(returns({ providerTests: 100 }));
    expect(await consumeProviderTestAllowance('user_1')).toEqual({ allowed: true });
    db.findOneAndUpdate.mockReturnValueOnce(returns({ providerTests: 101 }));
    expect(await consumeProviderTestAllowance('user_1')).toEqual({ allowed: false });
  });

  it('is independent of the LLM allowance: 300 LLM units used, tests still allowed', async () => {
    db.findOneAndUpdate.mockReturnValueOnce(returns({ count: 300, providerTests: 5 }));
    expect(await consumeProviderTestAllowance('user_1')).toEqual({ allowed: true });
  });

  it('retries once on the first-request upsert race (E11000)', async () => {
    db.findOneAndUpdate
      .mockReturnValueOnce({ lean: async () => Promise.reject(Object.assign(new Error('dup'), { code: 11000 })) })
      .mockReturnValueOnce(returns({ providerTests: 1 }));
    expect(await consumeProviderTestAllowance('user_1')).toEqual({ allowed: true });
    expect(db.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('fails open on a database error, like the LLM allowance', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.connect.mockRejectedValueOnce(new Error('server selection timed out'));
    expect(await consumeProviderTestAllowance('user_1')).toEqual({ allowed: true });
    errorLog.mockRestore();
  });
});

describe('consumeDailyAllowance (unchanged behaviour)', () => {
  it('still counts on `count`', async () => {
    db.findOneAndUpdate.mockReturnValueOnce(returns({ count: 1 }));
    expect(await consumeDailyAllowance('user_1')).toEqual({ allowed: true });
    expect(db.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user_1', date: '2026-10-02' },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  });

  it('refuses past the default 300', async () => {
    db.findOneAndUpdate.mockReturnValueOnce(returns({ count: 301 }));
    expect(await consumeDailyAllowance('user_1')).toEqual({ allowed: false });
  });
});

describe('nextUtcMidnightIso', () => {
  it('is the start of the next UTC day, the moment both counters reset', () => {
    expect(nextUtcMidnightIso()).toBe('2026-10-03T00:00:00.000Z');
    expect(nextUtcMidnightIso(new Date('2026-12-31T00:00:00Z'))).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('DailyUsage schema', () => {
  it('has a providerTests counter that defaults to 0', async () => {
    const { default: DailyUsage } = await vi.importActual<typeof import('@/models/DailyUsage')>('@/models/DailyUsage');
    const path = DailyUsage.schema.path('providerTests') as unknown as { instance: string; defaultValue: unknown };
    expect(path?.instance).toBe('Number');
    expect(path?.defaultValue).toBe(0);
  });
});
