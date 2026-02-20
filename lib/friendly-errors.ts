/**
 * Converts raw LLM provider error messages into user-friendly messages.
 * Falls back to a generic message if no pattern matches.
 */
export function friendlyErrorMessage(raw: string | undefined): string | undefined {
  if (!raw) return raw;

  const lower = raw.toLowerCase();

  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return 'This model is busy right now. Please try again in a moment.';
  }

  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('deadline')) {
    return 'This model took too long to respond. Try again.';
  }

  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('overloaded') || lower.includes('500')) {
    return 'This model is temporarily unavailable. Try a different one.';
  }

  return 'Something went wrong. Please try again.';
}
