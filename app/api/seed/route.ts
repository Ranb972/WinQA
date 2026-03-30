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

    await dbConnect();

    // Delete all existing public seed data across all collections
    const deleted = await Promise.all([
      BugReport.deleteMany({ is_public: true }),
      PromptLibrary.deleteMany({ is_public: true }),
      TestCase.deleteMany({ is_public: true }),
      Insight.deleteMany({ is_public: true }),
    ]);

    // Insert new seed data with is_public: true
    const [bugs, prompts, testCases, insights] = await Promise.all([
      BugReport.insertMany(seedBugReports.map(d => ({ ...d, user_id: userId, is_public: true }))),
      PromptLibrary.insertMany(seedPrompts.map(d => ({ ...d, user_id: userId, is_public: true }))),
      TestCase.insertMany(seedTestCases.map(d => ({ ...d, user_id: userId, is_public: true }))),
      Insight.insertMany(seedInsights.map(d => ({ ...d, user_id: userId, is_public: true }))),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Reseeded all collections',
      deleted: {
        bugs: deleted[0].deletedCount,
        prompts: deleted[1].deletedCount,
        testCases: deleted[2].deletedCount,
        insights: deleted[3].deletedCount,
      },
      inserted: {
        bugs: bugs.length,
        prompts: prompts.length,
        testCases: testCases.length,
        insights: insights.length,
      },
    });
  } catch (error) {
    console.error('Error reseeding data:', error);
    return NextResponse.json(
      { error: 'Failed to reseed data' },
      { status: 500 }
    );
  }
}

// POST - Seed empty collections (scoped to authenticated user)
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const userFilter = { user_id: userId };

    const results = {
      testCases: { seeded: false, count: 0 },
      prompts: { seeded: false, count: 0 },
      insights: { seeded: false, count: 0 },
      bugs: { seeded: false, count: 0 },
    };

    // Seed test cases if empty for this user
    const testCaseCount = await TestCase.countDocuments(userFilter);
    if (testCaseCount === 0) {
      await TestCase.insertMany(seedTestCases.map(d => ({ ...d, user_id: userId })));
      results.testCases = { seeded: true, count: seedTestCases.length };
    }

    // Seed prompts if empty for this user
    const promptCount = await PromptLibrary.countDocuments(userFilter);
    if (promptCount === 0) {
      await PromptLibrary.insertMany(seedPrompts.map(d => ({ ...d, user_id: userId })));
      results.prompts = { seeded: true, count: seedPrompts.length };
    }

    // Seed insights if empty for this user
    const insightCount = await Insight.countDocuments(userFilter);
    if (insightCount === 0) {
      await Insight.insertMany(seedInsights.map(d => ({ ...d, user_id: userId })));
      results.insights = { seeded: true, count: seedInsights.length };
    }

    // Seed bugs if empty for this user
    const bugCount = await BugReport.countDocuments(userFilter);
    if (bugCount === 0) {
      await BugReport.insertMany(seedBugReports.map(d => ({ ...d, user_id: userId })));
      results.bugs = { seeded: true, count: seedBugReports.length };
    }

    const totalSeeded =
      results.testCases.count +
      results.prompts.count +
      results.insights.count +
      results.bugs.count;

    return NextResponse.json({
      success: true,
      message: totalSeeded > 0
        ? `Seeded ${totalSeeded} items`
        : 'All collections already have data, nothing seeded',
      results,
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    );
  }
}
