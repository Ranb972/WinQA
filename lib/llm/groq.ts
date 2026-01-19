import Groq from 'groq-sdk';
import { ChatMessage, ChatResponse, GroqModel } from './types';

let groq: Groq | null = null;

function getGroqClient(): Groq {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groq;
}

export async function groqChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: GroqModel
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || 'llama-3.3-70b-versatile';

  try {
    const response = await getGroqClient().chat.completions.create({
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
