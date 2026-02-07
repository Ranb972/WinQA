import mongoose, { Schema, Document, Model } from 'mongoose';

export type BattleWinner = 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'tie';
export type BattleType = 'standard' | 'blindfold' | 'royale';

export interface IBattleRatings {
  accuracy: number;
  creativity: number;
  clarity: number;
  total: number;
}

export interface IBattleRanking {
  model: string;
  provider: string;
  rank: number;
  score: number;
}

export interface IBattle extends Document {
  _id: mongoose.Types.ObjectId;
  odlUserId: string;
  challengeId: string;
  challengeName: string;
  prompt: string;
  battleType: BattleType;
  modelA: { provider: string; model: string };
  modelB: { provider: string; model: string };
  modelC?: { provider: string; model: string };
  modelD?: { provider: string; model: string };
  responseA: { content: string; responseTime: number; specificModel?: string };
  responseB: { content: string; responseTime: number; specificModel?: string };
  responseC?: { content: string; responseTime: number; specificModel?: string };
  responseD?: { content: string; responseTime: number; specificModel?: string };
  ratings: {
    modelA: IBattleRatings;
    modelB: IBattleRatings;
    modelC?: IBattleRatings;
    modelD?: IBattleRatings;
  };
  winner: BattleWinner;
  rankings?: IBattleRanking[];
  created_at: Date;
}

const RatingsSchema = new Schema<IBattleRatings>(
  {
    accuracy: { type: Number, required: true, min: 0, max: 5 },
    creativity: { type: Number, required: true, min: 0, max: 5 },
    clarity: { type: Number, required: true, min: 0, max: 5 },
    total: { type: Number, required: true, min: 0, max: 15 },
  },
  { _id: false }
);

const ModelInfoSchema = new Schema(
  {
    provider: { type: String, required: true },
    model: { type: String, required: true },
  },
  { _id: false }
);

const ResponseSchema = new Schema(
  {
    content: { type: String, required: true },
    responseTime: { type: Number, required: true },
    specificModel: { type: String },
  },
  { _id: false }
);

const RankingSchema = new Schema(
  {
    model: { type: String, required: true },
    provider: { type: String, required: true },
    rank: { type: Number, required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const BattleSchema = new Schema<IBattle>({
  odlUserId: { type: String, required: true },
  challengeId: { type: String, required: true },
  challengeName: { type: String, required: true },
  prompt: { type: String, required: true },
  battleType: {
    type: String,
    enum: ['standard', 'blindfold', 'royale'],
    default: 'standard',
  },
  modelA: { type: ModelInfoSchema, required: true },
  modelB: { type: ModelInfoSchema, required: true },
  modelC: { type: ModelInfoSchema },
  modelD: { type: ModelInfoSchema },
  responseA: { type: ResponseSchema, required: true },
  responseB: { type: ResponseSchema, required: true },
  responseC: { type: ResponseSchema },
  responseD: { type: ResponseSchema },
  ratings: {
    modelA: { type: RatingsSchema, required: true },
    modelB: { type: RatingsSchema, required: true },
    modelC: { type: RatingsSchema },
    modelD: { type: RatingsSchema },
  },
  winner: {
    type: String,
    enum: ['modelA', 'modelB', 'modelC', 'modelD', 'tie'],
    required: true,
  },
  rankings: [RankingSchema],
  created_at: { type: Date, default: Date.now },
});

BattleSchema.index({ odlUserId: 1, created_at: -1 });

const Battle: Model<IBattle> =
  mongoose.models.Battle || mongoose.model<IBattle>('Battle', BattleSchema);

export default Battle;
