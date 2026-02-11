import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInsight extends Document {
  _id: mongoose.Types.ObjectId;
  user_id?: string;
  title: string;
  content: string;
  category?: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

const InsightSchema = new Schema<IInsight>({
  user_id: {
    type: String,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
  },
  category: {
    type: String,
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
