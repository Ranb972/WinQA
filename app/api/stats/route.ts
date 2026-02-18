import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import TestCase from '@/models/TestCase';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import Insight from '@/models/Insight';
import Battle from '@/models/Battle';

// GET - Fetch counts for dashboard stats (scoped to authenticated user)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const userFilter = { user_id: userId };

    const [testCases, bugs, prompts, insights, resolvedBugs, battles] = await Promise.all([
      TestCase.countDocuments(userFilter),
      BugReport.countDocuments(userFilter),
      PromptLibrary.countDocuments(userFilter),
      Insight.countDocuments(userFilter),
      BugReport.countDocuments({ ...userFilter, status: 'Resolved' }),
      Battle.countDocuments(userFilter),
    ]);

    return NextResponse.json({
      testCases,
      bugs,
      prompts,
      insights,
      resolvedBugs,
      battles,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
