import { ChatMessage, ChatResponse, OpenRouterModel } from './types';
import { defaultModels } from './registry';
import { reportProviderError } from './provider-error';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export async function openrouterChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: OpenRouterModel,
  customApiKey?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || defaultModels.openrouter;

  // The free OpenRouter models in the registry (NVIDIA Nemotron, as before E1; the
  // MiniMax pair in between too) are thinking/reasoning models that spend tokens on
  // internal reasoning before generating content. With low max_tokens the reasoning
  // consumes all tokens and content is empty. Minimum 4096 ensures enough room for
  // both reasoning and the actual response.
  const effectiveMaxTokens = Math.max(maxTokens, 4096);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customApiKey || process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'WinQA',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature,
        max_tokens: effectiveMaxTokens,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      // Throw with status for fallback detection
      const error = new Error(errorMessage) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    // OpenRouter reports upstream failures inside an HTTP 200 body with no
    // `choices`: {"error":{"message":"Upstream error from Nvidia: Service
    // temporarily overloaded","code":502}} (probe 2026-09-08). Reading choices[0]
    // from that body returned an empty answer with no error at all.
    if (data.error) {
      const error = new Error(data.error.message || 'Provider returned an error') as Error & { status?: number };
      if (typeof data.error.code === 'number') error.status = data.error.code;
      throw error;
    }

    // Thinking models put chain-of-thought in `reasoning` and the answer in `content`.
    // If content is empty (reasoning consumed all tokens), fall back to reasoning text.
    const message = data.choices[0]?.message;
    const content = message?.content || message?.reasoning || '';

    return {
      content,
      model: 'openrouter',
      specificModel: modelToUse,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      content: '',
      model: 'openrouter',
      specificModel: modelToUse,
      responseTime,
      error: reportProviderError('openrouter', modelToUse, error),
    };
  }
}
