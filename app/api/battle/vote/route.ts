import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Battle from '@/models/Battle';
import Leaderboard from '@/models/Leaderboard';

interface VoteRequestBody {
  challengeId: string;
  challengeName: string;
  prompt: string;
  battleType: 'standard' | 'blindfold' | 'royale';
  modelA: { provider: string; model: string };
  modelB: { provider: string; model: string };
  modelC?: { provider: string; model: string };
  modelD?: { provider: string; model: string };
  responseA: { content: string; responseTime: number; specificModel?: string };
  responseB: { content: string; responseTime: number; specificModel?: string };
  responseC?: { content: string; responseTime: number; specificModel?: string };
  responseD?: { content: string; responseTime: number; specificModel?: string };
  ratings: {
    modelA: { accuracy: number; creativity: number; clarity: number; total: number };
    modelB: { accuracy: number; creativity: number; clarity: number; total: number };
    modelC?: { accuracy: number; creativity: number; clarity: number; total: number };
    modelD?: { accuracy: number; creativity: number; clarity: number; total: number };
  };
  winner: 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'tie';
  rankings?: { model: string; provider: string; rank: number; score: number }[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const body = (await request.json()) as VoteRequestBody;

    // Save the battle
    const battle = await Battle.create({
      odlUserId: userId,
      challengeId: body.challengeId,
      challengeName: body.challengeName,
      prompt: body.prompt,
      battleType: body.battleType,
      modelA: body.modelA,
      modelB: body.modelB,
      modelC: body.modelC,
      modelD: body.modelD,
      responseA: body.responseA,
      responseB: body.responseB,
      responseC: body.responseC,
      responseD: body.responseD,
      ratings: body.ratings,
      winner: body.winner,
      rankings: body.rankings,
    });

    // Update leaderboard for each model
    const modelKeys = ['modelA', 'modelB', 'modelC', 'modelD'] as const;
    const models = modelKeys
      .filter((key) => body[key])
      .map((key) => ({
        key,
        provider: body[key]!.provider,
        model: body[key]!.model,
        ratings: body.ratings[key]!,
      }));

    for (const m of models) {
      const isWinner = body.winner === m.key;
      const isTie = body.winner === 'tie';
      const isLoser = !isWinner && !isTie;

      // Upsert leaderboard entry with running average
      const existing = await Leaderboard.findOne({
        odlUserId: userId,
        provider: m.provider,
        modelId: m.model,
      });

      if (existing) {
        const n = existing.totalBattles;
        await Leaderboard.updateOne(
          { _id: existing._id },
          {
            $inc: {
              wins: isWinner ? 1 : 0,
              losses: isLoser ? 1 : 0,
              ties: isTie ? 1 : 0,
              totalBattles: 1,
            },
            $set: {
              avgAccuracy: (existing.avgAccuracy * n + m.ratings.accuracy) / (n + 1),
              avgCreativity: (existing.avgCreativity * n + m.ratings.creativity) / (n + 1),
              avgClarity: (existing.avgClarity * n + m.ratings.clarity) / (n + 1),
              avgTotal: (existing.avgTotal * n + m.ratings.total) / (n + 1),
              updated_at: new Date(),
            },
          }
        );
      } else {
        await Leaderboard.create({
          odlUserId: userId,
          provider: m.provider,
          modelId: m.model,
          wins: isWinner ? 1 : 0,
          losses: isLoser ? 1 : 0,
          ties: isTie ? 1 : 0,
          totalBattles: 1,
          avgAccuracy: m.ratings.accuracy,
          avgCreativity: m.ratings.creativity,
          avgClarity: m.ratings.clarity,
          avgTotal: m.ratings.total,
        });
      }
    }

    return NextResponse.json(battle, { status: 201 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Battle vote error:', errMsg);
    console.error('Battle vote error details:', JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2));
    return NextResponse.json({ error: 'Failed to save battle' }, { status: 500 });
  }
}
