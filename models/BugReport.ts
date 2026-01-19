import mongoose, { Schema, Document, Model } from 'mongoose';

export type IssueType = 'Hallucination' | 'Formatting' | 'Refusal' | 'Logic';
export type Severity = 'Low' | 'Medium' | 'High';
export type BugStatus = 'Open' | 'Investigating' | 'Resolved';

export interface IBugReport extends Document {
  _id: mongoose.Types.ObjectId;
  prompt_context: string;
  model_response: string;
  model_used: string;
  issue_type: IssueType;
  severity: Severity;
  user_notes?: string;
  status: BugStatus;
  created_at: Date;
}

const BugReportSchema = new Schema<IBugReport>({
  prompt_context: {
    type: String,
    required: [true, 'Prompt context is required'],
  },
  model_response: {
    type: String,
    required: [true, 'Model response is required'],
  },
  model_used: {
    type: String,
    required: [true, 'Model used is required'],
  },
  issue_type: {
    type: String,
    enum: ['Hallucination', 'Formatting', 'Refusal', 'Logic'],
    required: [true, 'Issue type is required'],
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: [true, 'Severity is required'],
  },
  user_notes: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Open', 'Investigating', 'Resolved'],
    default: 'Open',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const BugReport: Model<IBugReport> =
  mongoose.models.BugReport || mongoose.model<IBugReport>('BugReport', BugReportSchema);

export default BugReport;
