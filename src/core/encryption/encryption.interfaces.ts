import { Buffer } from 'buffer';

export interface EncryptedField {
    content: string;
    iv: string;
    authTag: string;
    v: number;
    serviceKeyVersion?: number;
}

export interface IEncryptionService {
    generateMDK(): Buffer;
    generateRecoveryPhrase(): string;
    deriveKEK(secret: string, salt: string): Promise<Buffer>;
    wrapKey(mdk: Buffer, kek: Buffer, version?: number): string;
    unwrapKey(wrappedJson: string, kek: Buffer): Buffer;
    encrypt(plaintext: string, key: Buffer): EncryptedField;
    decrypt(field: EncryptedField, key: Buffer): string;
    getServiceKey(version?: number): { key: Buffer; version: number };
    encryptEnrichment(data: object): EncryptedField & { serviceKeyVersion: number };
    decryptEnrichment(field: EncryptedField & { serviceKeyVersion: number }): object;
    generateBlindIndex(term: string, mdk: Buffer): string;
}

export interface IEncryptionSessionService {
    storeMDK(userId: string, mdk: Buffer): Promise<void>;
    getMDK(userId: string): Promise<Buffer | null>;
    clearMDK(userId: string): Promise<void>;
    refreshMDK(userId: string): Promise<void>;
}
