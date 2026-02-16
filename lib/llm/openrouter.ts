import { ChatMessage, ChatResponse, OpenRouterModel } from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export async function openrouterChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: OpenRouterModel,
  customApiKey?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || 'stepfun/step-3.5-flash:free';

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
        max_tokens: maxTokens,
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

    return {
      content: data.choices[0]?.message?.content || '',
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
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
