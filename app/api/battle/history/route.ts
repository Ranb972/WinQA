import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Battle from '@/models/Battle';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';

// Battles are full documents (the UI expands every response body), so the page
// is smaller than the library pages: 20 by default, up to 50 with ?limit=.
const LIST_PAGE = { def: 20, max: 50 };

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

// A battle id is a 24-hex ObjectId; anything else is refused before the database.
const BATTLE_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * DELETE /api/battle/history?id=<battleId> (D14): removes one of the caller's
 * battles from their history. The battle document is the vote record (the
 * winner, ratings and rankings are stored on it; there is no separate vote
 * collection), so deleting it removes the vote from the history. The leaderboard
 * rows are running aggregates and are deliberately not touched: a deleted
 * battle stays counted in the leaderboard totals, as the page's confirm says.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Battle ID is required' }, { status: 400 });
    }
    if (!BATTLE_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid battle ID' }, { status: 400 });
    }

    await dbConnect();

    // Scoped to the owner: another user's id matches nothing and answers 404.
    const result = await Battle.deleteOne({ _id: id, odlUserId: userId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Battle delete error:', errMsg);
    return NextResponse.json({ error: 'Failed to delete battle' }, { status: 500 });
  }
}
