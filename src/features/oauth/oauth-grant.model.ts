import mongoose, { Schema } from 'mongoose';
import { IOAuthGrant } from './oauth.interfaces';

const oauthGrantSchema = new Schema<IOAuthGrant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: String, required: true },
  wrappedMDK: { type: String, required: true },
  vaultSalt: { type: String, required: true },
  scopes: [{ type: String }],
  revokedAt: { type: Date },
  lastUsedAt: { type: Date },
}, { timestamps: true });

// Ensure one grant per user per client
oauthGrantSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export const OAuthGrant = mongoose.model<IOAuthGrant>('OAuthGrant', oauthGrantSchema);
