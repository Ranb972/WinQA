/**
 * Content caps shared by the routes and the forms (Batch D). Client-safe:
 * no imports, constants only. Lengths are JavaScript string lengths (UTF-16 code
 * units), as the routes measure them.
 *
 * Chat (D8): checked by app/api/chat/route.ts before the key resolution and the
 * daily-allowance charge. The per-message cap leaves room for Code Testing's
 * prompts: up to 50,000 characters of code (the execute-code cap) plus the
 * program output or error, which the page clips to CODE_TESTING_RESULT_MAX_CHARS
 * with clipForPrompt before it builds the message. Chat Lab trims the history it
 * sends to the same caps (trimChatHistory, D13).
 */

export const CHAT_MAX_MESSAGES = 100;
export const CHAT_MAX_MESSAGE_CHARS = 64_000;
export const CHAT_MAX_TOTAL_CHARS = 200_000;
export const CHAT_ROLES = ['user', 'assistant', 'system'] as const;

export type ChatRole = (typeof CHAT_ROLES)[number];

/** Program output or error carried into a Code Testing analysis prompt. */
export const CODE_TESTING_RESULT_MAX_CHARS = 10_000;
export const CLIP_MARKER = '\n(truncated)';

/**
 * Clips text for a prompt so a message stays under the chat caps. Returns the
 * text unchanged when it fits; otherwise the first max characters followed by
 * CLIP_MARKER. Non-strings become an empty string.
 */
export function clipForPrompt(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + CLIP_MARKER;
}

/**
 * Fits a prefilled value into a stored field (D9): the Bug Report modal carries
 * a chat prompt and response into fields capped by BUG_REPORT_CAPS. Returns the
 * text unchanged when it fits; otherwise a cut that ends in CLIP_MARKER and is
 * exactly max characters long with the marker, so the result passes the route's
 * check. A cut never splits a surrogate pair. When max cannot hold the marker,
 * the text is cut to max with no marker. Non-strings become an empty string.
 */
export function truncateForField(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  if (text.length <= max) return text;
  if (max <= CLIP_MARKER.length) return text.slice(0, max);
  let cut = max - CLIP_MARKER.length;
  const last = text.charCodeAt(cut - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut -= 1;
  return text.slice(0, cut) + CLIP_MARKER;
}

/*
 * Chat Lab history (D13): the client trims what it sends so a long conversation
 * stays inside the route caps instead of being refused. The route still refuses
 * a raw oversize body (400 / 413), which protects every other caller.
 */

/** The three chat caps a trimmed history must fit. */
export interface ChatHistoryCaps {
  maxMessages: number;
  maxMessageChars: number;
  maxTotalChars: number;
}

export const CHAT_HISTORY_CAPS: Readonly<ChatHistoryCaps> = {
  maxMessages: CHAT_MAX_MESSAGES,
  maxMessageChars: CHAT_MAX_MESSAGE_CHARS,
  maxTotalChars: CHAT_MAX_TOTAL_CHARS,
};

/** The one note Chat Lab shows while older messages are left out of a send. */
export const CHAT_HISTORY_TRIMMED_TEXT = 'Older messages are no longer sent to the model.';

/**
 * Fits a conversation into the chat caps by dropping its oldest turns. A turn
 * is a user message and the non-system messages after it up to the next user
 * message, so a Compare turn (one user message, one reply per model) goes as
 * a whole and the window never starts with a reply.
 *
 * - A conversation inside every cap comes back unchanged (as a new array).
 * - System messages are all kept, in place, wherever they stand. Only when they
 *   alone pass a cap are they cut down to the newest ones that fit.
 * - Then the newest turns are kept while the whole window stays within the
 *   count and total caps; the first turn that does not fit ends the window, and
 *   it and every older turn are dropped. An older turn holding a message over
 *   the per-message cap is skipped on its own (the route refused that send, so
 *   the model never saw it) and the turns before it can still be kept. Replies
 *   before the first user message are always dropped when trimming.
 * - The newest turn (on a send, the user's new message) is always kept whole:
 *   no message is ever cut, so a new message over the per-message cap is left
 *   to the route's 413.
 *
 * `dropped` is the number of non-system messages left out. Content is measured
 * as the route measures it (string length).
 */
export function trimChatHistory<T extends { role: string; content: string }>(
  messages: readonly T[],
  caps: ChatHistoryCaps = CHAT_HISTORY_CAPS
): { messages: T[]; dropped: number } {
  const size = (message: T) => (typeof message.content === 'string' ? message.content.length : 0);

  let allChars = 0;
  let oversized = false;
  for (const message of messages) {
    const n = size(message);
    allChars += n;
    if (n > caps.maxMessageChars) oversized = true;
  }
  if (messages.length <= caps.maxMessages && allChars <= caps.maxTotalChars && !oversized) {
    return { messages: messages.slice(), dropped: 0 };
  }

  // System messages first: all of them, unless they alone pass a cap. Even when
  // they fill a cap the newest turn below is still added, and the route refuses
  // the send (Chat Lab sends no system messages).
  const systemIdx: number[] = [];
  messages.forEach((message, i) => {
    if (message.role === 'system') systemIdx.push(i);
  });
  const kept = new Set<number>();
  let count = 0;
  let chars = 0;
  const systemChars = systemIdx.reduce((n, i) => n + size(messages[i]), 0);
  const systemsFit =
    systemIdx.length <= caps.maxMessages &&
    systemChars <= caps.maxTotalChars &&
    systemIdx.every((i) => size(messages[i]) <= caps.maxMessageChars);
  if (systemsFit) {
    for (const i of systemIdx) kept.add(i);
    count = systemIdx.length;
    chars = systemChars;
  } else {
    for (let s = systemIdx.length - 1; s >= 0; s--) {
      const n = size(messages[systemIdx[s]]);
      if (n > caps.maxMessageChars || count + 1 > caps.maxMessages || chars + n > caps.maxTotalChars) break;
      kept.add(systemIdx[s]);
      count += 1;
      chars += n;
    }
  }

  // The other messages, grouped into turns; replies before any user message
  // form a group of their own that is never kept once trimming starts.
  const turns: number[][] = [];
  const leading: number[] = [];
  let nonSystem = 0;
  messages.forEach((message, i) => {
    if (message.role === 'system') return;
    nonSystem += 1;
    if (message.role === 'user') turns.push([i]);
    else if (turns.length > 0) turns[turns.length - 1].push(i);
    else leading.push(i);
  });
  if (turns.length === 0 && leading.length > 0) turns.push(leading);

  let keptNonSystem = 0;
  for (let t = turns.length - 1; t >= 0; t--) {
    const turn = turns[t];
    const turnChars = turn.reduce((n, i) => n + size(messages[i]), 0);
    const turnOversized = turn.some((i) => size(messages[i]) > caps.maxMessageChars);
    const newest = t === turns.length - 1;
    if (!newest && turnOversized) continue;
    if (!newest && (count + turn.length > caps.maxMessages || chars + turnChars > caps.maxTotalChars)) {
      break;
    }
    for (const i of turn) kept.add(i);
    count += turn.length;
    chars += turnChars;
    keptNonSystem += turn.length;
  }

  return {
    messages: messages.filter((_, i) => kept.has(i)),
    dropped: nonSystem - keptNonSystem,
  };
}

/*
 * Stored content (D6): the field caps of the library entries and of a saved
 * battle. One table feeds the route checks (lib/server/content-input.ts) and the
 * schemas' maxlength (models/*), so the two cannot disagree. Lengths are counted
 * as above; every cap is in characters, and an entry of exactly the cap is kept.
 */

export const BUG_REPORT_CAPS = {
  prompt_context: 10_000,
  model_response: 30_000,
  model_used: 100,
  user_notes: 5_000,
} as const;

export const PROMPT_CAPS = {
  title: 200,
  bad_prompt_example: 10_000,
  good_prompt_example: 10_000,
  explanation: 5_000,
} as const;

export const TEST_CASE_CAPS = {
  title: 200,
  description: 5_000,
  initial_prompt: 10_000,
  expected_outcome: 5_000,
  category: 100,
  difficulty: 50,
} as const;

export const INSIGHT_CAPS = {
  title: 200,
  content: 20_000,
  category: 100,
} as const;

/** Prompts and insights: at most this many tags, each at most TAG_MAX_CHARS. */
export const TAGS_MAX_COUNT = 20;
export const TAG_MAX_CHARS = 40;

/**
 * A saved battle (POST /api/battle/vote). The prompt cap is the one
 * battle/respond enforces. A response's content allows 4,096 tokens at about
 * 4 characters each (about 16k) with headroom; `error` carries the respond
 * route's friendly sentence.
 */
export const BATTLE_CAPS = {
  challengeId: 100,
  challengeName: 200,
  prompt: 5_000,
  provider: 200,
  model: 200,
  specificModel: 200,
  content: 24_000,
  error: 1_000,
} as const;

/** A royale has four fighters, so a battle carries at most four rankings. */
export const BATTLE_RANKINGS_MAX = 4;

function withThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "model_response is longer than 30,000 characters": names the field, never the value. */
export function tooLongText(field: string, maxChars: number): string {
  return `${field} is longer than ${withThousands(maxChars)} characters`;
}

/** "tags has more than 20 entries". */
export function tooManyText(field: string, maxCount: number): string {
  return `${field} has more than ${withThousands(maxCount)} entries`;
}

/** "tags has an entry longer than 40 characters". */
export function entryTooLongText(field: string, maxChars: number): string {
  return `${field} has an entry longer than ${withThousands(maxChars)} characters`;
}

/** The counter under a long form field: "12,345 / 30,000". */
export function charCountText(length: number, max: number): string {
  return `${withThousands(length)} / ${withThousands(max)}`;
}

/**
 * The tag inputs (prompts, insights) refuse what the route would refuse: null
 * when `tag` can be added to `tags`, otherwise the inline note. Names the limit,
 * never the tag.
 */
export function tagLimitText(tags: readonly string[], tag: string): string | null {
  if (tags.length >= TAGS_MAX_COUNT) {
    return `An entry can have at most ${withThousands(TAGS_MAX_COUNT)} tags.`;
  }
  if (tag.length > TAG_MAX_CHARS) {
    return `A tag can be at most ${withThousands(TAG_MAX_CHARS)} characters.`;
  }
  return null;
}

/** A schema `maxlength` carrying the same value-free sentence: [cap, message]. */
export function maxChars(field: string, cap: number): [number, string] {
  return [cap, tooLongText(field, cap)];
}

/** Schema validators for a `tags` array: the count, then each entry's length. */
export const TAGS_VALIDATORS = [
  {
    validator: (tags: unknown) => !Array.isArray(tags) || tags.length <= TAGS_MAX_COUNT,
    message: tooManyText('tags', TAGS_MAX_COUNT),
  },
  {
    validator: (tags: unknown) =>
      !Array.isArray(tags) || tags.every((tag) => typeof tag !== 'string' || tag.length <= TAG_MAX_CHARS),
    message: entryTooLongText('tags', TAG_MAX_CHARS),
  },
];

/** Schema validator for a battle's `rankings` array. */
export const RANKINGS_VALIDATOR = {
  validator: (rankings: unknown) => !Array.isArray(rankings) || rankings.length <= BATTLE_RANKINGS_MAX,
  message: tooManyText('rankings', BATTLE_RANKINGS_MAX),
};

/*
 * Import (D-9): the largest file Settings sends to POST /api/import, in bytes.
 * lib/server/body-limits.ts reads the import body with this cap and answers 413
 * with IMPORT_TOO_LARGE_TEXT, so the page and the route cannot disagree. The
 * page refuses a bigger file before reading it and warns when an export it
 * builds is bigger.
 */
export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;
export const IMPORT_TOO_LARGE_TEXT = 'This file is larger than 4 MB. Nothing was imported.';

/*
 * Per-user ceilings (D7, owner decision D-6): the most rows one account keeps in
 * each collection. The library collections count the owner's private rows
 * (public example rows never count); battles count every battle the user saved.
 * A create at the ceiling, or an import merge that would pass it, answers 409.
 * Battles refuse at the ceiling like the rest: nothing is deleted to make room.
 */
export const PER_USER_CEILING = 500;

export type CeilingCollection = 'bugs' | 'prompts' | 'testCases' | 'insights' | 'battles';

/** How each refusal names its collection. */
export const CEILING_NOUNS: Readonly<Record<CeilingCollection, string>> = {
  bugs: 'bug reports',
  prompts: 'prompts',
  testCases: 'test cases',
  insights: 'insights',
  battles: 'battles',
};

const KEPT_PER_ACCOUNT = 'the most WinQA keeps per account. Delete some to add more.';

/**
 * The 409 text for a create at the ceiling: "You have 500 bug reports, the most
 * WinQA keeps per account. Delete some to add more." It states the fixed
 * ceiling, never the row count or anything submitted.
 */
export function ceilingText(collection: CeilingCollection): string {
  // Battles cannot be deleted one by one (no route, no UI), so their sentence
  // does not ask for it; it says what happened to the vote instead.
  if (collection === 'battles') {
    return `You have ${withThousands(PER_USER_CEILING)} saved battles, the most WinQA keeps per account. This vote was not saved.`;
  }
  return `You have ${withThousands(PER_USER_CEILING)} ${CEILING_NOUNS[collection]}, ${KEPT_PER_ACCOUNT}`;
}

/** The 409 text for an import merge that would pass the ceiling. */
export function importCeilingText(collection: CeilingCollection): string {
  return (
    `Nothing was imported. With this file you would have more than ${withThousands(PER_USER_CEILING)} ` +
    `${CEILING_NOUNS[collection]}, ${KEPT_PER_ACCOUNT}`
  );
}
