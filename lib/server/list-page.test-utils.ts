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

// A tiny evaluator for the filter shapes pageQuery produces, so a paging walk
// (helper spec and route specs) runs the real clause logic over rows that share
// milliseconds. memoryModel is a stand-in for a seeded collection.
export type Doc = Record<string, unknown>;
export const cmp = (a: unknown, b: unknown): number => {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (a instanceof Types.ObjectId && b instanceof Types.ObjectId) {
    return a.toHexString() < b.toHexString() ? -1 : a.toHexString() > b.toHexString() ? 1 : 0;
  }
  return a === b ? 0 : NaN;
};
export function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$and') return (cond as Doc[]).every(f => matches(doc, f));
    if (key === '$or') return (cond as Doc[]).some(f => matches(doc, f));
    const v = doc[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !(cond instanceof Types.ObjectId)) {
      return Object.entries(cond as Doc).every(([op, arg]) => {
        if (v === undefined || v === null) return false;
        if (op === '$lt') return cmp(v, arg) < 0;
        if (op === '$lte') return cmp(v, arg) <= 0;
        throw new Error(`unsupported operator ${op}`);
      });
    }
    return cmp(v, cond) === 0;
  });
}
export function memoryModel(all: FakeRow[], sortField: 'created_at' | 'updated_at') {
  return {
    find(filter: Doc) {
      let limit = Infinity;
      const run = () =>
        all
          .filter(d => matches(d, filter))
          .sort((a, b) => cmp(b[sortField], a[sortField]) || cmp(b._id, a._id))
          .slice(0, limit);
      const q = {
        sort: () => q,
        limit: (n: number) => ((limit = n), q),
        lean: () => q,
        maxTimeMS: () => q,
        then: <A = FakeRow[], B = never>(
          ok?: ((rows: FakeRow[]) => A | PromiseLike<A>) | null,
          fail?: ((reason: unknown) => B | PromiseLike<B>) | null,
        ) => Promise.resolve(run()).then(ok, fail),
      };
      return q;
    },
  };
}
