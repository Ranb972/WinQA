// Test-only helper for the ceiling specs (not a spec itself: the name does not
// end in .test.ts). Nothing here touches a database.
import { vi } from 'vitest';
import type { Mock } from 'vitest';

export interface FakeCountQuery extends PromiseLike<number> {
  maxTimeMS: Mock;
}

/**
 * A stand-in for the Query that Model.countDocuments returns: maxTimeMS returns
 * the same query (as Mongoose's `this` does), and awaiting it at any point
 * yields `count`, or rejects with `count` when it is an Error. A spec asserts on
 * maxTimeMS to prove the deadline was set.
 */
export function fakeCount(count: number | Error): FakeCountQuery {
  const q = {
    maxTimeMS: vi.fn(),
    then<A = number, B = never>(
      onFulfilled?: ((value: number) => A | PromiseLike<A>) | null,
      onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      const settled = count instanceof Error ? Promise.reject(count) : Promise.resolve(count);
      return settled.then(onFulfilled, onRejected);
    },
  };
  q.maxTimeMS.mockReturnValue(q);
  return q;
}
