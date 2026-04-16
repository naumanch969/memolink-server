import { HydratedDocument } from "mongoose";
import { IUser } from "./auth.types";

export interface IVaultService {
    initializeVault(user: HydratedDocument<IUser>, credentials: { password?: string; securityQuestion: string; securityAnswer: string }): Promise<{ recoveryPhrase: string; mdk: Buffer }>;
    unlockVault(userId: string, securityAnswer: string): Promise<void>;
    getVaultStatus(userId: string): Promise<{ isLocked: boolean; securityQuestion?: string }>;
    recoverWithPhrase(email: string, recoveryPhrase: string, newPassword: string): Promise<void>;
}
