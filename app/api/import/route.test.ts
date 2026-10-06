import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';
import { BUG_REPORT_CAPS } from '@/lib/content-limits';

// No database: auth and dbConnect are mocked, and the model statics are spied
// on below. Creating a Mongoose model opens no connection. dbConnect resolves
// to { connection: <fake> }; the fake's transaction(fn) calls fn(fakeSession)
// and records start, commit and abort in the same log as the writes.
const { authMock, dbConnectMock } = vi.hoisted(() => ({
  authMock: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: null })),
  dbConnectMock: vi.fn(async (): Promise<unknown> => undefined),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/mongodb', () => ({ default: dbConnectMock }));

import * as route from './route';
const { POST } = route;

const USER = 'user_2abcDEF123';
const PRIVATE_ONLY = { user_id: USER, is_public: { $ne: true } };

const MODELS = { bugs: BugReport, prompts: PromptLibrary, testCases: TestCase, insights: Insight };
type Collection = keyof typeof MODELS;
const COLLECTIONS = Object.keys(MODELS) as Collection[];

// Every write and every transaction step is appended here in order. A write
// logs `:start` when called and `:end` when it settles, so two writes that
// overlap (Promise.all) show up as two starts in a row.
const calls: string[] = [];
type Spy = ReturnType<typeof vi.fn>;
const deleteSpies = {} as Record<Collection, Spy>;
const insertSpies = {} as Record<Collection, Spy>;

const SESSION = { fake: 'session' };
interface FakeConn {
  db: { admin(): { command: Spy } };
  transaction: Spy;
  inTransaction: boolean;
  rejectedWith: unknown;
  /** For each write: did it carry the fake session, and did it run inside the runner? */
  writes: Array<{ label: string; session: unknown; inside: boolean }>;
}
let conn: FakeConn;

function makeConn(supported: boolean): FakeConn {
  const fake: FakeConn = {
    db: { admin: () => ({ command }) },
    inTransaction: false,
    rejectedWith: undefined,
    writes: [],
    transaction: vi.fn(async (fn: (s: unknown) => Promise<unknown>, opts: unknown) => {
      void opts;
      calls.push('txn:start');
      fake.inTransaction = true;
      try {
        const result = await fn(SESSION);
        calls.push('txn:commit');
        return result;
      } catch (err) {
        calls.push('txn:abort');
        fake.rejectedWith = err;
        throw err;
      } finally {
        fake.inTransaction = false;
      }
    }),
  };
  const command = vi.fn(async () => (supported ? { setName: 'rs0' } : { isWritablePrimary: true }));
  return fake;
}

function recordWrite(label: string, options: unknown) {
  calls.push(`${label}:start`);
  conn.writes.push({
    label,
    session: (options as { session?: unknown } | undefined)?.session,
    inside: conn.inTransaction,
  });
}

// A write settles on a later macrotask, so an overlapping write would start
// before this one ends.
const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

function spyWrites() {
  for (const name of COLLECTIONS) {
    deleteSpies[name] = vi
      .spyOn(MODELS[name], 'deleteMany')
      .mockImplementation((async (_filter: unknown, options: unknown) => {
        recordWrite(`${name}.deleteMany`, options);
        await settle();
        calls.push(`${name}.deleteMany:end`);
        return { deletedCount: 3 };
      }) as never) as unknown as Spy;
    insertSpies[name] = vi
      .spyOn(MODELS[name], 'insertMany')
      .mockImplementation((async (docs: unknown[], options: unknown) => {
        recordWrite(`${name}.insertMany`, options);
        await settle();
        calls.push(`${name}.insertMany:end`);
        return docs;
      }) as never) as unknown as Spy;
  }
}

beforeEach(() => {
  calls.length = 0;
  authMock.mockReset();
  authMock.mockResolvedValue({ userId: USER });
  conn = makeConn(true);
  dbConnectMock.mockReset();
  dbConnectMock.mockImplementation(async () => ({ connection: conn }));
  spyWrites();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function validFile() {
  return {
    exportDate: '2026-10-01T00:00:00.000Z',
    version: '1.0',
    data: {
      bugs: [
        {
          id: '65f0c0ffee0000000000000a',
          prompt_context: 'context',
          model_response: 'response',
          model_used: 'model',
          issue_type: 'Logic',
          severity: 'Low',
          status: 'Open',
          user_notes: 'notes',
          is_public: false,
          created_at: '2026-09-01T10:00:00.000Z',
        },
      ],
      prompts: [
        {
          title: 'title',
          bad_prompt_example: 'bad',
          good_prompt_example: 'good',
          explanation: 'why',
          tags: ['one'],
          created_at: '2026-09-02T10:00:00.000Z',
        },
      ],
      testCases: [{ title: 'title', initial_prompt: 'prompt', category: 'cat', difficulty: 'easy' }],
      insights: [{ title: 'title', content: 'content', tags: [] }],
    } as Record<string, unknown[]>,
  };
}

function post(body: unknown): NextRequest {
  return new Request('http://localhost/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

function expectNoWrites() {
  for (const name of COLLECTIONS) {
    expect(deleteSpies[name]).not.toHaveBeenCalled();
    expect(insertSpies[name]).not.toHaveBeenCalled();
  }
}

describe('POST /api/import: the is_public guard (D2)', () => {
  it('replace deletes only private rows: each filter is { user_id, is_public: { $ne: true } }', async () => {
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(200);
    for (const name of COLLECTIONS) {
      expect(deleteSpies[name]).toHaveBeenCalledTimes(1);
      expect(deleteSpies[name].mock.calls[0][0]).toEqual(PRIVATE_ONLY);
    }
  });

  it('an element claiming is_public: true and user_id: system is inserted private and owned by the caller', async () => {
    const file = validFile();
    for (const name of COLLECTIONS) {
      Object.assign(file.data[name][0] as object, { is_public: true, user_id: 'system' });
    }
    const res = await POST(post({ data: file, mode: 'merge' }));
    expect(res.status).toBe(200);
    for (const name of COLLECTIONS) {
      expect(insertSpies[name]).toHaveBeenCalledTimes(1);
      const [doc] = insertSpies[name].mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(doc.is_public).toBe(false);
      expect(doc.user_id).toBe(USER);
    }
  });

  it.each(['system', 'user_'])('refuses the caller id %j with 400 and opens no DB connection', async (id) => {
    authMock.mockResolvedValue({ userId: id });
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(400);
    expect(dbConnectMock).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('answers 401 without a signed-in user and opens no DB connection', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(401);
    expect(dbConnectMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/import: the whole file is validated before any write (D3)', () => {
  it('replace with bugs: [42] answers 400 naming bugs item 1 and deletes nothing', async () => {
    const file = validFile();
    file.data.bugs = [42];
    const res = await POST(post({ data: file, mode: 'replace' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Nothing was imported. bugs item 1: the item is not an object.');
    expect(body.problems).toEqual([{ collection: 'bugs', item: 1, field: null }]);
    expectNoWrites();
    expect(dbConnectMock).not.toHaveBeenCalled();
  });

  it('replace with severity: Critical answers 400 naming the field and deletes nothing', async () => {
    const file = validFile();
    (file.data.bugs[0] as Record<string, unknown>).severity = 'Critical';
    const res = await POST(post({ data: file, mode: 'replace' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Nothing was imported. bugs item 1: severity is not an allowed value.');
    expect(body.problems).toEqual([{ collection: 'bugs', item: 1, field: 'severity' }]);
    expectNoWrites();
  });

  it('replace with a model_response over its cap answers 400 naming the field, before dbConnect, and deletes nothing', async () => {
    const file = validFile();
    (file.data.bugs[0] as Record<string, unknown>).model_response = 'x'.repeat(BUG_REPORT_CAPS.model_response + 1);
    const res = await POST(post({ data: file, mode: 'replace' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Nothing was imported. bugs item 1: model_response is too long.');
    expect(body.problems).toEqual([{ collection: 'bugs', item: 1, field: 'model_response' }]);
    expect(dbConnectMock).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it('replace with a bug missing model_response answers 400 naming the field and deletes nothing', async () => {
    const file = validFile();
    delete (file.data.bugs[0] as Record<string, unknown>).model_response;
    const res = await POST(post({ data: file, mode: 'replace' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Nothing was imported. bugs item 1: model_response is required.');
    expectNoWrites();
  });

  it('created_at: "not a date" answers 400 and deletes nothing', async () => {
    const file = validFile();
    (file.data.prompts[0] as Record<string, unknown>).created_at = 'not a date';
    const res = await POST(post({ data: file, mode: 'replace' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Nothing was imported. prompts item 1: created_at is not a valid date.');
    expectNoWrites();
  });

  it('1,001 bugs answer 400 before dbConnect', async () => {
    const file = validFile();
    file.data.bugs = Array.from({ length: 1001 }, () => ({ ...(file.data.bugs[0] as object) }));
    const res = await POST(post({ data: file, mode: 'replace' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Nothing was imported. bugs has more than 1000 items.');
    expect(dbConnectMock).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it('version 2.0 answers 400', async () => {
    const res = await POST(post({ data: { ...validFile(), version: '2.0' }, mode: 'replace' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Nothing was imported. The file is not a WinQA export of version 1.0.');
    expectNoWrites();
  });

  it('a missing testCases list answers 400 (D-3)', async () => {
    const file = validFile();
    delete file.data.testCases;
    const res = await POST(post({ data: file, mode: 'replace' }));
    expect(res.status).toBe(400);
    expectNoWrites();
  });

  it('a body over 4 MB answers 413 with the import sentence and opens no DB connection', async () => {
    const res = await POST(post('x'.repeat(4 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'This file is larger than 4 MB. Nothing was imported.' });
    expect(dbConnectMock).not.toHaveBeenCalled();
  });

  it('a body that is not JSON answers 400 and opens no DB connection', async () => {
    const res = await POST(post('{'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
    expect(dbConnectMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/import: writes run in one transaction (D3)', () => {
  it('happy replace: four deletes then four inserts, each with the session, inside the runner, one at a time', async () => {
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(200);
    expect(conn.transaction).toHaveBeenCalledTimes(1);
    expect(conn.transaction.mock.calls[0][1]).toEqual({ maxCommitTimeMS: 10_000 });
    expect(calls).toEqual([
      'txn:start',
      ...COLLECTIONS.flatMap((n) => [`${n}.deleteMany:start`, `${n}.deleteMany:end`]),
      ...COLLECTIONS.flatMap((n) => [`${n}.insertMany:start`, `${n}.insertMany:end`]),
      'txn:commit',
    ]);
    expect(conn.writes).toHaveLength(8);
    for (const write of conn.writes) {
      expect(write.session).toBe(SESSION);
      expect(write.inside).toBe(true);
    }
    for (const name of COLLECTIONS) {
      expect(insertSpies[name].mock.calls[0][1]).toEqual({ session: SESSION, ordered: true });
    }
    expect(await res.json()).toEqual({
      success: true,
      mode: 'replace',
      imported: { bugs: 1, prompts: 1, testCases: 1, insights: 1 },
      deleted: { bugs: 3, prompts: 3, testCases: 3, insights: 3 },
    });
  });

  it('an insert that rejects inside the runner answers 500 and the runner aborted', async () => {
    const failure = new Error('E11000 duplicate key');
    insertSpies.testCases.mockImplementation((async () => {
      calls.push('testCases.insertMany:start');
      throw failure;
    }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Import failed. Nothing was changed.' });
    expect(conn.rejectedWith).toBe(failure);
    expect(calls.at(-1)).toBe('txn:abort');
    expect(insertSpies.insights).not.toHaveBeenCalled();
  });

  it('a ValidationError inside the runner answers 400, not 500', async () => {
    insertSpies.bugs.mockImplementation((async () => {
      throw Object.assign(new Error('validation failed'), { name: 'ValidationError' });
    }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post({ data: validFile(), mode: 'merge' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Import failed. Nothing was changed.' });
    expect(calls.at(-1)).toBe('txn:abort');
  });

  it('replace without transactions answers 503 and writes nothing', async () => {
    conn = makeConn(false);
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'Replace import is unavailable right now. Nothing was changed. Merge still works.',
    });
    expect(conn.transaction).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it('merge deletes nothing; its inserts run inside the runner', async () => {
    const res = await POST(post({ data: validFile(), mode: 'merge' }));
    expect(res.status).toBe(200);
    for (const name of COLLECTIONS) expect(deleteSpies[name]).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'txn:start',
      ...COLLECTIONS.flatMap((n) => [`${n}.insertMany:start`, `${n}.insertMany:end`]),
      'txn:commit',
    ]);
    for (const write of conn.writes) {
      expect(write.session).toBe(SESSION);
      expect(write.inside).toBe(true);
    }
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      mode: 'merge',
      imported: { bugs: 1, prompts: 1, testCases: 1, insights: 1 },
    });
  });

  it('merge without transactions still appends, one insert at a time, with no session', async () => {
    conn = makeConn(false);
    const res = await POST(post({ data: validFile(), mode: 'merge' }));
    expect(res.status).toBe(200);
    expect(conn.transaction).not.toHaveBeenCalled();
    expect(calls).toEqual(COLLECTIONS.flatMap((n) => [`${n}.insertMany:start`, `${n}.insertMany:end`]));
    for (const write of conn.writes) expect(write.session).toBeUndefined();
  });

  it('an empty list is not written', async () => {
    const file = validFile();
    file.data.insights = [];
    const res = await POST(post({ data: file, mode: 'merge' }));
    expect(res.status).toBe(200);
    expect(insertSpies.insights).not.toHaveBeenCalled();
    expect((await res.json()).imported.insights).toBe(0);
  });

  it('exports maxDuration = 30', () => {
    expect(route.maxDuration).toBe(30);
  });

  it('logs one [import] line per outcome with no user id', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await POST(post({ data: validFile(), mode: 'replace' }));
    const lines = log.mock.calls.map((c) => c.join(' '));
    expect(lines).toEqual([expect.stringMatching(/^\[import\] mode=replace outcome=committed /)]);
    expect(lines.join('\n')).not.toContain(USER);
  });
});

describe('POST /api/import: no submitted value reaches the response or the logs', () => {
  const SENTINEL = 'SENTINEL_5be1d7';

  function sentinelFile(validEnums: boolean) {
    const file = validFile();
    for (const name of COLLECTIONS) {
      file.data[name] = [0, 1].map(() => {
        const item: Record<string, unknown> = {};
        for (const key of [
          'prompt_context', 'model_response', 'model_used', 'issue_type', 'severity', 'user_notes', 'status',
          'title', 'bad_prompt_example', 'good_prompt_example', 'explanation', 'description',
          'initial_prompt', 'expected_outcome', 'category', 'difficulty', 'content', 'id', 'user_id',
          'is_public', 'created_at',
        ]) {
          item[key] = SENTINEL;
        }
        item.tags = [SENTINEL];
        item[SENTINEL] = SENTINEL;
        if (validEnums) {
          Object.assign(item, { issue_type: 'Logic', severity: 'Low', status: 'Open' });
          delete item.created_at;
        }
        return item;
      });
    }
    return file;
  }

  function captureConsole() {
    const out: string[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        out.push(
          args
            .map((a) => (a instanceof Error ? `${a.name} ${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a)))
            .join(' ')
        );
      });
    }
    return out;
  }

  it('a rejected file (sentinel in every field)', async () => {
    const out = captureConsole();
    const res = await POST(post({ data: sentinelFile(false), mode: SENTINEL }));
    const res2 = await POST(post({ data: sentinelFile(false), mode: 'replace' }));
    expect(res.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(await res.text()).not.toContain(SENTINEL);
    expect(await res2.text()).not.toContain(SENTINEL);
    expect(out.join('\n')).not.toContain(SENTINEL);
    expectNoWrites();
  });

  it('a committed import of sentinel text', async () => {
    const out = captureConsole();
    const res = await POST(post({ data: sentinelFile(true), mode: 'replace' }));
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain(SENTINEL);
    expect(out.join('\n')).not.toContain(SENTINEL);
  });

  it('an aborted import whose driver error quotes the value', async () => {
    insertSpies.prompts.mockImplementation((async () => {
      throw Object.assign(new Error(`E11000 duplicate key { title: "${SENTINEL}" }`), {
        code: 11000,
        keyValue: { title: SENTINEL },
      });
    }) as never);
    const out = captureConsole();
    const res = await POST(post({ data: sentinelFile(true), mode: 'replace' }));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain(SENTINEL);
    const logged = out.join('\n');
    expect(logged).toContain('outcome=aborted');
    expect(logged).toContain('code=11000');
    expect(logged).not.toContain(SENTINEL);
  });
});

describe('POST /api/import: failures outside the runner', () => {
  it('a failed connect answers 500 "Nothing was changed" and writes nothing', async () => {
    dbConnectMock.mockImplementation(async () => {
      throw new Error('querySrv ENOTFOUND');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post({ data: validFile(), mode: 'merge' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Import failed. Nothing was changed.' });
    expectNoWrites();
  });

  it('a merge without transactions that fails part-way says some items may have been added', async () => {
    conn = makeConn(false);
    insertSpies.testCases.mockImplementation((async () => {
      throw new Error('network');
    }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post({ data: validFile(), mode: 'merge' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Import failed part-way. Some items may have been added; check your library before importing again.',
    });
    expect(deleteSpies.bugs).not.toHaveBeenCalled();
  });
});
