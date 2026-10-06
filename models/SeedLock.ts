import mongoose, { Schema, Document, Model } from 'mongoose';

// One marker document per seeded data set. Its _id is unique by definition, so the
// first insert wins and every later one fails with E11000 (lib/autoSeed.ts).
export interface ISeedLock extends Document<string> {
  _id: string;
  created_at: Date;
}

const SeedLockSchema = new Schema<ISeedLock>(
  {
    _id: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'seedlocks', versionKey: false }
);

const SeedLock: Model<ISeedLock> =
  mongoose.models.SeedLock || mongoose.model<ISeedLock>('SeedLock', SeedLockSchema);

export default SeedLock;
