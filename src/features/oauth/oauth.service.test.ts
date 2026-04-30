import { oauthService } from './oauth.service';
import { OAuthClient, OAuthCode } from './oauth.model';
import { OAuthGrant } from './oauth-grant.model';
import User from '../auth/auth.model';
import { cryptoService } from '../../core/crypto/crypto.service';
import { encryptionSessionService } from '../../core/encryption/encryption-session.service';
import { vaultService } from '../auth/vault.service';
import { ApiError } from '../../core/errors/api.error';

// Mock Dependencies
jest.mock('./oauth.model', () => ({
  OAuthClient: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  OAuthCode: {
    findOne: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock('./oauth-grant.model', () => ({
  OAuthGrant: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));
jest.mock('../auth/auth.model', () => ({
  findById: jest.fn(),
}));
jest.mock('../../core/crypto/crypto.service');
jest.mock('../../core/encryption/encryption-session.service');
jest.mock('../auth/vault.service');

describe('OAuthService', () => {
  const mockUserId = 'user123';
  const mockClientId = 'claude-ai';
  const mockRedirectUri = 'https://claude.ai/callback';
  const mockCode = 'code123';
  const mockGrantSecret = 'secret123';
  const mockMDK = 'mdk123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateClient', () => {
    it('should return true for valid client credentials', async () => {
      (OAuthClient.findOne as jest.Mock).mockResolvedValue({
        clientId: mockClientId,
        clientSecret: 'correct_secret',
        redirectUris: [mockRedirectUri],
      });

      const result = await oauthService.validateClient(mockClientId, 'correct_secret', mockRedirectUri);
      expect(result).toBe(true);
    });

    it('should return false if client not found', async () => {
      (OAuthClient.findOne as jest.Mock).mockResolvedValue(null);
      const result = await oauthService.validateClient('unknown', 'secret', mockRedirectUri);
      expect(result).toBe(false);
    });
  });

  describe('generateAuthorizationCode', () => {
    it('should create and return a code', async () => {
      (cryptoService.generateRandomToken as jest.Mock).mockReturnValue(mockCode);
      (OAuthCode.create as jest.Mock).mockResolvedValue({});

      const result = await oauthService.generateAuthorizationCode(mockClientId, mockUserId, mockRedirectUri);
      
      expect(result).toBe(mockCode);
      expect(OAuthCode.create).toHaveBeenCalledWith(expect.objectContaining({
        code: mockCode,
        clientId: mockClientId,
        userId: mockUserId,
      }));
    });
  });

  describe('approveGrant', () => {
    it('should generate a grant snapshot and return a code', async () => {
      (encryptionSessionService.getMDK as jest.Mock).mockResolvedValue(mockMDK);
      (cryptoService.generateSecureRandomString as jest.Mock).mockReturnValue(mockGrantSecret);
      (vaultService.generateGrantSnapshot as jest.Mock).mockResolvedValue({ wrapped: 'w1', salt: 's1' });
      (cryptoService.generateRandomToken as jest.Mock).mockReturnValue(mockCode);

      const result = await oauthService.approveGrant(mockUserId, mockClientId, mockRedirectUri);

      expect(result).toBe(mockCode);
      expect(OAuthGrant.findOneAndUpdate).toHaveBeenCalled();
      expect(OAuthCode.create).toHaveBeenCalledWith(expect.objectContaining({
        grantSecret: mockGrantSecret,
      }));
    });

    it('should throw if vault is locked (no MDK)', async () => {
      (encryptionSessionService.getMDK as jest.Mock).mockResolvedValue(null);
      await expect(oauthService.approveGrant(mockUserId, mockClientId, mockRedirectUri))
        .rejects.toThrow(ApiError);
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should return tokens for valid code and credentials', async () => {
      (OAuthClient.findOne as jest.Mock).mockResolvedValue({ clientId: mockClientId, clientSecret: 'secret' });
      (OAuthCode.findOne as jest.Mock).mockResolvedValue({
        code: mockCode,
        clientId: mockClientId,
        userId: mockUserId,
        grantSecret: mockGrantSecret,
        expiresAt: new Date(Date.now() + 10000),
      });
      (User.findById as jest.Mock).mockResolvedValue({ _id: mockUserId, email: 'test@test.com', role: 'user' });
      (OAuthGrant.findOne as jest.Mock).mockResolvedValue({ _id: 'grant123' });
      (cryptoService.generateAccessToken as jest.Mock).mockReturnValue('access_token');
      (cryptoService.generateRefreshToken as jest.Mock).mockReturnValue('refresh_token');

      const result = await oauthService.exchangeCodeForToken(mockClientId, 'secret', mockCode, mockRedirectUri);

      expect(result.accessToken).toBe('access_token');
      expect(cryptoService.generateAccessToken).toHaveBeenCalledWith(expect.objectContaining({
        ks: mockGrantSecret,
        gid: 'grant123',
      }));
      expect(OAuthCode.deleteOne).toHaveBeenCalled();
    });

    it('should throw if code is expired', async () => {
      (OAuthClient.findOne as jest.Mock).mockResolvedValue({ clientId: mockClientId, clientSecret: 'secret' });
      (OAuthCode.findOne as jest.Mock).mockResolvedValue({
        expiresAt: new Date(Date.now() - 10000),
      });

      await expect(oauthService.exchangeCodeForToken(mockClientId, 'secret', mockCode, mockRedirectUri))
        .rejects.toThrow('Invalid or expired authorization code');
    });
  });
});
