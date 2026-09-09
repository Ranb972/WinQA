import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chat, LLMProvider, ChatMessage, CustomApiKeys, isRegisteredModel } from '@/lib/llm';
import { friendlyErrorMessage, DAILY_LIMIT_ERROR } from '@/lib/friendly-errors';
import { consumeDailyAllowance } from '@/lib/rate-limit';

// Up to two same-provider attempts (a withdrawn or overloaded head falls through to
// the next model of its family) inside a 24s total budget: the second attempt only
// gets what the first left, so the route stays under its 30s cap and the battle
// page's 25s abort. Gemini 3.8 Flash answered a Code Duel prompt with a 503 after
// 5s in the 2026-09-08 smoke; one attempt made that the whole result.
export const maxDuration = 30;
const PROVIDER_TIMEOUT_MS = 20000;
const TOTAL_TIMEOUT_MS = 24000;

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

    const validProviders: LLMProvider[] = ['cohere', 'gemini', 'groq', 'mistral'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    if (prompt.length > 5000) {
      return NextResponse.json({ error: 'Prompt too long' }, { status: 400 });
    }

    // An id outside the registry is a 400, never a silent run of the chain head
    // (audit C01: the Battle dropdown used to offer three such ids).
    if (model !== undefined && !isRegisteredModel(provider, model)) {
      return NextResponse.json(
        { error: `Unknown model '${String(model)}' for provider '${provider}'` },
        { status: 400 }
      );
    }

    const { allowed } = await consumeDailyAllowance(userId);
    if (!allowed) {
      return NextResponse.json({ error: friendlyErrorMessage(DAILY_LIMIT_ERROR) }, { status: 429 });
    }

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    const response = await chat(
      messages,
      provider,
      0.7,
      4096,
      true,
      model,
      customApiKeys,
      {
        enableCrossProviderFallback: false,
        maxAttempts: 2,
        delayBetweenAttempts: 100,
        providerTimeout: PROVIDER_TIMEOUT_MS,
        totalTimeout: TOTAL_TIMEOUT_MS,
      }
    );

    return NextResponse.json({
      content: response.content,
      responseTime: response.responseTime,
      specificModel: response.specificModel,
      error: friendlyErrorMessage(response.error),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Battle respond error:', errorMessage);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
