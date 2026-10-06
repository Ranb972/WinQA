import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Battle from '@/models/Battle';
import Leaderboard from '@/models/Leaderboard';
import { validateRating, validateEnum } from '@/lib/security';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { readJsonObject } from '@/lib/server/read-json-body';
import {
  assertBelowCeiling,
  ownedBattles,
  prepareBattleVote,
  validationErrorText,
} from '@/lib/server/content-input';

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

    // The body is read under its cap before the database is touched.
    const parsed = await readJsonObject(request, BODY_LIMITS.battleVote);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    // Every stored text against its cap, the rankings count and the ratings object,
    // then the enums and rating values, all before the database.
    const input = prepareBattleVote(parsed.value);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }
    const body = parsed.value as unknown as VoteRequestBody;

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
      if (!validateRating(r.accuracy) || !validateRating(r.creativity) || !validateRating(r.clarity) || typeof r.total !== 'number' || r.total < 0 || r.total > 15) {
        return NextResponse.json({ error: `Invalid rating values for ${key}` }, { status: 400 });
      }
    }

    await dbConnect();

    // The per-user ceiling (D7, decision D-6): at 500 saved battles the vote is
    // refused with 409. Nothing is deleted to make room, and the leaderboard is
    // not touched, so a refused vote changes nothing.
    const room = await assertBelowCeiling(Battle, ownedBattles(userId), 'battles');
    if (!room.ok) {
      return NextResponse.json({ error: room.error }, { status: room.status });
    }

    // Record each slot under the model that actually produced its response. The
    // respond route reports the executed id in responseX.specificModel; the picked id
    // is only a fallback when a response carries none (audit C01: the leaderboard
    // used to be keyed on the pick, which could differ from what ran).
    const modelKeys = ['modelA', 'modelB', 'modelC', 'modelD'] as const;
    const responseKeyFor = { modelA: 'responseA', modelB: 'responseB', modelC: 'responseC', modelD: 'responseD' } as const;
    const executed = (key: (typeof modelKeys)[number]) => {
      const picked = body[key];
      if (!picked) return undefined;
      return { provider: picked.provider, model: body[responseKeyFor[key]]?.specificModel || picked.model };
    };

    // Save the battle
    const battle = await Battle.create({
      odlUserId: userId,
      challengeId: body.challengeId,
      challengeName: body.challengeName,
      prompt: body.prompt,
      battleType: body.battleType,
      modelA: executed('modelA'),
      modelB: executed('modelB'),
      modelC: executed('modelC'),
      modelD: executed('modelD'),
      responseA: body.responseA,
      responseB: body.responseB,
      responseC: body.responseC,
      responseD: body.responseD,
      ratings: body.ratings,
      winner: body.winner,
      rankings: body.rankings,
    });

    // Update leaderboard for each model, keyed on the executed id
    const models = modelKeys
      .filter((key) => body[key])
      .map((key) => ({
        key,
        provider: executed(key)!.provider,
        model: executed(key)!.model,
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
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Battle vote error:', errMsg);
    return NextResponse.json({ error: 'Failed to save battle' }, { status: 500 });
  }
}
