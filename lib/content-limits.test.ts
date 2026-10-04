import { describe, it, expect } from 'vitest';
import {
  CHAT_MAX_MESSAGE_CHARS,
  CLIP_MARKER,
  CODE_TESTING_RESULT_MAX_CHARS,
  clipForPrompt,
} from './content-limits';

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
