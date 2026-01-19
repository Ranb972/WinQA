import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, ChatResponse, GeminiModel } from './types';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
  }
  return genAI;
}

export async function geminiChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: GeminiModel
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || 'gemini-2.5-flash';

  try {
    const model = getGenAI().getGenerativeModel({
      model: modelToUse,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({
      history: history.length > 0 ? history : undefined,
    });

    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const responseTime = Date.now() - startTime;

    return {
      content: response.text(),
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
