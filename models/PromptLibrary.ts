import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPromptLibrary extends Document {
  _id: mongoose.Types.ObjectId;
  user_id?: string;
  title: string;
  bad_prompt_example: string;
  good_prompt_example: string;
  explanation?: string;
  tags: string[];
  is_favorite: boolean;
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
  is_favorite: {
    type: Boolean,
    default: false,
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

const PromptLibrary: Model<IPromptLibrary> =
  mongoose.models.PromptLibrary ||
  mongoose.model<IPromptLibrary>('PromptLibrary', PromptLibrarySchema);

export default PromptLibrary;
