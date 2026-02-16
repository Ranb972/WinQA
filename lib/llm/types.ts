export type LLMProvider = 'cohere' | 'gemini' | 'groq' | 'openrouter';

// Specific model types for fallback chains
export type CohereModel = 'command-a-03-2025' | 'command-r-plus-08-2024' | 'command-r-08-2024' | 'command-r7b-12-2024';
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.0-flash' | 'gemini-2.5-flash-lite';
export type GroqModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant';
export type OpenRouterModel = 'qwen/qwen3-4b:free' | 'qwen/qwen3-next-80b-a3b-instruct:free' | 'deepseek/deepseek-r1-0528:free';

export type SpecificModel = CohereModel | GeminiModel | GroqModel | OpenRouterModel;

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
  openrouter?: string;
}
