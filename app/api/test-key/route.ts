import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { LLMProvider } from '@/lib/llm/types';
// Every probe targets the provider's registry default, so a key check never names a
// model outside the lineup (audit V05: the OpenRouter probe used deepseek-r1, in no
// list; the Groq probe used llama-3.1-8b-instant, shut down 2026-08-16).
import { defaultModels } from '@/lib/llm/registry';
import { friendlyErrorMessage } from '@/lib/friendly-errors';

// Each provider check is bounded at 10s (abort + SDK timeout, no SDK retries),
// leaving ~5s headroom under maxDuration = 15.
export const maxDuration = 15;

interface TestKeyRequest {
  provider: LLMProvider;
  apiKey: string;
}

interface TestKeyResponse {
  valid: boolean;
  error?: string;
}

const PROVIDER_TIMEOUT_MS = 10_000;
const TIMEOUT_ERROR = 'Provider took too long to respond. Try again.';

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
    return { valid: false, error: friendlyErrorMessage(message) };
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
    return { valid: false, error: friendlyErrorMessage(message) };
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
    return { valid: false, error: friendlyErrorMessage(message) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test an OpenRouter API key
 */
async function testOpenRouterKey(apiKey: string): Promise<TestKeyResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'WinQA',
      },
      body: JSON.stringify({
        model: defaultModels.openrouter,
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
      const data = await response.json().catch(() => ({}));
      return { valid: false, error: friendlyErrorMessage(data.error?.message || response.statusText) };
    }

    return { valid: true };
  } catch (error) {
    if (isAbortError(error)) {
      return { valid: false, error: TIMEOUT_ERROR };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: friendlyErrorMessage(message) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as TestKeyRequest;
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { valid: false, error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders: LLMProvider[] = ['cohere', 'gemini', 'groq', 'openrouter'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { valid: false, error: 'Invalid provider' },
        { status: 400 }
      );
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
      case 'openrouter':
        result = await testOpenRouterKey(apiKey);
        break;
      default:
        result = { valid: false, error: 'Unknown provider' };
    }

    return NextResponse.json(result);
  } catch {
    // Never log the API key in error messages
    return NextResponse.json(
      { valid: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
