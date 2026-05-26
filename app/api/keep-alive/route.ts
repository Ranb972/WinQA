import { NextResponse, type NextRequest } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';

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
    return NextResponse.json({ status: 'ok', timestamp: Date.now() });
  } catch (error) {
    console.error('Keep-alive failed:', error);
    return NextResponse.json(
      { status: 'error', timestamp: Date.now() },
      { status: 500 }
    );
  }
}
