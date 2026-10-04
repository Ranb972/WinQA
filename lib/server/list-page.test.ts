import { describe, it, expect, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  cursorClause,
  encodeCursor,
  pageQuery,
  pageResponse,
  parsePage,
  NEXT_CURSOR_HEADER,
} from '@/lib/server/list-page';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';
import { cursorOf, fakeQuery, makeRows } from '@/lib/server/list-page.test-utils';
import type { FakeRow } from '@/lib/server/list-page.test-utils';
import Battle from '@/models/Battle';
import BugReport from '@/models/BugReport';
import Insight from '@/models/Insight';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';

const PAGE = { def: 200, max: 200 };
const params = (qs: string) => new URLSearchParams(qs);
const ID = '65f0a1b2c3d4e5f6a7b8c9d0';

describe('parsePage', () => {
  it('defaults the limit and has no cursor without params', () => {
    expect(parsePage(params(''), PAGE)).toEqual({ ok: true, page: { limit: 200, before: null } });
  });

  it('accepts an integer limit within 1..max', () => {
    const r = parsePage(params('limit=7'), { def: 50, max: 50 });
    expect(r.ok && r.page.limit).toBe(7);
  });

  it('clamps a limit over max to max', () => {
    const r = parsePage(params('limit=999'), PAGE);
    expect(r.ok && r.page.limit).toBe(200);
  });

  it.each(['0', '-1', 'abc', '1.5', '', '1e3', ' 5'])('falls back to def for limit=%j', raw => {
    const r = parsePage(params(`limit=${encodeURIComponent(raw)}`), { def: 50, max: 200 });
    expect(r.ok && r.page.limit).toBe(50);
  });

  it('parses a well-formed cursor into a Date and an ObjectId', () => {
    const r = parsePage(params(`before=1759276800000_${ID}`), PAGE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.page.before?.at.getTime()).toBe(1759276800000);
    expect(r.page.before?.id).toBeInstanceOf(Types.ObjectId);
    expect(r.page.before?.id.toHexString()).toBe(ID);
  });

  it.each([
    'garbage',
    `1759276800000-${ID}`,
    `175927680000_${ID}`,
    `17592768000000_${ID}`,
    `1759276800000_${ID.toUpperCase()}`,
    `1759276800000_${ID}0`,
    `1759276800000_${ID}\n`,
    `1759276800000_{"$gt":""}`,
    '',
  ])('answers 400 "Invalid cursor" for before=%j without echoing it', async raw => {
    const r = parsePage(params(`before=${encodeURIComponent(raw)}`), PAGE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(400);
    const text = await r.response.text();
    expect(JSON.parse(text)).toEqual({ error: 'Invalid cursor' });
  });
});

describe('encodeCursor', () => {
  it('round-trips through parsePage', () => {
    const at = new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 678));
    const id = new Types.ObjectId(ID);
    const cursor = encodeCursor(at, id);
    expect(cursor).toBe(`${at.getTime()}_${ID}`);
    const r = parsePage(params(`before=${cursor}`), PAGE);
    expect(r.ok && r.page.before?.at.getTime()).toBe(at.getTime());
    expect(r.ok && r.page.before?.id.toHexString()).toBe(ID);
  });

  it('zero-pads dates before 2001 to 13 digits', () => {
    const cursor = encodeCursor(new Date(Date.UTC(1999, 0, 1)), new Types.ObjectId(ID));
    expect(cursor).toMatch(/^0\d{12}_/);
    expect(parsePage(params(`before=${cursor}`), PAGE).ok).toBe(true);
  });

  it('gives null for a missing or unusable sort value', () => {
    const id = new Types.ObjectId(ID);
    expect(encodeCursor(undefined, id)).toBeNull();
    expect(encodeCursor('2026-01-01', id)).toBeNull();
    expect(encodeCursor(new Date(NaN), id)).toBeNull();
    expect(encodeCursor(new Date(-1), id)).toBeNull();
  });
});

describe('pageQuery against a fake query', () => {
  const visibility = { $or: [{ user_id: 'user_a' }, { is_public: true }] };

  it('asks for limit + 1 rows, newest first with _id breaking ties, lean and time-boxed', async () => {
    const q = fakeQuery(makeRows(3));
    const find = vi.fn(() => q);
    await pageQuery({ find }, visibility, 'created_at', { limit: 200, before: null });
    expect(find).toHaveBeenCalledWith(visibility);
    expect(q.sort).toHaveBeenCalledWith({ created_at: -1, _id: -1 });
    expect(q.limit).toHaveBeenCalledWith(201);
    expect(q.lean).toHaveBeenCalled();
    expect(q.maxTimeMS).toHaveBeenCalledWith(DB_QUERY_MAX_TIME_MS);
    expect(DB_QUERY_MAX_TIME_MS).toBe(5000);
  });

  it('cuts limit + 1 rows to limit and builds the cursor from the last kept row', async () => {
    const rows = makeRows(5);
    const { rows: page, nextCursor } = await pageQuery(
      { find: () => fakeQuery(rows) },
      visibility,
      'updated_at',
      { limit: 4, before: null },
    );
    expect(page).toEqual(rows.slice(0, 4));
    expect(nextCursor).toBe(cursorOf(rows[3].updated_at, rows[3]._id));
  });

  it('sends no cursor when the page is not full', async () => {
    const rows = makeRows(4);
    const r = await pageQuery({ find: () => fakeQuery(rows) }, visibility, 'created_at', {
      limit: 4,
      before: null,
    });
    expect(r.rows).toHaveLength(4);
    expect(r.nextCursor).toBeNull();
  });

  it('puts the cursor clause beside the filter under $and, leaving the visibility $or intact', async () => {
    const find = vi.fn(() => fakeQuery([]));
    const before = { at: new Date(1759276800000), id: new Types.ObjectId(ID) };
    const filter = { ...visibility, status: 'Open' };
    await pageQuery({ find }, filter, 'created_at', { limit: 10, before });
    expect(find).toHaveBeenCalledWith({
      $and: [
        { $or: [{ user_id: 'user_a' }, { is_public: true }], status: 'Open' },
        {
          created_at: { $lte: before.at },
          $or: [{ created_at: { $lt: before.at } }, { _id: { $lt: before.id } }],
        },
      ],
    });
  });
});

// A tiny evaluator for the filter shapes pageQuery produces, so the paging walk
// below runs the real clause logic over rows that share milliseconds.
type Doc = Record<string, unknown>;
const cmp = (a: unknown, b: unknown): number => {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (a instanceof Types.ObjectId && b instanceof Types.ObjectId) {
    return a.toHexString() < b.toHexString() ? -1 : a.toHexString() > b.toHexString() ? 1 : 0;
  }
  return a === b ? 0 : NaN;
};
function matches(doc: Doc, filter: Doc): boolean {
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
function memoryModel(all: FakeRow[], sortField: 'created_at' | 'updated_at') {
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

describe('paging walk over rows that share milliseconds', () => {
  // 30 rows, pairs share a millisecond; every third row belongs to another user
  // and is private, so it must never appear.
  const all = makeRows(30).map((r, i) => ({
    ...r,
    user_id: i % 3 === 0 ? 'user_other' : 'user_a',
    is_public: i % 5 === 0,
  }));
  const visible = all.filter(r => r.user_id === 'user_a' || r.is_public);
  const visibility = { $or: [{ user_id: 'user_a' }, { is_public: true }] };

  it.each([1, 3, 4, 7, 50])('returns every visible row exactly once, in order, with limit %i', async limit => {
    const model = memoryModel(all, 'created_at');
    const seen: FakeRow[] = [];
    let qs = '';
    for (let guard = 0; guard < 100; guard++) {
      const parsed = parsePage(params(qs), { def: limit, max: limit });
      if (!parsed.ok) throw new Error('cursor refused');
      const { rows, nextCursor } = await pageQuery<FakeRow>(model, visibility, 'created_at', parsed.page);
      seen.push(...rows);
      if (!nextCursor) break;
      qs = `before=${nextCursor}`;
    }
    expect(seen.map(r => r._id.toHexString())).toEqual(visible.map(r => r._id.toHexString()));
  });
});

describe('the real Mongoose cast keeps the cursor types', () => {
  it('casts the $and query to a Date range and an ObjectId bound', () => {
    const before = { at: new Date(1759276800000), id: new Types.ObjectId(ID) };
    const query = BugReport.find({
      $and: [{ $or: [{ user_id: 'u' }, { is_public: true }] }, cursorClause('created_at', before)],
    });
    const cast = query.cast(BugReport) as Doc;
    const [vis, clause] = cast.$and as Doc[];
    expect(vis).toEqual({ $or: [{ user_id: 'u' }, { is_public: true }] });
    expect((clause.created_at as Doc).$lte).toBeInstanceOf(Date);
    const [lt, tie] = clause.$or as Doc[];
    expect((lt.created_at as Doc).$lt).toEqual(before.at);
    expect((tie._id as Doc).$lt).toBeInstanceOf(Types.ObjectId);
  });
});

describe('pageResponse', () => {
  it('sends a bare array and the cursor header only when there is a next page', async () => {
    const withNext = pageResponse([{ a: 1 }], 'c');
    expect(await withNext.json()).toEqual([{ a: 1 }]);
    expect(withNext.headers.get(NEXT_CURSOR_HEADER)).toBe('c');
    const last = pageResponse([], null);
    expect(await last.json()).toEqual([]);
    expect(last.headers.get(NEXT_CURSOR_HEADER)).toBeNull();
  });
});

describe('list indexes in the schemas', () => {
  const keysOf = (model: { schema: { indexes(): unknown[] } }) =>
    model.schema.indexes().map(entry => JSON.stringify((entry as [Doc])[0]));

  it.each([
    ['BugReport', BugReport],
    ['PromptLibrary', PromptLibrary],
    ['TestCase', TestCase],
  ] as const)('%s has the two (..., created_at, _id) list indexes and keeps the old one', (_name, model) => {
    const keys = keysOf(model);
    expect(keys).toContain(JSON.stringify({ user_id: 1, created_at: -1, _id: -1 }));
    expect(keys).toContain(JSON.stringify({ is_public: 1, created_at: -1, _id: -1 }));
    expect(keys).toContain(JSON.stringify({ is_public: 1, created_at: -1 }));
  });

  it('Insight has the two (..., updated_at, _id) list indexes and keeps the old one', () => {
    const keys = keysOf(Insight);
    expect(keys).toContain(JSON.stringify({ user_id: 1, updated_at: -1, _id: -1 }));
    expect(keys).toContain(JSON.stringify({ is_public: 1, updated_at: -1, _id: -1 }));
    expect(keys).toContain(JSON.stringify({ is_public: 1, updated_at: -1 }));
  });

  it('Battle has the (odlUserId, created_at, _id) history index and keeps the old one', () => {
    const keys = keysOf(Battle);
    expect(keys).toContain(JSON.stringify({ odlUserId: 1, created_at: -1, _id: -1 }));
    expect(keys).toContain(JSON.stringify({ odlUserId: 1, created_at: -1 }));
  });
});
