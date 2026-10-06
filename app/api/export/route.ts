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

    // Fetch this user's private rows: exactly the rows a replace import deletes,
    // so export and replace are symmetric. Public library rows are never
    // exported, even for their owner.
    const privateRows = { user_id: userId, is_public: { $ne: true } };
    const [bugs, prompts, testCases, insights] = await Promise.all([
      BugReport.find(privateRows).lean(),
      PromptLibrary.find(privateRows).lean(),
      TestCase.find(privateRows).lean(),
      Insight.find(privateRows).lean(),
    ]);

    // Remove MongoDB _id and user_id from exported data for cleaner output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanDoc = (doc: any) => {
      const { _id, user_id, __v, ...rest } = doc;
      void user_id; // Intentionally removed from export
      void __v; // Intentionally removed from export
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
