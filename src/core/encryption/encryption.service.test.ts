import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
    const encryptionService = new EncryptionService();

    describe('generateMDK', () => {
        it('should generate a 32-byte buffer', () => {
            const mdk = encryptionService.generateMDK();
            expect(mdk).toBeInstanceOf(Buffer);
            expect(mdk.length).toBe(32);
        });
    });

    describe('Key Wrapping', () => {
        it('should wrap and unwrap a key correctly', async () => {
            const mdk = encryptionService.generateMDK();
            const password = 'extremely-secret-password';
            const salt = 'abcd'.repeat(16); // 64 chars hex

            const kek = await encryptionService.deriveKEK(password, salt);
            const wrapped = encryptionService.wrapKey(mdk, kek);

            expect(typeof wrapped).toBe('string');
            expect(wrapped).toContain('ct');

            const unwrapped = encryptionService.unwrapKey(wrapped, kek);
            expect(unwrapped.equals(mdk)).toBe(true);
        });

        it('should throw error on invalid kek for unwrap', async () => {
            const mdk = encryptionService.generateMDK();
            const kek1 = await encryptionService.deriveKEK('pass1', 'salt1'.repeat(10));
            const kek2 = await encryptionService.deriveKEK('pass2', 'salt1'.repeat(10));

            const wrapped = encryptionService.wrapKey(mdk, kek1);
            expect(() => encryptionService.unwrapKey(wrapped, kek2)).toThrow('KEY_UNWRAP_FAILED');
        });
    });

    describe('Blind Indexing', () => {
        it('should be deterministic and case-insensitive', () => {
            const mdk = encryptionService.generateMDK();
            const term1 = 'Hello World!';
            const term2 = 'hello world';

            const index1 = encryptionService.generateBlindIndex(term1, mdk);
            const index2 = encryptionService.generateBlindIndex(term2, mdk);

            expect(index1).toBe(index2);
            expect(index1.length).toBe(64); // sha256 hex
        });
    });
});
