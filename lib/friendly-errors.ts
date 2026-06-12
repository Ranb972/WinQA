/**
 * Converts raw LLM provider error messages into user-friendly messages.
 * Falls back to a generic message if no pattern matches.
 */
export function friendlyErrorMessage(raw: string | undefined): string | undefined {
  if (!raw) return raw;

  const lower = raw.toLowerCase();

  if (lower.includes('redirect')) {
    return 'This provider attempted a redirect, which WinQA blocks for security. Check the provider URL.';
  }

  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return 'This model is busy right now. Please try again in a moment.';
  }

  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('deadline')) {
    return 'This model took too long to respond. Try again.';
  }

  if (lower.includes('401') || lower.includes('403') || lower.includes('invalid api key') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return 'API key invalid or revoked. Check your provider settings.';
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
