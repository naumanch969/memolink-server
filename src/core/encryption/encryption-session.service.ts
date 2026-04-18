import { redisConnection } from '../../config/redis';
import { IEncryptionSessionService } from './encryption.interfaces';

const LOCK_TTL = 60 * 15; // 15 minutes inactivity → system lock
const UNLOCKED_TTL = 60 * 60 * 24; // 24 hours -> persistent vault access

export class EncryptionSessionService implements IEncryptionSessionService {

    async storeMDK(userId: string, mdk: Buffer, isLockEnabled: boolean = true): Promise<void> {
        const ttl = isLockEnabled ? LOCK_TTL : UNLOCKED_TTL;
        await redisConnection.setex(`vault:mdk:${userId}`, ttl, mdk.toString('hex'));
    }

    async getMDK(userId: string): Promise<Buffer | null> {
        const hex = await redisConnection.get(`vault:mdk:${userId}`);
        return hex ? Buffer.from(hex, 'hex') : null;
    }

    async clearMDK(userId: string): Promise<void> {
        await redisConnection.del(`vault:mdk:${userId}`);
    }

    async refreshMDK(userId: string, isLockEnabled: boolean = true): Promise<void> {
        const ttl = isLockEnabled ? LOCK_TTL : UNLOCKED_TTL;
        await redisConnection.expire(`vault:mdk:${userId}`, ttl);
    }
}

export const encryptionSessionService = new EncryptionSessionService();
export default encryptionSessionService;
