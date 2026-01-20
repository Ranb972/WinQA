import { CohereClient } from 'cohere-ai';
import { ChatMessage, ChatResponse, CohereModel } from './types';

// Cache clients by API key to avoid creating new instances for each request
const clientCache = new Map<string, CohereClient>();

function getCohereClient(customApiKey?: string): CohereClient {
  const apiKey = customApiKey || process.env.COHERE_API_KEY || '';

  // Return cached client if exists
  if (clientCache.has(apiKey)) {
    return clientCache.get(apiKey)!;
  }

  // Create and cache new client
  const client = new CohereClient({ token: apiKey });
  clientCache.set(apiKey, client);
  return client;
}

export async function cohereChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: CohereModel,
  customApiKey?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || 'command-r-plus-08-2024';

  try {
    // Convert messages to Cohere format
    const chatHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'CHATBOT' as const : 'USER' as const,
      message: msg.content,
    }));

    const lastMessage = messages[messages.length - 1];

    const response = await getCohereClient(customApiKey).chat({
      model: modelToUse,
      message: lastMessage.content,
      chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
      temperature,
      maxTokens,
    });

    const responseTime = Date.now() - startTime;

    return {
      content: response.text,
      model: 'cohere',
      specificModel: modelToUse,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      content: '',
      model: 'cohere',
      specificModel: modelToUse,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
