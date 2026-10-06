/**
 * Multi-document transactions for the routes that delete and rewrite a set of
 * rows (Batch D, D3: import; D4: admin reseed).
 *
 * MongoDB runs transactions only on a replica set member or through mongos.
 * The topology comes entirely from MONGODB_URI (lib/mongodb.ts sets none), so
 * the routes ask the server once per instance and, when the answer is no,
 * refuse the destructive operation (503) rather than delete outside a
 * transaction.
 */

import type { ClientSession, Connection } from 'mongoose';

/** The commit may take this long before the driver gives up on it. */
export const TRANSACTION_MAX_COMMIT_TIME_MS = 10_000;

// One answer per connection object, so per server instance. Only a successful
// probe is cached: a failed one answers false this time and is asked again on
// the next request.
const probed = new WeakMap<object, boolean>();

/**
 * True when the server behind `conn` can run multi-document transactions: a
 * replica set member (`hello` returns a `setName`) or a mongos router
 * (`msg: 'isdbgrid'`). A standalone server, a connection with no `db` yet, or a
 * failed probe answer false.
 */
export async function supportsTransactions(conn: Connection): Promise<boolean> {
  const cached = probed.get(conn);
  if (cached !== undefined) return cached;

  const db = conn.db;
  if (!db) return false;

  let hello: Record<string, unknown>;
  try {
    hello = (await db.admin().command({ hello: 1 })) as Record<string, unknown>;
  } catch (error) {
    // A failed probe is not a standalone server: say so, without the driver message.
    const name = error instanceof Error ? error.name : 'unknown';
    console.warn(`[transaction] probe=error name=${name}`);
    return false;
  }
  const supported = typeof hello.setName === 'string' || hello.msg === 'isdbgrid';
  probed.set(conn, supported);
  return supported;
}

/**
 * Runs `fn` in one transaction on `conn`. Mongoose commits when `fn` resolves,
 * retries transient errors (so `fn` may run more than once and must start from
 * scratch each time), and aborts and rethrows when `fn` throws.
 *
 * Every operation in `fn` must pass `{ session }` and run after the previous one
 * settled: never Promise.all inside a transaction.
 */
export function runInTransaction<T>(
  conn: Connection,
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  return conn.transaction(fn, { maxCommitTimeMS: TRANSACTION_MAX_COMMIT_TIME_MS });
}
