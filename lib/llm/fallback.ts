import {
  ChatMessage,
  ChatResponse,
  LLMProvider,
  SpecificModel,
  FallbackInfo,
  CohereModel,
  GeminiModel,
  GroqModel,
  OpenRouterModel,
  CustomApiKeys,
} from './types';
import { cohereChat } from './cohere';
import { geminiChat } from './gemini';
import { groqChat } from './groq';
import { openrouterChat } from './openrouter';

// Fallback chains: ordered from preferred to least preferred
export const fallbackChains: Record<LLMProvider, SpecificModel[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  cohere: ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024', 'command-r7b-12-2024'],
  openrouter: ['nvidia/nemotron-3-nano-30b-a3b:free', 'nvidia/nemotron-nano-9b-v2:free'],
};

// Cross-provider fallback order when all models in a provider fail
export const crossProviderFallbackOrder: LLMProvider[] = ['groq', 'gemini', 'openrouter', 'cohere'];

// Default model for each provider
export const defaultModels: Record<LLMProvider, SpecificModel> = {
  cohere: 'command-a-03-2025',
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'nvidia/nemotron-3-nano-30b-a3b:free',
};

// Display names for specific models (for UI)
export const specificModelDisplayNames: Record<SpecificModel, string> = {
  'command-a-03-2025': 'Command A',
  'command-r-plus-08-2024': 'Command R+',
  'command-r-08-2024': 'Command R',
  'command-r7b-12-2024': 'Command R 7B',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'nvidia/nemotron-3-nano-30b-a3b:free': 'Nemotron 30B',
  'nvidia/nemotron-nano-9b-v2:free': 'Nemotron 9B',
};

// Detect if an error is a rate limit or quota error
function isRateLimitError(error: unknown): { isRateLimit: boolean; reason: 'rate_limit' | 'quota_exceeded' | 'error' } {
  if (!error) return { isRateLimit: false, reason: 'error' };

  // Check for HTTP status codes
  const err = error as { status?: number; message?: string };
  if (err.status === 429) {
    return { isRateLimit: true, reason: 'rate_limit' };
  }
  if (err.status === 403) {
    return { isRateLimit: true, reason: 'quota_exceeded' };
  }

  // Check error message
  const message = (err.message || '').toLowerCase();
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return { isRateLimit: true, reason: 'rate_limit' };
  }
  if (message.includes('quota') || message.includes('exceeded') || message.includes('limit reached')) {
    return { isRateLimit: true, reason: 'quota_exceeded' };
  }

  return { isRateLimit: false, reason: 'error' };
}

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
    case 'openrouter':
      return openrouterChat(messages, temperature, maxTokens, model as OpenRouterModel, customApiKeys?.openrouter);
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

interface FallbackOptions {
  enableCrossProviderFallback?: boolean;
  maxAttempts?: number;
  delayBetweenAttempts?: number;
  providerTimeout?: number;
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
    specificModel,
    customApiKeys,
  } = options;

  // Use user-specified model or fall back to default
  const startModel = (specificModel as SpecificModel) || defaultModels[provider];

  // Build fallback sequence, starting from the specified model
  let fallbackSequence = buildFallbackSequence(provider, enableCrossProviderFallback);

  // If a specific model was requested, reorder the sequence to start with it
  if (specificModel) {
    const modelIndex = fallbackSequence.findIndex(
      (item) => item.model === specificModel && item.provider === provider
    );
    if (modelIndex > 0) {
      // Move the specified model to the front of its provider's models
      const [selectedItem] = fallbackSequence.splice(modelIndex, 1);
      fallbackSequence.unshift(selectedItem);
    }
  }

  let attemptCount = 0;
  let lastResponse: ChatResponse | null = null;
  let lastReason: 'rate_limit' | 'quota_exceeded' | 'error' = 'error';

  for (const { provider: currentProvider, model: currentModel } of fallbackSequence) {
    if (attemptCount >= maxAttempts) break;
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
      sleep(providerTimeout).then((): ChatResponse => ({
        content: '',
        model: currentProvider,
        specificModel: currentModel,
        responseTime: providerTimeout,
        error: `Request timed out after ${providerTimeout / 1000}s`,
      })),
    ]);

    // Check if the response has an error
    if (response.error) {
      const { isRateLimit, reason } = isRateLimitError({ message: response.error });
      lastResponse = response;
      lastReason = reason;

      if (isRateLimit) {
        // Rate limit detected, try next model after a short delay
        await sleep(delayBetweenAttempts);
        continue;
      }

      // Non-rate-limit error, return with fallback info if we tried multiple models
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

  // All attempts exhausted, return the last response with fallback info
  if (lastResponse) {
    lastResponse.fallback = {
      originalModel: startModel,
      usedModel: lastResponse.specificModel || startModel,
      reason: lastReason,
    };
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
