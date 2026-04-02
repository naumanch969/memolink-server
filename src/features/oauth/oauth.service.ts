import { cryptoService } from '../../core/crypto/crypto.service';
import { ApiError } from '../../core/errors/api.error';
import User from '../auth/auth.model';
import { IOAuthClient, OAuthClient, OAuthCode } from './oauth.model';

export class OAuthService {
  /**
   * Seed the default Claude AI client if it doesn't exist.
   */
  async seedClaudeClient(clientSecret: string = 'claude_secret_placeholder'): Promise<void> {
    const existing = await OAuthClient.findOne({ clientId: 'claude-ai' });
    if (!existing) {
      await OAuthClient.create({
        clientId: 'claude-ai',
        clientSecret,
        name: 'Claude AI',
        logo: 'https://cdn.oaistatic.com/_next/static/media/claude-logo.1d2b7f5e.svg', // Placeholder for Claude AI logo
        description: 'Claude AI - Your AI assistant.',
        redirectUris: ['https://claude.ai/auth/oauth/callback'], // Using standard Claude callback
        grants: ['authorization_code', 'refresh_token'],
      });
    } else if (existing.clientSecret !== clientSecret) {
      existing.clientSecret = clientSecret;
      await existing.save();
    }
  }

  async validateClient(clientId: string, clientSecret: string, redirectUri: string): Promise<boolean> {
    const client = await OAuthClient.findOne({ clientId });
    if (!client) return false;
    if (client.clientSecret !== clientSecret) return false;
    if (!client.redirectUris.includes(redirectUri)) return false;
    return true;
  }

  public async getClient(clientId: string): Promise<IOAuthClient | null> {
    return this.getClientById(clientId);
  }

  async generateAuthorizationCode(clientId: string, userId: string, redirectUri: string, scope: string[] = []): Promise<string> {
    const code = cryptoService.generateRandomToken(32);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 min expiry

    await OAuthCode.create({
      code,
      clientId,
      userId,
      redirectUri,
      scope,
      expiresAt,
    });

    return code;
  }

  async exchangeCodeForToken(clientId: string, clientSecret: string, code: string, redirectUri: string) {
    const client = await OAuthClient.findOne({ clientId });
    if (!client || client.clientSecret !== clientSecret) {
      throw ApiError.unauthorized('Invalid client credentials');
    }

    const authCode = await OAuthCode.findOne({ code, clientId, redirectUri });
    if (!authCode || authCode.expiresAt < new Date()) {
      throw ApiError.unauthorized('Invalid or expired authorization code');
    }

    const user = await User.findById(authCode.userId);
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Generate JWT using existing auth logic
    const accessToken = cryptoService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = cryptoService.generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Delete the code after use
    await OAuthCode.deleteOne({ _id: authCode._id });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600, // Typically 1 hour
    };
  }

  async getClientById(clientId: string) {
    return OAuthClient.findOne({ clientId });
  }
}

export const oauthService = new OAuthService();
export default oauthService;
