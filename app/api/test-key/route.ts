import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { LLMProvider } from '@/lib/llm/types';

interface TestKeyRequest {
  provider: LLMProvider;
  apiKey: string;
}

interface TestKeyResponse {
  valid: boolean;
  error?: string;
}

/**
 * Test a Cohere API key
 */
async function testCohereKey(apiKey: string): Promise<TestKeyResponse> {
  try {
    const { CohereClient } = await import('cohere-ai');
    const client = new CohereClient({ token: apiKey });

    await client.chat({
      model: 'command-r-08-2024',
      message: 'Hi',
      maxTokens: 1,
    });

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('401') || message.includes('invalid') || message.includes('unauthorized')) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (message.includes('429') || message.includes('rate')) {
      return { valid: true }; // Key is valid but rate limited
    }
    return { valid: false, error: message };
  }
}

/**
 * Test a Google Gemini API key
 */
async function testGeminiKey(apiKey: string): Promise<TestKeyResponse> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { maxOutputTokens: 1 },
    });

    await model.generateContent('Hi');

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('API_KEY_INVALID') || message.includes('401') || message.includes('invalid')) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (message.includes('429') || message.includes('quota') || message.includes('rate')) {
      return { valid: true }; // Key is valid but rate limited
    }
    return { valid: false, error: message };
  }
}

/**
 * Test a Groq API key
 */
async function testGroqKey(apiKey: string): Promise<TestKeyResponse> {
  try {
    const Groq = (await import('groq-sdk')).default;
    const client = new Groq({ apiKey });

    await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1,
    });

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('401') || message.includes('invalid') || message.includes('Unauthorized')) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (message.includes('429') || message.includes('rate')) {
      return { valid: true }; // Key is valid but rate limited
    }
    return { valid: false, error: message };
  }
}

/**
 * Test an OpenRouter API key
 */
async function testOpenRouterKey(apiKey: string): Promise<TestKeyResponse> {
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
        model: 'deepseek/deepseek-r1-0528:free',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { valid: true }; // Key is valid but rate limited
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { valid: false, error: data.error?.message || response.statusText };
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: message };
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
  } catch (error) {
    // Never log the API key in error messages
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { valid: false, error: message },
      { status: 500 }
    );
  }
}
