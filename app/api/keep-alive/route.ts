import { NextResponse, type NextRequest } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';
import { probeAppKeys } from '@/lib/llm/probe';

// The DB touch takes 1-3s on a cold M0 connect and the four key probes run in
// parallel under a 10s cap each (lib/llm/probe.ts), so 20s leaves headroom.
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  // Require Vercel's standard cron auth header. CRON_SECRET is set as a
  // project env var on Vercel; the cron runner injects the Authorization
  // header automatically. Anything else (including missing config) → 401.
  if (!process.env.CRON_SECRET) {
    console.error('Keep-alive misconfigured: CRON_SECRET is unset');
    return new NextResponse('Server misconfigured', { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await dbConnect();
    // Touch the DB so MongoDB Atlas doesn't pause the free-tier cluster.
    // Result is intentionally discarded — exposing the count was the SEC-004
    // info-leak. The auth check above blocks unauthenticated callers, but
    // keeping the response shape minimal is defense-in-depth.
    await BugReport.countDocuments({});

    // Daily app-key probe: one one-token call per provider on the app's own key,
    // logged as "[probe] provider=... status=ok|<http status>|timeout|error"
    // (Batch E3.1, item 6, the first piece of the model radar). Its outcome
    // lives in the logs: the response stays minimal and the cron's own status
    // is the DB touch.
    try {
      await probeAppKeys();
    } catch (error) {
      console.error('Key probe failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    return NextResponse.json({ status: 'ok', timestamp: Date.now() });
  } catch (error) {
    console.error('Keep-alive failed:', error);
    return NextResponse.json(
      { status: 'error', timestamp: Date.now() },
      { status: 500 }
    );
  }
}
