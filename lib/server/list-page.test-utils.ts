// Test-only helpers for the list-route specs (not a spec itself: the name does not
// end in .test.ts). Nothing here touches a database.
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { Types } from 'mongoose';

export interface FakeQuery<Row> extends PromiseLike<Row[]> {
  sort: Mock;
  limit: Mock;
  lean: Mock;
  maxTimeMS: Mock;
}

/**
 * A chainable stand-in for a Mongoose query. Every builder returns the same
 * object and awaiting it at any point yields `rows`, so code that skips a
 * builder still runs and the spec can assert on what was (not) called.
 */
export function fakeQuery<Row>(rows: Row[]): FakeQuery<Row> {
  const q = {
    sort: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn(),
    maxTimeMS: vi.fn(),
    then<A = Row[], B = never>(
      onFulfilled?: ((value: Row[]) => A | PromiseLike<A>) | null,
      onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
  q.sort.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  q.lean.mockReturnValue(q);
  q.maxTimeMS.mockReturnValue(q);
  return q;
}

export interface FakeRow {
  _id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

/**
 * `n` lean rows, newest first. Pairs of rows share a millisecond so the _id
 * tie-break matters; within a pair the larger _id comes first.
 */
export function makeRows(n: number, startMs = Date.UTC(2026, 9, 1)): FakeRow[] {
  const rows: FakeRow[] = [];
  for (let i = 0; i < n; i++) {
    const at = new Date(startMs - Math.floor(i / 2) * 1000);
    // Descending hex ids: row 0 has the largest.
    const id = new Types.ObjectId((0xffffff - i).toString(16).padStart(24, '0'));
    rows.push({ _id: id, created_at: at, updated_at: at, title: `row ${i}` });
  }
  return rows;
}

/** The cursor the server should send after `row`, computed independently. */
export function cursorOf(at: Date, id: Types.ObjectId): string {
  return `${String(at.getTime()).padStart(13, '0')}_${id.toHexString()}`;
}
