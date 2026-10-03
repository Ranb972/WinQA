import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { purgeUserData, PURGE_TARGETS, SYSTEM_OWNER_ID } from '@/lib/server/purge-user';
import Battle from '@/models/Battle';
import BugReport from '@/models/BugReport';
import DailyUsage from '@/models/DailyUsage';
import Insight from '@/models/Insight';
import Leaderboard from '@/models/Leaderboard';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import UserFavorite from '@/models/UserFavorite';

// No database: dbConnect is a spy, and the model statics are spied on below.
// Creating a Mongoose model opens no connection.
const db = vi.hoisted(() => ({ connect: vi.fn(async () => undefined) }));
vi.mock('@/lib/mongodb', () => ({ default: db.connect }));

const USER = 'user_2abcDEF123';

// The expected user field per model, written out here independently of the
// table in purge-user.ts. A wrong field is a silent no-op in Mongoose.
const MODELS = [
  { modelName: 'Battle', model: Battle, field: 'odlUserId', collection: 'battles', isPublic: false },
  { modelName: 'Leaderboard', model: Leaderboard, field: 'odlUserId', collection: 'leaderboards', isPublic: false },
  { modelName: 'DailyUsage', model: DailyUsage, field: 'userId', collection: 'dailyusages', isPublic: false },
  { modelName: 'UserFavorite', model: UserFavorite, field: 'user_id', collection: 'userfavorites', isPublic: false },
  { modelName: 'BugReport', model: BugReport, field: 'user_id', collection: 'bugreports', isPublic: true },
  { modelName: 'PromptLibrary', model: PromptLibrary, field: 'user_id', collection: 'promptlibraries', isPublic: true },
  { modelName: 'TestCase', model: TestCase, field: 'user_id', collection: 'testcases', isPublic: true },
  { modelName: 'Insight', model: Insight, field: 'user_id', collection: 'insights', isPublic: true },
] as const;

type Spy = MockInstance<(...args: unknown[]) => unknown>;
const deleteSpies = new Map<string, Spy>();
const updateSpies = new Map<string, Spy>();
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  db.connect.mockClear();
  for (const { modelName: name, model } of MODELS) {
    deleteSpies.set(
      name,
      vi.spyOn(model, 'deleteMany').mockImplementation((() => {
        calls.push(`${name}.deleteMany`);
        return Promise.resolve({ deletedCount: 2 });
      }) as never) as unknown as Spy
    );
    updateSpies.set(
      name,
      vi.spyOn(model, 'updateMany').mockImplementation((() => {
        calls.push(`${name}.updateMany`);
        return Promise.resolve({ modifiedCount: 1, matchedCount: 1 });
      }) as never) as unknown as Spy
    );
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('purgeUserData: the user field of each model', () => {
  it.each(MODELS)('$modelName: deleteMany is filtered on $field and nothing else names the user', async ({ modelName: name, field, isPublic }) => {
    await purgeUserData(USER);
    const spy = deleteSpies.get(name)!;
    expect(spy).toHaveBeenCalledTimes(1);
    const filter = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(filter[field]).toBe(USER);
    const otherFields = ['odlUserId', 'userId', 'user_id'].filter((f) => f !== field);
    for (const other of otherFields) expect(filter).not.toHaveProperty(other);
    if (isPublic) {
      expect(filter).toEqual({ [field]: USER, is_public: { $ne: true } });
    } else {
      expect(filter).toEqual({ [field]: USER });
    }
  });

  it('the table covers exactly the eight user-keyed models', () => {
    expect(PURGE_TARGETS.map((t) => t.collection).sort()).toEqual(
      MODELS.map((m) => m.collection).sort()
    );
    for (const { model, field, collection } of MODELS) {
      const target = PURGE_TARGETS.find((t) => t.collection === collection)!;
      expect(target.model).toBe(model);
      expect(target.field).toBe(field);
    }
  });

  it.each(PURGE_TARGETS.map((t) => [t.collection, t] as const))(
    '%s: the table field is a schema path of the model, and the other spellings are not',
    (_collection, { model, field }) => {
      const schema = (model as unknown as { schema: { path(p: string): unknown } }).schema;
      expect(schema.path(field)).toBeDefined();
      for (const other of ['odlUserId', 'userId', 'user_id'].filter((f) => f !== field)) {
        expect(schema.path(other)).toBeUndefined();
      }
    }
  );

  it('a table field missing from the schema throws before any database call', async () => {
    const realPath = Battle.schema.path.bind(Battle.schema);
    vi.spyOn(Battle.schema, 'path').mockImplementation(((p: string) =>
      p === 'odlUserId' ? undefined : realPath(p)) as never);
    await expect(purgeUserData(USER)).rejects.toThrow(/battles has no schema path 'odlUserId'/);
    expect(db.connect).not.toHaveBeenCalled();
    for (const spy of [...deleteSpies.values(), ...updateSpies.values()]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('purgeUserData: the id guard', () => {
  it.each([
    ['empty string', ''],
    ['undefined', undefined],
    ['the system owner', 'system'],
    ['a bare prefix', 'user_'],
  ])('refuses %s before any database call', async (_label, bad) => {
    await expect(purgeUserData(bad as string)).rejects.toThrow(/not a Clerk user id/);
    expect(db.connect).not.toHaveBeenCalled();
    for (const spy of [...deleteSpies.values(), ...updateSpies.values()]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('purgeUserData: public documents (D11)', () => {
  it.each(MODELS.filter((m) => m.isPublic))('$modelName: public rows are reassigned to system, before the private delete', async ({ modelName: name }) => {
    await purgeUserData(USER);
    const update = updateSpies.get(name)!;
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      { user_id: USER, is_public: true },
      { $set: { user_id: SYSTEM_OWNER_ID } }
    );
    expect(calls.indexOf(`${name}.updateMany`)).toBeLessThan(calls.indexOf(`${name}.deleteMany`));
    // The delete cannot match a public row on its own filter.
    expect(deleteSpies.get(name)!.mock.calls[0][0]).toMatchObject({ is_public: { $ne: true } });
  });

  it.each(MODELS.filter((m) => !m.isPublic))('$modelName has no public rows and is never updated', async ({ modelName: name }) => {
    await purgeUserData(USER);
    expect(updateSpies.get(name)).not.toHaveBeenCalled();
  });
});

describe('purgeUserData: result and failure', () => {
  it('returns deleted and reassigned counts per collection', async () => {
    const result = await purgeUserData(USER);
    expect(db.connect).toHaveBeenCalledTimes(1);
    for (const { collection, isPublic } of MODELS) {
      expect(result[collection]).toEqual({ deleted: 2, reassigned: isPublic ? 1 : 0 });
    }
  });

  it('a rejected deleteMany propagates', async () => {
    deleteSpies.get('Battle')!.mockImplementation((() => Promise.reject(new Error('db down'))) as never);
    await expect(purgeUserData(USER)).rejects.toThrow('db down');
  });

  it('a rejected updateMany propagates and the private delete of that model does not run', async () => {
    updateSpies.get('BugReport')!.mockImplementation((() => Promise.reject(new Error('db down'))) as never);
    await expect(purgeUserData(USER)).rejects.toThrow('db down');
    expect(deleteSpies.get('BugReport')).not.toHaveBeenCalled();
  });

  it('deletes per-user state and battles before any content', async () => {
    await purgeUserData(USER);
    expect(calls.indexOf('DailyUsage.deleteMany')).toBeLessThan(calls.indexOf('BugReport.updateMany'));
    expect(calls.indexOf('Battle.deleteMany')).toBeLessThan(calls.indexOf('BugReport.updateMany'));
  });
});
