import { HydratedDocument } from "mongoose";
import { IUser } from "./auth.types";

export interface IVaultService {
    /**
     * Initializes a new vault for a user.
     * Generates MDK, Recovery Phrase, and three wrappers (Pass, Answer, Recovery).
     */
    initializeVault(user: HydratedDocument<IUser>, credentials: { password?: string; securityQuestion: string; securityAnswer: string }): Promise<{ recoveryPhrase: string; mdk: Buffer }>;

    /**
     * Unlocks a user's vault using their security answer.
     * Restores MDK to session for the session window.
     */
    unlockVault(userId: string, securityAnswer: string): Promise<void>;

    /**
     * Performs JIT migration for legacy users.
     * Generates a temporary MDK and recovery phrase.
     */
    migrateLegacyUser(user: HydratedDocument<IUser>, password?: string): Promise<{ recoveryPhrase: string; mdk: Buffer }>;

    /**
     * Checks if the vault is locked and returns the security question.
     */
    getVaultStatus(userId: string): Promise<{ isLocked: boolean; securityQuestion?: string }>;

    /**
     * Recovers a vault using the emergency recovery phrase.
     */
    recoverWithPhrase(email: string, recoveryPhrase: string, newPassword: string): Promise<void>;
}
