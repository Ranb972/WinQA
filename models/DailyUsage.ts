import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDailyUsage extends Document {
  userId: string;
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

const DailyUsageSchema = new Schema<IDailyUsage>({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  count: { type: Number, default: 0 },
});

DailyUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

const DailyUsage: Model<IDailyUsage> =
  mongoose.models.DailyUsage || mongoose.model<IDailyUsage>('DailyUsage', DailyUsageSchema);

export default DailyUsage;
