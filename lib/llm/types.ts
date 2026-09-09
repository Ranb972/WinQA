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

/**
 * Provider-agnostic reasoning control. 'lowest' maps to each provider's smallest
 * setting where one exists (Groq gpt-oss: reasoning_effort low); providers without
 * a control never see it (Cohere, Gemini's caps are fixed, and Ministral 3 answers
 * 400 "reasoning_effort is not enabled for this model", Compare run 2026-09-09).
 * Omit it for the provider default. The chat route (Compare, Code Testing) sends
 * 'lowest'; Battle sends nothing (owner decision, Batch E3).
 */
export type ReasoningEffort = 'lowest';

export interface AdapterOptions {
  reasoningEffort?: ReasoningEffort;
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
