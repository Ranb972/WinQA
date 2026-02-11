import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chat, LLMProvider, ChatMessage, SpecificModel, CustomApiKeys } from '@/lib/llm';
import { getChallengeById } from '@/lib/battle-challenges';

interface BattleRequestBody {
  modelA: { provider: LLMProvider; model?: string };
  modelB: { provider: LLMProvider; model?: string };
  modelC?: { provider: LLMProvider; model?: string };
  modelD?: { provider: LLMProvider; model?: string };
  challengeId?: string;
  customPrompt?: string;
  modelPreferences?: Record<LLMProvider, SpecificModel>;
  customApiKeys?: CustomApiKeys;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as BattleRequestBody;
    const { modelA, modelB, modelC, modelD, challengeId, customPrompt, modelPreferences, customApiKeys } = body;

    if (!modelA?.provider || !modelB?.provider) {
      return NextResponse.json({ error: 'Two models are required' }, { status: 400 });
    }

    // Determine prompt
    let prompt: string;
    let challengeName: string;
    if (challengeId) {
      const challenge = getChallengeById(challengeId);
      if (!challenge) {
        return NextResponse.json({ error: 'Invalid challenge ID' }, { status: 400 });
      }
      prompt = challenge.singleRoundPrompt;
      challengeName = challenge.name;
    } else if (customPrompt) {
      prompt = customPrompt;
      challengeName = 'Custom Challenge';
    } else {
      return NextResponse.json({ error: 'Challenge or custom prompt required' }, { status: 400 });
    }

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    // Battle settings: 45s timeout, 2 retries, no cross-provider fallback
    const fallbackOverrides = {
      enableCrossProviderFallback: false,
      maxAttempts: 2,
      delayBetweenAttempts: 300,
      providerTimeout: 45000,
    };

    // Build list of contenders
    const contenders = [modelA, modelB];
    if (modelC) contenders.push(modelC);
    if (modelD) contenders.push(modelD);

    // Fire all requests in parallel
    const results = await Promise.allSettled(
      contenders.map((contender) => {
        const specificModel = contender.model || modelPreferences?.[contender.provider];
        return chat(
          messages,
          contender.provider,
          0.7,
          1024,
          true,
          specificModel,
          customApiKeys,
          fallbackOverrides
        );
      })
    );

    // Process results
    const responses = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return {
          content: result.value.content,
          responseTime: result.value.responseTime,
          specificModel: result.value.specificModel,
          error: result.value.error,
        };
      }
      return {
        content: '',
        responseTime: 0,
        error: result.reason?.message || 'Request failed',
      };
    });

    return NextResponse.json({
      challengeId: challengeId || 'custom',
      challengeName,
      prompt,
      models: contenders.map((c) => ({ provider: c.provider, model: c.model || '' })),
      responses,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Battle API error:', errorMessage);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
