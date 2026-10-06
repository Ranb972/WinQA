import { describe, it, expect } from 'vitest';
import {
  IMPORT_COLLECTIONS,
  IMPORT_MAX_ITEMS,
  IMPORT_MAX_PROBLEMS,
  parseImportPayload,
  type ParsedImport,
} from './import-payload';
import { BUG_REPORT_CAPS, PER_USER_CEILING, TAGS_MAX_COUNT } from '@/lib/content-limits';

const USER = 'user_2abcDEF123';
const NOW = new Date('2026-10-06T12:00:00.000Z');

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
          is_public: true,
          user_id: 'system',
          unknown_key: 'ignored',
          created_at: '2026-09-01T10:00:00.000Z',
        },
      ],
      prompts: [
        { title: 'title', bad_prompt_example: 'bad', good_prompt_example: 'good', explanation: 'why', tags: ['one'] },
      ],
      testCases: [{ title: 'title', initial_prompt: 'prompt' }],
      insights: [{ title: 'title', content: 'content', tags: [] }],
    } as Record<string, unknown[]>,
  };
}

function parse(file: unknown, mode: unknown = 'replace'): ParsedImport {
  return parseImportPayload({ data: file, mode }, USER, NOW);
}

function refused(result: ParsedImport) {
  if (result.ok) throw new Error('expected a refusal');
  return result;
}

describe('parseImportPayload: a valid file', () => {
  it('builds every row owned by the caller, private, from allow-listed keys only', () => {
    const result = parse(validFile());
    if (!result.ok) throw new Error(result.error);
    expect(result.value.mode).toBe('replace');
    const [bug] = result.value.docs.bugs;
    expect(bug).toEqual({
      prompt_context: 'context',
      model_response: 'response',
      model_used: 'model',
      issue_type: 'Logic',
      severity: 'Low',
      status: 'Open',
      user_notes: 'notes',
      user_id: USER,
      is_public: false,
      created_at: new Date('2026-09-01T10:00:00.000Z'),
      updated_at: NOW,
    });
    for (const collection of IMPORT_COLLECTIONS) {
      expect(result.value.docs[collection]).toHaveLength(1);
      expect(result.value.docs[collection][0].user_id).toBe(USER);
      expect(result.value.docs[collection][0].is_public).toBe(false);
    }
  });

  it('dates rows without created_at (absent or null) at now', () => {
    const file = validFile();
    (file.data.prompts[0] as Record<string, unknown>).created_at = null;
    const result = parse(file, 'merge');
    if (!result.ok) throw new Error(result.error);
    expect(result.value.mode).toBe('merge');
    expect(result.value.docs.prompts[0].created_at).toEqual(NOW);
    expect(result.value.docs.testCases[0].created_at).toEqual(NOW);
  });

  it('accepts empty lists and exactly IMPORT_MAX_ITEMS items', () => {
    const file = validFile();
    file.data.bugs = Array.from({ length: IMPORT_MAX_ITEMS }, () => ({ ...(file.data.bugs[0] as object) }));
    file.data.insights = [];
    const result = parse(file);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.docs.bugs).toHaveLength(IMPORT_MAX_ITEMS);
    expect(result.value.docs.insights).toEqual([]);
  });
});

describe('parseImportPayload: the file as a whole', () => {
  it.each([
    ['a body that is not an object', null],
    ['data that is not an object', 'text'],
    ['data that is a list', []],
  ])('refuses %s', (_label, data) => {
    const result = refused(parseImportPayload(data === null ? null : { data, mode: 'replace' }, USER, NOW));
    expect(result.error).toBe('Nothing was imported. The file is not a WinQA export.');
  });

  it('refuses any version other than 1.0', () => {
    const file = { ...validFile(), version: '2.0' };
    expect(refused(parse(file)).error).toBe('Nothing was imported. The file is not a WinQA export of version 1.0.');
    expect(refused(parse({ ...validFile(), version: undefined })).error).toMatch(/version 1\.0/);
  });

  it('refuses a missing list instead of reading it as empty (D-3)', () => {
    const file = validFile();
    delete file.data.testCases;
    const result = refused(parse(file));
    expect(result.error).toBe('Nothing was imported. The file has no testCases list.');
    expect(result.problems).toEqual([{ collection: 'testCases', item: null, field: null }]);
  });

  it('D7: a list holds at most the per-user ceiling, 500 items', () => {
    expect(IMPORT_MAX_ITEMS).toBe(500);
    expect(IMPORT_MAX_ITEMS).toBe(PER_USER_CEILING);
  });

  it.each(IMPORT_COLLECTIONS)('D7: refuses %s with 501 items, naming the list and the limit', (collection) => {
    const file = validFile();
    file.data[collection] = Array.from({ length: IMPORT_MAX_ITEMS + 1 }, () => ({}));
    const result = refused(parse(file));
    expect(result.error).toBe(
      `Nothing was imported. ${collection} has more than 500 items, the most WinQA keeps per account.`
    );
    expect(result.problems).toEqual([{ collection, item: null, field: null }]);
  });

  it('refuses a mode other than merge or replace', () => {
    expect(refused(parse(validFile(), 'append')).error).toBe(
      'Nothing was imported. The mode must be "merge" or "replace".'
    );
  });
});

describe('parseImportPayload: each item', () => {
  it.each([[42], [null], [['a']], ['text']])('refuses a non-object item (%j) and names its position', (bad) => {
    const file = validFile();
    file.data.bugs = [file.data.bugs[0], bad];
    const result = refused(parse(file));
    expect(result.error).toBe('Nothing was imported. bugs item 2: the item is not an object.');
    expect(result.problems).toEqual([{ collection: 'bugs', item: 2, field: null }]);
  });

  it('refuses a value outside an enum and names the field', () => {
    const file = validFile();
    (file.data.bugs[0] as Record<string, unknown>).severity = 'Critical';
    const result = refused(parse(file));
    expect(result.error).toBe('Nothing was imported. bugs item 1: severity is not an allowed value.');
    expect(result.problems).toEqual([{ collection: 'bugs', item: 1, field: 'severity' }]);
  });

  it('refuses a field over its D6 cap and names the field (maxlength reaches import)', () => {
    const file = validFile();
    (file.data.bugs[0] as Record<string, unknown>).model_response = 'x'.repeat(BUG_REPORT_CAPS.model_response + 1);
    const result = refused(parse(file));
    expect(result.error).toBe('Nothing was imported. bugs item 1: model_response is too long.');
    expect(result.problems).toEqual([{ collection: 'bugs', item: 1, field: 'model_response' }]);
  });

  it('accepts a field exactly at its cap and refuses 21 tags', () => {
    const atCap = validFile();
    (atCap.data.bugs[0] as Record<string, unknown>).model_response = 'x'.repeat(BUG_REPORT_CAPS.model_response);
    expect(parse(atCap).ok).toBe(true);
    const tags = validFile();
    (tags.data.prompts[0] as Record<string, unknown>).tags = Array.from({ length: TAGS_MAX_COUNT + 1 }, (_, i) => `t${i}`);
    const result = refused(parse(tags));
    expect(result.problems).toEqual([{ collection: 'prompts', item: 1, field: 'tags' }]);
    expect(result.error).not.toContain('t0');
  });

  it('refuses a missing required field', () => {
    const file = validFile();
    delete (file.data.bugs[0] as Record<string, unknown>).model_response;
    const result = refused(parse(file));
    expect(result.error).toBe('Nothing was imported. bugs item 1: model_response is required.');
  });

  it('refuses a value of the wrong type and reports tags.1 as tags', () => {
    const file = validFile();
    (file.data.prompts[0] as Record<string, unknown>).tags = ['ok', { nested: true }, { again: true }];
    const result = refused(parse(file));
    expect(result.error).toBe('Nothing was imported. prompts item 1: tags has the wrong type.');
    expect(result.problems).toEqual([{ collection: 'prompts', item: 1, field: 'tags' }]);
  });

  it.each([
    ['not a date', 'not a date'],
    ['a number', 1_700_000_000_000],
    ['an empty string', ''],
    ['a date in 1960 (no 13-digit cursor)', '1960-01-01T00:00:00.000Z'],
    ['a date before 2001-09-09', '2001-09-08T00:00:00.000Z'],
    ['a date after the year 2286', '2300-01-01T00:00:00.000Z'],
  ])('refuses created_at that is %s', (_label, value) => {
    const file = validFile();
    (file.data.insights[0] as Record<string, unknown>).created_at = value;
    const result = refused(parse(file));
    expect(result.error).toBe('Nothing was imported. insights item 1: created_at is not a valid date.');
    expect(result.problems).toEqual([{ collection: 'insights', item: 1, field: 'created_at' }]);
  });

  it('accepts created_at at both ends of the cursor range', () => {
    const file = validFile();
    (file.data.bugs[0] as Record<string, unknown>).created_at = new Date(1_000_000_000_000).toISOString();
    (file.data.insights[0] as Record<string, unknown>).created_at = new Date(9_999_999_999_999).toISOString();
    const result = parse(file);
    if (!result.ok) throw new Error(result.error);
    expect((result.value.docs.bugs[0].created_at as Date).getTime()).toBe(1_000_000_000_000);
    expect((result.value.docs.insights[0].created_at as Date).getTime()).toBe(9_999_999_999_999);
  });

  it(`collects at most ${IMPORT_MAX_PROBLEMS} problems, in file order`, () => {
    const file = validFile();
    file.data.bugs = Array.from({ length: 10 }, () => 7);
    const result = refused(parse(file));
    expect(result.problems).toHaveLength(IMPORT_MAX_PROBLEMS);
    expect(result.problems.map((p) => p.item)).toEqual([1, 2, 3, 4, 5]);
    expect(result.error).toBe(
      'Nothing was imported. bugs item 1: the item is not an object; bugs item 2: the item is not an object; ' +
        'bugs item 3: the item is not an object; bugs item 4: the item is not an object; ' +
        'bugs item 5: the item is not an object. (the first 5 problems are shown)'
    );
  });

  it('reports problems across collections', () => {
    const file = validFile();
    (file.data.bugs[0] as Record<string, unknown>).issue_type = 'Other';
    file.data.insights = [{ title: 'only a title' }];
    const result = refused(parse(file));
    expect(result.problems).toEqual([
      { collection: 'bugs', item: 1, field: 'issue_type' },
      { collection: 'insights', item: 1, field: 'content' },
    ]);
  });

  it('never echoes a submitted value: a sentinel in every field stays out of the error and problems', () => {
    const SENTINEL = 'SENTINEL_9f3c1e';
    const file = validFile();
    for (const collection of IMPORT_COLLECTIONS) {
      file.data[collection] = [0, 1].map(() => {
        const item: Record<string, unknown> = {};
        for (const key of [
          'prompt_context', 'model_response', 'model_used', 'issue_type', 'severity', 'user_notes', 'status',
          'title', 'bad_prompt_example', 'good_prompt_example', 'explanation', 'tags', 'description',
          'initial_prompt', 'expected_outcome', 'category', 'difficulty', 'content', 'created_at', 'id',
          'user_id', 'is_public',
        ]) {
          item[key] = SENTINEL;
        }
        item[SENTINEL] = SENTINEL;
        return item;
      });
    }
    const result = refused(parse(file));
    expect(result.problems.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });
});
