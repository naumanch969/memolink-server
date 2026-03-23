import crypto from 'crypto';
import { Types } from 'mongoose';
import { cryptoService } from '../../core/crypto/crypto.service';
import { encryptionSessionService } from '../../core/encryption/encryption-session.service';
import { encryptionService } from '../../core/encryption/encryption.service';
import { ApiError } from '../../core/errors/api.error';
import { IApiKeyService } from './api-key.interfaces';
import { ApiKey } from './api-key.model';
import { IApiKeyDocument, ICreateApiKeyDTO } from './api-key.types';

const KEY_PREFIX = 'mclk_';

export class ApiKeyService implements IApiKeyService {
    /**
     * Generates a new raw API key and stores its hashed version.
     * Only returns the raw key ONCE upon creation.
     */
    async createApiKey(userId: Types.ObjectId | string, dto: ICreateApiKeyDTO): Promise<{ rawKey: string; key: IApiKeyDocument }> {
        // Generate secure 32 byte hex string
        const rawSecret = cryptoService.generateSecureRandomString(32);
        const fullRawKey = `${KEY_PREFIX}${rawSecret}`;

        // Hash it before storing (Using SHA-256 for fast comparison vs Bcrypt which is slow and meant for passwords)
        const hashedKey = crypto.createHash('sha256').update(fullRawKey).digest('hex');

        let expiresAt: Date | undefined;
        if (dto.expiresInDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);
        }

        let wrappedMDK: string | undefined;
        let vaultSalt: string | undefined;

        // If includeVault is true, try to get current session MDK and wrap it with the API key
        if (dto.includeVault) {
            const mdk = await encryptionSessionService.getMDK(userId.toString());
            if (mdk) {
                vaultSalt = crypto.randomBytes(32).toString('hex');
                // Use the rawSecret as the key to derive a KEK for wrapping the MDK
                const kek = await encryptionService.deriveKEK(rawSecret, vaultSalt);
                wrappedMDK = encryptionService.wrapKey(mdk, kek);
            }
        }

        const newKey = await ApiKey.create({
            userId,
            name: dto.name,
            hashedKey,
            prefix: KEY_PREFIX,
            expiresAt,
            wrappedMDK,
            vaultSalt,
        });

        return {
            rawKey: fullRawKey,
            key: newKey,
        };
    }

    async revokeApiKey(userId: string | Types.ObjectId, keyId: string): Promise<void> {
        const key = await ApiKey.findOneAndUpdate(
            { _id: keyId, userId },
            { isActive: false },
            { new: true }
        );

        if (!key) {
            throw ApiError.notFound('API Key');
        }
    }

    async listApiKeys(userId: string | Types.ObjectId): Promise<IApiKeyDocument[]> {
        return ApiKey.find({ userId, isActive: true })
            .select('-hashedKey')
            .sort({ createdAt: -1 });
    }

    /**
     * Internal verification method used by the auth middleware
     */
    async verifyAndGetUser(rawKey: string): Promise<Types.ObjectId | null> {
        if (!rawKey.startsWith(KEY_PREFIX)) return null;

        const rawSecret = rawKey.substring(KEY_PREFIX.length);
        const hashedIncomingKey = crypto.createHash('sha256').update(rawKey).digest('hex');

        const apiKeyData = await ApiKey.findOne({
            hashedKey: hashedIncomingKey,
            isActive: true,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
        }).select('+hashedKey +wrappedMDK +vaultSalt');

        if (!apiKeyData || !apiKeyData.userId) {
            return null;
        }

        // If the key has a wrapped MDK, unseal it and put it in session
        if (apiKeyData.wrappedMDK && apiKeyData.vaultSalt) {
            try {
                const kek = await encryptionService.deriveKEK(rawSecret, apiKeyData.vaultSalt);
                const mdk = encryptionService.unwrapKey(apiKeyData.wrappedMDK, kek);
                await encryptionSessionService.storeMDK(apiKeyData.userId.toString(), mdk);
            } catch (error) {
                // Silently fail unsealing - request will fail at requireVault if needed
                console.error('Failed to unseal MDK with API Key:', error);
            }
        }

        // Update last used asynchronously (floating promise)
        ApiKey.updateOne({ _id: apiKeyData._id }, { lastUsedAt: new Date() }).exec();

        return apiKeyData.userId;
    }
}

export const apiKeyService = new ApiKeyService();
