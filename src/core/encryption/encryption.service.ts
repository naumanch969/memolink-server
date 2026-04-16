import argon2 from 'argon2';
import * as bip39 from 'bip39';
import crypto from 'crypto';
import { EncryptedField, IEncryptionService } from './encryption.interfaces';
import { config } from '../../config/env';

const ALGORITHM = 'aes-256-gcm';
const MDK_LENGTH = 32;
const ARGON2_MEM = 65536; // 64MB — memory-hard
const ARGON2_TIME = 3;     // 3 iterations
const ARGON2_PAR = 4;     // parallel threads

export class EncryptionService implements IEncryptionService {

    // --- MDK ---

    generateMDK(): Buffer {
        return crypto.randomBytes(MDK_LENGTH);
    }

    generateRecoveryPhrase(): string {
        return bip39.generateMnemonic();
    }

    async deriveKEK(secret: string, salt: string): Promise<Buffer> {
        // Argon2id — Memory-hard KDF protects against GPU/ASIC cracking
        return await argon2.hash(secret, {
            type: argon2.argon2id,
            salt: Buffer.from(salt, 'hex'),
            memoryCost: ARGON2_MEM,
            timeCost: ARGON2_TIME,
            parallelism: ARGON2_PAR,
            hashLength: 32,
            raw: true
        });
    }

    wrapKey(mdk: Buffer, kek: Buffer, version = 1): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
        const encrypted = Buffer.concat([cipher.update(mdk), cipher.final()]);
        return JSON.stringify({
            ct: encrypted.toString('hex'),
            iv: iv.toString('hex'),
            at: cipher.getAuthTag().toString('hex'),
            v: version
        });
    }

    unwrapKey(wrappedJson: string, kek: Buffer): Buffer {
        try {
            const { ct, iv, at } = JSON.parse(wrappedJson);
            const decipher = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(iv, 'hex'));
            decipher.setAuthTag(Buffer.from(at, 'hex'));
            return Buffer.concat([
                decipher.update(Buffer.from(ct, 'hex')),
                decipher.final()
            ]);
        } catch (error) {
            throw new Error('KEY_UNWRAP_FAILED: integrity check failed or invalid input');
        }
    }

    // --- ENCRYPT / DECRYPT ---

    encrypt(plaintext: string, key: Buffer): EncryptedField {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        return {
            content: ct.toString('hex'),
            iv: iv.toString('hex'),
            authTag: cipher.getAuthTag().toString('hex'),
            v: 3
        };
    }

    decrypt(field: EncryptedField, key: Buffer): string {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(field.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(field.authTag, 'hex'));
        try {
            return Buffer.concat([
                decipher.update(Buffer.from(field.content, 'hex')),
                decipher.final()
            ]).toString('utf8');
        } catch {
            throw new Error('DECRYPTION_FAILED: integrity check failed');
        }
    }

    // --- SERVICE KEY (enrichments — versioned) ---

    getServiceKey(version?: number): { key: Buffer; version: number } {
        const v = version ?? parseInt(config.CURRENT_SERVICE_KEY_VERSION || '1');
        const keyHex = config[`SERVICE_KEY_${v}`];
        if (!keyHex) throw new Error(`SERVICE_KEY_${v} not set`);
        return { key: Buffer.from(keyHex, 'hex'), version: v };
    }

    encryptEnrichment(data: object): EncryptedField & { serviceKeyVersion: number } {
        const { key, version } = this.getServiceKey();
        return { ...this.encrypt(JSON.stringify(data), key), serviceKeyVersion: version };
    }

    decryptEnrichment(field: EncryptedField & { serviceKeyVersion: number }): object {
        const { key } = this.getServiceKey(field.serviceKeyVersion);
        return JSON.parse(this.decrypt(field, key));
    }

    // --- BLIND INDEX (syntactic search) ---

    generateBlindIndex(term: string, mdk: Buffer): string {
        const searchKey = crypto.createHmac('sha256', mdk).update('brinn-search-v1').digest();
        return crypto
            .createHmac('sha256', searchKey)
            .update(term.toLowerCase().replace(/[^a-z0-9]/g, '').trim())
            .digest('hex');
    }
}

export const encryptionService = new EncryptionService();
export default encryptionService;
