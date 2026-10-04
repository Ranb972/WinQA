import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Battle from '@/models/Battle';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';

// Battles are full documents (the UI expands every response body), so the page
// is smaller than the library pages.
const LIST_PAGE = { def: 50, max: 50 };

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parsePage(searchParams, LIST_PAGE);
    if (!parsed.ok) return parsed.response;

    await dbConnect();

    const { rows, nextCursor } = await pageQuery(
      Battle,
      { odlUserId: userId },
      'created_at',
      parsed.page
    );

    return pageResponse(rows, nextCursor);
  } catch (error) {
    console.error('Battle history fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch battle history' }, { status: 500 });
  }
}
