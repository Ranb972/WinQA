import { CohereClient } from 'cohere-ai';
import { ChatMessage, ChatResponse, CohereModel } from './types';

let cohere: CohereClient | null = null;

function getCohereClient(): CohereClient {
  if (!cohere) {
    cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
  }
  return cohere;
}

export async function cohereChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: CohereModel
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

    const response = await getCohereClient().chat({
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
