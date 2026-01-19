import { NextRequest, NextResponse } from 'next/server';
import { chat, multiModelChat, LLMProvider, ChatMessage, SpecificModel } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, models, temperature, maxTokens, modelPreferences } = body as {
      messages: ChatMessage[];
      models: LLMProvider | LLMProvider[];
      temperature?: number;
      maxTokens?: number;
      modelPreferences?: Record<LLMProvider, SpecificModel>;
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
      });
      return NextResponse.json(response);
    }

    // Handle single model
    const specificModel = modelPreferences?.[models];
    const response = await chat(messages, models, temperature, maxTokens, true, specificModel);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
