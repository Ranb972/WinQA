import {
  ChatMessage,
  ChatResponse,
  LLMProvider,
  SpecificModel,
  CohereModel,
  GeminiModel,
  GroqModel,
  MistralModel,
  CustomApiKeys,
} from './types';
import { cohereChat } from './cohere';
import { geminiChat } from './gemini';
import { groqChat } from './groq';
import { mistralChat } from './mistral';
import { fallbackChains, defaultModels, isRegisteredModel } from './registry';

// The chains, defaults and display names live in the registry (lib/llm/registry.ts);
// they are re-exported here for existing importers.
export { fallbackChains, defaultModels, specificModelDisplayNames } from './registry';

// Cross-provider fallback order when all models in a provider fail
export const crossProviderFallbackOrder: LLMProvider[] = ['groq', 'gemini', 'mistral', 'cohere'];

export type FailureReason = 'rate_limit' | 'quota_exceeded' | 'error';

export interface FailureClass {
  /** True when the next model in the chain should be tried. */
  retry: boolean;
  reason: FailureReason;
}

// Adapters prefix the HTTP status to the error string (lib/llm/provider-error.ts),
// so the engine can read it back here.
function leadingStatus(message: string): number | undefined {
  const m = /^(\d{3})\b/.exec(message);
  return m ? Number(m[1]) : undefined;
}

/**
 * Decide whether a failed attempt should fall through to the next model.
 *
 * Before the E1 hotfix only rate-limit and quota wording continued the chain; a
 * withdrawn model (404), an overloaded provider (5xx) or a provider timeout ended
 * the call on attempt one, which is exactly the situation the chain exists for
 * (2026-09-08 smoke: OpenRouter 404 "unavailable for free", Gemini 503 "high
 * demand"). Bad requests and bad keys still stop immediately: retrying them on a
 * sibling model cannot help and would hide the real problem.
 */
export function classifyFailure(errorMessage: string | undefined): FailureClass {
  if (!errorMessage) return { retry: false, reason: 'error' };

  const status = leadingStatus(errorMessage);
  const message = errorMessage.toLowerCase();

  if (status === 429 || message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return { retry: true, reason: 'rate_limit' };
  }
  if (
    status === 402 || status === 403 ||
    message.includes('quota') || message.includes('exceeded') || message.includes('limit reached') || message.includes('insufficient')
  ) {
    return { retry: true, reason: 'quota_exceeded' };
  }
  if (status === 404 || status === 408 || (status !== undefined && status >= 500)) {
    return { retry: true, reason: 'error' };
  }
  if (
    message.includes('not found') || message.includes('no endpoints') ||
    message.includes('unavailable') || message.includes('overloaded') || message.includes('high demand') ||
    message.includes('timed out') || message.includes('timeout') || message.includes('deadline')
  ) {
    return { retry: true, reason: 'error' };
  }

  return { retry: false, reason: 'error' };
}

// No attempt starts when less than this much of the total budget remains.
const MIN_ATTEMPT_BUDGET_MS = 1000;

// Call the appropriate provider with a specific model
async function callProvider(
  provider: LLMProvider,
  model: SpecificModel,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  customApiKeys?: CustomApiKeys
): Promise<ChatResponse> {
  switch (provider) {
    case 'cohere':
      return cohereChat(messages, temperature, maxTokens, model as CohereModel, customApiKeys?.cohere);
    case 'gemini':
      return geminiChat(messages, temperature, maxTokens, model as GeminiModel, customApiKeys?.gemini);
    case 'groq':
      return groqChat(messages, temperature, maxTokens, model as GroqModel, customApiKeys?.groq);
    case 'mistral':
      return mistralChat(messages, temperature, maxTokens, model as MistralModel, customApiKeys?.mistral);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Build fallback sequence: same provider models first, then cross-provider
function buildFallbackSequence(
  startProvider: LLMProvider,
  enableCrossProvider: boolean
): Array<{ provider: LLMProvider; model: SpecificModel }> {
  const sequence: Array<{ provider: LLMProvider; model: SpecificModel }> = [];

  // Add all models from the starting provider
  for (const model of fallbackChains[startProvider]) {
    sequence.push({ provider: startProvider, model });
  }

  // Add cross-provider fallbacks if enabled
  if (enableCrossProvider) {
    for (const provider of crossProviderFallbackOrder) {
      if (provider !== startProvider) {
        // Add all models from this provider
        for (const model of fallbackChains[provider]) {
          sequence.push({ provider, model });
        }
      }
    }
  }

  return sequence;
}

export interface FallbackOptions {
  enableCrossProviderFallback?: boolean;
  maxAttempts?: number;
  delayBetweenAttempts?: number;
  /** Cap per attempt, ms. */
  providerTimeout?: number;
  /**
   * Cap for the whole call, ms. A later attempt gets only what is left, and is
   * skipped when less than MIN_ATTEMPT_BUDGET_MS remains, so a route with two
   * attempts can stay inside its own maxDuration and the client's abort.
   */
  totalTimeout?: number;
  specificModel?: string;
  customApiKeys?: CustomApiKeys;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main fallback-enabled chat function
export async function chatWithFallback(
  messages: ChatMessage[],
  provider: LLMProvider,
  temperature: number = 0.7,
  maxTokens: number = 1024,
  options: FallbackOptions = {}
): Promise<ChatResponse> {
  const {
    enableCrossProviderFallback = true,
    maxAttempts = 6,
    delayBetweenAttempts = 500,
    providerTimeout = 30000,
    totalTimeout,
    specificModel,
    customApiKeys,
  } = options;

  // A requested model must be a registered model of this provider. Previously an
  // unknown id left the sequence untouched and the chain head ran in its place,
  // silently, with no fallback badge (audit C01). The routes reject unknown ids with
  // a 400 before charging the allowance; this is the engine's own guard.
  if (specificModel !== undefined && !isRegisteredModel(provider, specificModel)) {
    return {
      content: '',
      model: provider,
      specificModel,
      responseTime: 0,
      error: `Unknown model '${specificModel}' for provider '${provider}'`,
    };
  }

  // Use user-specified model or fall back to default
  const startModel: SpecificModel = specificModel ?? defaultModels[provider];

  // Build fallback sequence, starting from the specified model
  const fallbackSequence = buildFallbackSequence(provider, enableCrossProviderFallback);

  // Reorder the sequence so the requested model runs first. It is always present
  // (validated above), so this only ever moves it forward.
  const modelIndex = fallbackSequence.findIndex(
    (item) => item.model === startModel && item.provider === provider
  );
  if (modelIndex > 0) {
    const [selectedItem] = fallbackSequence.splice(modelIndex, 1);
    fallbackSequence.unshift(selectedItem);
  }

  let attemptCount = 0;
  let lastResponse: ChatResponse | null = null;
  let lastReason: FailureReason = 'error';

  const deadline = totalTimeout === undefined ? undefined : Date.now() + totalTimeout;
  const remaining = (): number => (deadline === undefined ? Infinity : deadline - Date.now());

  for (const { provider: currentProvider, model: currentModel } of fallbackSequence) {
    if (attemptCount >= maxAttempts) break;

    const timeLeft = remaining();
    if (timeLeft < MIN_ATTEMPT_BUDGET_MS) break;
    const attemptBudget = Math.min(providerTimeout, timeLeft);
    attemptCount++;

    const response = await Promise.race([
      callProvider(
        currentProvider,
        currentModel,
        messages,
        temperature,
        maxTokens,
        customApiKeys
      ),
      sleep(attemptBudget).then((): ChatResponse => ({
        content: '',
        model: currentProvider,
        specificModel: currentModel,
        responseTime: attemptBudget,
        error: `Request timed out after ${Math.round(attemptBudget / 100) / 10}s`,
      })),
    ]);

    // Check if the response has an error
    if (response.error) {
      const { retry, reason } = classifyFailure(response.error);
      lastResponse = response;
      lastReason = reason;

      if (retry) {
        // Transient for this model: try the next one after a short delay
        await sleep(Math.min(delayBetweenAttempts, Math.max(0, remaining())));
        continue;
      }

      // A failure retrying cannot fix; return with fallback info if we tried multiple models
      if (attemptCount > 1) {
        response.fallback = {
          originalModel: startModel,
          usedModel: currentModel,
          reason: lastReason,
        };
      }
      return response;
    }

    // Success! Add fallback info if we're not on the first attempt
    if (attemptCount > 1) {
      response.fallback = {
        originalModel: startModel,
        usedModel: currentModel,
        reason: lastReason,
      };
    }

    return response;
  }

  // Attempts or budget exhausted: return the last failure. The fallback badge is
  // only honest when a second model actually ran; a single failed attempt used
  // to be labelled as a fallback from the model onto itself.
  if (lastResponse) {
    if (attemptCount > 1) {
      lastResponse.fallback = {
        originalModel: startModel,
        usedModel: lastResponse.specificModel || startModel,
        reason: lastReason,
      };
    }
    return lastResponse;
  }

  // This shouldn't happen, but just in case
  return {
    content: '',
    model: provider,
    specificModel: startModel,
    responseTime: 0,
    error: 'All fallback attempts exhausted',
    fallback: {
      originalModel: startModel,
      usedModel: startModel,
      reason: 'error',
    },
  };
}
