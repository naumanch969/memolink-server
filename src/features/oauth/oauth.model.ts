import mongoose, { Schema } from 'mongoose';
import { IOAuthClient, IOAuthCode } from './oauth.interfaces';

const oauthClientSchema = new Schema<IOAuthClient>({
  clientId: { type: String, required: true, unique: true },
  clientSecret: { type: String, required: true },
  name: { type: String, required: true },
  logo: { type: String },
  description: { type: String },
  redirectUris: [{ type: String, required: true }],
  grants: [{ type: String, enum: ['authorization_code', 'refresh_token'], default: ['authorization_code', 'refresh_token'] }],
}, { timestamps: true });

const oauthCodeSchema = new Schema<IOAuthCode>({
  code: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  redirectUri: { type: String, required: true },
  scope: [{ type: String }],
  grantSecret: { type: String },
  codeChallenge: { type: String },
  codeChallengeMethod: { type: String },
}, { timestamps: true });

oauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthClient = mongoose.model<IOAuthClient>('OAuthClient', oauthClientSchema);
export const OAuthCode = mongoose.model<IOAuthCode>('OAuthCode', oauthCodeSchema);
