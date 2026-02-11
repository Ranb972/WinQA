import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Battle from '@/models/Battle';
import Leaderboard from '@/models/Leaderboard';
import { validateRating, validateEnum } from '@/lib/security';

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

    // Validate battleType
    if (!validateEnum(body.battleType, ['standard', 'blindfold', 'royale'])) {
      return NextResponse.json({ error: 'Invalid battleType' }, { status: 400 });
    }

    // Validate winner
    if (!validateEnum(body.winner, ['modelA', 'modelB', 'modelC', 'modelD', 'tie'])) {
      return NextResponse.json({ error: 'Invalid winner value' }, { status: 400 });
    }

    // Validate rating values (0-5)
    const ratingKeys = ['modelA', 'modelB', 'modelC', 'modelD'] as const;
    for (const key of ratingKeys) {
      const r = body.ratings[key];
      if (!r) continue;
      if (!validateRating(r.accuracy) || !validateRating(r.creativity) || !validateRating(r.clarity) || !validateRating(r.total)) {
        return NextResponse.json({ error: `Invalid rating values for ${key}` }, { status: 400 });
      }
    }

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
    return NextResponse.json({ error: 'Failed to save battle' }, { status: 500 });
  }
}
