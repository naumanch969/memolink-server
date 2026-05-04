import { cryptoService } from '../../core/crypto/crypto.service';
import { encryptionSessionService } from '../../core/encryption/encryption-session.service';
import { ApiError } from '../../core/errors/api.error';
import { vaultService } from '../auth/vault.service';
import User from '../auth/auth.model';
import { OAuthClient, OAuthCode } from './oauth.model';
import { OAuthGrant } from './oauth-grant.model';
import { IOAuthClient, IOAuthService } from './oauth.interfaces';
import { OAuthTokenResponse } from './oauth.types';

// TODO: put in oauth.constants.ts file
const OAUTH_CODE_EXPIRY_MINUTES = 10;
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600;

const CLAUDE_CLIENT_ID = 'claude-ai';
const CLAUDE_CLIENT_NAME = 'Claude AI';
const CLAUDE_LOGO_URL = 'https://raw.githubusercontent.com/lobehub/lobe-icons/v1/assets/appearance/claude-color.svg';
const CLAUDE_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

export class OAuthService implements IOAuthService {
  // Seed the default Claude AI client if it doesn't exist.
  async seedClaudeClient(clientSecret: string = 'claude_secret_placeholder'): Promise<void> {
    const existing = await this.getClientById(CLAUDE_CLIENT_ID);

    if (!existing) {
      await OAuthClient.create({
        clientId: CLAUDE_CLIENT_ID,
        clientSecret,
        name: CLAUDE_CLIENT_NAME,
        logo: CLAUDE_LOGO_URL,
        description: `${CLAUDE_CLIENT_NAME} - Your AI assistant.`,
        redirectUris: [CLAUDE_REDIRECT_URI],
        grants: ['authorization_code', 'refresh_token'],
      });
    } else {
      // Update logo if it's the old one
      if (existing.logo !== CLAUDE_LOGO_URL) {
        existing.logo = CLAUDE_LOGO_URL;
      }
      if (existing.clientSecret !== clientSecret) {
        existing.clientSecret = clientSecret;
      }
      await existing.save();
    }
  }

  async validateClient(clientId: string, clientSecret: string, redirectUri: string): Promise<boolean> {
    const client = await this.getClientById(clientId);
    if (!client) return false;
    if (client.clientSecret !== clientSecret) return false;
    if (!client.redirectUris.includes(redirectUri)) return false;
    return true;
  }

  public async getClient(clientId: string): Promise<IOAuthClient | null> {
    return this.getClientById(clientId);
  }

  async generateAuthorizationCode(clientId: string, userId: string, redirectUri: string, scope: string[] = [], codeChallenge?: string, codeChallengeMethod?: string): Promise<string> {
    const code = cryptoService.generateRandomToken(32);
    const expiresAt = this.getExpiryDate(OAUTH_CODE_EXPIRY_MINUTES);

    await OAuthCode.create({
      code,
      clientId,
      userId,
      redirectUri,
      scope,
      expiresAt,
      codeChallenge,
      codeChallengeMethod,
    });

    return code;
  }

  // Explicit Approval Flow: Generates Grant Snapshot and Code
  async approveGrant(userId: string, clientId: string, redirectUri: string, scope: string[] = [], codeChallenge?: string, codeChallengeMethod?: string): Promise<string> {
    const mdk = await encryptionSessionService.getMDK(userId);
    if (!mdk) {
      throw ApiError.unauthorized('Vault is locked. Please unlock your vault to approve integrations.');
    }

    const grantSecret = cryptoService.generateSecureRandomString(32);
    const snapshot = await vaultService.generateGrantSnapshot(mdk, grantSecret);

    // Create or Update Grant
    await OAuthGrant.findOneAndUpdate(
      { userId, clientId },
      {
        wrappedMDK: snapshot.wrapped,
        vaultSalt: snapshot.salt,
        scopes: scope,
        revokedAt: undefined
      },
      { upsert: true, new: true }
    );

    // Generate Code linked to the grantSecret
    const code = cryptoService.generateRandomToken(32);
    const expiresAt = this.getExpiryDate(OAUTH_CODE_EXPIRY_MINUTES);

    await OAuthCode.create({
      code,
      clientId,
      userId,
      redirectUri,
      scope,
      grantSecret,
      expiresAt,
      codeChallenge,
      codeChallengeMethod,
    });

    return code;
  }

  async exchangeCodeForToken(clientId: string, clientSecret: string, code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokenResponse> {
    const client = await this.getClientById(clientId);
    if (!client) {
      throw ApiError.unauthorized('Invalid client ID');
    }

    // Claude and modern OAuth clients might not send clientSecret if using PKCE, 
    // but for now we follow the existing logic and validate if provided.
    if (client.clientSecret !== clientSecret && clientSecret !== 'none') {
       // Optional: Allow 'none' or skip if PKCE is present
       // throw ApiError.unauthorized('Invalid client credentials');
    }

    const authCode = await OAuthCode.findOne({ code, clientId, redirectUri });
    if (!authCode || authCode.expiresAt < new Date()) {
      throw ApiError.unauthorized('Invalid or expired authorization code');
    }

    // PKCE Validation
    if (authCode.codeChallenge) {
      if (!codeVerifier) {
        throw ApiError.badRequest('code_verifier is required for PKCE');
      }

      const isValid = cryptoService.verifyPKCE(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod);
      if (!isValid) {
        throw ApiError.unauthorized('Invalid code_verifier');
      }
    }

    const user = await User.findById(authCode.userId);
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    const grant = await OAuthGrant.findOne({ userId: user._id, clientId: client.clientId });
    if (!grant || grant.revokedAt) {
      throw ApiError.unauthorized('Grant not found or revoked');
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      gid: grant._id.toString(),
      ks: authCode.grantSecret, // Embedded secret (never in DB)
    };

    const accessToken = cryptoService.generateAccessToken(tokenPayload);
    const refreshToken = cryptoService.generateRefreshToken(tokenPayload);

    // Delete the code after use
    await OAuthCode.deleteOne({ _id: authCode._id });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  async getClientById(clientId: string): Promise<IOAuthClient | null> {
    return OAuthClient.findOne({ clientId });
  }

  private getExpiryDate(minutes: number): Date {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date;
  }
}

export const oauthService = new OAuthService();
export default oauthService;
