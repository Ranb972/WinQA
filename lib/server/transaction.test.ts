import { describe, it, expect, vi } from 'vitest';
import type { Connection } from 'mongoose';
import {
  runInTransaction,
  supportsTransactions,
  TRANSACTION_MAX_COMMIT_TIME_MS,
} from './transaction';

function fakeConnection(hello: () => Promise<Record<string, unknown>>) {
  const command = vi.fn(async (cmd: Record<string, unknown>) => {
    void cmd;
    return hello();
  });
  const conn = { db: { admin: () => ({ command }) } } as unknown as Connection;
  return { conn, command };
}

describe('supportsTransactions', () => {
  it('is true for a replica set member (hello has a setName)', async () => {
    const { conn, command } = fakeConnection(async () => ({ setName: 'atlas-abc-shard-0', isWritablePrimary: true }));
    expect(await supportsTransactions(conn)).toBe(true);
    expect(command).toHaveBeenCalledWith({ hello: 1 });
  });

  it('is true behind mongos (msg: isdbgrid)', async () => {
    const { conn } = fakeConnection(async () => ({ msg: 'isdbgrid' }));
    expect(await supportsTransactions(conn)).toBe(true);
  });

  it('is false for a standalone server', async () => {
    const { conn } = fakeConnection(async () => ({ isWritablePrimary: true }));
    expect(await supportsTransactions(conn)).toBe(false);
  });

  it('is false when setName is not a string', async () => {
    const { conn } = fakeConnection(async () => ({ setName: 1 }));
    expect(await supportsTransactions(conn)).toBe(false);
  });

  it('asks the server once per connection: one command for two calls', async () => {
    const { conn, command } = fakeConnection(async () => ({ setName: 'rs0' }));
    expect(await supportsTransactions(conn)).toBe(true);
    expect(await supportsTransactions(conn)).toBe(true);
    expect(command).toHaveBeenCalledTimes(1);

    const standalone = fakeConnection(async () => ({}));
    expect(await supportsTransactions(standalone.conn)).toBe(false);
    expect(await supportsTransactions(standalone.conn)).toBe(false);
    expect(standalone.command).toHaveBeenCalledTimes(1);
  });

  it('a failed probe answers false and is not cached', async () => {
    let fail = true;
    const { conn, command } = fakeConnection(async () => {
      if (fail) throw new Error('network');
      return { setName: 'rs0' };
    });
    expect(await supportsTransactions(conn)).toBe(false);
    fail = false;
    expect(await supportsTransactions(conn)).toBe(true);
    expect(command).toHaveBeenCalledTimes(2);
  });

  it('is false for a connection that has no db yet', async () => {
    expect(await supportsTransactions({ db: undefined } as unknown as Connection)).toBe(false);
  });
});

describe('runInTransaction', () => {
  it('passes fn to conn.transaction with maxCommitTimeMS and returns its result', async () => {
    const session = { id: 'session' };
    const transaction = vi.fn(async (fn: (s: unknown) => Promise<unknown>, opts: unknown) => {
      void opts;
      return fn(session);
    });
    const conn = { transaction } as unknown as Connection;
    const fn = vi.fn(async () => 'done');

    await expect(runInTransaction(conn, fn)).resolves.toBe('done');
    expect(TRANSACTION_MAX_COMMIT_TIME_MS).toBe(10_000);
    expect(transaction).toHaveBeenCalledWith(fn, { maxCommitTimeMS: 10_000 });
    expect(fn).toHaveBeenCalledWith(session);
  });

  it('rethrows what the transaction rejects with', async () => {
    const boom = new Error('aborted');
    const conn = {
      transaction: async (fn: (s: unknown) => Promise<unknown>) => fn({}),
    } as unknown as Connection;
    await expect(
      runInTransaction(conn, async () => {
        throw boom;
      })
    ).rejects.toBe(boom);
  });
});
