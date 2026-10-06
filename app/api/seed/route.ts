import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
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
import { SYSTEM_USER_ID } from '@/lib/systemUser';
import { runInTransaction, supportsTransactions } from '@/lib/server/transaction';

// Admin allowlist for destructive reseed operations.
// Parsed once at module load; empty list means no one can call PUT (fail-closed).
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

// GET - Check seeding status (scoped to authenticated user)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const userFilter = { user_id: userId };

    const [testCaseCount, promptCount, insightCount, bugCount] = await Promise.all([
      TestCase.countDocuments(userFilter),
      PromptLibrary.countDocuments(userFilter),
      Insight.countDocuments(userFilter),
      BugReport.countDocuments(userFilter),
    ]);

    return NextResponse.json({
      status: 'ok',
      counts: {
        testCases: testCaseCount,
        prompts: promptCount,
        insights: insightCount,
        bugs: bugCount,
      },
      needsSeeding: {
        testCases: testCaseCount === 0,
        prompts: promptCount === 0,
        insights: insightCount === 0,
        bugs: bugCount === 0,
      },
    });
  } catch (error) {
    console.error('Error checking seed status:', error);
    return NextResponse.json(
      { error: 'Failed to check seed status' },
      { status: 500 }
    );
  }
}

// PUT - Reseed: delete all is_public entries and insert fresh seed data
export async function PUT() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json(
        { error: 'Forbidden: admin access required' },
        { status: 403 }
      );
    }

    const { connection } = await dbConnect();

    // The delete and the inserts must land together: a library left empty or
    // partial is never repaired, because autoSeed skips when any public row
    // exists (lib/autoSeed.ts). Without transactions, refuse rather than risk it.
    if (!(await supportsTransactions(connection))) {
      return NextResponse.json(
        {
          error:
            'Reseed is unavailable right now: the database does not support transactions. Nothing was changed.',
        },
        { status: 503 }
      );
    }

    // Delete all existing public seed data, then insert fresh seed data owned by
    // the system user, one operation at a time inside one transaction (never
    // Promise.all on a session). The runner may retry, so each run starts over.
    const { deleted, inserted } = await runInTransaction(connection, async (session) => {
      const publicRows = { is_public: true };
      const owned = <T extends object>(docs: T[]) =>
        docs.map(d => ({ ...d, user_id: SYSTEM_USER_ID, is_public: true }));
      const deleted = {
        bugs: (await BugReport.deleteMany(publicRows, { session })).deletedCount,
        prompts: (await PromptLibrary.deleteMany(publicRows, { session })).deletedCount,
        testCases: (await TestCase.deleteMany(publicRows, { session })).deletedCount,
        insights: (await Insight.deleteMany(publicRows, { session })).deletedCount,
      };
      const inserted = {
        bugs: (await BugReport.insertMany(owned(seedBugReports), { session })).length,
        prompts: (await PromptLibrary.insertMany(owned(seedPrompts), { session })).length,
        testCases: (await TestCase.insertMany(owned(seedTestCases), { session })).length,
        insights: (await Insight.insertMany(owned(seedInsights), { session })).length,
      };
      return { deleted, inserted };
    });

    return NextResponse.json({
      success: true,
      message: 'Reseeded all collections',
      deleted,
      inserted,
    });
  } catch (error) {
    console.error('Error reseeding data:', error);
    return NextResponse.json(
      { error: 'Failed to reseed data' },
      { status: 500 }
    );
  }
}
