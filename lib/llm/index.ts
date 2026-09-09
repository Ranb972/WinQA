import { cohereChat } from './cohere';
import { geminiChat } from './gemini';
import { groqChat } from './groq';
import { mistralChat } from './mistral';
import { chatWithFallback } from './fallback';
import {
  ChatMessage,
  ChatResponse,
  LLMProvider,
  CohereModel,
  GeminiModel,
  GroqModel,
  MistralModel,
  MultiModelRequest,
  MultiModelResponse,
  CustomApiKeys,
  ReasoningEffort,
} from './types';

export * from './types';
export {
  MODEL_REGISTRY,
  REGISTRY_MODEL_COUNT,
  specificModelDisplayNames,
  modelDescriptions,
  fallbackChains,
  defaultModels,
  getRegisteredModel,
  isRegisteredModel,
  sanitizeModelPreferences,
} from './registry';
export type { ModelEntry } from './registry';

export async function chat(
  messages: ChatMessage[],
  model: LLMProvider,
  temperature: number = 0.7,
  maxTokens: number = 1024,
  enableFallback: boolean = true,
  specificModel?: string,
  customApiKeys?: CustomApiKeys,
  fallbackOverrides?: {
    enableCrossProviderFallback?: boolean;
    maxAttempts?: number;
    delayBetweenAttempts?: number;
    providerTimeout?: number;
    totalTimeout?: number;
    reasoningEffort?: ReasoningEffort;
  }
): Promise<ChatResponse> {
  // Use fallback-enabled chat by default
  if (enableFallback) {
    return chatWithFallback(messages, model, temperature, maxTokens, {
      specificModel,
      customApiKeys,
      ...fallbackOverrides,
    });
  }

  // Direct call without fallback
  switch (model) {
    case 'cohere':
      return cohereChat(messages, temperature, maxTokens, specificModel as CohereModel | undefined, customApiKeys?.cohere);
    case 'gemini':
      return geminiChat(messages, temperature, maxTokens, specificModel as GeminiModel | undefined, customApiKeys?.gemini);
    case 'groq':
      return groqChat(messages, temperature, maxTokens, specificModel as GroqModel | undefined, customApiKeys?.groq, fallbackOverrides?.reasoningEffort ? { reasoningEffort: fallbackOverrides.reasoningEffort } : undefined);
    case 'mistral':
      return mistralChat(messages, temperature, maxTokens, specificModel as MistralModel | undefined, customApiKeys?.mistral);
    default:
      return {
        content: '',
        model,
        responseTime: 0,
        error: `Unknown model: ${model}`,
      };
  }
}

export async function multiModelChat(
  request: MultiModelRequest & {
    customApiKeys?: CustomApiKeys;
    fallbackOverrides?: {
      enableCrossProviderFallback?: boolean;
      maxAttempts?: number;
      delayBetweenAttempts?: number;
      providerTimeout?: number;
      totalTimeout?: number;
      reasoningEffort?: ReasoningEffort;
    };
  }
): Promise<MultiModelResponse> {
  const { messages, models, temperature, maxTokens, modelPreferences, customApiKeys, fallbackOverrides } = request;

  const responses = await Promise.all(
    models.map((model) => {
      const specificModel = modelPreferences?.[model];
      return chat(messages, model, temperature, maxTokens, true, specificModel, customApiKeys, fallbackOverrides);
    })
  );

  return { responses };
}

export const modelDisplayNames: Record<LLMProvider, string> = {
  cohere: 'Cohere Command',
  gemini: 'Google Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
};

export const modelColors: Record<LLMProvider, string> = {
  cohere: 'text-purple-400',
  gemini: 'text-blue-400',
  groq: 'text-orange-400',
  mistral: 'text-green-400',
};

// Provider display names (shorter, for badges)
export const providerDisplayNames: Record<LLMProvider, string> = {
  cohere: 'Cohere',
  gemini: 'Google',
  groq: 'Groq',
  mistral: 'Mistral',
};
