import TestCase from '@/models/TestCase';
import PromptLibrary from '@/models/PromptLibrary';
import Insight from '@/models/Insight';
import BugReport from '@/models/BugReport';
import SeedLock from '@/models/SeedLock';
import {
  seedTestCases,
  seedPrompts,
  seedInsights,
  seedBugReports,
} from '@/lib/seedData';
import { SYSTEM_USER_ID } from '@/lib/systemUser';

// The marker that makes seeding happen once per database. Bump the version only
// together with a seed-data change that must be written to databases already seeded.
export const PUBLIC_LIBRARY_LOCK_ID = 'public-library-v1';

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

// Name and code only: the message of a driver error is not needed to tell the cases apart.
function describeError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'unknown error';
  const { name, code } = err as { name?: unknown; code?: unknown };
  return [typeof name === 'string' ? name : 'Error', code !== undefined ? `code=${String(code)}` : '']
    .filter(Boolean)
    .join(' ');
}

export async function autoSeed(): Promise<void> {
  const publicFilter = { is_public: true };

  const [testCaseCount, promptCount, insightCount, bugCount] = await Promise.all([
    TestCase.countDocuments(publicFilter),
    PromptLibrary.countDocuments(publicFilter),
    Insight.countDocuments(publicFilter),
    BugReport.countDocuments(publicFilter),
  ]);

  if (testCaseCount > 0 || promptCount > 0 || insightCount > 0 || bugCount > 0) {
    console.log('Auto-seed: public content found, skipping');
    return;
  }

  // The count check above is per instance: two cold starts on an empty database
  // both pass it. The marker's _id is unique, so exactly one insert succeeds and
  // only that instance seeds. Any other failure skips the inserts (fail closed).
  try {
    await SeedLock.create({ _id: PUBLIC_LIBRARY_LOCK_ID });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      console.log('Auto-seed: seed lock held by another instance, skipping');
    } else {
      console.error(`Auto-seed: seed lock insert failed (${describeError(err)}), skipping`);
    }
    return;
  }

  console.log('Auto-seed: no public content, seeding...');

  await Promise.all([
    TestCase.insertMany(seedTestCases.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
    PromptLibrary.insertMany(seedPrompts.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
    Insight.insertMany(seedInsights.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
    BugReport.insertMany(seedBugReports.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
  ]);

  console.log('Auto-seed: complete');
}
