import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';
import { isClerkUserId, purgeUserData } from '@/lib/server/purge-user';

// Clerk (through Svix) calls this endpoint; register it in the Clerk dashboard
// as https://www.winqa.ai/api/webhooks/clerk (the apex answers 308).
//
// There is no Clerk session on these requests: the Svix signature is the only
// gate, so this route makes no auth() call and no allowance metering. When
// Batch F replaces the bare clerkMiddleware() with an auth.protect() route
// matcher, /api/webhooks/clerk must stay outside that matcher, or every
// delivery is refused before it reaches the signature check.
//
// Status codes drive Svix: any non-2xx is retried, a 2xx is final.
//   secret unset/invalid  500 (fail closed; retried once the env var is fixed)
//   bad signature / time  400
//   other event types     200, ignored
//   user.deleted, no id   400, no database call
//   purge failed          500 (retried; the purge is idempotent)
//   purged                200 with per-collection counts
//
// Logs never carry the user id (decision D12: logs are the only record).

export const maxDuration = 30;

// A Clerk signing secret: 'whsec_' and the base64 key. A bare 'whsec_' decodes
// to an empty HMAC key that anyone can sign with, and a short placeholder is
// guessable, so both count as not configured.
const SIGNING_SECRET_FORMAT = /^whsec_[A-Za-z0-9+/]{32,}={0,2}$/;

export async function POST(req: NextRequest) {
  // Checked here, not left to verifyWebhook: a configuration fault must answer
  // 500 and log its own line, not look like a forged request (verifyWebhook
  // throws on a missing secret too, which the catch below would turn into 400).
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim();
  if (!secret || !SIGNING_SECRET_FORMAT.test(secret)) {
    console.error(
      '[account] webhook refused: CLERK_WEBHOOK_SIGNING_SECRET is not set or is not a whsec_ signing secret'
    );
    return Response.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req, { signingSecret: secret });
  } catch {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  // Verified above: verifyWebhook refuses a request without this header.
  const svixId = req.headers.get('svix-id') ?? 'unknown';

  if (evt.type !== 'user.deleted') {
    return Response.json({ received: true, ignored: evt.type });
  }

  const userId = evt.data.id;
  if (!isClerkUserId(userId)) {
    console.error(`[account] user.deleted svix=${svixId} refused: no Clerk user id in the event`);
    return Response.json({ error: 'Event has no user id' }, { status: 400 });
  }

  let counts: Awaited<ReturnType<typeof purgeUserData>>;
  try {
    counts = await purgeUserData(userId);
  } catch (err) {
    // The error name only: a driver message could quote the filter, which
    // holds the user id.
    const name = err instanceof Error ? err.name : 'unknown error';
    console.error(`[account] user.deleted svix=${svixId} purge failed: ${name}`);
    return Response.json({ error: 'Purge failed' }, { status: 500 });
  }

  const summary = Object.entries(counts)
    .map(([collection, { deleted, reassigned }]) =>
      reassigned > 0 ? `${collection}=${deleted} ${collection}_reassigned=${reassigned}` : `${collection}=${deleted}`
    )
    .join(' ');
  console.log(`[account] user.deleted svix=${svixId} ${summary}`);

  return Response.json({ received: true, counts });
}
