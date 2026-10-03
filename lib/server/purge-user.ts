import dbConnect from '@/lib/mongodb';
import Battle from '@/models/Battle';
import BugReport from '@/models/BugReport';
import DailyUsage from '@/models/DailyUsage';
import Insight from '@/models/Insight';
import Leaderboard from '@/models/Leaderboard';
import PromptLibrary from '@/models/PromptLibrary';
import ProviderCredential from '@/models/ProviderCredential';
import TestCase from '@/models/TestCase';
import UserFavorite from '@/models/UserFavorite';

// Owner of the seeded public library (lib/autoSeed.ts). A deleted user's public
// documents are handed to it instead of deleted (decision D11), so deleting the
// admin account can never erase the public library.
export const SYSTEM_OWNER_ID = 'system';

type Filter = Record<string, unknown>;

// The two statics the purge uses, typed structurally so one table can hold
// all nine models.
interface PurgeableModel {
  schema: { path(path: string): unknown };
  deleteMany(filter: Filter): PromiseLike<{ deletedCount: number }>;
  updateMany(filter: Filter, update: Filter): PromiseLike<{ modifiedCount: number }>;
}

interface PurgeTarget {
  /** Collection name, used as the key of the returned counts and in logs. */
  collection: string;
  model: PurgeableModel;
  /** The field that holds the Clerk user id. The models do not agree on it. */
  field: 'odlUserId' | 'userId' | 'user_id';
  /** The model has `is_public`; public rows are reassigned, not deleted (D11). */
  hasPublicRows: boolean;
}

// The one place that says which field holds the user id in which collection.
// A wrong field name is a silent no-op (Mongoose passes an unknown path through
// and deletes nothing) or, under strictQuery, is stripped and leaves an empty
// filter that matches every row. purgeUserData therefore checks each field
// against the model's schema before any query, and
// lib/server/purge-user.test.ts pins every entry.
// Order is the purge order: keys and per-user state first, then content.
// Saved API keys go first, so a run that stops part-way never leaves a
// deleted user's credentials behind its content.
export const PURGE_TARGETS: readonly PurgeTarget[] = [
  { collection: 'providercredentials', model: ProviderCredential, field: 'userId', hasPublicRows: false },
  { collection: 'dailyusages', model: DailyUsage, field: 'userId', hasPublicRows: false },
  { collection: 'leaderboards', model: Leaderboard, field: 'odlUserId', hasPublicRows: false },
  { collection: 'battles', model: Battle, field: 'odlUserId', hasPublicRows: false },
  { collection: 'userfavorites', model: UserFavorite, field: 'user_id', hasPublicRows: false },
  { collection: 'bugreports', model: BugReport, field: 'user_id', hasPublicRows: true },
  { collection: 'promptlibraries', model: PromptLibrary, field: 'user_id', hasPublicRows: true },
  { collection: 'testcases', model: TestCase, field: 'user_id', hasPublicRows: true },
  { collection: 'insights', model: Insight, field: 'user_id', hasPublicRows: true },
];

export interface PurgeCounts {
  deleted: number;
  reassigned: number;
}

export type PurgeResult = Record<string, PurgeCounts>;

const CLERK_USER_ID = /^user_[A-Za-z0-9]+$/;

export function isClerkUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && CLERK_USER_ID.test(userId);
}

/**
 * Deletes every row one Clerk user owns, across all user-keyed collections.
 * Public documents (`is_public: true`) are reassigned to SYSTEM_OWNER_ID.
 *
 * Throws before any database call unless userId is a Clerk user id: an
 * undefined filter value or 'system' would otherwise match other people's rows.
 * Any failed write rejects, so the caller can answer 500 and the sender retry.
 * Re-running is safe: every step matches only rows still owned by the user.
 */
export async function purgeUserData(userId: string): Promise<PurgeResult> {
  if (!isClerkUserId(userId)) {
    throw new Error('purgeUserData: refusing a value that is not a Clerk user id');
  }

  for (const { collection, model, field } of PURGE_TARGETS) {
    if (model.schema.path(field) === undefined) {
      throw new Error(`purgeUserData: ${collection} has no schema path '${field}'`);
    }
  }

  await dbConnect();

  const result: PurgeResult = {};
  // Sequential, in table order, so keys go before content and a failure stops
  // the run at a known point for the retry to finish.
  for (const { collection, model, field, hasPublicRows } of PURGE_TARGETS) {
    let reassigned = 0;
    let deleteFilter: Filter = { [field]: userId };
    if (hasPublicRows) {
      const updated = await model.updateMany(
        { [field]: userId, is_public: true },
        { $set: { [field]: SYSTEM_OWNER_ID } }
      );
      reassigned = updated.modifiedCount;
      // The delete excludes public rows by its own filter, not only because the
      // update ran first: a row made public after the update is left in place
      // rather than deleted. `$ne: true` matches false, null and a missing
      // field, which the app treats as private.
      deleteFilter = { [field]: userId, is_public: { $ne: true } };
    }
    const deleted = await model.deleteMany(deleteFilter);
    result[collection] = { deleted: deleted.deletedCount, reassigned };
  }
  return result;
}
