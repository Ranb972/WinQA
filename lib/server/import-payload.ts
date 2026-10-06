/**
 * Validate a whole import file before anything is written (Batch D, D3).
 *
 * parseImportPayload is pure: it builds every row the import would insert and
 * checks each one against its Mongoose schema with validateSync (required
 * fields, enums, casts, and any length cap the schema declares), with no
 * database access. The import route deletes or inserts nothing unless this
 * returns ok, so a bad file can never empty a library.
 *
 * Error texts name the collection, the 1-based item number and the field only.
 * They never contain a submitted value, and neither does `problems`.
 */

import type mongoose from 'mongoose';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';

/** The only file version export writes (app/api/export/route.ts). */
export const IMPORT_FILE_VERSION = '1.0';

/** Most items accepted per collection in one file. D7 replaces it with the per-user ceilings. */
export const IMPORT_MAX_ITEMS = 1000;

/** Most problems collected and reported for one file. */
export const IMPORT_MAX_PROBLEMS = 5;

// Smallest and largest created_at, in ms since the epoch, a list cursor can
// carry: lib/server/list-page.ts writes `<13-digit ms>_<_id>`, so a row dated
// before 2001-09-09 or after the year 2286 could never be paged past.
export const IMPORT_MIN_CREATED_AT_MS = 1_000_000_000_000;
export const IMPORT_MAX_CREATED_AT_MS = 9_999_999_999_999;

export const IMPORT_COLLECTIONS = ['bugs', 'prompts', 'testCases', 'insights'] as const;
export type ImportCollection = (typeof IMPORT_COLLECTIONS)[number];
export type ImportMode = 'merge' | 'replace';

/** The keys read from each item. Everything else in the file is ignored. */
export const IMPORT_ALLOWED_FIELDS: Record<ImportCollection, readonly string[]> = {
  bugs: ['prompt_context', 'model_response', 'model_used', 'issue_type', 'severity', 'user_notes', 'status'],
  prompts: ['title', 'bad_prompt_example', 'good_prompt_example', 'explanation', 'tags'],
  testCases: ['title', 'description', 'initial_prompt', 'expected_outcome', 'category', 'difficulty'],
  insights: ['title', 'content', 'category', 'tags'],
};

interface ValidatingModel {
  new (doc: Record<string, unknown>): { validateSync(): mongoose.Error.ValidationError | null };
}

const SCHEMA_MODELS: Record<ImportCollection, ValidatingModel> = {
  bugs: BugReport,
  prompts: PromptLibrary,
  testCases: TestCase,
  insights: Insight,
};

export interface ImportProblem {
  collection: ImportCollection;
  /** 1-based position in the file's list; null when the whole list is at fault. */
  item: number | null;
  /** The schema field; null when the whole item or list is at fault. */
  field: string | null;
}

export type ImportDocs = Record<ImportCollection, Record<string, unknown>[]>;

export type ParsedImport =
  | { ok: true; value: { mode: ImportMode; docs: ImportDocs } }
  | { ok: false; error: string; problems: ImportProblem[] };

const NOTHING = 'Nothing was imported.';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function refuse(sentence: string, problems: ImportProblem[] = []): ParsedImport {
  return { ok: false, error: `${NOTHING} ${sentence}`, problems };
}

// What is wrong with a field, from the validator's kind. Mongoose's own
// messages are never used: an enum message quotes the submitted value.
function describeFieldError(kind: string | undefined, name: string | undefined): string {
  if (name === 'CastError') return 'has the wrong type';
  switch (kind) {
    case 'required':
      return 'is required';
    case 'enum':
      return 'is not an allowed value';
    case 'maxlength':
      return 'is too long';
    case 'minlength':
      return 'is too short';
    default:
      return 'is not valid';
  }
}

interface Finding {
  problem: ImportProblem;
  sentence: string;
}

/**
 * A present created_at must be a date string that lands inside the cursor's
 * range; null or absent means "now".
 */
function readCreatedAt(item: Record<string, unknown>): Date | null | 'invalid' {
  if (!hasOwn(item, 'created_at')) return null;
  const raw = item.created_at;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'invalid';
  const ms = Date.parse(raw);
  if (!Number.isInteger(ms) || ms < IMPORT_MIN_CREATED_AT_MS || ms > IMPORT_MAX_CREATED_AT_MS) {
    return 'invalid';
  }
  return new Date(ms);
}

/**
 * Checks the request body `{ data: <export file>, mode }` and builds every row
 * to insert, owned by `userId`, private, dated from the file or `now`.
 */
export function parseImportPayload(body: unknown, userId: string, now: Date = new Date()): ParsedImport {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    return refuse('The file is not a WinQA export.');
  }
  const file = body.data;
  if (file.version !== IMPORT_FILE_VERSION) {
    return refuse(`The file is not a WinQA export of version ${IMPORT_FILE_VERSION}.`);
  }
  if (!isPlainObject(file.data)) {
    return refuse('The file is not a WinQA export.');
  }
  const lists = file.data;

  // A missing list is refused, never read as empty: on replace that would
  // delete a whole collection the file never mentioned (decision D-3).
  for (const collection of IMPORT_COLLECTIONS) {
    if (!Array.isArray(lists[collection])) {
      return refuse(`The file has no ${collection} list.`, [{ collection, item: null, field: null }]);
    }
  }
  for (const collection of IMPORT_COLLECTIONS) {
    if ((lists[collection] as unknown[]).length > IMPORT_MAX_ITEMS) {
      return refuse(`${collection} has more than ${IMPORT_MAX_ITEMS} items.`, [
        { collection, item: null, field: null },
      ]);
    }
  }

  const mode = body.mode;
  if (mode !== 'merge' && mode !== 'replace') {
    return refuse('The mode must be "merge" or "replace".');
  }

  const docs: ImportDocs = { bugs: [], prompts: [], testCases: [], insights: [] };
  const findings: Finding[] = [];
  const full = () => findings.length >= IMPORT_MAX_PROBLEMS;
  const add = (collection: ImportCollection, item: number, field: string | null, what: string) => {
    if (full()) return;
    findings.push({
      problem: { collection, item, field },
      sentence: field === null ? `${collection} item ${item}: ${what}` : `${collection} item ${item}: ${field} ${what}`,
    });
  };

  for (const collection of IMPORT_COLLECTIONS) {
    const items = lists[collection] as unknown[];
    for (let i = 0; i < items.length && !full(); i++) {
      const position = i + 1;
      const item = items[i];
      if (!isPlainObject(item)) {
        add(collection, position, null, 'the item is not an object');
        continue;
      }

      const doc: Record<string, unknown> = {};
      for (const key of IMPORT_ALLOWED_FIELDS[collection]) {
        if (hasOwn(item, key)) doc[key] = item[key];
      }
      const createdAt = readCreatedAt(item);
      if (createdAt === 'invalid') add(collection, position, 'created_at', 'is not a valid date');
      // Set after the file's keys, so the file can never choose them.
      doc.user_id = userId;
      doc.is_public = false;
      doc.created_at = createdAt instanceof Date ? createdAt : now;
      doc.updated_at = now;

      const error = new SCHEMA_MODELS[collection](doc).validateSync();
      if (error) {
        const seen = new Set<string>();
        for (const [path, detail] of Object.entries(error.errors)) {
          // tags.1 is reported as tags.
          const field = path.split('.')[0];
          if (seen.has(field)) continue;
          seen.add(field);
          const { kind, name } = detail as { kind?: string; name?: string };
          add(collection, position, field, describeFieldError(kind, name));
        }
      }
      docs[collection].push(doc);
    }
    if (full()) break;
  }

  if (findings.length > 0) {
    const listed = findings.map((f) => f.sentence).join('; ');
    const more = full() ? ` (the first ${IMPORT_MAX_PROBLEMS} problems are shown)` : '';
    return refuse(`${listed}.${more}`, findings.map((f) => f.problem));
  }

  return { ok: true, value: { mode, docs } };
}
