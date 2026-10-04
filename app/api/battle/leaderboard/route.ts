import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Leaderboard from '@/models/Leaderboard';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';

// Rows are keyed on the provider and model strings the client sends with a vote,
// so their count is not bounded by the registry. Keep the most played ones.
const LEADERBOARD_MAX_ROWS = 200;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const entries = await Leaderboard.find({ odlUserId: userId })
      .sort({ totalBattles: -1 })
      .limit(LEADERBOARD_MAX_ROWS)
      .lean()
      .maxTimeMS(DB_QUERY_MAX_TIME_MS);

    // Sort by win rate descending (wins / totalBattles)
    const sorted = entries.sort((a, b) => {
      const rateA = a.totalBattles > 0 ? a.wins / a.totalBattles : 0;
      const rateB = b.totalBattles > 0 ? b.wins / b.totalBattles : 0;
      return rateB - rateA;
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
