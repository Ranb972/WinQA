import { GoogleGenAI } from '@google/genai';
import { ChatMessage, ChatResponse, GeminiModel } from './types';

// Cache clients by API key to avoid creating new instances for each request
const clientCache = new Map<string, GoogleGenAI>();

function getGenAI(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GOOGLE_GEMINI_API_KEY || '';

  // Return cached client if exists
  if (clientCache.has(apiKey)) {
    return clientCache.get(apiKey)!;
  }

  // Create and cache new client
  const client = new GoogleGenAI({ apiKey });
  clientCache.set(apiKey, client);
  return client;
}

export async function geminiChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: GeminiModel,
  customApiKey?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || 'gemini-2.5-flash';

  try {
    const ai = getGenAI(customApiKey);

    // Convert messages to Gemini contents format
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }));

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents,
      config: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    const responseTime = Date.now() - startTime;

    return {
      content: response.text ?? '',
      model: 'gemini',
      specificModel: modelToUse,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      content: '',
      model: 'gemini',
      specificModel: modelToUse,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
