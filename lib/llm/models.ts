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
