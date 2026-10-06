import Groq from 'groq-sdk';
import { AdapterOptions, ChatMessage, ChatResponse, GroqModel, KeySource } from './types';
import { defaultModels } from './registry';
import { reportProviderError } from './provider-error';
import { GroqFetch, groqFetchForTests } from './groq-fetch';

function getGroqClient(customApiKey?: string, fetchImpl: GroqFetch | undefined = groqFetchForTests()): Groq {
  const apiKey = customApiKey || process.env.GROQ_API_KEY || '';
  // Construct fresh per call, as cohere.ts does. The constructor only stores the
  // key; the real cost is the network round-trip in chat.completions.create()
  // below. A module-level Map keyed by user API keys grew without bound on
  // long-lived serverless instances and retained every key ever seen (audit V18).
  // `fetchImpl` is set only by the wire contract test (lib/llm/groq-fetch.ts);
  // unset, the options are exactly { apiKey } as before.
  return new Groq({ apiKey, ...(fetchImpl && { fetch: fetchImpl }) });
}

export async function groqChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: GroqModel,
  customApiKey?: string,
  options?: AdapterOptions
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || defaultModels.groq;
  const keySource: KeySource = customApiKey ? 'user' : 'app';

  try {
    const response = await getGroqClient(customApiKey).chat.completions.create({
      model: modelToUse,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature,
      max_tokens: maxTokens,
      // gpt-oss reasons before answering; 'low' is its smallest documented effort
      // (console.groq.com/docs/reasoning). Sent only when the caller asks.
      ...(options?.reasoningEffort === 'lowest' && { reasoning_effort: 'low' as const }),
    });

    const responseTime = Date.now() - startTime;

    return {
      content: response.choices[0]?.message?.content || '',
      model: 'groq',
      specificModel: modelToUse,
      responseTime,
      keySource,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      content: '',
      model: 'groq',
      specificModel: modelToUse,
      responseTime,
      keySource,
      error: reportProviderError('groq', modelToUse, error, keySource),
    };
  }
}
