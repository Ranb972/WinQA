/**
 * Content caps shared by the routes and, later, the forms (Batch D). Client-safe:
 * no imports, constants only. Lengths are JavaScript string lengths (UTF-16 code
 * units), as the routes measure them.
 *
 * Chat (D8): checked by app/api/chat/route.ts before the key resolution and the
 * daily-allowance charge. The per-message cap leaves room for Code Testing's
 * prompts: up to 50,000 characters of code (the execute-code cap) plus the
 * program output or error, which the page clips to CODE_TESTING_RESULT_MAX_CHARS
 * with clipForPrompt before it builds the message.
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
