import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Battle from '@/models/Battle';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const battles = await Battle.find({ odlUserId: userId })
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json(battles);
  } catch (error) {
    console.error('Battle history fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch battle history' }, { status: 500 });
  }
}
