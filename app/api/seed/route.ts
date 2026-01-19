import { NextResponse } from 'next/server';
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

// GET - Check seeding status
export async function GET() {
  try {
    await dbConnect();

    const [testCaseCount, promptCount, insightCount, bugCount] = await Promise.all([
      TestCase.countDocuments(),
      PromptLibrary.countDocuments(),
      Insight.countDocuments(),
      BugReport.countDocuments(),
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

// POST - Seed empty collections
export async function POST() {
  try {
    await dbConnect();

    const results = {
      testCases: { seeded: false, count: 0 },
      prompts: { seeded: false, count: 0 },
      insights: { seeded: false, count: 0 },
      bugs: { seeded: false, count: 0 },
    };

    // Seed test cases if empty
    const testCaseCount = await TestCase.countDocuments();
    if (testCaseCount === 0) {
      await TestCase.insertMany(seedTestCases);
      results.testCases = { seeded: true, count: seedTestCases.length };
    }

    // Seed prompts if empty
    const promptCount = await PromptLibrary.countDocuments();
    if (promptCount === 0) {
      await PromptLibrary.insertMany(seedPrompts);
      results.prompts = { seeded: true, count: seedPrompts.length };
    }

    // Seed insights if empty
    const insightCount = await Insight.countDocuments();
    if (insightCount === 0) {
      await Insight.insertMany(seedInsights);
      results.insights = { seeded: true, count: seedInsights.length };
    }

    // Seed bugs if empty
    const bugCount = await BugReport.countDocuments();
    if (bugCount === 0) {
      await BugReport.insertMany(seedBugReports);
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
      { error: 'Failed to seed data', details: String(error) },
      { status: 500 }
    );
  }
}
