import { redisConnection } from '../../config/redis';
import { IEncryptionSessionService } from './encryption.interfaces';

const LOCK_TTL = 60 * 15; // 15 minutes inactivity → system lock

export class EncryptionSessionService implements IEncryptionSessionService {

    async storeMDK(userId: string, mdk: Buffer): Promise<void> {
        await redisConnection.setex(`vault:mdk:${userId}`, LOCK_TTL, mdk.toString('hex'));
    }

    async getMDK(userId: string): Promise<Buffer | null> {
        const hex = await redisConnection.get(`vault:mdk:${userId}`);
        return hex ? Buffer.from(hex, 'hex') : null;
    }

    async clearMDK(userId: string): Promise<void> {
        await redisConnection.del(`vault:mdk:${userId}`);
    }

    async refreshMDK(userId: string): Promise<void> {
        // Active users never hit the lock screen
        await redisConnection.expire(`vault:mdk:${userId}`, LOCK_TTL);
    }
}

export const encryptionSessionService = new EncryptionSessionService();
export default encryptionSessionService;
