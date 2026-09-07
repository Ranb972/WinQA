import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ChatMessage, ChatResponse, GeminiModel } from './types';
import { defaultModels } from './registry';

function getGenAI(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GOOGLE_GEMINI_API_KEY || '';
  // Construct fresh per call, as cohere.ts does. The constructor only stores the
  // key; the real cost is the network round-trip in generateContent() below. A
  // module-level Map keyed by user API keys grew without bound on long-lived
  // serverless instances and retained every key ever seen (audit V18).
  return new GoogleGenAI({ apiKey });
}

export async function geminiChat(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  modelOverride?: GeminiModel,
  customApiKey?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const modelToUse = modelOverride || defaultModels.gemini;

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
        // Gemini 2.5 thinking tokens count against maxOutputTokens. Unbounded thinking
        // starved Code Duel answers to ~160 output tokens (harness 2026-06-12: 6/6
        // finished MAX_TOKENS with ~3,900 thought tokens). Cap thinking so at least
        // half the budget reaches the visible response.
        // flash-lite: thinking is off by default upstream and its only legal explicit
        // budgets are 0 or 512-24576 — values 1-511 are a guaranteed 400. Keep it off.
        // flash: 0-24576 all legal; keep the starvation cap (half the budget, max 1024).
        // Gemini 3.x documents only thinking_level (ai.google.dev/gemini-api/docs/thinking,
        // checked 2026-09-07); LOW keeps the same "most of the budget reaches the
        // answer" intent without a numeric budget the 3.x API may reject.
        thinkingConfig: modelToUse.startsWith('gemini-2.5')
          ? { thinkingBudget: modelToUse === 'gemini-2.5-flash-lite' ? 0 : Math.min(1024, Math.floor(maxTokens / 2)) }
          : { thinkingLevel: ThinkingLevel.LOW },
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
