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
     */
    private async generateWrapper(secret: string, mdk: Buffer): Promise<{ salt: string; wrapped: string }> {
        const salt = crypto.randomBytes(32).toString('hex');
        const kek = await encryptionService.deriveKEK(secret.toLowerCase().trim(), salt);
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

        const mdk = encryptionService.generateMDK();
        const recoveryPhrase = encryptionService.generateRecoveryPhrase();

        // 1. Password Wrapper
        const passWrapper = await this.generateWrapper(plainPassword || '', mdk);

        // 2. Security Answer Wrapper
        const answerWrapper = await this.generateWrapper(securityAnswer, mdk);

        // 3. Recovery Phrase Wrapper
        const recoveryWrapper = await this.generateWrapper(recoveryPhrase, mdk);

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

        // Also update security config for legacy compatibility
        user.securityConfig = {
            question: securityQuestion,
            answerHash: await cryptoService.hashPassword(securityAnswer.toLowerCase().trim()),
            isEnabled: true,
            timeoutMinutes: 15
        };

        await user.save();
        await encryptionSessionService.storeMDK(user._id.toString(), mdk);

        logger.info('Vault initialized successfully', { userId: user._id });
        return { recoveryPhrase, mdk };
    }

    async unlockVault(userId: string, securityAnswer: string): Promise<void> {
        const user = await User.findById(userId)
            .select('+vault.securityAnswerSalt +vault.wrappedMDK_securityAnswer +vault.unlockAttempts +vault.unlockLockedUntil +securityConfig.answerHash');

        if (!user || !user.vault) throw ApiError.notFound('User or Vault not found');
        const vault = user.vault;

        try {
            const kek = await encryptionService.deriveKEK(securityAnswer.toLowerCase().trim(), vault.securityAnswerSalt!);
            const mdk = encryptionService.unwrapKey(vault.wrappedMDK_securityAnswer!, kek);
            await encryptionSessionService.storeMDK(userId, mdk);

            user.vault.unlockAttempts = 0;
            user.vault.unlockLockedUntil = undefined;
            await user.save();
        } catch (error) {
            user.vault!.unlockAttempts = (user.vault!.unlockAttempts || 0) + 1;
            if (user.vault!.unlockAttempts >= 5) {
                user.vault!.unlockLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            }
            await user.save();
            throw ApiError.unauthorized('Incorrect security answer');
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

    async recoverWithPhrase(email: string, recoveryPhrase: string, newPassword: string): Promise<void> {
        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select('+vault.recoverySalt +vault.wrappedMDK_recovery +password');

        if (!user || !user.vault?.wrappedMDK_recovery) {
            throw ApiError.unauthorized('Recovery not possible for this account');
        }

        try {
            const kek = await encryptionService.deriveKEK(recoveryPhrase.trim(), user.vault.recoverySalt!);
            const mdk = encryptionService.unwrapKey(user.vault.wrappedMDK_recovery, kek);

            const passWrapper = await this.generateWrapper(newPassword, mdk);
            const hashedPassword = await cryptoService.hashPassword(newPassword);

            user.password = hashedPassword;
            user.vault.passwordSalt = passWrapper.salt;
            user.vault.wrappedMDK_password = passWrapper.wrapped;

            await user.save();
            await encryptionSessionService.storeMDK(user._id.toString(), mdk);
        } catch (error) {
            throw ApiError.unauthorized('Invalid recovery phrase');
        }
    }
}

export const vaultService = new VaultService();
export default vaultService;
