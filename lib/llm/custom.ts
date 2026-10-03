// Generic OpenAI-compatible API handler for custom providers

import { ChatMessage, ChatResponse, LLMProvider } from './types';
import { CustomProvider } from '../custom-providers';
import { normalizeBaseUrl, getHeaderType, isAnthropicProvider } from './models';
import { checkProviderUrl, safeProviderFetch, ProviderTimeoutError } from '@/lib/security';
// The same deadline the connection test uses (app/api/test-custom-provider/route.ts).
import { DEFAULT_PROVIDER_TIMEOUT_MS } from './provider-timeout';

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenAIChatResponse {
  id: string;
  choices?: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  // OpenRouter reports upstream failures inside an HTTP 200 body with no choices:
  // {"error":{"message":"Upstream error from Nvidia: Service temporarily
  // overloaded","code":502}} (probe 2026-09-08).
  error?: {
    message?: string;
    code?: number;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicChatRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  system?: string;
}

interface AnthropicChatResponse {
  id: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Build headers for the API request
 */
function buildHeaders(provider: CustomProvider): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const headerType = provider.headerType || getHeaderType(provider.baseUrl);

  if (headerType === 'x-api-key') {
    headers['x-api-key'] = provider.apiKey;
    // Anthropic requires version header
    if (isAnthropicProvider(provider.baseUrl)) {
      headers['anthropic-version'] = '2023-06-01';
    }
  } else {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  return headers;
}

/**
 * A timeout leaves the same runtime-log line as an engine timeout
 * (lib/llm/fallback.ts runAttempt); a custom provider's key is always the user's.
 */
function logTimeout(provider: CustomProvider, error: unknown): void {
  if (error instanceof ProviderTimeoutError) {
    console.error(`[llm] custom:${provider.id} ${provider.modelId} ${error.message.replace(/^Request /, '')} key=user`);
  }
}

/**
 * Convert messages to Anthropic format
 */
function convertToAnthropicFormat(messages: ChatMessage[]): {
  system?: string;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const anthropicMessages: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
    } else {
      anthropicMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return { system, messages: anthropicMessages };
}

/**
 * Call an Anthropic-format API
 */
async function callAnthropicApi(
  provider: CustomProvider,
  messages: ChatMessage[],
  temperature?: number,
  maxTokens?: number
): Promise<ChatResponse> {
  const startTime = Date.now();
  const { system, messages: anthropicMessages } = convertToAnthropicFormat(messages);

  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const endpoint = `${baseUrl}/messages`;

  // temperature is deliberately not sent: Claude 4.7 and later return 400 for any
  // non-default value (platform.claude.com model-deprecations, checked 2026-09-07),
  // which would make every current Anthropic preset fail on a temperature-bearing call.
  void temperature;
  const body: AnthropicChatRequest = {
    model: provider.modelId,
    messages: anthropicMessages,
    max_tokens: maxTokens || 4096,
    ...(system && { system }),
  };

  try {
    // Resolves and vets the host, connects only to the vetted address, and throws
    // REDIRECT_BLOCKED_ERROR on a 3xx instead of following it (lib/security.ts).
    // The budget is the engine's per-attempt cap: a custom provider gets the same
    // 20s a built-in model gets before the chat route answers with a timeout.
    const response = await safeProviderFetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(provider),
      body: JSON.stringify(body),
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data: AnthropicChatResponse = await response.json();
    const content = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return {
      content,
      model: `custom:${provider.id}` as LLMProvider,
      specificModel: `${provider.name}: ${provider.modelId}`,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    logTimeout(provider, error);
    return {
      content: '',
      model: `custom:${provider.id}` as LLMProvider,
      specificModel: `${provider.name}: ${provider.modelId}`,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Call an OpenAI-compatible API
 */
async function callOpenAIApi(
  provider: CustomProvider,
  messages: ChatMessage[],
  temperature?: number,
  maxTokens?: number
): Promise<ChatResponse> {
  const startTime = Date.now();

  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const endpoint = `${baseUrl}/chat/completions`;

  const body: OpenAIChatRequest = {
    model: provider.modelId,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { max_tokens: maxTokens }),
  };

  try {
    // Resolves and vets the host, connects only to the vetted address, and throws
    // REDIRECT_BLOCKED_ERROR on a 3xx instead of following it (lib/security.ts).
    // The budget is the engine's per-attempt cap: a custom provider gets the same
    // 20s a built-in model gets before the chat route answers with a timeout.
    const response = await safeProviderFetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(provider),
      body: JSON.stringify(body),
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data: OpenAIChatResponse = await response.json();
    if (data.error) {
      const code = typeof data.error.code === 'number' ? ` (${data.error.code})` : '';
      throw new Error(`API error${code}: ${data.error.message || 'Provider returned an error'}`);
    }
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      model: `custom:${provider.id}` as LLMProvider,
      specificModel: `${provider.name}: ${provider.modelId}`,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    logTimeout(provider, error);
    return {
      content: '',
      model: `custom:${provider.id}` as LLMProvider,
      specificModel: `${provider.name}: ${provider.modelId}`,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Call a custom provider's API
 * Automatically detects the API format (OpenAI vs Anthropic) based on base URL
 */
export async function callCustomProvider(
  provider: CustomProvider,
  messages: ChatMessage[],
  temperature?: number,
  maxTokens?: number
): Promise<ChatResponse> {
  if (!provider.apiKey) {
    return {
      content: '',
      model: `custom:${provider.id}` as LLMProvider,
      specificModel: `${provider.name}: ${provider.modelId}`,
      responseTime: 0,
      error: 'API key is required',
    };
  }

  // SSRF guard shared with /api/test-custom-provider (lib/security.ts).
  const urlError = checkProviderUrl(provider.baseUrl);
  if (urlError) {
    return {
      content: '',
      model: `custom:${provider.id}` as LLMProvider,
      specificModel: `${provider.name}: ${provider.modelId}`,
      responseTime: 0,
      error: urlError,
    };
  }

  if (isAnthropicProvider(provider.baseUrl)) {
    return callAnthropicApi(provider, messages, temperature, maxTokens);
  }

  return callOpenAIApi(provider, messages, temperature, maxTokens);
}
