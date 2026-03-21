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

    const visibleFilter = { $or: [{ user_id: userId }, { is_public: true }] };

    const [testCases, bugs, prompts, insights, resolvedBugs, battles] = await Promise.all([
      TestCase.countDocuments(visibleFilter),
      BugReport.countDocuments(visibleFilter),
      PromptLibrary.countDocuments(visibleFilter),
      Insight.countDocuments(visibleFilter),
      BugReport.countDocuments({ ...visibleFilter, status: 'Resolved' }),
      Battle.countDocuments({ user_id: userId }),
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
