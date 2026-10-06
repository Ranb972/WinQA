import { describe, it, expect } from 'vitest';
import {
  BUG_REPORT_CAPS,
  CHAT_HISTORY_TRIMMED_TEXT,
  CHAT_MAX_MESSAGE_CHARS,
  CHAT_MAX_MESSAGES,
  CHAT_MAX_TOTAL_CHARS,
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
  trimChatHistory,
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

describe('trimChatHistory (D13): a long conversation is trimmed to the chat caps, never refused', () => {
  type Msg = { role: 'user' | 'assistant' | 'system'; content: string };
  const user = (content: string): Msg => ({ role: 'user', content });
  const bot = (content: string): Msg => ({ role: 'assistant', content });
  const sys = (content: string): Msg => ({ role: 'system', content });
  const chars = (list: readonly Msg[]) => list.reduce((n, x) => n + x.content.length, 0);

  /** A send whose earlier turns are each a user message and `replies` replies,
   *  then the new user message. One reply a turn is what each Compare model is
   *  sent since D15 (and single mode); several replies a turn is the shared
   *  Compare list Chat Lab sent before D15. */
  function turnsHistory(previousTurns: number, replies: number): Msg[] {
    const out: Msg[] = [];
    for (let t = 1; t <= previousTurns; t++) {
      out.push(user(`u${t}`));
      for (let k = 1; k <= replies; k++) out.push(bot(`r${t}.${k}`));
    }
    out.push(user(`u${previousTurns + 1}`));
    return out;
  }

  it('the defaults are the route caps, and the note is one short sentence', () => {
    expect([CHAT_MAX_MESSAGES, CHAT_MAX_MESSAGE_CHARS, CHAT_MAX_TOTAL_CHARS]).toEqual([100, 64_000, 200_000]);
    expect(CHAT_HISTORY_TRIMMED_TEXT).toBe('Older messages are no longer sent to the model.');
  });

  it('exactly at every cap nothing is dropped and the list comes back as it was', () => {
    // 100 messages, one of 64,000 characters, 200,000 in all (the route's at-cap case).
    const rest = Array.from({ length: 99 }, (_, i) =>
      (i % 2 ? user : bot)('x'.repeat(i < 98 ? 1373 : 1446))
    );
    const all = [sys('x'.repeat(64_000)), ...rest];
    expect(all).toHaveLength(100);
    expect(chars(all)).toBe(200_000);
    const out = trimChatHistory(all);
    expect(out.dropped).toBe(0);
    expect(out.messages).toEqual(all);
    expect(out.messages).not.toBe(all);
  });

  it('an empty list stays empty', () => {
    expect(trimChatHistory([])).toEqual({ messages: [], dropped: 0 });
  });

  it('101 messages drop the oldest whole turn and keep the system prompt', () => {
    const turns = Array.from({ length: 50 }, (_, i) => [user(`u${i + 1}`), bot(`a${i + 1}`)]).flat();
    const all = [sys('be terse'), ...turns];
    expect(all).toHaveLength(101);
    const out = trimChatHistory(all);
    // Both halves of turn 1 go, not only its user message.
    expect(out.dropped).toBe(2);
    expect(out.messages).toHaveLength(99);
    expect(out.messages[0]).toBe(all[0]);
    expect(out.messages[1]).toEqual(user('u2'));
    expect(out.messages.at(-1)).toEqual(bot('a50'));
  });

  it('every system message is kept in place, also one inside a dropped turn', () => {
    const all = [sys('first'), user('u1'), sys('middle'), bot('a1'), user('u2'), bot('a2'), user('u3')];
    const out = trimChatHistory(all, { maxMessages: 5, maxMessageChars: 100, maxTotalChars: 1_000 });
    expect(out.messages).toEqual([sys('first'), sys('middle'), user('u2'), bot('a2'), user('u3')]);
    expect(out.dropped).toBe(2);
  });

  it('a total over 200,000 characters drops the oldest turns until it fits', () => {
    const all: Msg[] = [];
    for (let t = 1; t <= 7; t++) all.push(user(`q${t}`.padEnd(10, '.')), bot('y'.repeat(30_000)));
    expect(all).toHaveLength(14);
    expect(chars(all)).toBe(210_070);
    const out = trimChatHistory(all);
    expect(out.dropped).toBe(2);
    expect(out.messages).toEqual(all.slice(2));
    expect(chars(out.messages)).toBe(180_060);
  });

  it('the window never starts with an assistant reply: whole Compare turns go, not single messages', () => {
    // Three turns of a user message and two replies. A cap of 7 taken message by
    // message would start on turn 1's second reply.
    const all = turnsHistory(3, 2).slice(0, -1);
    expect(all).toHaveLength(9);
    const out = trimChatHistory(all, { maxMessages: 7, maxMessageChars: 100, maxTotalChars: 1_000 });
    expect(out.messages[0]).toEqual(user('u2'));
    expect(out.messages).toHaveLength(6);
    expect(out.dropped).toBe(3);
  });

  it('assistant replies before the first user message are dropped first when trimming', () => {
    const all = [bot('stray 1'), bot('stray 2'), user('u1'), bot('a1'), user('u2')];
    const out = trimChatHistory(all, { maxMessages: 4, maxMessageChars: 100, maxTotalChars: 1_000 });
    expect(out.messages).toEqual([user('u1'), bot('a1'), user('u2')]);
    expect(out.dropped).toBe(2);
  });

  it('a Compare model is sent two messages a turn (D15): 40 turns never trim, turn 51 keeps the 49 newest turns', () => {
    const at40 = turnsHistory(39, 1);
    expect(at40).toHaveLength(79);
    expect(trimChatHistory(at40).dropped).toBe(0);
    const at50 = turnsHistory(49, 1);
    expect(at50).toHaveLength(99);
    expect(trimChatHistory(at50).dropped).toBe(0);
    const at51 = turnsHistory(50, 1);
    expect(at51).toHaveLength(101);
    const out = trimChatHistory(at51);
    expect(out.dropped).toBe(2);
    expect(out.messages).toEqual(at51.slice(2));
    expect(out.messages[0]).toEqual(user('u2'));
    const at80 = trimChatHistory(turnsHistory(79, 1));
    expect(at80.messages).toHaveLength(99);
    expect(at80.dropped).toBe(60);
    expect(at80.messages[0]).toEqual(user('u31'));
    expect(at80.messages.at(-1)).toEqual(user('u80'));
  });

  it('the shared shape (one reply per model in one list, before D15) trims at turn 21 with 4 models', () => {
    const at21 = turnsHistory(20, 4);
    expect(at21).toHaveLength(101);
    const out = trimChatHistory(at21);
    expect(out.dropped).toBe(5);
    expect(out.messages).toEqual(at21.slice(5));
    expect(out.messages[0]).toEqual(user('u2'));
  });

  it('turns of a user message and two replies keep 33 whole turns plus the new message (100 messages)', () => {
    const all = turnsHistory(60, 2);
    expect(all).toHaveLength(181);
    const out = trimChatHistory(all);
    expect(out.messages).toHaveLength(100);
    expect(out.messages[0]).toEqual(user('u28'));
    expect(out.dropped).toBe(81);
  });

  it('an older turn holding a message over 64,000 characters is skipped; the turns before it are kept', () => {
    // A message the route refused with 413 stays on screen; it must not block
    // every later send, and the model never saw it, so only its turn goes.
    const all = [user('u1'), bot('a1'), user('x'.repeat(64_001)), bot('refused'), user('u3'), bot('a3'), user('u4')];
    const out = trimChatHistory(all);
    expect(out.messages).toEqual([user('u1'), bot('a1'), user('u3'), bot('a3'), user('u4')]);
    expect(out.dropped).toBe(2);
  });

  it('a 10-turn chat with turn 5 oversized keeps turns 1-4 and 6-10 and drops only turn 5', () => {
    const all: Msg[] = [];
    for (let t = 1; t <= 10; t++) {
      all.push(user(t === 5 ? 'x'.repeat(70_000) : `u${t}`), bot(`a${t}`));
    }
    all.push(user('u11'));
    const out = trimChatHistory(all);
    expect(out.messages).toEqual([...all.slice(0, 8), ...all.slice(10)]);
    expect(out.messages.map((x) => x.role)).toEqual([...Array(9).fill(['user', 'assistant']).flat(), 'user']);
    expect(out.dropped).toBe(2);
  });

  it('a new message over 64,000 characters is sent whole, never cut; the route answers 413', () => {
    const all = [user('u1'), bot('a1'), user('x'.repeat(64_001))];
    const out = trimChatHistory(all);
    expect(out.messages).toEqual(all);
    expect(out.messages[2].content).toHaveLength(64_001);
    expect(out.dropped).toBe(0);
  });

  it('system messages that alone pass the caps keep the newest that fit; dropped counts only the others', () => {
    const all = [sys('s'.repeat(60)), sys('t'.repeat(50)), user('hi')];
    const out = trimChatHistory(all, { maxMessages: 10, maxMessageChars: 100, maxTotalChars: 100 });
    expect(out.messages).toEqual([sys('t'.repeat(50)), user('hi')]);
    expect(out.dropped).toBe(0);
  });

  it('does not change the list it is given', () => {
    const all = turnsHistory(20, 4);
    const copy = all.map((x) => ({ ...x }));
    trimChatHistory(all);
    expect(all).toEqual(copy);
  });
});
