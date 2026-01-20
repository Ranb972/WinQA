import { NextRequest, NextResponse } from 'next/server';
import { chat, multiModelChat, LLMProvider, ChatMessage, SpecificModel, CustomApiKeys } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, models, temperature, maxTokens, modelPreferences, customApiKeys } = body as {
      messages: ChatMessage[];
      models: LLMProvider | LLMProvider[];
      temperature?: number;
      maxTokens?: number;
      modelPreferences?: Record<LLMProvider, SpecificModel>;
      customApiKeys?: CustomApiKeys;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    if (!models) {
      return NextResponse.json(
        { error: 'Model(s) are required' },
        { status: 400 }
      );
    }

    // Handle multi-model comparison
    if (Array.isArray(models)) {
      const response = await multiModelChat({
        messages,
        models,
        temperature,
        maxTokens,
        modelPreferences,
        customApiKeys,
      });
      return NextResponse.json(response);
    }

    // Handle single model
    const specificModel = modelPreferences?.[models];
    const response = await chat(messages, models, temperature, maxTokens, true, specificModel, customApiKeys);
    return NextResponse.json(response);
  } catch (error) {
    // Log error message only, never log full error object which could contain API keys
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat API error:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
