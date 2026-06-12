import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chat, multiModelChat, LLMProvider, ChatMessage, SpecificModel, CustomApiKeys } from '@/lib/llm';
import { callCustomProvider } from '@/lib/llm/custom';
import { CustomProvider } from '@/lib/custom-providers';
import { friendlyErrorMessage } from '@/lib/friendly-errors';
import { consumeDailyAllowance } from '@/lib/rate-limit';

// Worst case ≈ 2 provider timeouts (30s each) under the client's 2-attempt config;
// also bounds the custom-provider path, whose fetch has no timeout of its own.
export const maxDuration = 60;

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

    // Clamp client-supplied generation params silently (no 400s): temperature to a
    // range every provider accepts; maxTokens to 4096 — the app's largest sanctioned
    // budget (battle/respond) — so no client can request more than the product grants.
    const safeTemperature = typeof temperature === 'number' && Number.isFinite(temperature)
      ? Math.min(Math.max(temperature, 0), 2)
      : undefined;
    const safeMaxTokens = typeof maxTokens === 'number' && Number.isFinite(maxTokens)
      ? Math.min(Math.max(Math.floor(maxTokens), 1), 4096)
      : undefined;

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

    const { allowed } = await consumeDailyAllowance(userId);
    if (!allowed) {
      return NextResponse.json({ error: friendlyErrorMessage('daily limit reached') }, { status: 429 });
    }

    // Build fallback overrides once; honored by both the multi-model and single-model paths
    const fallbackOverrides = crossProviderFallback !== undefined || maxFallbackAttempts || fallbackDelay
      ? {
          enableCrossProviderFallback: crossProviderFallback,
          maxAttempts: maxFallbackAttempts,
          delayBetweenAttempts: fallbackDelay,
        }
      : undefined;

    // Handle custom provider request
    if (typeof models === 'string' && models.startsWith('custom:') && customProvider) {
      const response = await callCustomProvider(customProvider, messages, safeTemperature, safeMaxTokens);
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
        temperature: safeTemperature,
        maxTokens: safeMaxTokens,
        modelPreferences,
        customApiKeys,
        fallbackOverrides,
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
    const response = await chat(messages, models as LLMProvider, safeTemperature, safeMaxTokens, true, specificModel, customApiKeys, fallbackOverrides);
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
