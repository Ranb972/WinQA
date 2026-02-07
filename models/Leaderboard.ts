import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILeaderboard extends Document {
  _id: mongoose.Types.ObjectId;
  odlUserId: string;
  provider: string;
  modelId: string;
  wins: number;
  losses: number;
  ties: number;
  totalBattles: number;
  avgAccuracy: number;
  avgCreativity: number;
  avgClarity: number;
  avgTotal: number;
  updated_at: Date;
}

const LeaderboardSchema = new Schema<ILeaderboard>({
  odlUserId: { type: String, required: true },
  provider: { type: String, required: true },
  modelId: { type: String, required: true },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  ties: { type: Number, default: 0 },
  totalBattles: { type: Number, default: 0 },
  avgAccuracy: { type: Number, default: 0 },
  avgCreativity: { type: Number, default: 0 },
  avgClarity: { type: Number, default: 0 },
  avgTotal: { type: Number, default: 0 },
  updated_at: { type: Date, default: Date.now },
});

LeaderboardSchema.index({ odlUserId: 1, provider: 1, modelId: 1 }, { unique: true });

const Leaderboard: Model<ILeaderboard> =
  mongoose.models.Leaderboard ||
  mongoose.model<ILeaderboard>('Leaderboard', LeaderboardSchema);

export default Leaderboard;
