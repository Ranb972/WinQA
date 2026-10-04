import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITestCase extends Document {
  _id: mongoose.Types.ObjectId;
  user_id?: string;
  title: string;
  description?: string;
  initial_prompt: string;
  expected_outcome?: string;
  category?: string;
  difficulty?: string;
  is_public: boolean;
  created_at: Date;
}

const TestCaseSchema = new Schema<ITestCase>({
  user_id: {
    type: String,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  initial_prompt: {
    type: String,
    required: [true, 'Initial prompt is required'],
  },
  expected_outcome: {
    type: String,
  },
  category: {
    type: String,
  },
  difficulty: {
    type: String,
  },
  is_public: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

TestCaseSchema.index({ is_public: 1, created_at: -1 });
// List pages (lib/server/list-page.ts): one index per branch of the visibility $or,
// each ending in the (created_at, _id) sort, so the server can merge two ordered
// scans instead of sorting in memory.
TestCaseSchema.index({ user_id: 1, created_at: -1, _id: -1 });
TestCaseSchema.index({ is_public: 1, created_at: -1, _id: -1 });

const TestCase: Model<ITestCase> =
  mongoose.models.TestCase || mongoose.model<ITestCase>('TestCase', TestCaseSchema);

export default TestCase;
