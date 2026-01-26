import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Fetch all collections for this user
    const [bugs, prompts, testCases, insights] = await Promise.all([
      BugReport.find({ user_id: userId }).lean(),
      PromptLibrary.find({ user_id: userId }).lean(),
      TestCase.find({ user_id: userId }).lean(),
      Insight.find({ user_id: userId }).lean(),
    ]);

    // Remove MongoDB _id and user_id from exported data for cleaner output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanDoc = (doc: any) => {
      const { _id, user_id, __v, ...rest } = doc;
      void user_id; // Intentionally removed from export
      return { id: _id?.toString(), ...rest };
    };

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {
        bugs: bugs.map(cleanDoc),
        prompts: prompts.map(cleanDoc),
        testCases: testCases.map(cleanDoc),
        insights: insights.map(cleanDoc),
      },
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
