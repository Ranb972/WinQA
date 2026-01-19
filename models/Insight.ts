import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInsight extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

const InsightSchema = new Schema<IInsight>({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
  },
  tags: {
    type: [String],
    default: [],
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

InsightSchema.pre('save', function () {
  this.updated_at = new Date();
});

const Insight: Model<IInsight> =
  mongoose.models.Insight || mongoose.model<IInsight>('Insight', InsightSchema);

export default Insight;
