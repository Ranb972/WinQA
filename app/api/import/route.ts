import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { ClientSession } from 'mongoose';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';
import { isClerkUserId } from '@/lib/server/purge-user';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { readJsonBody } from '@/lib/server/read-json-body';
import {
  parseImportPayload,
  type ImportCollection,
  type ImportDocs,
  type ImportMode,
} from '@/lib/server/import-payload';
import { runInTransaction, supportsTransactions } from '@/lib/server/transaction';

// A replace of 4 x 1,000 rows is eight operations in one transaction. If the
// platform kills the function mid-transaction, the server aborts the
// uncommitted transaction, so nothing is half-written.
export const maxDuration = 30;

const IMPORT_FAILED = 'Import failed. Nothing was changed.';
const REPLACE_UNAVAILABLE =
  'Replace import is unavailable right now. Nothing was changed. Merge still works.';
const MERGE_PARTIAL =
  'Import failed part-way. Some items may have been added; check your library before importing again.';

type Counts = Record<ImportCollection, number>;

interface ImportResult {
  imported: Counts;
  deleted: Counts;
}

const zero = (): Counts => ({ bugs: 0, prompts: 0, testCases: 0, insights: 0 });

// One line per outcome. It carries the mode, counts and an error class only:
// never a user id and never anything from the file.
function logOutcome(mode: string, outcome: 'committed' | 'aborted' | 'rejected' | 'unavailable', detail: string) {
  const line = `[import] mode=${mode} outcome=${outcome} ${detail}`;
  if (outcome === 'aborted') console.error(line);
  else console.log(line);
}

function modeLabel(body: unknown): string {
  const mode = (body as { mode?: unknown } | null)?.mode;
  return mode === 'merge' || mode === 'replace' ? mode : 'unknown';
}

// The driver's code and class, sanitised: a MongoServerError's message can
// quote a document (a duplicate key error does), so it is never logged.
function errorClass(err: unknown): string {
  const e = (err ?? {}) as { code?: unknown; codeName?: unknown; name?: unknown };
  const clean = (v: unknown) =>
    (typeof v === 'string' || typeof v === 'number') && /^[A-Za-z0-9_]{1,40}$/.test(String(v)) ? String(v) : '';
  const parts = [
    clean(e.code) && `code=${clean(e.code)}`,
    clean(e.codeName) && `codeName=${clean(e.codeName)}`,
    `error=${clean(e.name) || 'unknown'}`,
  ];
  return parts.filter(Boolean).join(' ');
}

function isValidationError(err: unknown): boolean {
  return (err as { name?: unknown } | null)?.name === 'ValidationError';
}

/**
 * The writes, one after another. With a session they belong to the transaction:
 * never Promise.all, which would run them concurrently on one session.
 * Starts from zero each time, because the runner may retry it.
 */
async function writeImport(
  userId: string,
  mode: ImportMode,
  docs: ImportDocs,
  session?: ClientSession
): Promise<ImportResult> {
  // D-1: a replace deletes, and there is never a delete outside a transaction.
  if (mode === 'replace' && !session) {
    throw new Error('replace import requires a transaction session');
  }
  const withSession = session ? { session } : {};
  const deleted = zero();
  const imported = zero();

  if (mode === 'replace') {
    // Only private rows: `$ne: true` matches false, null and a missing field.
    // Public library rows are never deleted by an import.
    const privateRows = { user_id: userId, is_public: { $ne: true } };
    deleted.bugs = (await BugReport.deleteMany(privateRows, withSession)).deletedCount;
    deleted.prompts = (await PromptLibrary.deleteMany(privateRows, withSession)).deletedCount;
    deleted.testCases = (await TestCase.deleteMany(privateRows, withSession)).deletedCount;
    deleted.insights = (await Insight.deleteMany(privateRows, withSession)).deletedCount;
  }

  const insertOptions = { ...withSession, ordered: true };
  if (docs.bugs.length > 0) {
    imported.bugs = (await BugReport.insertMany(docs.bugs, insertOptions)).length;
  }
  if (docs.prompts.length > 0) {
    imported.prompts = (await PromptLibrary.insertMany(docs.prompts, insertOptions)).length;
  }
  if (docs.testCases.length > 0) {
    imported.testCases = (await TestCase.insertMany(docs.testCases, insertOptions)).length;
  }
  if (docs.insights.length > 0) {
    imported.insights = (await Insight.insertMany(docs.insights, insertOptions)).length;
  }

  return { imported, deleted };
}

const total = (c: Counts) => c.bugs + c.prompts + c.testCases + c.insights;

export async function POST(request: NextRequest) {
  let mode = 'unknown';
  let transactional = false;
  let writingWithoutTransaction = false;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const read = await readJsonBody(request, BODY_LIMITS.dataImport);
    if (!read.ok) {
      logOutcome(mode, 'rejected', `status=${read.status}`);
      return NextResponse.json({ error: read.error }, { status: read.status });
    }

    // The whole file is checked before anything touches the database.
    const parsed = parseImportPayload(read.value, userId);
    if (!parsed.ok) {
      logOutcome(modeLabel(read.value), 'rejected', `status=400 problems=${parsed.problems.length}`);
      return NextResponse.json({ error: parsed.error, problems: parsed.problems }, { status: 400 });
    }
    mode = parsed.value.mode;
    const { docs } = parsed.value;

    // 'system' owns the public library, and a malformed id must never become a
    // filter value: refuse both before any database call.
    if (!isClerkUserId(userId)) {
      logOutcome(mode, 'rejected', 'status=400 reason=user');
      return NextResponse.json({ error: 'This account cannot import data.' }, { status: 400 });
    }

    const { connection } = await dbConnect();
    transactional = await supportsTransactions(connection);

    // A replace deletes, and there is never a delete outside a transaction.
    if (!transactional && mode === 'replace') {
      logOutcome(mode, 'unavailable', 'txn=no');
      return NextResponse.json({ error: REPLACE_UNAVAILABLE }, { status: 503 });
    }

    const validMode = parsed.value.mode;
    writingWithoutTransaction = !transactional;
    const result = transactional
      ? await runInTransaction(connection, (session) => writeImport(userId, validMode, docs, session))
      : await writeImport(userId, validMode, docs);

    logOutcome(
      mode,
      'committed',
      `txn=${transactional ? 'yes' : 'no'} imported=${total(result.imported)} deleted=${total(result.deleted)}`
    );
    return NextResponse.json({
      success: true,
      mode: validMode,
      imported: result.imported,
      ...(validMode === 'replace' ? { deleted: result.deleted } : {}),
    });
  } catch (error) {
    logOutcome(mode, 'aborted', `txn=${transactional ? 'yes' : 'no'} ${errorClass(error)}`);
    // validateSync ran on every row first, so a ValidationError here is a bug;
    // it is still the file's fault, not the server's.
    const status = isValidationError(error) ? 400 : 500;
    // Without a transaction only a merge writes, and its earlier inserts stay.
    const text = writingWithoutTransaction ? MERGE_PARTIAL : IMPORT_FAILED;
    return NextResponse.json({ error: text }, { status });
  }
}
