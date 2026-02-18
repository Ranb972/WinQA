// Model definitions for built-in providers and common custom provider suggestions

export interface ModelDefinition {
  id: string;
  name: string;
  default?: boolean;
}

export interface CommonProviderSuggestion {
  name: string;
  baseUrl: string;
  models: string[];
  headerType?: 'bearer' | 'x-api-key'; // Default is 'bearer'
}

export const PROVIDER_MODELS: Record<string, ModelDefinition[]> = {
  cohere: [
    { id: 'command-a-03-2025', name: 'Command A (Latest)', default: true },
    { id: 'command-r-plus', name: 'Command R+' },
    { id: 'command-r', name: 'Command R' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', default: true },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  ],
  openrouter: [
    { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 30B (Free)', default: true },
    { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron 9B (Free)' },
  ],
};

export const COMMON_CUSTOM_PROVIDERS: CommonProviderSuggestion[] = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  {
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
    headerType: 'x-api-key',
  },
  {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
  },
  {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3-70b-chat-hf', 'meta-llama/Llama-3-8b-chat-hf'],
  },
  {
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: ['accounts/fireworks/models/llama-v3-70b-instruct'],
  },
  {
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    models: ['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online'],
  },
];

/**
 * Get the default model ID for a provider
 */
export function getDefaultModel(provider: string): string | undefined {
  const models = PROVIDER_MODELS[provider];
  return models?.find((m) => m.default)?.id || models?.[0]?.id;
}

/**
 * Get the display name for a model ID
 */
export function getModelDisplayName(provider: string, modelId: string): string {
  const models = PROVIDER_MODELS[provider];
  const model = models?.find((m) => m.id === modelId);
  return model?.name || modelId;
}

/**
 * Check if a model ID is valid for a provider
 */
export function isValidModel(provider: string, modelId: string): boolean {
  const models = PROVIDER_MODELS[provider];
  return models?.some((m) => m.id === modelId) ?? false;
}

/**
 * Get suggested models for a custom provider base URL
 */
export function getSuggestedModels(baseUrl: string): string[] {
  const suggestion = COMMON_CUSTOM_PROVIDERS.find(
    (p) => normalizeBaseUrl(p.baseUrl) === normalizeBaseUrl(baseUrl)
  );
  return suggestion?.models || [];
}

/**
 * Get the header type for a custom provider base URL
 */
export function getHeaderType(baseUrl: string): 'bearer' | 'x-api-key' {
  const suggestion = COMMON_CUSTOM_PROVIDERS.find(
    (p) => normalizeBaseUrl(p.baseUrl) === normalizeBaseUrl(baseUrl)
  );
  return suggestion?.headerType || 'bearer';
}

/**
 * Normalize a base URL for comparison (remove trailing slash, lowercase)
 */
export function normalizeBaseUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}
