import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chat, multiModelChat, LLMProvider, ChatMessage, SpecificModel, CustomApiKeys } from '@/lib/llm';
import { callCustomProvider } from '@/lib/llm/custom';
import { CustomProvider } from '@/lib/custom-providers';
import { friendlyErrorMessage } from '@/lib/friendly-errors';

interface RequestBody {
  messages: ChatMessage[];
  models: string | string[]; // Can be LLMProvider or 'custom:id'
  temperature?: number;
  maxTokens?: number;
  modelPreferences?: Record<LLMProvider, SpecificModel>;
  customApiKeys?: CustomApiKeys;
  customProvider?: CustomProvider; // For custom provider requests
  crossProviderFallback?: boolean;
  maxFallbackAttempts?: number;
  fallbackDelay?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const { messages, models, temperature, maxTokens, modelPreferences, customApiKeys, customProvider, crossProviderFallback, maxFallbackAttempts, fallbackDelay } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    if (!models) {
      return NextResponse.json(
        { error: 'Model(s) are required' },
        { status: 400 }
      );
    }

    // Handle custom provider request
    if (typeof models === 'string' && models.startsWith('custom:') && customProvider) {
      const response = await callCustomProvider(customProvider, messages, temperature, maxTokens);
      return NextResponse.json({ ...response, error: friendlyErrorMessage(response.error) });
    }

    // Handle multi-model comparison (built-in providers only)
    if (Array.isArray(models)) {
      // Filter out any custom provider IDs (they should be handled separately by the client)
      const builtInModels = models.filter((m) => !m.startsWith('custom:')) as LLMProvider[];

      if (builtInModels.length === 0) {
        return NextResponse.json(
          { error: 'No valid built-in models specified' },
          { status: 400 }
        );
      }

      const response = await multiModelChat({
        messages,
        models: builtInModels,
        temperature,
        maxTokens,
        modelPreferences,
        customApiKeys,
      });
      // Sanitize error messages in multi-model responses
      const sanitized = {
        ...response,
        responses: response.responses.map((r) => ({
          ...r,
          error: friendlyErrorMessage(r.error),
        })),
      };
      return NextResponse.json(sanitized);
    }

    // Handle single built-in model
    const specificModel = modelPreferences?.[models as LLMProvider];
    const fallbackOverrides = crossProviderFallback !== undefined || maxFallbackAttempts || fallbackDelay
      ? {
          enableCrossProviderFallback: crossProviderFallback,
          maxAttempts: maxFallbackAttempts,
          delayBetweenAttempts: fallbackDelay,
        }
      : undefined;
    const response = await chat(messages, models as LLMProvider, temperature, maxTokens, true, specificModel, customApiKeys, fallbackOverrides);
    return NextResponse.json({ ...response, error: friendlyErrorMessage(response.error) });
  } catch (error) {
    // Log error message only, never log full error object which could contain API keys
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat API error:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
