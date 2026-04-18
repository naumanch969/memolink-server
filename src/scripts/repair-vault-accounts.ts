import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import Models / Services
import { User } from '../features/auth/auth.model';
import encryptionService from '../core/encryption/encryption.service';
import { cryptoService } from '../core/crypto/crypto.service';

/**
 * REPAIR CONFIGURATION
 */
const ACCOUNTS_TO_REPAIR = [
    { email: 'mnauman.bese23seecs@seecs.edu.pk', password: 'Test123$' }
];

const DEFAULT_QUESTION = "What is your primary security key?";

async function repair() {
    console.log('🚀 Starting Self-Verifying Vault Repair...');

    try {
        await mongoose.connect(process.env.MONGODB_PROD_URI!);
        console.log('✅ Connected to Database');

        for (const account of ACCOUNTS_TO_REPAIR) {
            console.log(`\nProcessing: ${account.email}...`);

            // 0. Fetch user with ALL hidden fields
            const user = await User.findOne({ email: account.email.toLowerCase().trim() })
                .select('+vault.passwordSalt +vault.wrappedMDK_password +vault.securityAnswerSalt +vault.wrappedMDK_securityAnswer +vault.recoverySalt +vault.wrappedMDK_recovery +password');

            if (!user) {
                console.error(`❌ User not found: ${account.email}`);
                continue;
            }

            // 1. Generate NEW MDK
            const mdk = encryptionService.generateMDK();
            const normalize = (val: string) => val.trim().toLowerCase();
            const secret = normalize(account.password);

            // 2. Generate Wrappers
            const passSalt = crypto.randomBytes(32).toString('hex');
            const passKek = await encryptionService.deriveKEK(secret, passSalt);
            const wrappedPassMDK = encryptionService.wrapKey(mdk, passKek);

            // VERIFICATION (Check math before saving)
            try {
                const verifyKek = await encryptionService.deriveKEK(secret, passSalt);
                const verifyMdk = encryptionService.unwrapKey(wrappedPassMDK, verifyKek);
                if (verifyMdk.equals(mdk)) {
                    console.log('✅ Math Verification Passed: KEK/MDK cycle is valid');
                } else {
                    throw new Error('MDK Mismatch after unwrap!');
                }
            } catch (err) {
                console.error('❌ Math Verification Failed!', err);
                continue;
            }

            // 3. Update User Data
            user.password = await cryptoService.hashPassword(account.password);
            user.isOnboarded = true;
            user.isActive = true;

            // Re-initialize vault object correctly
            user.vault = {
                passwordSalt: passSalt,
                wrappedMDK_password: wrappedPassMDK,
                securityQuestion: DEFAULT_QUESTION,
                securityAnswerSalt: passSalt, // Syncing for repair
                wrappedMDK_securityAnswer: wrappedPassMDK,
                recoverySalt: crypto.randomBytes(32).toString('hex'),
                wrappedMDK_recovery: 'REPAIR_RESET',
                encryptionVersion: 3,
                unlockAttempts: 0
            };

            user.securityConfig = {
                question: DEFAULT_QUESTION,
                answerHash: await cryptoService.hashPassword(secret),
                isEnabled: true,
                timeoutMinutes: 15
            };

            await user.save();

            console.log('user', user)
            console.log(`✅ Database Updated & Healed: ${account.email}`);
        }

        console.log('\n✨ Repair complete.');
    } catch (error) {
        console.error('💥 Critical Repair Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

repair();
