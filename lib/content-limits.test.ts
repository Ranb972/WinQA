import { describe, it, expect } from 'vitest';
import {
  BUG_REPORT_CAPS,
  CHAT_MAX_MESSAGE_CHARS,
  CLIP_MARKER,
  CODE_TESTING_RESULT_MAX_CHARS,
  IMPORT_MAX_BYTES,
  IMPORT_TOO_LARGE_TEXT,
  PER_USER_CEILING,
  TAGS_MAX_COUNT,
  TAG_MAX_CHARS,
  ceilingText,
  charCountText,
  clipForPrompt,
  importCeilingText,
  tagLimitText,
  truncateForField,
} from './content-limits';
import { BODY_LIMITS } from './server/body-limits';

describe('clipForPrompt (D8): Code Testing prompts stay under the chat message cap', () => {
  it('returns text at or below the cap unchanged', () => {
    const exact = 'x'.repeat(CODE_TESTING_RESULT_MAX_CHARS);
    expect(clipForPrompt(exact, CODE_TESTING_RESULT_MAX_CHARS)).toBe(exact);
    expect(clipForPrompt('short', 10)).toBe('short');
    expect(clipForPrompt('', 10)).toBe('');
  });

  it('clips text over the cap to the first max characters plus the marker', () => {
    const over = 'a'.repeat(CODE_TESTING_RESULT_MAX_CHARS + 1);
    const out = clipForPrompt(over, CODE_TESTING_RESULT_MAX_CHARS);
    expect(out).toBe('a'.repeat(CODE_TESTING_RESULT_MAX_CHARS) + CLIP_MARKER);
    expect(out.length).toBe(CODE_TESTING_RESULT_MAX_CHARS + CLIP_MARKER.length);
    expect(CLIP_MARKER).toContain('(truncated)');
  });

  it('turns a non-string into an empty string', () => {
    expect(clipForPrompt(undefined, 10)).toBe('');
    expect(clipForPrompt(null, 10)).toBe('');
    expect(clipForPrompt(42, 10)).toBe('');
  });

  it('keeps a worst-case Code Testing prompt under the per-message chat cap', () => {
    // execute-code caps code at 50,000 characters; the page clips output or error
    // to CODE_TESTING_RESULT_MAX_CHARS; the longest template adds well under 1,000.
    const code = 'x'.repeat(50_000);
    const result = clipForPrompt('y'.repeat(1_000_000), CODE_TESTING_RESULT_MAX_CHARS);
    const template = 'z'.repeat(1_000);
    expect(code.length + result.length + template.length).toBeLessThan(CHAT_MAX_MESSAGE_CHARS);
  });
});

describe('truncateForField (D9): a prefill that fits its field cap', () => {
  it('returns text below or exactly at the cap unchanged', () => {
    expect(truncateForField('short', 10)).toBe('short');
    expect(truncateForField('', 10)).toBe('');
    const exact = 'r'.repeat(BUG_REPORT_CAPS.model_response);
    expect(truncateForField(exact, BUG_REPORT_CAPS.model_response)).toBe(exact);
  });

  it('cuts text over the cap so that the text plus the marker is exactly the cap', () => {
    const cap = BUG_REPORT_CAPS.model_response;
    const over = 'r'.repeat(cap + 1);
    const out = truncateForField(over, cap);
    expect(out.length).toBe(cap);
    expect(out.endsWith(CLIP_MARKER)).toBe(true);
    expect(out).toBe('r'.repeat(cap - CLIP_MARKER.length) + CLIP_MARKER);

    const prompt = 'p'.repeat(BUG_REPORT_CAPS.prompt_context * 3);
    expect(truncateForField(prompt, BUG_REPORT_CAPS.prompt_context).length).toBe(
      BUG_REPORT_CAPS.prompt_context
    );
  });

  it('never leaves half of a surrogate pair before the marker', () => {
    // 'x' then emoji (2 code units each): a cut at an odd offset lands mid-pair.
    const text = 'x' + '\u{1F600}'.repeat(20);
    const max = CLIP_MARKER.length + 2; // room for 'x' and one high surrogate
    const out = truncateForField(text, max);
    expect(out).toBe('x' + CLIP_MARKER);
    expect(out.length).toBeLessThanOrEqual(max);
  });

  it('cuts without a marker when the cap is too small to hold one, and turns a non-string into ""', () => {
    expect(truncateForField('abcdefghijklmnop', 5)).toBe('abcde');
    expect(truncateForField(undefined, 10)).toBe('');
    expect(truncateForField(42, 10)).toBe('');
  });
});

describe('charCountText (D9): the counter under a long field', () => {
  it('shows the length and the cap with thousands separators', () => {
    expect(charCountText(12_345, 30_000)).toBe('12,345 / 30,000');
    expect(charCountText(0, 5_000)).toBe('0 / 5,000');
    expect(charCountText(200, 200)).toBe('200 / 200');
  });
});

describe('tagLimitText (D9): the tag input refuses what the route would refuse', () => {
  const full = Array.from({ length: TAGS_MAX_COUNT }, (_, i) => `t${i}`);

  it('accepts a tag below both limits', () => {
    expect(tagLimitText([], 'Code')).toBeNull();
    expect(tagLimitText(full.slice(1), 'Code')).toBeNull();
    expect(tagLimitText([], 'x'.repeat(TAG_MAX_CHARS))).toBeNull();
  });

  it('refuses a tag past the count, naming the limit and never the tag', () => {
    const text = tagLimitText(full, 'Code');
    expect(text).toBe('An entry can have at most 20 tags.');
    expect(text).not.toContain('Code');
  });

  it('refuses a tag over the length cap, naming the limit and never the tag', () => {
    const long = 'L'.repeat(TAG_MAX_CHARS + 1);
    const text = tagLimitText([], long);
    expect(text).toBe('A tag can be at most 40 characters.');
    expect(text).not.toContain(long);
  });
});

describe('IMPORT_MAX_BYTES (D9, D-9): the client and the import route share one cap', () => {
  it('is 4 MB, the cap the import route reads with, and the file sentence is the route sentence', () => {
    expect(IMPORT_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(BODY_LIMITS.dataImport.maxBytes).toBe(IMPORT_MAX_BYTES);
    expect(IMPORT_TOO_LARGE_TEXT).toBe('This file is larger than 4 MB. Nothing was imported.');
    expect(BODY_LIMITS.dataImport.tooLarge).toBe(IMPORT_TOO_LARGE_TEXT);
  });
});

describe('D7: the per-user ceiling sentences', () => {
  it('the ceiling is 500 per collection (decision D-6)', () => {
    expect(PER_USER_CEILING).toBe(500);
  });

  it.each([
    ['bugs', 'bug reports'],
    ['prompts', 'prompts'],
    ['testCases', 'test cases'],
    ['insights', 'insights'],
  ] as const)('%s: the create refusal names the collection and the fixed ceiling', (collection, noun) => {
    expect(ceilingText(collection)).toBe(
      `You have 500 ${noun}, the most WinQA keeps per account. Delete some to add more.`
    );
  });

  it('battles: the refusal does not ask for a delete that does not exist', () => {
    expect(ceilingText('battles')).toBe(
      'You have 500 saved battles, the most WinQA keeps per account. This vote was not saved.'
    );
  });

  it('the import refusal says nothing was imported and names the same ceiling', () => {
    expect(importCeilingText('bugs')).toBe(
      'Nothing was imported. With this file you would have more than 500 bug reports, ' +
        'the most WinQA keeps per account. Delete some to add more.'
    );
    expect(importCeilingText('testCases')).toContain('more than 500 test cases,');
  });
});
