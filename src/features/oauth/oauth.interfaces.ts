import { Document, Schema } from 'mongoose';
import { OAuthTokenResponse } from './oauth.types';

export interface IOAuthClient extends Document {
  clientId: string;
  clientSecret: string;
  name: string;
  logo?: string;
  description?: string;
  redirectUris: string[];
  grants: string[];
}

export interface IOAuthCode extends Document {
  code: string;
  clientId: string;
  userId: string;
  expiresAt: Date;
  redirectUri: string;
  scope: string[];
  grantSecret?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface IOAuthGrant extends Document {
  userId: Schema.Types.ObjectId;
  clientId: string;
  wrappedMDK: string;
  vaultSalt: string;
  scopes: string[];
  revokedAt?: Date;
  lastUsedAt?: Date;
}

export interface IOAuthService {
  seedClaudeClient(clientSecret?: string): Promise<void>;
  validateClient(clientId: string, clientSecret: string, redirectUri: string): Promise<boolean>;
  getClient(clientId: string): Promise<IOAuthClient | null>;
  generateAuthorizationCode(clientId: string, userId: string, redirectUri: string, scope?: string[], codeChallenge?: string, codeChallengeMethod?: string): Promise<string>;
  approveGrant(userId: string, clientId: string, redirectUri: string, scope?: string[], codeChallenge?: string, codeChallengeMethod?: string): Promise<string>;
  exchangeCodeForToken(clientId: string, clientSecret: string, code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokenResponse>;
  getClientById(clientId: string): Promise<IOAuthClient | null>;
}
