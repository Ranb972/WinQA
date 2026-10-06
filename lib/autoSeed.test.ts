import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { SYSTEM_USER_ID } from '@/lib/systemUser';

// Every model static records its call here, so the tests can assert the order of
// the marker insert and the public inserts.
const { calls, makeModel, seedLockCreate } = vi.hoisted(() => {
  const calls: string[] = [];
  const makeModel = (name: string) => ({
    countDocuments: vi.fn(async () => 0),
    insertMany: vi.fn(async (docs: unknown[]) => {
      calls.push(`${name}.insertMany`);
      return docs;
    }),
  });
  const seedLockCreate = vi.fn(async (doc: unknown) => {
    calls.push('SeedLock.create');
    return doc;
  });
  return { calls, makeModel, seedLockCreate };
});

vi.mock('@/models/TestCase', () => ({ default: makeModel('TestCase') }));
vi.mock('@/models/PromptLibrary', () => ({ default: makeModel('PromptLibrary') }));
vi.mock('@/models/Insight', () => ({ default: makeModel('Insight') }));
vi.mock('@/models/BugReport', () => ({ default: makeModel('BugReport') }));
vi.mock('@/models/SeedLock', () => ({ default: { create: seedLockCreate } }));

import { autoSeed } from '@/lib/autoSeed';
import TestCase from '@/models/TestCase';
import PromptLibrary from '@/models/PromptLibrary';
import Insight from '@/models/Insight';
import BugReport from '@/models/BugReport';

type ModelMock = ReturnType<typeof makeModel>;
const models = {
  TestCase: TestCase as unknown as ModelMock,
  PromptLibrary: PromptLibrary as unknown as ModelMock,
  Insight: Insight as unknown as ModelMock,
  BugReport: BugReport as unknown as ModelMock,
};
const publicInserts = Object.values(models).map((m) => m.insertMany);

function duplicateKeyError(): Error {
  return Object.assign(new Error('E11000 duplicate key error collection: seedlocks'), {
    name: 'MongoServerError',
    code: 11000,
  });
}

let logSpy: MockInstance<typeof console.log>;
let errorSpy: MockInstance<typeof console.error>;

function logged(spy: MockInstance<typeof console.log>): string {
  return spy.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  for (const m of Object.values(models)) m.countDocuments.mockResolvedValue(0);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('autoSeed seed lock', () => {
  it('inserts the public-library-v1 marker before any public insert', async () => {
    await autoSeed();

    expect(seedLockCreate).toHaveBeenCalledTimes(1);
    expect(seedLockCreate).toHaveBeenCalledWith({ _id: 'public-library-v1' });
    expect(calls[0]).toBe('SeedLock.create');
    expect(calls.slice(1).every((c) => c.endsWith('.insertMany'))).toBe(true);
  });

  it('skips every insert and logs the skip when the marker already exists (E11000)', async () => {
    seedLockCreate.mockRejectedValueOnce(duplicateKeyError());

    await expect(autoSeed()).resolves.toBeUndefined();

    for (const insert of publicInserts) expect(insert).not.toHaveBeenCalled();
    expect(logged(logSpy)).toMatch(/another instance/i);
    expect(logged(logSpy)).not.toMatch(/complete/i);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('fails closed: any other error on the marker insert is logged and nothing is inserted', async () => {
    seedLockCreate.mockRejectedValueOnce(
      Object.assign(new Error('server selection timed out'), { name: 'MongoServerSelectionError' })
    );

    await expect(autoSeed()).resolves.toBeUndefined();

    for (const insert of publicInserts) expect(insert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logged(errorSpy)).toMatch(/seed lock/i);
    expect(logged(errorSpy)).toContain('MongoServerSelectionError');
    expect(logged(logSpy)).not.toMatch(/complete/i);
  });

  it.each(Object.keys(models) as (keyof typeof models)[])(
    'writes no marker when %s already has public rows',
    async (name) => {
      models[name].countDocuments.mockResolvedValue(3);

      await autoSeed();

      expect(seedLockCreate).not.toHaveBeenCalled();
      for (const insert of publicInserts) expect(insert).not.toHaveBeenCalled();
      expect(logged(logSpy)).toMatch(/public content found, skipping/);
    }
  );

  it('a clean run inserts the marker, then the four collections under the system owner', async () => {
    await autoSeed();

    expect(calls).toHaveLength(5);
    expect(calls[0]).toBe('SeedLock.create');
    expect(new Set(calls.slice(1))).toEqual(
      new Set([
        'TestCase.insertMany',
        'PromptLibrary.insertMany',
        'Insight.insertMany',
        'BugReport.insertMany',
      ])
    );

    const expected: [keyof typeof models, number][] = [
      ['BugReport', 15],
      ['PromptLibrary', 10],
      ['TestCase', 6],
      ['Insight', 5],
    ];
    for (const [name, count] of expected) {
      const docs = models[name].insertMany.mock.calls[0][0] as Record<string, unknown>[];
      expect(docs, name).toHaveLength(count);
      for (const d of docs) {
        expect(d.user_id).toBe(SYSTEM_USER_ID);
        expect(d.is_public).toBe(true);
      }
    }
    expect(logged(logSpy)).toMatch(/complete/);
  });

  it('logs carry no user id and no seeded content', async () => {
    seedLockCreate.mockRejectedValueOnce(duplicateKeyError());
    await autoSeed();
    await autoSeed();

    const all = `${logged(logSpy)}\n${logged(errorSpy)}`;
    expect(all).not.toMatch(/user_/);
    expect(all).not.toContain(SYSTEM_USER_ID);
  });
});
