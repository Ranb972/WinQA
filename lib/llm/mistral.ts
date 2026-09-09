import { ChatMessage, ChatResponse, KeySource, MistralModel } from './types';
import { defaultModels } from './registry';
import { reportProviderError } from './provider-error';

// Mistral's chat completions API is OpenAI-shaped (docs.mistral.ai/api, checked
// 2026-09-09), so this adapter follows the OpenAI-format path of lib/llm/custom.ts
// over plain fetch: no SDK, no new dependency. The app's own key comes from
// MISTRAL_API_KEY; a user's saved key overrides it per request.
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';

interface MistralContentChunk {
  type?: string;
  text?: string;
}

interface MistralChatResponse {
  choices?: Array<{
    message?: {
      // A plain string normally; an array of chunks (text, thinking) when the model
      // reasons before answering.
      content?: string | MistralContentChunk[] | null;
    };
    finish_reason?: string;
  }>;
}

interface MistralErrorBody {
  message?: string;
  error?: { message?: string };
  detail?: string | Array<{ msg?: string }>;
}

/** The visible answer: the string itself, or the text chunks joined, never the thinking. */
export function mistralText(content: string | MistralContentChunk[] | null | undefined): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is MistralContentChunk & { text: string } => !!c && c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('');
  }
  return '';
}

/** Mistral error bodies vary: {message}, {error:{message}}, or a 422 {detail}. */
function mistralErrorMessage(body: MistralErrorBody, statusText: string, status: number): string {
  if (typeof body.message === 'string' && body.message) return body.message;
  if (typeof body.error?.message === 'string' && body.error.message) return body.error.message;
  if (typeof body.detail === 'string' && body.detail) return body.detail;
  if (Array.isArray(body.detail)) {
    const msgs = body.detail.map((d) => d?.msg).filter((m): m is string => typeof m === 'string');
    if (msgs.length > 0) return msgs.join('; ');
  }
  return statusText || `HTTP ${status}`;
}

export async function mistralChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: MistralModel,
  customApiKey?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || defaultModels.mistral;
  const keySource: KeySource = customApiKey ? 'user' : 'app';

  try {
    const response = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${customApiKey || process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature,
        max_tokens: maxTokens,
        // No reasoning_effort: the Ministral 3 family has no reasoning control and
        // answers 400 "reasoning_effort is not enabled for this model" when one is
        // sent (Compare run 2026-09-09). Mistral Medium 3.5 / Small 4 accept it, but
        // they are not in the registry (zero request limit on the app's Free plan).
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as MistralErrorBody;
      const error = new Error(mistralErrorMessage(body, response.statusText, response.status)) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const data = (await response.json()) as MistralChatResponse;

    return {
      content: mistralText(data.choices?.[0]?.message?.content),
      model: 'mistral',
      specificModel: modelToUse,
      responseTime,
      keySource,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      content: '',
      model: 'mistral',
      specificModel: modelToUse,
      responseTime,
      keySource,
      error: reportProviderError('mistral', modelToUse, error, keySource),
    };
  }
}
