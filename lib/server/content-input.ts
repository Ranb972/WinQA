/**
 * Type and length checks for stored content (Batch D, D6).
 *
 * The write routes of the library (bugs, prompts, test cases, insights) and the
 * battle vote call one of these after reading the body and before dbConnect. Each
 * returns the document the route writes, built exactly as the route built it
 * before, or the first field that fails with a sentence that names the field and
 * never echoes its value. The caps come from lib/content-limits.ts, the same
 * table the schemas' maxlength reads, so a body that passes here also passes the
 * schema, and the schema stays the backstop for any other writer (import).
 *
 * A field that is absent (undefined or null) is not checked here: whether it is
 * required stays the schema's decision, and the route maps the schema's
 * ValidationError to a 400 with validationErrorText.
 *
 * assertBelowCeiling (D7) is the one database read here: after dbConnect and
 * before the create, it counts the caller's rows against the per-user ceiling.
 */

import mongoose from 'mongoose';
import { pickAllowedFields } from '@/lib/security';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';
import {
  BATTLE_CAPS,
  BATTLE_RANKINGS_MAX,
  BUG_REPORT_CAPS,
  INSIGHT_CAPS,
  PER_USER_CEILING,
  PROMPT_CAPS,
  TAG_MAX_CHARS,
  TAGS_MAX_COUNT,
  TEST_CASE_CAPS,
  ceilingText,
  entryTooLongText,
  tooLongText,
  tooManyText,
  type CeilingCollection,
} from '@/lib/content-limits';

export type ContentDoc = Record<string, unknown>;

export type ContentCheck<T = ContentDoc> =
  | { ok: true; doc: T }
  | { ok: false; field: string; message: string };

type Problem = { ok: false; field: string; message: string };

/** The fields each PUT may change (unchanged from the routes' former lists). */
export const BUG_REPORT_PUT_FIELDS = [
  'prompt_context',
  'model_response',
  'issue_type',
  'severity',
  'user_notes',
  'status',
];
export const PROMPT_PUT_FIELDS = ['title', 'bad_prompt_example', 'good_prompt_example', 'explanation', 'tags'];
export const TEST_CASE_PUT_FIELDS = [
  'title',
  'description',
  'initial_prompt',
  'expected_outcome',
  'category',
  'difficulty',
];
export const INSIGHT_PUT_FIELDS = ['title', 'content', 'tags', 'category'];

type Rule = { kind: 'text'; max?: number } | { kind: 'tags' };
type Rules = Readonly<Record<string, Rule>>;

/** A string, capped at `max` characters when given (enum fields are typed only). */
const text = (max?: number): Rule => ({ kind: 'text', max });
const TAGS: Rule = { kind: 'tags' };

const BUG_REPORT_RULES: Rules = {
  prompt_context: text(BUG_REPORT_CAPS.prompt_context),
  model_response: text(BUG_REPORT_CAPS.model_response),
  model_used: text(BUG_REPORT_CAPS.model_used),
  issue_type: text(),
  severity: text(),
  user_notes: text(BUG_REPORT_CAPS.user_notes),
  status: text(),
};

const PROMPT_RULES: Rules = {
  title: text(PROMPT_CAPS.title),
  bad_prompt_example: text(PROMPT_CAPS.bad_prompt_example),
  good_prompt_example: text(PROMPT_CAPS.good_prompt_example),
  explanation: text(PROMPT_CAPS.explanation),
  tags: TAGS,
};

const TEST_CASE_RULES: Rules = {
  title: text(TEST_CASE_CAPS.title),
  description: text(TEST_CASE_CAPS.description),
  initial_prompt: text(TEST_CASE_CAPS.initial_prompt),
  expected_outcome: text(TEST_CASE_CAPS.expected_outcome),
  category: text(TEST_CASE_CAPS.category),
  difficulty: text(TEST_CASE_CAPS.difficulty),
};

const INSIGHT_RULES: Rules = {
  title: text(INSIGHT_CAPS.title),
  content: text(INSIGHT_CAPS.content),
  category: text(INSIGHT_CAPS.category),
  tags: TAGS,
};

const problem = (field: string, message: string): Problem => ({ ok: false, field, message });

const isAbsent = (value: unknown) => value === undefined || value === null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function checkValue(field: string, value: unknown, rule: Rule): Problem | null {
  if (isAbsent(value)) return null;
  if (rule.kind === 'text') {
    if (typeof value !== 'string') return problem(field, `${field} must be text`);
    if (rule.max !== undefined && value.length > rule.max) {
      return problem(field, tooLongText(field, rule.max));
    }
    return null;
  }
  if (!Array.isArray(value)) return problem(field, `${field} must be a list of text`);
  if (value.length > TAGS_MAX_COUNT) return problem(field, tooManyText(field, TAGS_MAX_COUNT));
  for (const tag of value) {
    if (typeof tag !== 'string') return problem(field, `${field} must be a list of text`);
    if (tag.length > TAG_MAX_CHARS) return problem(field, entryTooLongText(field, TAG_MAX_CHARS));
  }
  return null;
}

function checkDoc<T extends ContentDoc>(doc: T, rules: Rules): ContentCheck<T> {
  for (const [field, rule] of Object.entries(rules)) {
    const failed = checkValue(field, doc[field], rule);
    if (failed) return failed;
  }
  return { ok: true, doc };
}

// --- Library entries: POST builds the whole document, PUT the allowed subset ---

export function prepareBugReportCreate(body: ContentDoc): ContentCheck {
  return checkDoc(
    {
      prompt_context: body.prompt_context,
      model_response: body.model_response,
      model_used: body.model_used,
      issue_type: body.issue_type,
      severity: body.severity,
      user_notes: body.user_notes,
      status: body.status || 'Open',
    },
    BUG_REPORT_RULES
  );
}

export function prepareBugReportUpdate(body: ContentDoc): ContentCheck {
  return checkDoc(pickAllowedFields(body, BUG_REPORT_PUT_FIELDS), BUG_REPORT_RULES);
}

export function preparePromptCreate(body: ContentDoc): ContentCheck {
  return checkDoc(
    {
      title: body.title,
      bad_prompt_example: body.bad_prompt_example,
      good_prompt_example: body.good_prompt_example,
      explanation: body.explanation,
      tags: body.tags || [],
    },
    PROMPT_RULES
  );
}

export function preparePromptUpdate(body: ContentDoc): ContentCheck {
  return checkDoc(pickAllowedFields(body, PROMPT_PUT_FIELDS), PROMPT_RULES);
}

export function prepareTestCaseCreate(body: ContentDoc): ContentCheck {
  return checkDoc(
    {
      title: body.title,
      description: body.description,
      initial_prompt: body.initial_prompt,
      expected_outcome: body.expected_outcome,
      category: body.category,
      difficulty: body.difficulty,
    },
    TEST_CASE_RULES
  );
}

export function prepareTestCaseUpdate(body: ContentDoc): ContentCheck {
  return checkDoc(pickAllowedFields(body, TEST_CASE_PUT_FIELDS), TEST_CASE_RULES);
}

export function prepareInsightCreate(body: ContentDoc): ContentCheck {
  return checkDoc(
    {
      title: body.title,
      content: body.content,
      category: body.category,
      tags: body.tags || [],
    },
    INSIGHT_RULES
  );
}

export function prepareInsightUpdate(body: ContentDoc): ContentCheck {
  return checkDoc(pickAllowedFields(body, INSIGHT_PUT_FIELDS), INSIGHT_RULES);
}

// --- Battle vote ---

const MODEL_KEYS = ['modelA', 'modelB', 'modelC', 'modelD'] as const;
const RESPONSE_KEYS = ['responseA', 'responseB', 'responseC', 'responseD'] as const;

const MODEL_RULES: Rules = {
  provider: text(BATTLE_CAPS.provider),
  model: text(BATTLE_CAPS.model),
};

const RESPONSE_RULES: Rules = {
  content: text(BATTLE_CAPS.content),
  specificModel: text(BATTLE_CAPS.specificModel),
  error: text(BATTLE_CAPS.error),
};

const BATTLE_TOP_RULES: Rules = {
  challengeId: text(BATTLE_CAPS.challengeId),
  challengeName: text(BATTLE_CAPS.challengeName),
  prompt: text(BATTLE_CAPS.prompt),
};

/** Checks every stored text of a vote body (an optional part may be absent). */
function checkPart(prefix: string, value: unknown, rules: Rules): Problem | null {
  if (isAbsent(value)) return null;
  if (!isObject(value)) return problem(prefix, `${prefix} must be an object`);
  for (const [field, rule] of Object.entries(rules)) {
    const failed = checkValue(`${prefix}.${field}`, value[field], rule);
    if (failed) return failed;
  }
  return null;
}

/**
 * The vote body's stored texts, its rankings and the presence of `ratings` (the
 * route reads it before saving). The body is returned as is: the route still
 * picks what it saves. battleType, winner and the rating values stay the route's
 * own checks.
 */
export function prepareBattleVote(body: ContentDoc): ContentCheck {
  for (const [field, rule] of Object.entries(BATTLE_TOP_RULES)) {
    const failed = checkValue(field, body[field], rule);
    if (failed) return failed;
  }
  for (const key of MODEL_KEYS) {
    const failed = checkPart(key, body[key], MODEL_RULES);
    if (failed) return failed;
  }
  for (const key of RESPONSE_KEYS) {
    const failed = checkPart(key, body[key], RESPONSE_RULES);
    if (failed) return failed;
  }
  if (!isObject(body.ratings)) return problem('ratings', 'ratings must be an object');

  const rankings = body.rankings;
  if (!isAbsent(rankings)) {
    if (!Array.isArray(rankings)) return problem('rankings', 'rankings must be a list');
    if (rankings.length > BATTLE_RANKINGS_MAX) {
      return problem('rankings', tooManyText('rankings', BATTLE_RANKINGS_MAX));
    }
    for (let i = 0; i < rankings.length; i += 1) {
      const entry = rankings[i];
      const failed = isAbsent(entry)
        ? problem(`rankings.${i}`, `rankings.${i} must be an object`)
        : checkPart(`rankings.${i}`, entry, MODEL_RULES);
      if (failed) return failed;
    }
  }
  return { ok: true, doc: body };
}

// --- Per-user ceilings (D7) ---

type CeilingFilter = Record<string, unknown>;

/**
 * The rows a library ceiling counts: the caller's own private rows. `$ne: true`
 * matches false, null and a missing field, the filter the PUT/DELETE guards and
 * the import's replace use, so public example rows never count.
 */
export function ownedPrivateRows(userId: string): CeilingFilter {
  return { user_id: userId, is_public: { $ne: true } };
}

/** The rows the battle ceiling counts: every battle the caller saved. */
export function ownedBattles(userId: string): CeilingFilter {
  return { odlUserId: userId };
}

/** The count query assertBelowCeiling drives, typed structurally so a test can pass a fake. */
export interface CountableModel {
  countDocuments(filter: CeilingFilter): { maxTimeMS(ms: number): PromiseLike<number> };
}

export type CeilingCheck = { ok: true } | { ok: false; status: 409; error: string };

export interface CeilingOptions {
  /** Rows about to be added: 1 for a create, the file's list length for an import merge. */
  incoming?: number;
  /** The refusal sentence; the create sentence unless the caller passes another. */
  refusal?: (collection: CeilingCollection) => string;
}

/**
 * Counts the rows `filter` matches and refuses with 409 when adding `incoming`
 * would pass PER_USER_CEILING. A collection already past the ceiling (rows
 * saved before D7) refuses every create until enough are deleted.
 *
 * Count, then insert: two concurrent creates from one user can both see 499 and
 * both insert, leaving 501. Accepted, as for custom providers: the ceiling
 * bounds storage per account and is not a security boundary, and an overshoot
 * of up to the incoming rows of each racing request is harmless. The count runs under the read deadline
 * (DB_QUERY_MAX_TIME_MS); a failure rejects, and the route answers its 500
 * before any write.
 */
export async function assertBelowCeiling(
  model: CountableModel,
  filter: CeilingFilter,
  collection: CeilingCollection,
  { incoming = 1, refusal = ceilingText }: CeilingOptions = {}
): Promise<CeilingCheck> {
  const existing = await model.countDocuments(filter).maxTimeMS(DB_QUERY_MAX_TIME_MS);
  if (existing + incoming <= PER_USER_CEILING) return { ok: true };
  return { ok: false, status: 409, error: refusal(collection) };
}

// --- The schema's verdict ---

/**
 * The 400 text for a Mongoose ValidationError, or null for any other error.
 *
 * It names the first failing path and never echoes a value. Mongoose's own enum
 * and cast messages quote the value, and its default maxlength message does too,
 * so only messages whose templates are value-free are passed through: `required`
 * and the content models' own validators (`user defined`, each with a written
 * message). A maxlength failure is rewritten from its path and cap; anything
 * else gets a sentence built from the path alone.
 */
export function validationErrorText(error: unknown): string | null {
  if (!(error instanceof mongoose.Error.ValidationError)) return null;
  const first = Object.entries(error.errors)[0];
  if (!first) return 'This entry is not valid';
  const [path, cause] = first;
  if (cause instanceof mongoose.Error.ValidatorError) {
    if (cause.kind === 'required' || cause.kind === 'user defined') return cause.message;
    if (cause.kind === 'maxlength') {
      const max = Number((cause.properties as Record<string, unknown>).maxlength);
      if (Number.isFinite(max)) return tooLongText(path, max);
    }
  }
  return `${path} is not a valid value`;
}
