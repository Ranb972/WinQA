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

const TestCase: Model<ITestCase> =
  mongoose.models.TestCase || mongoose.model<ITestCase>('TestCase', TestCaseSchema);

export default TestCase;
