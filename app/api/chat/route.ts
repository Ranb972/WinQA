import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chat, multiModelChat, LLMProvider, ChatMessage, SpecificModel, CustomApiKeys, REGISTRY_MODEL_COUNT, isRegisteredModel, providerDisplayNames } from '@/lib/llm';
import { callCustomProvider } from '@/lib/llm/custom';
import { CustomProvider } from '@/lib/custom-providers';
import { friendlyErrorMessage, DAILY_LIMIT_ERROR } from '@/lib/friendly-errors';
import { consumeDailyAllowance } from '@/lib/rate-limit';
import { loadCustomProvider, markRejected, resolveUserKeys, type KeyOrigin } from '@/lib/server/user-keys';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { readJsonObject } from '@/lib/server/read-json-body';

// Every built-in call runs under a 42s total budget (20s per attempt, so two Compare
// attempts plus delays finish before the client's 45s abort; Batch E3); the 60s cap
// leaves headroom for the daily-allowance check. The custom-provider path is bounded
// by its own 20s deadline (DEFAULT_PROVIDER_TIMEOUT_MS, lib/llm/provider-timeout.ts).
export const maxDuration = 60;
const TOTAL_TIMEOUT_MS = 42000;

interface RequestBody {
  messages: ChatMessage[];
  models: string | string[]; // Can be LLMProvider or 'custom:id'
  temperature?: number;
  maxTokens?: number;
  modelPreferences?: Record<LLMProvider, SpecificModel>;
  // Migration only (dual-read): an old tab or an un-migrated browser still sends
  // its keys. A saved key wins over these per provider (resolveUserKeys).
  customApiKeys?: CustomApiKeys;
  // Migration only: used when no saved provider matches the id in `models`.
  customProvider?: CustomProvider;
  crossProviderFallback?: boolean;
  maxFallbackAttempts?: number;
  fallbackDelay?: number;
}

// Membership test for client-supplied model keys. A Set, not `key in PROVIDER_MODELS`:
// `in` walks the prototype chain, so 'toString' / 'constructor' / 'valueOf' /
// '__proto__' all pass and then reach `for (const m of fallbackChains[provider])`
// (lib/llm/fallback.ts:106) holding a Function — an uncaught TypeError surfacing as a
// 500. PROVIDER_MODELS is a UI catalogue, not an authorization list.
const VALID_PROVIDERS = new Set<LLMProvider>(['cohere', 'gemini', 'groq', 'mistral']);
const ALL_PROVIDERS: LLMProvider[] = ['cohere', 'gemini', 'groq', 'mistral'];

// A saved custom provider's id: a Mongo ObjectId, 24 hex characters. Ids from the
// old browser-only store (`custom_<time>_<random>`) never match and can only use
// the legacy body path.
const CUSTOM_ID_RE = /^[0-9a-f]{24}$/;

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

    const parsed = await readJsonObject(request, BODY_LIMITS.chat);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.value as unknown as RequestBody;
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
      !(models.startsWith('custom:') || VALID_PROVIDERS.has(models as LLMProvider))
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

    // Resolve the credentials before the allowance charge, so a provider that does
    // not exist or is disabled 400s without burning a unit.
    let keyOrigin: KeyOrigin = 'none';
    let keyProviders: string[] = [];
    let apiKeys: CustomApiKeys | undefined;
    let serverKeyProviders: LLMProvider[] = [];
    let customToCall: CustomProvider | null = null;

    if (typeof models === 'string' && models.startsWith('custom:')) {
      const id = models.slice('custom:'.length).toLowerCase();
      let stored: CustomProvider | null = null;
      if (CUSTOM_ID_RE.test(id)) {
        try {
          stored = await loadCustomProvider(userId, id);
        } catch (err) {
          console.error(`[keys] load-failed error=${err instanceof Error ? err.name : 'Error'}`);
        }
      }
      if (stored) {
        // The saved record wins whole: a body customProvider (another base URL,
        // another key) has no effect, so a saved key only ever goes to its saved host.
        if (!stored.enabled) {
          return NextResponse.json({ error: 'This custom provider is disabled' }, { status: 400 });
        }
        customToCall = stored;
        keyOrigin = 'server';
      } else if (customProvider && typeof customProvider === 'object') {
        // Legacy: a browser that has not moved its providers to the account yet.
        customToCall = customProvider;
        keyOrigin = 'client';
      } else if (!CUSTOM_ID_RE.test(id)) {
        return NextResponse.json({ error: 'Invalid model specified' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'Custom provider not found' }, { status: 400 });
      }
      keyProviders = ['custom'];
    } else {
      // The engine falls back across providers unless the client turns it off
      // (chatWithFallback defaults enableCrossProviderFallback to true and then
      // walks every provider in crossProviderFallbackOrder, reading keys[provider]
      // on each attempt). So keys are resolved for all four built-ins, as the
      // browser sent all of its keys before; with fallback off, only the called ones.
      const resolved = await resolveUserKeys(
        userId,
        safeCrossProviderFallback === false ? calledProviders : ALL_PROVIDERS,
        customApiKeys
      );
      apiKeys = resolved.keys;
      keyOrigin = resolved.origin;
      serverKeyProviders = resolved.fromServer;
      keyProviders = apiKeys ? Object.keys(apiKeys).sort() : [];
    }

    const { allowed } = await consumeDailyAllowance(userId);
    if (!allowed) {
      return NextResponse.json({ error: friendlyErrorMessage(DAILY_LIMIT_ERROR) }, { status: 429 });
    }

    // One line per request that runs on a user key: where the keys came from
    // (origin=client must reach 0 before body keys are dropped, C16). Never a user
    // id, a key or a custom provider id.
    if (keyOrigin !== 'none') {
      console.log(`[keys] route=chat origin=${keyOrigin} providers=${keyProviders.join(',')}`);
    }

    // A saved key the provider rejected (the engine retried on the app key) is
    // recorded so Settings can say so. The engine flags the response, not the
    // provider; the rejected provider is known only when the final attempt ran on
    // that provider with the app key although a saved key was resolved for it,
    // since the engine drops a key only when it is rejected. Fire-and-forget.
    const recordRejection = (r: { model: LLMProvider; keySource?: string; userKeyRejected?: boolean }) => {
      if (r.userKeyRejected && r.keySource !== 'user' && serverKeyProviders.includes(r.model)) {
        void markRejected(userId, r.model);
      }
    };

    // Build fallback overrides once; honored by both the multi-model and single-model
    // paths. The total budget is always set; undefined tuning fields fall back to the
    // engine's defaults, so an explicit 0 behaves the same sent alone or with others.
    const fallbackOverrides = {
      enableCrossProviderFallback: safeCrossProviderFallback,
      maxAttempts: safeMaxFallbackAttempts,
      delayBetweenAttempts: safeFallbackDelay,
      totalTimeout: TOTAL_TIMEOUT_MS,
      // Compare and Code Testing want the answer, not the deliberation: the lowest
      // reasoning effort on providers that expose one (Groq gpt-oss, Mistral).
      // Battle sends nothing and gets each provider's default.
      reasoningEffort: 'lowest' as const,
    };

    // Handle custom provider request
    if (customToCall) {
      const response = await callCustomProvider(customToCall, messages, safeTemperature, safeMaxTokens);
      // A custom provider's key is always the user's own.
      return NextResponse.json({
        ...response,
        error: friendlyErrorMessage(response.error, { keySource: 'user', providerName: customToCall.name }),
      });
    }

    // Handle multi-model comparison (built-in providers only; validated above)
    if (Array.isArray(models)) {
      const response = await multiModelChat({
        messages,
        models: builtInModels,
        temperature: safeTemperature,
        maxTokens: safeMaxTokens,
        modelPreferences,
        customApiKeys: apiKeys,
        fallbackOverrides,
      });
      response.responses.forEach(recordRejection);
      // Sanitize error messages in multi-model responses
      const sanitized = {
        ...response,
        responses: response.responses.map((r) => ({
          ...r,
          error: friendlyErrorMessage(r.error, {
            keySource: r.keySource,
            userKeyRejected: r.userKeyRejected,
            providerName: providerDisplayNames[r.model],
          }),
        })),
      };
      return NextResponse.json(sanitized);
    }

    // Handle single built-in model
    const specificModel = modelPreferences?.[models as LLMProvider];
    const response = await chat(messages, models as LLMProvider, safeTemperature, safeMaxTokens, true, specificModel, apiKeys, fallbackOverrides);
    recordRejection(response);
    return NextResponse.json({
      ...response,
      error: friendlyErrorMessage(response.error, {
        keySource: response.keySource,
        userKeyRejected: response.userKeyRejected,
        providerName: providerDisplayNames[models as LLMProvider],
      }),
    });
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
