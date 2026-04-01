import TestCase from '@/models/TestCase';
import PromptLibrary from '@/models/PromptLibrary';
import Insight from '@/models/Insight';
import BugReport from '@/models/BugReport';
import {
  seedTestCases,
  seedPrompts,
  seedInsights,
  seedBugReports,
} from '@/lib/seedData';

const SYSTEM_USER_ID = 'system';

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

  console.log('Auto-seed: no public content, seeding...');

  await Promise.all([
    TestCase.insertMany(seedTestCases.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
    PromptLibrary.insertMany(seedPrompts.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
    Insight.insertMany(seedInsights.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
    BugReport.insertMany(seedBugReports.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }))),
  ]);

  console.log('Auto-seed: complete');
}
