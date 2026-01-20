import Groq from 'groq-sdk';
import { ChatMessage, ChatResponse, GroqModel } from './types';

// Cache clients by API key to avoid creating new instances for each request
const clientCache = new Map<string, Groq>();

function getGroqClient(customApiKey?: string): Groq {
  const apiKey = customApiKey || process.env.GROQ_API_KEY || '';

  // Return cached client if exists
  if (clientCache.has(apiKey)) {
    return clientCache.get(apiKey)!;
  }

  // Create and cache new client
  const client = new Groq({ apiKey });
  clientCache.set(apiKey, client);
  return client;
}

export async function groqChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: GroqModel,
  customApiKey?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || 'llama-3.3-70b-versatile';

  try {
    const response = await getGroqClient(customApiKey).chat.completions.create({
      model: modelToUse,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const responseTime = Date.now() - startTime;

    return {
      content: response.choices[0]?.message?.content || '',
      model: 'groq',
      specificModel: modelToUse,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      content: '',
      model: 'groq',
      specificModel: modelToUse,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
