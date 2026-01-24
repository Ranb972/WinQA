import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TestCase from '@/models/TestCase';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import Insight from '@/models/Insight';

// GET - Fetch counts for dashboard stats
export async function GET() {
  try {
    await dbConnect();

    const [testCases, bugs, prompts, insights, resolvedBugs] = await Promise.all([
      TestCase.countDocuments({}),
      BugReport.countDocuments({}),
      PromptLibrary.countDocuments({}),
      Insight.countDocuments({}),
      BugReport.countDocuments({ status: 'Resolved' }),
    ]);

    return NextResponse.json({
      testCases,
      bugs,
      prompts,
      insights,
      resolvedBugs,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
