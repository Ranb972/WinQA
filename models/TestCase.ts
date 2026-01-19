import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITestCase extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  initial_prompt: string;
  expected_outcome?: string;
  created_at: Date;
}

const TestCaseSchema = new Schema<ITestCase>({
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
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const TestCase: Model<ITestCase> =
  mongoose.models.TestCase || mongoose.model<ITestCase>('TestCase', TestCaseSchema);

export default TestCase;
