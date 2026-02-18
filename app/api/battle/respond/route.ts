import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chat, LLMProvider, ChatMessage, CustomApiKeys } from '@/lib/llm';

interface RespondRequestBody {
  provider: LLMProvider;
  model?: string;
  prompt: string;
  customApiKeys?: CustomApiKeys;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as RespondRequestBody;
    const { provider, model, prompt, customApiKeys } = body;

    if (!provider || !prompt) {
      return NextResponse.json({ error: 'Provider and prompt are required' }, { status: 400 });
    }

    const validProviders: LLMProvider[] = ['cohere', 'gemini', 'groq', 'openrouter'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    if (prompt.length > 5000) {
      return NextResponse.json({ error: 'Prompt too long' }, { status: 400 });
    }

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    const response = await chat(
      messages,
      provider,
      0.7,
      2048,
      true,
      model,
      customApiKeys,
      {
        enableCrossProviderFallback: false,
        maxAttempts: 1,
        delayBetweenAttempts: 100,
        providerTimeout: 20000,
      }
    );

    return NextResponse.json({
      content: response.content,
      responseTime: response.responseTime,
      specificModel: response.specificModel,
      error: response.error,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Battle respond error:', errorMessage);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
