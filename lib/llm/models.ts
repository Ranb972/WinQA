// Model definitions for built-in providers and common custom provider suggestions

import type { LLMProvider } from './types';
import { REGISTRY_PROVIDERS, registryEntries, getRegisteredModel } from './registry';

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

/**
 * UI catalogue of built-in models, derived from lib/llm/registry.ts: same ids, same
 * order, first entry flagged as the default. Never edit this; edit the registry.
 */
export const PROVIDER_MODELS: Record<LLMProvider, ModelDefinition[]> = Object.fromEntries(
  REGISTRY_PROVIDERS.map((provider) => [
    provider,
    registryEntries(provider).map((m, index) => ({
      id: m.id,
      name: m.name,
      ...(index === 0 && { default: true }),
    })),
  ])
) as Record<LLMProvider, ModelDefinition[]>;

// Preset ids verified 2026-09-07 against each vendor's official model page; the first
// id is what quick-fill selects. Perplexity was dropped: its Sonar chat-completions
// endpoint is supported only until 2026-09-27 (docs.perplexity.ai).
export const COMMON_CUSTOM_PROVIDERS: CommonProviderSuggestion[] = [
  {
    // developers.openai.com/api/docs/models; gpt-4-turbo and gpt-3.5-turbo shut down 2026-10-23.
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-6-astra'],
  },
  {
    // platform.claude.com/docs/en/about-claude/models/overview; all Claude 3 ids are retired.
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'],
    headerType: 'x-api-key',
  },
  {
    // docs.mistral.ai model cards; the "-latest" aliases are no longer documented.
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-medium-3-5', 'mistral-small-2603'],
  },
  {
    // docs.together.ai/docs/serverless-models; the Llama 3 ids left serverless in 2024.
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'openai/gpt-oss-120b', 'Qwen/Qwen3.7-Plus'],
  },
  {
    // fireworks.ai/models/fireworks/gpt-oss-120b ("Available Serverless"); llama-v3-70b-instruct is gone.
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: ['accounts/fireworks/models/gpt-oss-120b'],
  },
  {
    // api-docs.deepseek.com/quick_start/pricing; OpenAI-format base URL takes no /v1.
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  },
  {
    // OpenRouter left the built-in lineup in Batch E3 (2026-09-09) and lives on here
    // for anyone with their own key. Free Nemotron ids that answered the 2026-09-08
    // probes (openrouter.ai/api/v1/models); OpenRouter reports upstream failures
    // inside an HTTP 200 body, which lib/llm/custom.ts now treats as an error.
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['nvidia/nemotron-3.5-lightning:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
  },
];

/**
 * Get the default model ID for a provider (the head of its registry chain)
 */
export function getDefaultModel(provider: string): string | undefined {
  return (PROVIDER_MODELS as Record<string, ModelDefinition[] | undefined>)[provider]?.[0]?.id;
}

/**
 * Get the display name for a model ID
 */
export function getModelDisplayName(provider: string, modelId: string): string {
  return getRegisteredModel(provider, modelId)?.name || modelId;
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

/**
 * Detect if a provider uses the Anthropic Messages API format, based on base URL.
 * Shared by the chat path and the test-connection route.
 */
export function isAnthropicProvider(baseUrl: string): boolean {
  return normalizeBaseUrl(baseUrl).includes('anthropic.com');
}
