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

  it('names the rejected key when the route says which one it was', () => {
    expect(friendlyErrorMessage('401: Invalid API Key', { keySource: 'user', providerName: 'Mistral' }))
      .toBe('Your saved Mistral API key was rejected. Check it in Settings.');
    expect(friendlyErrorMessage('401: Invalid API Key', { keySource: 'app', providerName: 'Mistral' }))
      .toBe("The app's Mistral key was rejected. Try another provider.");
    expect(friendlyErrorMessage('401: Invalid API Key', { keySource: 'app', userKeyRejected: true, providerName: 'Mistral' }))
      .toBe("Your saved Mistral key and the app's key were both rejected. Try another provider.");
    // A 403 is the same story with a different status.
    expect(friendlyErrorMessage('403: This model is not available in your subscription tier', { keySource: 'user', providerName: 'Mistral' }))
      .toBe('Your saved Mistral API key was rejected. Check it in Settings.');
    // Without a provider name the sentence still reads.
    expect(friendlyErrorMessage('401: No auth credentials found', { keySource: 'app' }))
      .toBe("The app's key was rejected. Try another provider.");
  });

  it('keeps the generic key text without a context, and a context changes no other message', () => {
    expect(friendlyErrorMessage('401: No auth credentials found', {})).toBe('API key invalid or revoked. Check your provider settings.');
    expect(friendlyErrorMessage('Request timed out after 20s', { keySource: 'user', providerName: 'Groq' }))
      .toBe('This model took too long to respond. Try again.');
    expect(friendlyErrorMessage(DAILY_LIMIT_ERROR, { keySource: 'app' })).toBe("You've reached today's free usage limit — it resets at midnight UTC.");
  });

  it('passes undefined through and falls back to the generic message', () => {
    expect(friendlyErrorMessage(undefined)).toBeUndefined();
    expect(friendlyErrorMessage('socket hang up')).toBe('Something went wrong. Please try again.');
  });
});
