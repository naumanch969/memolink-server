import mongoose, { Document, Schema } from 'mongoose';

export interface IOAuthClient extends Document {
  clientId: string;
  clientSecret: string;
  name: string;
  logo?: string;
  description?: string;
  redirectUris: string[];
  grants: string[];
}

const oauthClientSchema = new Schema<IOAuthClient>({
  clientId: { type: String, required: true, unique: true },
  clientSecret: { type: String, required: true },
  name: { type: String, required: true },
  logo: { type: String },
  description: { type: String },
  redirectUris: [{ type: String, required: true }],
  grants: [{ type: String, enum: ['authorization_code', 'refresh_token'], default: ['authorization_code', 'refresh_token'] }],
}, { timestamps: true });

export interface IOAuthCode extends Document {
  code: string;
  clientId: string;
  userId: string;
  expiresAt: Date;
  redirectUri: string;
  scope: string[];
}

const oauthCodeSchema = new Schema<IOAuthCode>({
  code: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  redirectUri: { type: String, required: true },
  scope: [{ type: String }],
}, { timestamps: true });

oauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthClient = mongoose.model<IOAuthClient>('OAuthClient', oauthClientSchema);
export const OAuthCode = mongoose.model<IOAuthCode>('OAuthCode', oauthCodeSchema);
