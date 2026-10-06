import type { KeySource, LLMProvider } from './types';

// One place for turning a provider failure into the ChatResponse error string.
//
// Two problems this solves (E1 hotfix, 2026-09-08). First, the adapters used to
// return `error.message` alone, so the HTTP status never reached
// friendlyErrorMessage or the fallback engine: OpenRouter's 404 "This model is
// unavailable for free" read as a 503 in the UI and as a hard failure in the
// engine. Second, nothing was logged, so the Vercel runtime logs of a failing
// production deployment contained no provider detail at all. Every adapter now
// reports through here: the status is prefixed to the message and one sanitized
// line goes to the server log.

const MAX_LOGGED_MESSAGE = 200;

/** Status carried by the SDK error classes we see: fetch-based (status), groq-sdk
 *  APIError (status), @google/genai ApiError (status), cohere-ai CohereError
 *  (statusCode). */
export function providerErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as { status?: unknown; statusCode?: unknown };
  for (const candidate of [e.status, e.statusCode]) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599) {
      return candidate;
    }
  }
  return undefined;
}

/** `"<status>: <message>"` when a status is known, else the message alone. */
export function formatProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  const status = providerErrorStatus(error);
  if (status === undefined) return message;
  // Some SDKs (Gemini) already lead with the code; do not double it.
  return message.startsWith(`${status}`) ? message : `${status}: ${message}`;
}

/** Strip anything that looks like a credential before a message reaches a log. */
export function redactSecrets(text: string): string {
  return text
    .replace(/bearer\s+[a-z0-9_\-.]{8,}/gi, 'Bearer <redacted>')
    .replace(/([?&]key=)[^&\s]+/gi, '$1<redacted>')
    .replace(/\b(sk|gsk|or|co)[-_][a-z0-9_\-]{12,}/gi, '<redacted>');
}

/**
 * Record a provider failure and return the error string for the ChatResponse.
 * Logs exactly one line: provider, model, status, which key was sent (app or
 * user) and a truncated, redacted message. Never the error object, never a key.
 * The key source is what the 2026-09-09 smoke lacked: four 401 lines that could
 * not say whether the app key or a saved user key had been rejected.
 */
export function reportProviderError(provider: LLMProvider, model: string, error: unknown, keySource: KeySource): string {
  const formatted = formatProviderError(error);
  const status = providerErrorStatus(error);
  const head = redactSecrets(formatted).replace(/\s+/g, ' ').slice(0, MAX_LOGGED_MESSAGE);
  console.error(`[llm] ${provider} ${model} failed: status=${status ?? 'n/a'} key=${keySource} ${head}`);
  return formatted;
}
