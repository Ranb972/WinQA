import mongoose, { Schema, Document, Model } from 'mongoose';
import { BUG_REPORT_CAPS as CAPS, maxChars } from '@/lib/content-limits';

export type IssueType = 'Hallucination' | 'Formatting' | 'Refusal' | 'Logic';
export type Severity = 'Low' | 'Medium' | 'High';
export type BugStatus = 'Open' | 'Investigating' | 'Resolved';

export interface IBugReport extends Document {
  _id: mongoose.Types.ObjectId;
  user_id?: string;
  prompt_context: string;
  model_response: string;
  model_used: string;
  issue_type: IssueType;
  severity: Severity;
  user_notes?: string;
  status: BugStatus;
  is_public: boolean;
  created_at: Date;
}

const BugReportSchema = new Schema<IBugReport>({
  user_id: {
    type: String,
    index: true,
  },
  prompt_context: {
    type: String,
    required: [true, 'Prompt context is required'],
    maxlength: maxChars('prompt_context', CAPS.prompt_context),
  },
  model_response: {
    type: String,
    required: [true, 'Model response is required'],
    maxlength: maxChars('model_response', CAPS.model_response),
  },
  model_used: {
    type: String,
    required: [true, 'Model used is required'],
    maxlength: maxChars('model_used', CAPS.model_used),
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
    maxlength: maxChars('user_notes', CAPS.user_notes),
  },
  status: {
    type: String,
    enum: ['Open', 'Investigating', 'Resolved'],
    default: 'Open',
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

BugReportSchema.index({ is_public: 1, created_at: -1 });
// List pages (lib/server/list-page.ts): one index per branch of the visibility $or,
// each ending in the (created_at, _id) sort, so the server can merge two ordered
// scans instead of sorting in memory.
BugReportSchema.index({ user_id: 1, created_at: -1, _id: -1 });
BugReportSchema.index({ is_public: 1, created_at: -1, _id: -1 });

const BugReport: Model<IBugReport> =
  mongoose.models.BugReport || mongoose.model<IBugReport>('BugReport', BugReportSchema);

export default BugReport;
