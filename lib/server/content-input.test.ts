import { describe, it, expect, vi } from 'vitest';
import type { Document } from 'mongoose';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';
import Battle from '@/models/Battle';
import {
  BATTLE_CAPS,
  BUG_REPORT_CAPS,
  INSIGHT_CAPS,
  PROMPT_CAPS,
  TEST_CASE_CAPS,
  ceilingText,
  importCeilingText,
  tooLongText,
} from '@/lib/content-limits';
import { DB_QUERY_MAX_TIME_MS } from '@/lib/server/db-limits';
import { fakeCount } from '@/lib/server/count-query.test-utils';
import {
  assertBelowCeiling,
  ownedBattles,
  ownedPrivateRows,
  prepareBattleVote,
  prepareBugReportCreate,
  prepareBugReportUpdate,
  prepareInsightCreate,
  prepareInsightUpdate,
  preparePromptCreate,
  preparePromptUpdate,
  prepareTestCaseCreate,
  prepareTestCaseUpdate,
  validationErrorText,
} from '@/lib/server/content-input';

/** A value the length of `n` that a leaked message would be easy to spot in. */
const fill = (n: number) => 'Z'.repeat(n);

const BUG = {
  prompt_context: 'p',
  model_response: 'r',
  model_used: 'm',
  issue_type: 'Logic',
  severity: 'Low',
};
const PROMPT = { title: 't', bad_prompt_example: 'b', good_prompt_example: 'g' };
const TEST_CASE = { title: 't', initial_prompt: 'i' };
const INSIGHT = { title: 't', content: 'c' };
const RATING = { accuracy: 3, creativity: 3, clarity: 3, total: 9 };
const VOTE = {
  challengeId: 'c1',
  challengeName: 'Challenge',
  prompt: 'p',
  battleType: 'standard',
  modelA: { provider: 'groq', model: 'a' },
  modelB: { provider: 'gemini', model: 'b' },
  responseA: { content: 'A', responseTime: 10 },
  responseB: { content: 'B', responseTime: 20 },
  ratings: { modelA: RATING, modelB: RATING },
  winner: 'modelA',
};

const tags = (count: number, length = 3) =>
  Array.from({ length: count }, (_, i) => `${i}`.padEnd(length, 't'));

describe('D6: the route checks each library field against its cap', () => {
  const creators = [
    { name: 'bug report', prepare: prepareBugReportCreate, base: BUG, caps: BUG_REPORT_CAPS },
    { name: 'prompt', prepare: preparePromptCreate, base: PROMPT, caps: PROMPT_CAPS },
    { name: 'test case', prepare: prepareTestCaseCreate, base: TEST_CASE, caps: TEST_CASE_CAPS },
    { name: 'insight', prepare: prepareInsightCreate, base: INSIGHT, caps: INSIGHT_CAPS },
  ];
  const fieldCases = creators.flatMap((c) =>
    Object.entries(c.caps).map(([field, cap]) => ({ ...c, field, cap }))
  );

  it.each(fieldCases)('$name $field: exactly $cap passes, $cap + 1 names the field only', (c) => {
    const atCap = c.prepare({ ...c.base, [c.field]: fill(c.cap) });
    expect(atCap.ok).toBe(true);

    const over = c.prepare({ ...c.base, [c.field]: fill(c.cap + 1) });
    expect(over).toEqual({ ok: false, field: c.field, message: tooLongText(c.field, c.cap) });
    if (!over.ok) expect(over.message).not.toContain('ZZ');
  });

  it('builds the same document the bug route built, defaulting status to Open', () => {
    const result = prepareBugReportCreate({ ...BUG, user_notes: 'n', extra: 'dropped', user_id: 'x' });
    expect(result).toEqual({
      ok: true,
      doc: { ...BUG, user_notes: 'n', status: 'Open' },
    });
  });

  it('defaults tags to [] for a new prompt and a new insight', () => {
    expect(preparePromptCreate(PROMPT)).toEqual({
      ok: true,
      doc: { ...PROMPT, explanation: undefined, tags: [] },
    });
    expect(prepareInsightCreate(INSIGHT)).toEqual({
      ok: true,
      doc: { ...INSIGHT, category: undefined, tags: [] },
    });
  });

  it('leaves an absent required field to the schema', () => {
    expect(prepareBugReportCreate({}).ok).toBe(true);
    expect(prepareTestCaseCreate({ title: null }).ok).toBe(true);
  });

  it('refuses a field that is not text, without echoing it', () => {
    expect(prepareBugReportCreate({ ...BUG, model_response: { $gt: '' } })).toEqual({
      ok: false,
      field: 'model_response',
      message: 'model_response must be text',
    });
    expect(prepareTestCaseCreate({ ...TEST_CASE, difficulty: 3 })).toEqual({
      ok: false,
      field: 'difficulty',
      message: 'difficulty must be text',
    });
    expect(prepareBugReportCreate({ ...BUG, issue_type: ['Logic'] })).toMatchObject({
      ok: false,
      field: 'issue_type',
    });
  });

  it('a PUT keeps only its allowed fields and checks those', () => {
    expect(
      prepareBugReportUpdate({ id: 'x', status: 'Resolved', model_used: fill(500), user_id: 'y' })
    ).toEqual({ ok: true, doc: { status: 'Resolved' } });
    expect(prepareBugReportUpdate({ user_notes: fill(5_001) })).toEqual({
      ok: false,
      field: 'user_notes',
      message: 'user_notes is longer than 5,000 characters',
    });
    expect(preparePromptUpdate({ title: fill(201) })).toMatchObject({ ok: false, field: 'title' });
    expect(prepareTestCaseUpdate({ category: fill(101) })).toMatchObject({ ok: false, field: 'category' });
    expect(prepareInsightUpdate({ content: fill(20_001) })).toMatchObject({ ok: false, field: 'content' });
    expect(prepareInsightUpdate({ title: 'kept', content: fill(20_000) })).toEqual({
      ok: true,
      doc: { title: 'kept', content: fill(20_000) },
    });
  });
});

describe('D6: tags are at most 20 entries of at most 40 characters', () => {
  const tagged = [
    { name: 'prompt create', prepare: (t: unknown) => preparePromptCreate({ ...PROMPT, tags: t }) },
    { name: 'prompt update', prepare: (t: unknown) => preparePromptUpdate({ tags: t }) },
    { name: 'insight create', prepare: (t: unknown) => prepareInsightCreate({ ...INSIGHT, tags: t }) },
    { name: 'insight update', prepare: (t: unknown) => prepareInsightUpdate({ tags: t }) },
  ];

  it.each(tagged)('$name: 20 tags of 40 characters pass', ({ prepare }) => {
    expect(prepare(tags(20, 40)).ok).toBe(true);
  });

  it.each(tagged)('$name: 21 tags give "tags has more than 20 entries"', ({ prepare }) => {
    expect(prepare(tags(21))).toEqual({ ok: false, field: 'tags', message: 'tags has more than 20 entries' });
  });

  it.each(tagged)('$name: a 41-character tag is refused', ({ prepare }) => {
    expect(prepare(['ok', fill(41)])).toEqual({
      ok: false,
      field: 'tags',
      message: 'tags has an entry longer than 40 characters',
    });
  });

  it.each(tagged)('$name: tags that are not a list of text are refused', ({ prepare }) => {
    expect(prepare('a,b')).toEqual({ ok: false, field: 'tags', message: 'tags must be a list of text' });
    expect(prepare(['a', 5])).toEqual({ ok: false, field: 'tags', message: 'tags must be a list of text' });
  });
});

describe('D6: a battle vote checks every stored text', () => {
  type Mutate = (body: Record<string, unknown>, value: string) => void;
  const nested =
    (part: string, field: string): Mutate =>
    (body, value) => {
      body[part] = { ...(body[part] as object), [field]: value };
    };
  const voteCases: { path: string; cap: number; set: Mutate }[] = [
    { path: 'challengeId', cap: BATTLE_CAPS.challengeId, set: (b, v) => (b.challengeId = v) },
    { path: 'challengeName', cap: BATTLE_CAPS.challengeName, set: (b, v) => (b.challengeName = v) },
    { path: 'prompt', cap: BATTLE_CAPS.prompt, set: (b, v) => (b.prompt = v) },
    { path: 'modelA.provider', cap: BATTLE_CAPS.provider, set: nested('modelA', 'provider') },
    { path: 'modelB.model', cap: BATTLE_CAPS.model, set: nested('modelB', 'model') },
    { path: 'responseA.content', cap: BATTLE_CAPS.content, set: nested('responseA', 'content') },
    { path: 'responseB.specificModel', cap: BATTLE_CAPS.specificModel, set: nested('responseB', 'specificModel') },
    { path: 'responseA.error', cap: BATTLE_CAPS.error, set: nested('responseA', 'error') },
    {
      path: 'rankings.1.model',
      cap: BATTLE_CAPS.model,
      set: (b, v) => (b.rankings = [{ model: 'a', provider: 'groq', rank: 1, score: 9 }, { model: v, provider: 'groq', rank: 2, score: 8 }]),
    },
  ];

  it.each(voteCases)('$path: exactly $cap passes, one more names the path', ({ path, cap, set }) => {
    const atCap: Record<string, unknown> = structuredClone(VOTE);
    set(atCap, fill(cap));
    expect(prepareBattleVote(atCap)).toEqual({ ok: true, doc: atCap });

    const over: Record<string, unknown> = structuredClone(VOTE);
    set(over, fill(cap + 1));
    expect(prepareBattleVote(over)).toEqual({ ok: false, field: path, message: tooLongText(path, cap) });
  });

  it('accepts four rankings and refuses five', () => {
    const ranking = { model: 'm', provider: 'groq', rank: 1, score: 9 };
    expect(prepareBattleVote({ ...VOTE, rankings: Array(4).fill(ranking) }).ok).toBe(true);
    expect(prepareBattleVote({ ...VOTE, rankings: Array(5).fill(ranking) })).toEqual({
      ok: false,
      field: 'rankings',
      message: 'rankings has more than 4 entries',
    });
  });

  it('refuses parts of the wrong type and a missing ratings object', () => {
    expect(prepareBattleVote({ ...VOTE, modelC: 'groq' })).toEqual({
      ok: false,
      field: 'modelC',
      message: 'modelC must be an object',
    });
    expect(prepareBattleVote({ ...VOTE, responseA: { content: 7, responseTime: 1 } })).toMatchObject({
      ok: false,
      field: 'responseA.content',
    });
    expect(prepareBattleVote({ ...VOTE, rankings: { model: 'm' } })).toMatchObject({ ok: false, field: 'rankings' });
    expect(prepareBattleVote({ ...VOTE, rankings: [null] })).toMatchObject({ ok: false, field: 'rankings.0' });
    const { ratings: _ratings, ...noRatings } = VOTE;
    void _ratings;
    expect(prepareBattleVote(noRatings)).toEqual({ ok: false, field: 'ratings', message: 'ratings must be an object' });
  });
});

describe('D6: the schemas carry the same caps (maxlength)', () => {
  type Case = { model: string; path: string; cap: number; make: (value: string) => Document };
  const flat = <T extends object>(
    model: string,
    caps: Record<string, number>,
    make: (doc: T) => Document,
    base: T
  ): Case[] =>
    Object.entries(caps).map(([path, cap]) => ({
      model,
      path,
      cap,
      make: (value: string) => make({ ...base, [path]: value }),
    }));
  const battle = (mutate: (doc: Record<string, unknown>, value: string) => void) => (value: string) => {
    const doc: Record<string, unknown> = { ...structuredClone(VOTE), odlUserId: 'user_a' };
    mutate(doc, value);
    return new Battle(doc);
  };
  const cases: Case[] = [
    ...flat('BugReport', BUG_REPORT_CAPS, (d) => new BugReport(d), BUG),
    ...flat('PromptLibrary', PROMPT_CAPS, (d) => new PromptLibrary(d), PROMPT),
    ...flat('TestCase', TEST_CASE_CAPS, (d) => new TestCase(d), TEST_CASE),
    ...flat('Insight', INSIGHT_CAPS, (d) => new Insight(d), INSIGHT),
    { model: 'Battle', path: 'challengeId', cap: BATTLE_CAPS.challengeId, make: battle((d, v) => (d.challengeId = v)) },
    { model: 'Battle', path: 'challengeName', cap: BATTLE_CAPS.challengeName, make: battle((d, v) => (d.challengeName = v)) },
    { model: 'Battle', path: 'prompt', cap: BATTLE_CAPS.prompt, make: battle((d, v) => (d.prompt = v)) },
    { model: 'Battle', path: 'modelA.provider', cap: BATTLE_CAPS.provider, make: battle((d, v) => (d.modelA = { provider: v, model: 'a' })) },
    { model: 'Battle', path: 'modelA.model', cap: BATTLE_CAPS.model, make: battle((d, v) => (d.modelA = { provider: 'groq', model: v })) },
    { model: 'Battle', path: 'responseA.content', cap: BATTLE_CAPS.content, make: battle((d, v) => (d.responseA = { content: v, responseTime: 1 })) },
    {
      model: 'Battle',
      path: 'responseA.specificModel',
      cap: BATTLE_CAPS.specificModel,
      make: battle((d, v) => (d.responseA = { content: 'a', responseTime: 1, specificModel: v })),
    },
    { model: 'Battle', path: 'responseA.error', cap: BATTLE_CAPS.error, make: battle((d, v) => (d.responseA = { content: 'a', responseTime: 1, error: v })) },
    {
      model: 'Battle',
      path: 'rankings.0.provider',
      cap: BATTLE_CAPS.provider,
      make: battle((d, v) => (d.rankings = [{ model: 'm', provider: v, rank: 1, score: 9 }])),
    },
  ];

  it('new BugReport with a 30,001-character model_response fails validateSync on maxlength', () => {
    const err = new BugReport({ ...BUG, model_response: 'x'.repeat(30_001) }).validateSync();
    expect(err?.errors.model_response?.kind).toBe('maxlength');
    expect(err?.errors.model_response?.message).toBe('model_response is longer than 30,000 characters');
  });

  it.each(cases)('$model $path: exactly $cap validates, one more fails on maxlength', ({ path, cap, make }) => {
    expect(make(fill(cap)).validateSync()).toBeUndefined();
    const err = make(fill(cap + 1)).validateSync();
    expect(err?.errors[path]?.kind).toBe('maxlength');
    expect(Object.keys(err?.errors ?? {})).toEqual([path]);
    expect(validationErrorText(err)).toBe(tooLongText(path, cap));
  });

  it.each([
    ['PromptLibrary', (t: string[]) => new PromptLibrary({ ...PROMPT, tags: t })],
    ['Insight', (t: string[]) => new Insight({ ...INSIGHT, tags: t })],
  ] as const)('%s tags: 20 x 40 validates, 21 tags or a 41-character tag fails', (_name, make) => {
    expect(make(tags(20, 40)).validateSync()).toBeUndefined();
    expect(make(tags(21)).validateSync()?.errors.tags?.message).toBe('tags has more than 20 entries');
    expect(make(['a', fill(41)]).validateSync()?.errors.tags?.message).toBe(
      'tags has an entry longer than 40 characters'
    );
  });

  it('Battle rankings: four validate, five fail', () => {
    const ranking = { model: 'm', provider: 'groq', rank: 1, score: 9 };
    const make = (n: number) => new Battle({ ...VOTE, odlUserId: 'u', rankings: Array(n).fill(ranking) });
    expect(make(4).validateSync()).toBeUndefined();
    expect(make(5).validateSync()?.errors.rankings?.message).toBe('rankings has more than 4 entries');
  });
});

describe('D6: validationErrorText', () => {
  it('is null for anything that is not a ValidationError', () => {
    expect(validationErrorText(new Error('boom'))).toBeNull();
    expect(validationErrorText(undefined)).toBeNull();
  });

  it('passes the schema required message through', () => {
    expect(validationErrorText(new BugReport({ ...BUG, prompt_context: undefined }).validateSync())).toBe(
      'Prompt context is required'
    );
  });

  it('never echoes an enum or cast value', () => {
    const enumErr = new BugReport({ ...BUG, issue_type: 'SECRET_VALUE' }).validateSync();
    expect(enumErr?.errors.issue_type?.message).toContain('SECRET_VALUE');
    expect(validationErrorText(enumErr)).toBe('issue_type is not a valid value');

    const castErr = new Battle({
      ...VOTE,
      odlUserId: 'u',
      responseA: { content: 'a', responseTime: 'SECRET_VALUE' },
    }).validateSync();
    expect(validationErrorText(castErr)).toBe('responseA.responseTime is not a valid value');
  });
});

describe("D7: assertBelowCeiling counts the owner's rows before a create", () => {
  const countingModel = (count: number | Error) => {
    const query = fakeCount(count);
    return { query, model: { countDocuments: vi.fn(() => query) } };
  };

  it("the library filter counts only the owner's private rows; battles count by odlUserId", () => {
    expect(ownedPrivateRows('user_a')).toEqual({ user_id: 'user_a', is_public: { $ne: true } });
    expect(ownedBattles('user_a')).toEqual({ odlUserId: 'user_a' });
  });

  it('499 rows: there is room for one more', async () => {
    const { model, query } = countingModel(499);
    const filter = ownedPrivateRows('user_a');
    expect(await assertBelowCeiling(model, filter, 'bugs')).toEqual({ ok: true });
    expect(model.countDocuments).toHaveBeenCalledWith(filter);
    expect(query.maxTimeMS).toHaveBeenCalledWith(DB_QUERY_MAX_TIME_MS);
  });

  it.each([500, 650])("%i rows: refused with 409 and the collection's sentence", async (count) => {
    const { model } = countingModel(count);
    expect(await assertBelowCeiling(model, ownedBattles('user_a'), 'battles')).toEqual({
      ok: false,
      status: 409,
      error: ceilingText('battles'),
    });
  });

  it('an import counts its incoming rows: 490 + 10 fits, 490 + 11 does not', async () => {
    const options = { incoming: 10, refusal: importCeilingText };
    expect(await assertBelowCeiling(countingModel(490).model, {}, 'insights', options)).toEqual({ ok: true });
    expect(
      await assertBelowCeiling(countingModel(490).model, {}, 'insights', { ...options, incoming: 11 })
    ).toEqual({ ok: false, status: 409, error: importCeilingText('insights') });
  });

  it('a failed count rejects, so the route answers its own 500 and writes nothing', async () => {
    const failure = Object.assign(new Error('operation exceeded time limit'), { codeName: 'MaxTimeMSExpired' });
    await expect(assertBelowCeiling(countingModel(failure).model, {}, 'prompts')).rejects.toBe(failure);
  });
});
