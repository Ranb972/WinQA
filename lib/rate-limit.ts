import dbConnect from '@/lib/mongodb';
import DailyUsage from '@/models/DailyUsage';

// A heavy real user lands ~150-200 server-side LLM requests/day (Compare sends
// fan out client-side as one request per model); 300 gives honest headroom while
// bounding worst-case abuse of the owner's provider keys.
const DEFAULT_DAILY_LIMIT = 300;

function dailyLimit(): number {
  const fromEnv = Number(process.env.DAILY_LLM_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : DEFAULT_DAILY_LIMIT;
}

/**
 * Counts one LLM request against the user's daily allowance (UTC day).
 * Fail-open: a DB hiccup must not take down every LLM feature.
 */
export async function consumeDailyAllowance(userId: string): Promise<{ allowed: boolean }> {
  try {
    await dbConnect();
    const date = new Date().toISOString().slice(0, 10);
    let usage;
    try {
      usage = await DailyUsage.findOneAndUpdate(
        { userId, date },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      ).lean();
    } catch {
      // Two concurrent first requests of the day can race the upsert (E11000);
      // the document exists after the loser's failure, so one retry settles it.
      usage = await DailyUsage.findOneAndUpdate(
        { userId, date },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      ).lean();
    }
    return { allowed: (usage?.count ?? 0) <= dailyLimit() };
  } catch (error) {
    console.error('Rate limit check failed (allowing request):', error instanceof Error ? error.message : error);
    return { allowed: true };
  }
}
