import { HydratedDocument } from "mongoose";
import { IUser } from "./auth.types";

export interface IVaultService {
    initializeVault(user: HydratedDocument<IUser>, credentials: { password?: string; securityQuestion: string; securityAnswer: string }): Promise<{ recoveryPhrase: string; mdk: Buffer }>;
    unlockVault(userId: string, data: { securityAnswer?: string; password?: string }): Promise<void>;
    getVaultStatus(userId: string): Promise<{ isLocked: boolean; securityQuestion?: string }>;
    recoverWithPhrase(email: string, recoveryPhrase: string, newPassword: string): Promise<void>;
    generateGrantSnapshot(mdk: Buffer, secret: string): Promise<{ salt: string; wrapped: string }>;
    unwrapMDKFromGrant(wrappedMDK: string, salt: string, secret: string): Promise<Buffer>;
}
