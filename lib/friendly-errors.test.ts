import { describe, it, expect } from 'vitest';
import { friendlyErrorMessage, DAILY_LIMIT_ERROR, REDIRECT_BLOCKED_ERROR } from '@/lib/friendly-errors';

// Raw strings as the adapters now emit them (status prefixed by lib/llm/provider-error.ts).
describe('friendlyErrorMessage', () => {
  it('keeps the WinQA sentinels ahead of the substring chain', () => {
    expect(friendlyErrorMessage(DAILY_LIMIT_ERROR)).toBe("You've reached today's free usage limit — it resets at midnight UTC.");
    expect(friendlyErrorMessage(REDIRECT_BLOCKED_ERROR)).toBe('This provider attempted a redirect, which WinQA blocks for security. Check the provider URL.');
  });

  it('maps a withdrawn OpenRouter slug (404 whose text says "unavailable") to the model message, not the outage message', () => {
    const raw = '404: This model is unavailable for free. The paid version is available now - use this slug instead: minimax/minimax-m3';
    expect(friendlyErrorMessage(raw)).toBe('The selected model is unavailable. Try another one.');
  });

  it('maps Gemini high-demand 503s and OpenRouter 502-in-200 bodies to the outage message', () => {
    expect(friendlyErrorMessage('503: {"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'))
      .toBe('This model is temporarily unavailable. Try a different one.');
    expect(friendlyErrorMessage('502: Upstream error from Nvidia: Service temporarily overloaded'))
      .toBe('This model is temporarily unavailable. Try a different one.');
  });

  it('maps the engine timeout, rate limits and bad keys', () => {
    expect(friendlyErrorMessage('Request timed out after 20s')).toBe('This model took too long to respond. Try again.');
    expect(friendlyErrorMessage('429: Rate limit exceeded: free-models-per-day')).toBe('This model is busy right now. Please try again in a moment.');
    expect(friendlyErrorMessage('401: No auth credentials found')).toBe('API key invalid or revoked. Check your provider settings.');
  });

  it('passes undefined through and falls back to the generic message', () => {
    expect(friendlyErrorMessage(undefined)).toBeUndefined();
    expect(friendlyErrorMessage('socket hang up')).toBe('Something went wrong. Please try again.');
  });
});
