/**
 * Request body caps per route, in bytes, with the sentence a 413 answers with
 * (Batch D, D5). Read through readJsonBody / readJsonObject
 * (lib/server/read-json-body.ts).
 *
 * Each cap is at least three times the sum of the route's field caps (the UTF-8
 * worst case for ordinary text), and every cap sits below the platform limits
 * (proxyClientMaxBodySize, 10 MB by default; Vercel's function request limit),
 * so the app answers first with a sentence instead of the platform's error page.
 * A 413 text never echoes the submitted value.
 */

import { IMPORT_MAX_BYTES, IMPORT_TOO_LARGE_TEXT } from '@/lib/content-limits';

export interface BodyLimit {
  /** The largest body accepted, in bytes. Exactly this many is accepted. */
  readonly maxBytes: number;
  /** The `error` sent with the 413. */
  readonly tooLarge: string;
}

const KB = 1024;
const MB = 1024 * KB;

export const REQUEST_TOO_LARGE_ERROR = 'This request is too large.';
export const ENTRY_TOO_LARGE_ERROR =
  'This entry is too large to save. Shorten the longest field and try again.';
export const CHAT_TOO_LARGE_ERROR =
  'This conversation is too long to send. Start a new chat or remove earlier messages.';

const entry: BodyLimit = { maxBytes: 256 * KB, tooLarge: ENTRY_TOO_LARGE_ERROR };
const credential: BodyLimit = { maxBytes: 8 * KB, tooLarge: REQUEST_TOO_LARGE_ERROR };
const customProvider: BodyLimit = { maxBytes: 16 * KB, tooLarge: REQUEST_TOO_LARGE_ERROR };

export const BODY_LIMITS = {
  // Library entries: POST/PUT/PATCH (wired in D6).
  bugs: entry,
  prompts: entry,
  testCases: entry,
  insights: entry,
  battleVote: { maxBytes: 512 * KB, tooLarge: 'This battle is too large to save.' },
  battleRespond: { maxBytes: 32 * KB, tooLarge: 'This prompt is too large.' },
  chat: { maxBytes: 1 * MB, tooLarge: CHAT_TOO_LARGE_ERROR },
  executeCode: {
    maxBytes: 256 * KB,
    tooLarge: 'This code is too large to run (limit 50,000 characters).',
  },
  // Wired in D3.
  dataImport: { maxBytes: IMPORT_MAX_BYTES, tooLarge: IMPORT_TOO_LARGE_TEXT },
  keysMigrate: { maxBytes: 256 * KB, tooLarge: 'Too much data in one request.' },
  keys: credential,
  testKey: credential,
  customProviders: customProvider,
  testCustomProvider: customProvider,
} as const satisfies Record<string, BodyLimit>;
