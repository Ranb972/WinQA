import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { LLMProvider } from '@/lib/llm/types';
// Every probe targets the provider's registry default, so a key check never names a
// model outside the lineup (audit V05: the then-OpenRouter probe used deepseek-r1, in no
// list; the Groq probe used llama-3.1-8b-instant, shut down 2026-08-16).
import { defaultModels } from '@/lib/llm/registry';
import { friendlyErrorMessage } from '@/lib/friendly-errors';
import dbConnect from '@/lib/mongodb';
import ProviderCredential from '@/models/ProviderCredential';
import { loadUserKeys } from '@/lib/server/user-keys';

// Each provider check is bounded at 10s (abort + SDK timeout, no SDK retries),
// leaving ~5s headroom under maxDuration = 15.
export const maxDuration = 15;

/**
 * `apiKey` is the key the user just typed. Without it the route tests the key
 * saved for `provider` on the server (lib/server/user-keys.ts), so a saved key
 * never has to travel from the browser to be checked.
 */
interface TestKeyRequest {
  provider: LLMProvider;
  apiKey?: string;
}

// A Set, not `in`: 'toString' and other prototype names are not providers.
const VALID_PROVIDERS: ReadonlySet<string> = new Set<LLMProvider>(['cohere', 'gemini', 'groq', 'mistral']);
const NO_SAVED_KEY_ERROR = 'No saved key for this provider';

interface TestKeyResponse {
  valid: boolean;
  error?: string;
}

const PROVIDER_TIMEOUT_MS = 10_000;
const TIMEOUT_ERROR = 'Provider took too long to respond. Try again.';
// Every key this route checks is the user's (typed or saved), so a rejection is theirs.
// Names match providerDisplayNames in lib/llm/index.ts, which is not imported
// here to keep the SDKs on their dynamic imports.
const USER_KEY = { keySource: 'user' as const };

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message));
}

/**
 * Test a Cohere API key
 */
async function testCohereKey(apiKey: string): Promise<TestKeyResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const { CohereClient } = await import('cohere-ai');
    const client = new CohereClient({ token: apiKey });

    await client.chat(
      {
        model: defaultModels.cohere,
        message: 'Hi',
        maxTokens: 1,
      },
      {
        abortSignal: controller.signal,
        timeoutInSeconds: PROVIDER_TIMEOUT_MS / 1000,
        maxRetries: 0,
      }
    );

    return { valid: true };
  } catch (error) {
    if (isAbortError(error)) {
      return { valid: false, error: TIMEOUT_ERROR };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('401') || message.includes('invalid') || message.includes('unauthorized')) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (message.includes('429') || message.includes('rate')) {
      return { valid: true }; // Key is valid but rate limited
    }
    return { valid: false, error: friendlyErrorMessage(message, { ...USER_KEY, providerName: 'Cohere' }) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test a Google Gemini API key
 */
async function testGeminiKey(apiKey: string): Promise<TestKeyResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: defaultModels.gemini,
      contents: 'Hi',
      config: { maxOutputTokens: 1, abortSignal: controller.signal },
    });

    return { valid: true };
  } catch (error) {
    if (isAbortError(error)) {
      return { valid: false, error: TIMEOUT_ERROR };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('API_KEY_INVALID') || message.includes('401') || message.includes('invalid')) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (message.includes('429') || message.includes('quota') || message.includes('rate')) {
      return { valid: true }; // Key is valid but rate limited
    }
    return { valid: false, error: friendlyErrorMessage(message, { ...USER_KEY, providerName: 'Google' }) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test a Groq API key
 */
async function testGroqKey(apiKey: string): Promise<TestKeyResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const Groq = (await import('groq-sdk')).default;
    const client = new Groq({ apiKey });

    await client.chat.completions.create(
      {
        model: defaultModels.groq,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      },
      {
        signal: controller.signal,
        timeout: PROVIDER_TIMEOUT_MS,
        maxRetries: 0,
      }
    );

    return { valid: true };
  } catch (error) {
    if (isAbortError(error)) {
      return { valid: false, error: TIMEOUT_ERROR };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('401') || message.includes('invalid') || message.includes('Unauthorized')) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (message.includes('429') || message.includes('rate')) {
      return { valid: true }; // Key is valid but rate limited
    }
    return { valid: false, error: friendlyErrorMessage(message, { ...USER_KEY, providerName: 'Groq' }) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test a Mistral API key
 */
async function testMistralKey(apiKey: string): Promise<TestKeyResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: defaultModels.mistral,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { valid: true }; // Key is valid but rate limited
    }

    if (!response.ok) {
      // Mistral error bodies carry {message} or {error:{message}}.
      const data = await response.json().catch(() => ({}));
      return { valid: false, error: friendlyErrorMessage(`${response.status}: ${data.message || data.error?.message || response.statusText}`, { ...USER_KEY, providerName: 'Mistral' }) };
    }

    return { valid: true };
  } catch (error) {
    if (isAbortError(error)) {
      return { valid: false, error: TIMEOUT_ERROR };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: friendlyErrorMessage(message, { ...USER_KEY, providerName: 'Mistral' }) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Records the outcome on the user's saved record for this provider, if there is
 * one (updateOne matches nothing otherwise and creates nothing). Fire-and-forget:
 * the answer never waits for it, and a failure logs only the slot and the error
 * class. Only lastTestedAt and lastTestOk are set; never userId, slot or kind.
 */
function recordTestResult(userId: string, provider: LLMProvider, ok: boolean): void {
  void (async () => {
    try {
      await dbConnect();
      await ProviderCredential.updateOne(
        { userId, slot: provider, kind: 'builtin' },
        { $set: { lastTestedAt: new Date(), lastTestOk: ok } },
        { runValidators: true }
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error';
      console.error(`[keys] record-test-failed slot=${provider} error=${name}`);
    }
  })();
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as TestKeyRequest;
    const { provider } = body;
    // No apiKey field (or null): test the saved key. A field that is present must
    // be a typed key, as before.
    const useSavedKey = body.apiKey === undefined || body.apiKey === null;

    if (!provider || (!useSavedKey && !body.apiKey)) {
      return NextResponse.json(
        { valid: false, error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Validate provider (before any DB call)
    if (typeof provider !== 'string' || !VALID_PROVIDERS.has(provider)) {
      return NextResponse.json(
        { valid: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    let apiKey: string;
    if (useSavedKey) {
      // A record that does not decrypt is logged by the loader and counts as no key.
      const { keys } = await loadUserKeys(userId, [provider]);
      const saved = keys[provider];
      if (!saved) {
        return NextResponse.json({ valid: false, error: NO_SAVED_KEY_ERROR }, { status: 404 });
      }
      apiKey = saved;
    } else {
      apiKey = body.apiKey as string;
    }

    let result: TestKeyResponse;

    switch (provider) {
      case 'cohere':
        result = await testCohereKey(apiKey);
        break;
      case 'gemini':
        result = await testGeminiKey(apiKey);
        break;
      case 'groq':
        result = await testGroqKey(apiKey);
        break;
      case 'mistral':
        result = await testMistralKey(apiKey);
        break;
      default:
        result = { valid: false, error: 'Unknown provider' };
    }

    // Only a test of the saved key says anything about the saved record. A typed
    // key may be a different key, and its row may not even decrypt here.
    if (useSavedKey) recordTestResult(userId, provider, result.valid);

    return NextResponse.json(result);
  } catch {
    // Never log the API key in error messages
    return NextResponse.json(
      { valid: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
