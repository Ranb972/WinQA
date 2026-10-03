import mongoose, { Schema, Document, Model } from 'mongoose';
import type { LLMProvider } from '@/lib/llm/types';

/**
 * One saved API key: one document per user per slot.
 *
 * Built-in slots are the provider id ('cohere', 'gemini', 'groq', 'mistral').
 * A custom provider's slot is `custom:<_id>`. The _id is generated BEFORE the
 * insert (newCustomCredentialId() in lib/server/user-keys.ts) and written both
 * as _id and inside slot, in the same insert, so the slot is unique because the
 * _id is (the primary key), and the unique { userId, slot } index can never see
 * two custom rows collide. The pre('validate') hook below refuses a document
 * whose slot does not match its kind (builtin: slot === provider; custom:
 * slot === `custom:<own _id>`).
 *
 * Contract for the routes (C7, C8): userId, slot, kind and provider are
 * `immutable`. Hooks do not run on updateOne/findOneAndUpdate, so the schema
 * itself drops those paths from a $set on an update (strict 'throw' makes it
 * throw instead). An upsert puts kind and provider in $setOnInsert (userId and
 * slot come from the filter); never $set userId, slot, kind or provider; pass
 * runValidators: true so the enums and caps apply to updates too.
 *
 * ct, iv and tag are `select: false`: no query loads them unless it asks with
 * .select('+ct +iv +tag'), and toJSON strips them even then. The only code that
 * asks is lib/server/user-keys.ts. The field is `modelId`, never `model`
 * (Document.model() clash).
 */

export const BUILTIN_SLOTS: readonly LLMProvider[] = ['cohere', 'gemini', 'groq', 'mistral'];
export const CUSTOM_SLOT_PREFIX = 'custom:';

export const CREDENTIAL_LIMITS = {
  name: 60,
  modelId: 200,
  baseUrl: 2048,
} as const;

export type CredentialKind = 'builtin' | 'custom';
export type CredentialHeaderType = 'bearer' | 'x-api-key';

export interface IProviderCredential extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  slot: string;
  kind: CredentialKind;
  provider?: LLMProvider;
  name?: string;
  baseUrl?: string;
  modelId?: string;
  headerType?: CredentialHeaderType;
  enabled?: boolean;
  ct: string;
  iv: string;
  tag: string;
  keyVersion: string;
  last4: string;
  lastTestedAt?: Date | null;
  lastTestOk?: boolean | null;
  lastRejectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderCredentialSchema = new Schema<IProviderCredential>(
  {
    // Clerk user id (owner decision D14: `userId`, like DailyUsage). Queries by
    // user are served by the { userId, slot } index below (userId is its prefix),
    // so no separate single-field index is declared.
    userId: { type: String, required: true, immutable: true },
    slot: { type: String, required: true, immutable: true },
    kind: { type: String, enum: ['builtin', 'custom'], required: true, immutable: true },
    // builtin only
    provider: { type: String, enum: BUILTIN_SLOTS, immutable: true },
    // custom only
    name: { type: String, trim: true, maxlength: CREDENTIAL_LIMITS.name },
    baseUrl: { type: String, trim: true, maxlength: CREDENTIAL_LIMITS.baseUrl },
    modelId: { type: String, trim: true, maxlength: CREDENTIAL_LIMITS.modelId },
    headerType: { type: String, enum: ['bearer', 'x-api-key'] },
    enabled: { type: Boolean },
    // AES-256-GCM record from lib/server/key-vault.ts, base64. Never loaded by default.
    ct: { type: String, required: true, select: false },
    iv: { type: String, required: true, select: false },
    tag: { type: String, required: true, select: false },
    keyVersion: { type: String, required: true },
    // Last 4 characters for display; '' when the key is shorter than 12.
    last4: { type: String, default: '' },
    lastTestedAt: { type: Date, default: null },
    lastTestOk: { type: Boolean, default: null },
    lastRejectedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'providercredentials',
    toJSON: {
      transform(_doc, ret) {
        const out = ret as Record<string, unknown>;
        delete out.ct;
        delete out.iv;
        delete out.tag;
        return out;
      },
    },
  }
);

ProviderCredentialSchema.index({ userId: 1, slot: 1 }, { unique: true });

ProviderCredentialSchema.pre('validate', function () {
  if (this.kind === 'builtin') {
    if (!this.provider || this.slot !== this.provider) {
      this.invalidate('slot', 'A built-in credential slot must equal its provider');
    }
  } else if (this.kind === 'custom') {
    if (this.slot !== `${CUSTOM_SLOT_PREFIX}${this._id.toString()}`) {
      this.invalidate('slot', 'A custom credential slot must be custom:<its own _id>');
    }
    if (this.provider !== undefined && this.provider !== null) {
      this.invalidate('provider', 'A custom credential has no built-in provider');
    }
    if (!this.name || !this.baseUrl || !this.modelId) {
      this.invalidate('name', 'A custom credential needs a name, a base URL and a model id');
    }
  }
});

const ProviderCredential: Model<IProviderCredential> =
  mongoose.models.ProviderCredential ||
  mongoose.model<IProviderCredential>('ProviderCredential', ProviderCredentialSchema);

export default ProviderCredential;
