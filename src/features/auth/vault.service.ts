import crypto from 'crypto';
import { HydratedDocument } from 'mongoose';
import { logger } from '../../config/logger';
import { cryptoService } from '../../core/crypto/crypto.service';
import { encryptionSessionService } from '../../core/encryption/encryption-session.service';
import { encryptionService } from '../../core/encryption/encryption.service';
import { ApiError } from '../../core/errors/api.error';
import { User } from './auth.model';
import { IUser } from './auth.types';
import { IVaultService } from './vault.interfaces';

export class VaultService implements IVaultService {

    /**
     * Helper to generate a vault wrapper (Salt + KEK + Wrapped Key)
     * BASELINE: Universal lowercase/trim normalization
     */
    private async generateWrapper(secret: string, mdk: Buffer): Promise<{ salt: string; wrapped: string }> {
        const salt = crypto.randomBytes(32).toString('hex');
        const normalizedSecret = secret.trim().toLowerCase();
        const kek = await encryptionService.deriveKEK(normalizedSecret, salt);
        const wrapped = encryptionService.wrapKey(mdk, kek);
        return { salt, wrapped };
    }

    async initializeVault(user: HydratedDocument<IUser>, credentials: { password?: string; securityQuestion: string; securityAnswer: string }): Promise<{ recoveryPhrase: string; mdk: Buffer }> {
        const { password, securityQuestion, securityAnswer } = credentials;

        const plainPassword = password;
        if (password) {
            user.password = await cryptoService.hashPassword(password);
        }

        if (!plainPassword && !user.password) {
            throw ApiError.badRequest('Password is required to initialize vault');
        }

        // Reuse existing MDK if session already has one
        let mdk = await encryptionSessionService.getMDK(user._id.toString());
        if (!mdk) {
            mdk = encryptionService.generateMDK();
        }

        const recoveryPhrase = encryptionService.generateRecoveryPhrase();

        const passWrapper = await this.generateWrapper(plainPassword || '', mdk);
        const answerWrapper = await this.generateWrapper(securityAnswer, mdk);
        const recoveryWrapper = await this.generateWrapper(recoveryPhrase, mdk);

        user.isActive = true;

        user.vault = {
            passwordSalt: passWrapper.salt,
            wrappedMDK_password: passWrapper.wrapped,
            securityQuestion,
            securityAnswerSalt: answerWrapper.salt,
            wrappedMDK_securityAnswer: answerWrapper.wrapped,
            recoverySalt: recoveryWrapper.salt,
            wrappedMDK_recovery: recoveryWrapper.wrapped,
            encryptionVersion: 3,
            unlockAttempts: 0
        };

        // Sync old securityConfig
        user.securityConfig = {
            question: securityQuestion,
            answerHash: await cryptoService.hashPassword(securityAnswer.toLowerCase().trim()),
            isEnabled: true,
            timeoutMinutes: 15
        };

        await user.save();
        await encryptionSessionService.storeMDK(user._id.toString(), mdk, user.securityConfig?.isEnabled);

        logger.info('Vault initialized successfully', { userId: user._id });
        return { recoveryPhrase, mdk };
    }

    async unlockVault(userId: string, data: { securityAnswer?: string; password?: string }): Promise<void> {
        const { securityAnswer, password } = data;

        console.log('data', data)
        const isPasswordUnlock = !!password;

        // Universal normalization: Baseline match
        const secret = (isPasswordUnlock ? password : securityAnswer)?.trim().toLowerCase();

        if (!secret) {
            throw ApiError.badRequest('Credential is required to unlock vault');
        }

        const user = await User.findById(userId).select('+vault.passwordSalt +vault.wrappedMDK_password +vault.securityAnswerSalt +vault.wrappedMDK_securityAnswer +vault.unlockAttempts +vault.unlockLockedUntil +securityConfig.isEnabled');
        if (!user || !user.vault) throw ApiError.notFound('User or Vault not found');

        // if (user.vault.unlockLockedUntil && user.vault.unlockLockedUntil > new Date()) {
        //     throw ApiError.forbidden(`Vault is locked due to too many attempts. Try again later.`);
        // }

        try {
            const salt = isPasswordUnlock ? user.vault.passwordSalt : user.vault.securityAnswerSalt;
            const wrappedMDKValue = isPasswordUnlock ? user.vault.wrappedMDK_password : user.vault.wrappedMDK_securityAnswer;

            if (!salt || !wrappedMDKValue || wrappedMDKValue === 'pending') {
                throw new Error('Credential path not initialized');
            }

            const kek = await encryptionService.deriveKEK(secret, salt);
            const mdk = encryptionService.unwrapKey(wrappedMDKValue, kek);
            await encryptionSessionService.storeMDK(userId, mdk, user.securityConfig?.isEnabled);

            user.vault.unlockAttempts = 0;
            user.vault.unlockLockedUntil = undefined;
            await user.save();
        } catch (error) {
            user.vault.unlockAttempts = (user.vault.unlockAttempts || 0) + 1;
            if (user.vault.unlockAttempts >= 5) {
                user.vault.unlockLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            }
            await user.save();
            throw ApiError.unauthorized(`Incorrect ${isPasswordUnlock ? 'password' : 'security answer'}`);
        }
    }

    async getVaultStatus(userId: string): Promise<{ isLocked: boolean; securityQuestion?: string }> {
        const mdk = await encryptionSessionService.getMDK(userId);
        if (mdk) return { isLocked: false };

        const user = await User.findById(userId).select('vault.securityQuestion');
        return {
            isLocked: true,
            securityQuestion: user?.vault?.securityQuestion || 'Security Question not set.'
        };
    }

    async recoverWithPhrase(email: string, recoveryPhrase: string, newPassword?: string, newSecurityQuestion?: string, newSecurityAnswer?: string): Promise<void> {
        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select('+vault.recoverySalt +vault.wrappedMDK_recovery +password +securityConfig.isEnabled');

        if (!user || !user.vault?.wrappedMDK_recovery) {
            throw ApiError.unauthorized('Recovery not possible for this account');
        }

        try {
            const kek = await encryptionService.deriveKEK(recoveryPhrase.trim().toLowerCase(), user.vault.recoverySalt!);
            const mdk = encryptionService.unwrapKey(user.vault.wrappedMDK_recovery, kek);

            if (newPassword) {
                const passWrapper = await this.generateWrapper(newPassword, mdk);
                user.password = await cryptoService.hashPassword(newPassword);
                user.vault.passwordSalt = passWrapper.salt;
                user.vault.wrappedMDK_password = passWrapper.wrapped;
            }

            if (newSecurityQuestion && newSecurityAnswer) {
                const answerWrapper = await this.generateWrapper(newSecurityAnswer, mdk);
                user.vault.securityQuestion = newSecurityQuestion;
                user.vault.securityAnswerSalt = answerWrapper.salt;
                user.vault.wrappedMDK_securityAnswer = answerWrapper.wrapped;
            }

            await user.save();
            await encryptionSessionService.storeMDK(user._id.toString(), mdk, user.securityConfig?.isEnabled);
        } catch (error) {
            throw ApiError.unauthorized('Invalid recovery phrase');
        }
    }

    /**
     * OAuth Grant Wrapping
     */
    async generateGrantSnapshot(mdk: Buffer, secret: string): Promise<{ salt: string; wrapped: string }> {
        return this.generateWrapper(secret, mdk);
    }

    async unwrapMDKFromGrant(wrappedMDK: string, salt: string, secret: string): Promise<Buffer> {
        const normalizedSecret = secret.trim().toLowerCase();
        const kek = await encryptionService.deriveKEK(normalizedSecret, salt);
        return encryptionService.unwrapKey(wrappedMDK, kek);
    }
}

export const vaultService = new VaultService();
export default vaultService;
