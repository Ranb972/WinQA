// Generic OpenAI-compatible API handler for custom providers

import { ChatMessage, ChatResponse, LLMProvider } from './types';
import { CustomProvider } from '../custom-providers';
import { normalizeBaseUrl, getHeaderType } from './models';

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
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
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
 * Detect if a provider uses Anthropic API format based on base URL
 */
function isAnthropicProvider(baseUrl: string): boolean {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.includes('anthropic.com');
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

  const body: AnthropicChatRequest = {
    model: provider.modelId,
    messages: anthropicMessages,
    max_tokens: maxTokens || 4096,
    ...(temperature !== undefined && { temperature }),
    ...(system && { system }),
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(provider),
      body: JSON.stringify(body),
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
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(provider),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data: OpenAIChatResponse = await response.json();
    const content = data.choices[0]?.message?.content || '';

    return {
      content,
      model: `custom:${provider.id}` as LLMProvider,
      specificModel: `${provider.name}: ${provider.modelId}`,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
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

  if (isAnthropicProvider(provider.baseUrl)) {
    return callAnthropicApi(provider, messages, temperature, maxTokens);
  }

  return callOpenAIApi(provider, messages, temperature, maxTokens);
}

/**
 * Test a custom provider's API key with a simple request
 */
export async function testCustomProviderConnection(
  provider: CustomProvider
): Promise<{ valid: boolean; error?: string }> {
  try {
    const testMessages: ChatMessage[] = [
      { role: 'user', content: 'Say "OK" and nothing else.' },
    ];

    const response = await callCustomProvider(provider, testMessages, 0, 10);

    if (response.error) {
      return { valid: false, error: response.error };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
