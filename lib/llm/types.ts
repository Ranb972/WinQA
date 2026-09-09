export type LLMProvider = 'cohere' | 'gemini' | 'groq' | 'mistral';

// Specific model types are derived from the registry (lib/llm/registry.ts) so that an
// id outside the lineup cannot type-check into the runtime.
import type { CohereModel, GeminiModel, GroqModel, MistralModel, SpecificModel } from './registry';
export type { CohereModel, GeminiModel, GroqModel, MistralModel, SpecificModel };

// Model preferences - which specific model to use for each provider
export type ModelPreferences = Record<LLMProvider, SpecificModel>;

export interface FallbackInfo {
  originalModel: string;
  usedModel: string;
  reason: 'rate_limit' | 'quota_exceeded' | 'error';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: LLMProvider;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  model: LLMProvider;
  specificModel?: string;
  responseTime: number;
  error?: string;
  fallback?: FallbackInfo;
}

export interface MultiModelRequest {
  messages: ChatMessage[];
  models: LLMProvider[];
  temperature?: number;
  maxTokens?: number;
  modelPreferences?: Record<LLMProvider, SpecificModel>;
}

export interface MultiModelResponse {
  responses: ChatResponse[];
}

// Custom API keys provided by user
export interface CustomApiKeys {
  cohere?: string;
  gemini?: string;
  groq?: string;
  mistral?: string;
}
