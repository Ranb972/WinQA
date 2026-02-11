import { cohereChat } from './cohere';
import { geminiChat } from './gemini';
import { groqChat } from './groq';
import { openrouterChat } from './openrouter';
import { chatWithFallback, specificModelDisplayNames, fallbackChains, defaultModels } from './fallback';
import {
  ChatMessage,
  ChatResponse,
  LLMProvider,
  MultiModelRequest,
  MultiModelResponse,
  CustomApiKeys,
} from './types';

export * from './types';
export { specificModelDisplayNames, fallbackChains, defaultModels } from './fallback';

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
      return cohereChat(messages, temperature, maxTokens, specificModel as any, customApiKeys?.cohere);
    case 'gemini':
      return geminiChat(messages, temperature, maxTokens, specificModel as any, customApiKeys?.gemini);
    case 'groq':
      return groqChat(messages, temperature, maxTokens, specificModel as any, customApiKeys?.groq);
    case 'openrouter':
      return openrouterChat(messages, temperature, maxTokens, specificModel as any, customApiKeys?.openrouter);
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
  request: MultiModelRequest & { customApiKeys?: CustomApiKeys }
): Promise<MultiModelResponse> {
  const { messages, models, temperature, maxTokens, modelPreferences, customApiKeys } = request;

  const responses = await Promise.all(
    models.map((model) => {
      const specificModel = modelPreferences?.[model];
      return chat(messages, model, temperature, maxTokens, true, specificModel, customApiKeys);
    })
  );

  return { responses };
}

export const modelDisplayNames: Record<LLMProvider, string> = {
  cohere: 'Cohere Command',
  gemini: 'Google Gemini',
  groq: 'Groq (Llama)',
  openrouter: 'OpenRouter',
};

export const modelColors: Record<LLMProvider, string> = {
  cohere: 'text-purple-400',
  gemini: 'text-blue-400',
  groq: 'text-orange-400',
  openrouter: 'text-green-400',
};

// Provider display names (shorter, for badges)
export const providerDisplayNames: Record<LLMProvider, string> = {
  cohere: 'Cohere',
  gemini: 'Google',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};
