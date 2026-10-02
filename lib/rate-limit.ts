import dbConnect from '@/lib/mongodb';
import DailyUsage from '@/models/DailyUsage';

// A heavy real user lands ~150-200 server-side LLM requests/day (Compare sends
// fan out client-side as one request per model); 300 gives honest headroom while
// bounding worst-case abuse of the owner's provider keys.
const DEFAULT_DAILY_LIMIT = 300;

/**
 * Custom-provider connection tests per user per UTC day, counted apart from the
 * LLM allowance so testing providers never eats into chat. The heaviest honest
 * day is about 60 tests: all MAX_CUSTOM_PROVIDERS (6) added with up to 4 tries
 * each (24), each re-tested twice from its card (12), toggled off and on twice
 * (12; turning one on runs a test) and edited once with two tries (12). 100 leaves
 * 40 spare over that and still bounds the route as an outbound relay.
 */
export const DAILY_PROVIDER_TEST_LIMIT = 100;

function dailyLimit(): number {
  const fromEnv = Number(process.env.DAILY_LLM_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : DEFAULT_DAILY_LIMIT;
}

/** ISO time of the next UTC midnight, when every daily counter starts again. */
export function nextUtcMidnightIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

/**
 * Adds one to `field` on the user's document for today (UTC) and returns the new
 * value. Throws on any database error; callers decide the failure policy.
 */
async function incrementToday(userId: string, field: 'count' | 'providerTests'): Promise<number> {
  await dbConnect();
  const date = new Date().toISOString().slice(0, 10);
  const inc = () =>
    DailyUsage.findOneAndUpdate(
      { userId, date },
      { $inc: { [field]: 1 } },
      { upsert: true, new: true }
    ).lean();

  let usage;
  try {
    usage = await inc();
  } catch (e) {
    // Two concurrent first requests of the day can race the upsert (E11000);
    // the document exists after the loser's failure, so one retry settles it.
    // Anything else (server-selection timeout, auth, network) must NOT be
    // blindly retried: rethrow so the outer fail-open answers immediately
    // instead of burning a second server-selection window.
    if ((e as { code?: number })?.code !== 11000) throw e;
    usage = await inc();
  }
  return usage?.[field] ?? 0;
}

/**
 * Counts one LLM request against the user's daily allowance (UTC day).
 * Fail-open: a DB hiccup must not take down every LLM feature.
 */
export async function consumeDailyAllowance(userId: string): Promise<{ allowed: boolean }> {
  try {
    return { allowed: (await incrementToday(userId, 'count')) <= dailyLimit() };
  } catch (error) {
    console.error('Rate limit check failed (allowing request):', error instanceof Error ? error.message : error);
    return { allowed: true };
  }
}

/**
 * Counts one custom-provider connection test against the user's own daily cap
 * (DAILY_PROVIDER_TEST_LIMIT, UTC day). Same fail-open policy as
 * consumeDailyAllowance: a DB hiccup must not block saving a provider.
 */
export async function consumeProviderTestAllowance(userId: string): Promise<{ allowed: boolean }> {
  try {
    return { allowed: (await incrementToday(userId, 'providerTests')) <= DAILY_PROVIDER_TEST_LIMIT };
  } catch (error) {
    console.error('Provider-test limit check failed (allowing request):', error instanceof Error ? error.message : error);
    return { allowed: true };
  }
}
