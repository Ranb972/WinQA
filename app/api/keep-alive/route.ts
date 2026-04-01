import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';

export async function GET() {
  try {
    await dbConnect();
    const count = await BugReport.countDocuments({});
    return NextResponse.json({ status: 'ok', timestamp: Date.now(), count });
  } catch (error) {
    console.error('Keep-alive failed:', error);
    return NextResponse.json(
      { status: 'error', timestamp: Date.now() },
      { status: 500 }
    );
  }
}
