import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserFavorite extends Document {
  user_id: string;
  prompt_id: mongoose.Types.ObjectId;
  created_at: Date;
}

const UserFavoriteSchema = new Schema<IUserFavorite>({
  user_id: {
    type: String,
    required: true,
    index: true,
  },
  prompt_id: {
    type: Schema.Types.ObjectId,
    ref: 'PromptLibrary',
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

UserFavoriteSchema.index({ user_id: 1, prompt_id: 1 }, { unique: true });

const UserFavorite: Model<IUserFavorite> =
  mongoose.models.UserFavorite ||
  mongoose.model<IUserFavorite>('UserFavorite', UserFavoriteSchema);

export default UserFavorite;
