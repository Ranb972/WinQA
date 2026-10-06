/**
 * The sentence a page shows when an API call fails (Batch D, D9). Client-safe:
 * no imports.
 *
 * The write routes answer 400 for a field ("model_response is longer than
 * 30,000 characters"), 409 for a per-account ceiling and 413 for a body over its
 * byte cap, each as JSON `{ error }` (D-7). The page shows that text whatever the
 * status. A platform or proxy can answer 413 itself with an HTML or plain-text
 * page, so a 413 with no usable JSON gets a fixed sentence; any other failure
 * with no usable JSON (a 500 page, a 502, a thrown network error, an abort) gets
 * the page's own fallback, as before.
 */

/** A 413 whose body is not the app's JSON. */
export const TOO_LARGE_TEXT = 'This is too large to send. Shorten it and try again.';

/** A server text longer than this is not shown; the fallback is. */
export const MAX_ERROR_TEXT_CHARS = 500;

export interface ErrorTextOptions {
  /** The sentence for a non-JSON 413 on this page, instead of TOO_LARGE_TEXT. */
  tooLarge?: string;
}

interface ResponseLike {
  status: number;
  text: () => Promise<string>;
}

function isResponseLike(value: unknown): value is ResponseLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ResponseLike).status === 'number' &&
    typeof (value as ResponseLike).text === 'function'
  );
}

function jsonErrorText(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const error = (parsed as { error?: unknown }).error;
  if (typeof error !== 'string') return null;
  const text = error.trim();
  if (!text || text.length > MAX_ERROR_TEXT_CHARS) return null;
  return text;
}

/**
 * Returns the text to show for a failed call. `source` is the Response of a
 * call that was not ok, or whatever a failed fetch threw. Reads the body once,
 * so the caller must not have read it. Never throws.
 */
export async function errorTextFrom(
  source: unknown,
  fallback: string,
  options: ErrorTextOptions = {}
): Promise<string> {
  if (!isResponseLike(source)) return fallback;

  let body = '';
  try {
    body = await source.text();
  } catch {
    body = '';
  }

  const serverText = jsonErrorText(body);
  if (serverText) return serverText;
  if (source.status === 413) return options.tooLarge ?? TOO_LARGE_TEXT;
  return fallback;
}
