import { describe, it, expect } from 'vitest';
import {
  friendlyErrorMessage,
  DAILY_LIMIT_ERROR,
  REDIRECT_BLOCKED_ERROR,
  PROVIDER_BODY_TOO_LARGE_ERROR,
  UNREACHABLE_PROVIDER_ERROR,
  ADDRESS_GUARD_ERRORS,
  CONNECT_FAILURE_ERRORS,
  PROVIDER_CONNECT_TIMEOUT_ERROR,
  PROVIDER_CONNECT_REFUSED_ERROR,
  PROVIDER_CONNECT_UNREACHABLE_ERROR,
  PROVIDER_CONNECT_RESET_ERROR,
} from '@/lib/friendly-errors';

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

describe('friendlyErrorMessage: WinQA address block (S11)', () => {
  it('maps the unreachable-address sentinel to the address message', () => {
    expect(UNREACHABLE_PROVIDER_ERROR).toBe('The provider address is not reachable from WinQA');
    expect(friendlyErrorMessage('The provider address is not reachable from WinQA')).toBe(
      'WinQA cannot connect to this provider address. Check the base URL.'
    );
  });

  it.each([
    'Base URL must use HTTPS',
    'Base URL must not point to a private/internal address',
    'Base URL is too long (2048 characters max)',
  ])('maps the base-URL guard text "%s" to the address message', (raw) => {
    expect(friendlyErrorMessage(raw)).toBe('WinQA cannot connect to this provider address. Check the base URL.');
  });
});

describe('friendlyErrorMessage: the address-guard match is an exact set (S11)', () => {
  it('holds exactly the guard texts checkProviderUrl and the DNS vetting return', () => {
    expect([...ADDRESS_GUARD_ERRORS].sort()).toEqual(
      [
        'Base URL is too long (2048 characters max)',
        'Base URL must not point to a private/internal address',
        'Base URL must use HTTPS',
        'The provider address is not reachable from WinQA',
      ].sort()
    );
  });

  it('a provider text that merely begins with "Base URL" is not treated as WinQA\'s block', () => {
    expect(friendlyErrorMessage('Base URL not configured for this deployment')).toBe(
      'Something went wrong. Please try again.'
    );
  });
});

describe('friendlyErrorMessage: an oversized provider answer (S13)', () => {
  it('maps the body-too-large sentinel to plain words', () => {
    expect(PROVIDER_BODY_TOO_LARGE_ERROR).toBe('Provider response exceeded the size limit');
    expect(friendlyErrorMessage(PROVIDER_BODY_TOO_LARGE_ERROR)).toBe('This provider sent a response that was too large.');
  });

  it('matches the sentinel exactly, not as a prefix', () => {
    expect(friendlyErrorMessage(`${PROVIDER_BODY_TOO_LARGE_ERROR} of the upstream gateway`)).toBe(
      'Something went wrong. Please try again.'
    );
  });
});

describe('friendlyErrorMessage: a failed connect names its cause', () => {
  it('holds exactly the four connect-failure sentinels', () => {
    expect([...CONNECT_FAILURE_ERRORS].sort()).toEqual(
      [
        'The provider did not accept a connection in time',
        'The provider refused the connection',
        'The provider address could not be reached',
        'The connection to the provider was closed',
      ].sort()
    );
    expect(PROVIDER_CONNECT_TIMEOUT_ERROR).toBe('The provider did not accept a connection in time');
  });

  it('the connect-timeout sentinel reads as a provider timeout', () => {
    expect(friendlyErrorMessage(PROVIDER_CONNECT_TIMEOUT_ERROR)).toBe('This model took too long to respond. Try again.');
  });

  it('the unreachable sentinel points at the address', () => {
    expect(friendlyErrorMessage(PROVIDER_CONNECT_UNREACHABLE_ERROR)).toBe(
      'WinQA cannot connect to this provider address. Check the base URL.'
    );
  });

  it.each([
    ['refused', PROVIDER_CONNECT_REFUSED_ERROR],
    ['closed', PROVIDER_CONNECT_RESET_ERROR],
  ])('the %s sentinel says the provider may be down or the URL wrong', (_label, raw) => {
    expect(friendlyErrorMessage(raw)).toBe(
      'WinQA could not connect to this provider. It may be down, or the base URL may be wrong.'
    );
  });

  it('matches the sentinels exactly, not as a prefix', () => {
    expect(friendlyErrorMessage(`${PROVIDER_CONNECT_REFUSED_ERROR} by the gateway`)).toBe(
      'Something went wrong. Please try again.'
    );
    expect(friendlyErrorMessage(`${PROVIDER_CONNECT_TIMEOUT_ERROR} today`)).toBe('Something went wrong. Please try again.');
  });

  it('"fetch failed" is unchanged (the generic fallback)', () => {
    expect(friendlyErrorMessage('fetch failed')).toBe('Something went wrong. Please try again.');
  });
});
