import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPromptLibrary extends Document {
  _id: mongoose.Types.ObjectId;
  user_id?: string;
  title: string;
  bad_prompt_example: string;
  good_prompt_example: string;
  explanation?: string;
  tags: string[];
  is_public: boolean;
  created_at: Date;
}

const PromptLibrarySchema = new Schema<IPromptLibrary>({
  user_id: {
    type: String,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  bad_prompt_example: {
    type: String,
    required: [true, 'Bad prompt example is required'],
  },
  good_prompt_example: {
    type: String,
    required: [true, 'Good prompt example is required'],
  },
  explanation: {
    type: String,
  },
  tags: {
    type: [String],
    default: [],
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

PromptLibrarySchema.index({ is_public: 1, created_at: -1 });
// List pages (lib/server/list-page.ts): one index per branch of the visibility $or,
// each ending in the (created_at, _id) sort, so the server can merge two ordered
// scans instead of sorting in memory.
PromptLibrarySchema.index({ user_id: 1, created_at: -1, _id: -1 });
PromptLibrarySchema.index({ is_public: 1, created_at: -1, _id: -1 });

const PromptLibrary: Model<IPromptLibrary> =
  mongoose.models.PromptLibrary ||
  mongoose.model<IPromptLibrary>('PromptLibrary', PromptLibrarySchema);

export default PromptLibrary;
