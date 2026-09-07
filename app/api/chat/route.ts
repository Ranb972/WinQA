import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chat, multiModelChat, LLMProvider, ChatMessage, SpecificModel, CustomApiKeys, REGISTRY_MODEL_COUNT, isRegisteredModel } from '@/lib/llm';
import { callCustomProvider } from '@/lib/llm/custom';
import { CustomProvider } from '@/lib/custom-providers';
import { friendlyErrorMessage, DAILY_LIMIT_ERROR } from '@/lib/friendly-errors';
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

// Membership test for client-supplied model keys. A Set, not `key in PROVIDER_MODELS`:
// `in` walks the prototype chain, so 'toString' / 'constructor' / 'valueOf' /
// '__proto__' all pass and then reach `for (const m of fallbackChains[provider])`
// (lib/llm/fallback.ts:106) holding a Function — an uncaught TypeError surfacing as a
// 500. PROVIDER_MODELS is a UI catalogue, not an authorization list.
const VALID_PROVIDERS = new Set<LLMProvider>(['cohere', 'gemini', 'groq', 'openrouter']);

/**
 * The first (provider, id) preference that names a model the registry does not know,
 * checked only for the providers this request will actually call. A stale preference
 * for an unselected provider must not fail the request.
 */
function findUnregisteredPreference(
  providers: LLMProvider[],
  prefs: unknown
): { provider: LLMProvider; id: unknown } | null {
  if (!prefs || typeof prefs !== 'object') return null;
  for (const provider of providers) {
    const id = (prefs as Record<string, unknown>)[provider];
    if (id !== undefined && !isRegisteredModel(provider, id)) return { provider, id };
  }
  return null;
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

    // Same silent-clamp philosophy for the fallback-tuning params.
    // maxAttempts: the longest reachable sequence is every registered model once
    // (REGISTRY_MODEL_COUNT, lib/llm/registry.ts), so anything above it is a no-op.
    // The floor of 1 matters too: maxAttempts 0 breaks out of the loop on the first
    // iteration (fallback.ts) and returns the "All fallback attempts exhausted"
    // 200 after a daily unit has already been charged.
    const safeMaxFallbackAttempts = typeof maxFallbackAttempts === 'number' && Number.isFinite(maxFallbackAttempts)
      ? Math.min(Math.max(Math.floor(maxFallbackAttempts), 1), REGISTRY_MODEL_COUNT)
      : undefined;
    // delayBetweenAttempts: default 500, Compare mode sends 200. The 2s cap bounds the
    // total added sleep at ~18s worst case (9 inter-attempt delays), ending the
    // client-controlled sleep amplification vector.
    const safeFallbackDelay = typeof fallbackDelay === 'number' && Number.isFinite(fallbackDelay)
      ? Math.min(Math.max(Math.floor(fallbackDelay), 0), 2000)
      : undefined;
    // Non-boolean junk no longer flows into the fallback engine.
    const safeCrossProviderFallback = typeof crossProviderFallback === 'boolean'
      ? crossProviderFallback
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

    // Normalize/validate the requested model(s) BEFORE consumeDailyAllowance so an
    // invalid request 400s without burning a unit. Filter -> dedupe -> explicit cap
    // (only 4 distinct providers exist, so the slice documents the bound rather than
    // enforcing a new one).
    const builtInModels: LLMProvider[] = Array.isArray(models)
      ? Array.from(
          new Set(
            models.filter((m): m is LLMProvider =>
              typeof m === 'string' && VALID_PROVIDERS.has(m as LLMProvider)
            )
          )
        ).slice(0, 4)
      : [];

    if (Array.isArray(models)) {
      // Custom-provider IDs, unknown strings and non-strings are all dropped above.
      if (builtInModels.length === 0) {
        return NextResponse.json(
          { error: 'No valid built-in models specified' },
          { status: 400 }
        );
      }
    } else if (
      typeof models !== 'string' ||
      !((models.startsWith('custom:') && customProvider) || VALID_PROVIDERS.has(models as LLMProvider))
    ) {
      // Previously these reached chat() and returned 200-with-error (or a 500 from an
      // unhandled TypeError) after the charge. Behavior change: they now 400 up front.
      return NextResponse.json(
        { error: 'Invalid model specified' },
        { status: 400 }
      );
    }

    // A model preference outside the registry is a 400, never a silent run of the
    // chain head (audit C01). Checked before the allowance charge like the rest.
    const calledProviders: LLMProvider[] = Array.isArray(models)
      ? builtInModels
      : VALID_PROVIDERS.has(models as LLMProvider)
        ? [models as LLMProvider]
        : [];
    const unregistered = findUnregisteredPreference(calledProviders, modelPreferences);
    if (unregistered) {
      return NextResponse.json(
        { error: `Unknown model '${String(unregistered.id)}' for provider '${unregistered.provider}'` },
        { status: 400 }
      );
    }

    const { allowed } = await consumeDailyAllowance(userId);
    if (!allowed) {
      return NextResponse.json({ error: friendlyErrorMessage(DAILY_LIMIT_ERROR) }, { status: 429 });
    }

    // Build fallback overrides once; honored by both the multi-model and single-model paths.
    // Checking each clamped value for undefined keeps an explicit 0 behaving identically
    // whether it is sent alone or alongside other fields.
    const fallbackOverrides = [safeCrossProviderFallback, safeMaxFallbackAttempts, safeFallbackDelay].some((v) => v !== undefined)
      ? {
          enableCrossProviderFallback: safeCrossProviderFallback,
          maxAttempts: safeMaxFallbackAttempts,
          delayBetweenAttempts: safeFallbackDelay,
        }
      : undefined;

    // Handle custom provider request
    if (typeof models === 'string' && models.startsWith('custom:') && customProvider) {
      const response = await callCustomProvider(customProvider, messages, safeTemperature, safeMaxTokens);
      return NextResponse.json({ ...response, error: friendlyErrorMessage(response.error) });
    }

    // Handle multi-model comparison (built-in providers only; validated above)
    if (Array.isArray(models)) {
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
