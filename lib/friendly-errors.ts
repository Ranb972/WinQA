import type { KeySource } from './llm/types';

export const DAILY_LIMIT_ERROR = 'daily limit reached';
export const REDIRECT_BLOCKED_ERROR = 'Provider attempted an HTTP redirect (blocked for security)';

/**
 * What the route knows about a failed call and the raw message does not: which
 * key was sent, whether a saved user key had already been rejected on the way,
 * and the provider's display name. Only the 401/403 text reads it; every other
 * message is the same with or without it.
 */
export interface ErrorContext {
  keySource?: KeySource;
  userKeyRejected?: boolean;
  providerName?: string;
}

/**
 * The 401/403 text names the key that was rejected. Before Batch E3.1 every bad
 * key read "check your provider settings", which sent the user to Settings even
 * when it was the app's own key that had been rejected (2026-09-09 smoke).
 * Without a context the old generic text stays, for callers that know nothing.
 */
function rejectedKeyMessage(context?: ErrorContext): string {
  const name = context?.providerName ? `${context.providerName} ` : '';
  if (context?.keySource === 'user') {
    return `Your saved ${name}API key was rejected. Check it in Settings.`;
  }
  if (context?.keySource === 'app') {
    return context.userKeyRejected
      ? `Your saved ${name}key and the app's key were both rejected. Try another provider.`
      : `The app's ${name}key was rejected. Try another provider.`;
  }
  return 'API key invalid or revoked. Check your provider settings.';
}

/**
 * Converts raw LLM provider error messages into user-friendly messages.
 * Falls back to a generic message if no pattern matches.
 */
export function friendlyErrorMessage(raw: string | undefined, context?: ErrorContext): string | undefined {
  if (!raw) return raw;

  // WinQA-constructed sentinels: exact match on the raw string, before lowercasing.
  // These MUST stay above the substring chain — neither sentinel matches any branch
  // below, so moving them down would drop both to the generic fallback (silently
  // degrading the 429 body on every metered route).
  if (raw === DAILY_LIMIT_ERROR) {
    return "You've reached today's free usage limit — it resets at midnight UTC.";
  }

  if (raw === REDIRECT_BLOCKED_ERROR) {
    return 'This provider attempted a redirect, which WinQA blocks for security. Check the provider URL.';
  }

  const lower = raw.toLowerCase();

  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return 'This model is busy right now. Please try again in a moment.';
  }

  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('deadline')) {
    return 'This model took too long to respond. Try again.';
  }

  if (lower.includes('401') || lower.includes('403') || lower.includes('invalid api key') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return rejectedKeyMessage(context);
  }

  if (lower.includes('404') || lower.includes('model not found') || lower.includes('not found')) {
    return 'The selected model is unavailable. Try another one.';
  }

  if (lower.includes('402') || lower.includes('quota') || lower.includes('insufficient')) {
    return 'Provider quota exceeded. Try later or use a different provider.';
  }

  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('overloaded') || lower.includes('500')) {
    return 'This model is temporarily unavailable. Try a different one.';
  }

  return 'Something went wrong. Please try again.';
}
