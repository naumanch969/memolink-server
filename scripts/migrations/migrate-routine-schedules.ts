/**
 * Migration: Routine Schedule Structure
 *
 * Migrates legacy `schedule.activeDays` format to new `IScheduleConfig` structure.
 *
 * OLD FORMAT:
 *   schedule: { activeDays: [0, 1, 2, 3, 4, 5, 6] }
 *
 * NEW FORMAT:
 *   schedule: { type: 'specific_days', days: [0, 1, 2, 3, 4, 5, 6] }
 *
 * USAGE:
 *   npx ts-node scripts/migrations/migrate-routine-schedules.ts                  # Dry run (default)
 *   npx ts-node scripts/migrations/migrate-routine-schedules.ts --execute        # Apply to dev DB
 *   npx ts-node scripts/migrations/migrate-routine-schedules.ts --execute --production  # Production
 *
 * SAFETY FEATURES:
 *   - Dry-run by default (preview only)
 *   - Pre-migration validation
 *   - Post-migration verification
 *   - Production requires manual confirmation
 *   - Detailed audit logging
 */

import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as readline from 'readline';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memolink';
const IS_EXECUTE = process.argv.includes('--execute');
const IS_PRODUCTION = process.argv.includes('--production');
const COLLECTION_NAME = 'routine_templates';

// Valid day values (0-6, Sunday-Saturday)
const VALID_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6]; // All days as fallback

// ============================================
// TYPE DEFINITIONS
// ============================================

interface LegacySchedule {
    activeDays?: number[];
    // May also have partial new fields
    type?: string;
    days?: number[];
}

interface NewScheduleConfig {
    type: 'specific_days' | 'frequency' | 'interval';
    days?: number[];
    dates?: number[];
    frequencyCount?: number;
    frequencyPeriod?: 'week' | 'month';
    intervalValue?: number;
    intervalUnit?: 'day' | 'week' | 'month';
}

interface MigrationResult {
    routineId: string;
    routineName: string;
    oldSchedule: LegacySchedule | undefined;
    newSchedule: NewScheduleConfig;
    status: 'success' | 'skipped' | 'error';
    error?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function log(message: string, indent = 0): void {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${message}`);
}

function logSection(title: string): void {
    console.log('\n' + '='.repeat(50));
    console.log(`  ${title}`);
    console.log('='.repeat(50) + '\n');
}

function validateDaysArray(days: unknown): days is number[] {
    if (!Array.isArray(days)) return false;
    return days.every(day => VALID_DAYS.includes(day));
}

function isLegacyFormat(schedule: unknown): boolean {
    if (!schedule || typeof schedule !== 'object') return false;
    const s = schedule as LegacySchedule;

    // Has activeDays but no type = definitely legacy
    if (s.activeDays !== undefined && s.type === undefined) return true;

    // Has no type field at all = legacy
    if (s.type === undefined) return true;

    return false;
}

function isAlreadyMigrated(schedule: unknown): boolean {
    if (!schedule || typeof schedule !== 'object') return false;
    const s = schedule as NewScheduleConfig;
    return s.type !== undefined && ['specific_days', 'frequency', 'interval'].includes(s.type);
}

function buildNewSchedule(oldSchedule: LegacySchedule | undefined): NewScheduleConfig {
    // Extract days from legacy format
    let days: number[] = DEFAULT_DAYS;

    if (oldSchedule?.activeDays && validateDaysArray(oldSchedule.activeDays)) {
        days = [...oldSchedule.activeDays].sort((a, b) => a - b);
    } else if (oldSchedule?.days && validateDaysArray(oldSchedule.days)) {
        // Already has days array, just ensure sorted
        days = [...oldSchedule.days].sort((a, b) => a - b);
    }

    return {
        type: 'specific_days',
        days,
    };
}

// ============================================
// CONFIRMATION PROMPT
// ============================================

async function confirmExecution(): Promise<boolean> {
    if (!IS_EXECUTE) return false;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const dbLabel = IS_PRODUCTION ? '🔴 PRODUCTION' : '🟡 DEVELOPMENT';
    const maskedUri = MONGODB_URI.substring(0, 30) + '...';

    return new Promise((resolve) => {
        console.log('\n' + '⚠️'.repeat(20));
        console.log(`\n  ${dbLabel} DATABASE MIGRATION`);
        console.log(`  URI: ${maskedUri}`);
        console.log('\n' + '⚠️'.repeat(20));

        if (IS_PRODUCTION) {
            rl.question('\n  Type "MIGRATE PRODUCTION" to proceed: ', (answer) => {
                rl.close();
                resolve(answer === 'MIGRATE PRODUCTION');
            });
        } else {
            rl.question('\n  Type "CONFIRM" to proceed: ', (answer) => {
                rl.close();
                resolve(answer === 'CONFIRM');
            });
        }
    });
}

// ============================================
// PRE-MIGRATION VALIDATION
// ============================================

async function validatePreMigration(
    collection: mongoose.mongo.Collection
): Promise<{ valid: boolean; totalCount: number; legacyCount: number; migratedCount: number }> {
    logSection('Pre-Migration Validation');

    const totalCount = await collection.countDocuments({});
    log(`📊 Total routines in database: ${totalCount}`);

    // Count legacy format records
    const legacyCount = await collection.countDocuments({
        $or: [
            { 'schedule.activeDays': { $exists: true } },
            { 'schedule.type': { $exists: false } },
        ],
    });
    log(`📋 Routines with legacy format: ${legacyCount}`);

    // Count already migrated records
    const migratedCount = await collection.countDocuments({
        'schedule.type': { $in: ['specific_days', 'frequency', 'interval'] },
    });
    log(`✅ Routines already migrated: ${migratedCount}`);

    // Validation checks
    const valid = totalCount >= 0 && legacyCount >= 0;

    if (legacyCount === 0) {
        log('\n✅ No legacy records found - migration may not be needed');
    }

    return { valid, totalCount, legacyCount, migratedCount };
}

// ============================================
// MIGRATION LOGIC
// ============================================

async function migrateRoutines(
    collection: mongoose.mongo.Collection,
    execute: boolean
): Promise<MigrationResult[]> {
    logSection(execute ? 'Executing Migration' : 'Migration Preview (Dry Run)');

    if (!execute) {
        log('🔍 DRY RUN MODE - No changes will be applied\n');
    }

    // Find all routines needing migration
    const legacyRoutines = await collection
        .find({
            $or: [
                { 'schedule.activeDays': { $exists: true } },
                { 'schedule.type': { $exists: false } },
            ],
        })
        .toArray();

    if (legacyRoutines.length === 0) {
        log('✅ No routines require migration');
        return [];
    }

    log(`📝 Processing ${legacyRoutines.length} routine(s)...\n`);

    const results: MigrationResult[] = [];

    for (const routine of legacyRoutines) {
        const routineId = routine._id.toString();
        const routineName = (routine.name as string) || 'Unnamed';
        const oldSchedule = routine.schedule as LegacySchedule | undefined;

        // Skip if already migrated (double-check)
        if (isAlreadyMigrated(oldSchedule)) {
            log(`⏭️  ${routineName} - Already migrated, skipping`);
            results.push({
                routineId,
                routineName,
                oldSchedule,
                newSchedule: oldSchedule as NewScheduleConfig,
                status: 'skipped',
            });
            continue;
        }

        // Build new schedule
        const newSchedule = buildNewSchedule(oldSchedule);

        log(`📝 ${routineName} (${routineId})`);
        log(`   Old: ${JSON.stringify(oldSchedule ?? {})}`, 1);
        log(`   New: ${JSON.stringify(newSchedule)}`, 1);

        if (execute) {
            try {
                // Atomic update - replace entire schedule object
                const updateResult = await collection.updateOne(
                    { _id: routine._id },
                    { $set: { schedule: newSchedule } }
                );

                if (updateResult.modifiedCount === 1) {
                    log(`   ✅ Migrated successfully`, 1);
                    results.push({
                        routineId,
                        routineName,
                        oldSchedule,
                        newSchedule,
                        status: 'success',
                    });
                } else {
                    log(`   ⚠️  No document modified (unexpected)`, 1);
                    results.push({
                        routineId,
                        routineName,
                        oldSchedule,
                        newSchedule,
                        status: 'error',
                        error: 'No document modified',
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log(`   ❌ Error: ${errorMessage}`, 1);
                results.push({
                    routineId,
                    routineName,
                    oldSchedule,
                    newSchedule,
                    status: 'error',
                    error: errorMessage,
                });
            }
        } else {
            log(`   ⏩ Would migrate (dry run)`, 1);
            results.push({
                routineId,
                routineName,
                oldSchedule,
                newSchedule,
                status: 'success', // Treated as success for dry run
            });
        }

        console.log(''); // Blank line between entries
    }

    return results;
}

// ============================================
// POST-MIGRATION VERIFICATION
// ============================================

async function verifyPostMigration(
    collection: mongoose.mongo.Collection,
    preStats: { totalCount: number; legacyCount: number }
): Promise<boolean> {
    logSection('Post-Migration Verification');

    const postTotalCount = await collection.countDocuments({});
    const postLegacyCount = await collection.countDocuments({
        $or: [
            { 'schedule.activeDays': { $exists: true }, 'schedule.type': { $exists: false } },
            { 'schedule.type': { $exists: false } },
        ],
    });
    const postMigratedCount = await collection.countDocuments({
        'schedule.type': { $in: ['specific_days', 'frequency', 'interval'] },
    });

    log(`📊 Total routines: ${postTotalCount} (was ${preStats.totalCount})`);
    log(`📋 Legacy format remaining: ${postLegacyCount} (was ${preStats.legacyCount})`);
    log(`✅ Migrated format: ${postMigratedCount}`);

    // Verification checks
    const countMatch = postTotalCount === preStats.totalCount;
    const allMigrated = postLegacyCount === 0;

    if (!countMatch) {
        log('\n❌ CRITICAL: Document count changed during migration!');
        return false;
    }

    if (!allMigrated) {
        log(`\n⚠️  Warning: ${postLegacyCount} routine(s) still have legacy format`);
    } else {
        log('\n✅ All routines successfully migrated to new format');
    }

    return countMatch;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main(): Promise<void> {
    logSection('Routine Schedule Migration');

    log(`📅 Started at: ${new Date().toISOString()}`);
    log(`🔧 Mode: ${IS_EXECUTE ? 'EXECUTE' : 'DRY RUN (preview only)'}`);
    log(`🗄️  Target: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);

    // Confirmation for execution mode
    if (IS_EXECUTE) {
        const confirmed = await confirmExecution();
        if (!confirmed) {
            log('\n❌ Migration cancelled by user.\n');
            process.exit(0);
        }
    }

    // Connect to MongoDB
    log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected successfully');

    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection not established');
    }

    const collection = db.collection(COLLECTION_NAME);

    try {
        // Step 1: Pre-migration validation
        const preStats = await validatePreMigration(collection);
        if (!preStats.valid) {
            throw new Error('Pre-migration validation failed');
        }

        if (preStats.legacyCount === 0) {
            log('\n✅ No migration needed - all routines are already up to date!\n');
            await mongoose.disconnect();
            return;
        }

        // Step 2: Execute migration
        const results = await migrateRoutines(collection, IS_EXECUTE);

        // Step 3: Post-migration verification (only if executed)
        if (IS_EXECUTE && results.length > 0) {
            const verified = await verifyPostMigration(collection, preStats);
            if (!verified) {
                throw new Error('Post-migration verification failed - data integrity issue detected');
            }
        }

        // Summary
        logSection('Migration Summary');

        const successCount = results.filter((r) => r.status === 'success').length;
        const skippedCount = results.filter((r) => r.status === 'skipped').length;
        const errorCount = results.filter((r) => r.status === 'error').length;

        log(`📊 Total Processed: ${results.length}`);
        log(`✅ Success: ${successCount}`);
        log(`⏭️  Skipped: ${skippedCount}`);
        log(`❌ Errors: ${errorCount}`);

        if (!IS_EXECUTE) {
            log('\n💡 This was a DRY RUN - no changes were made');
            log('   Run with --execute to apply changes');
            if (IS_PRODUCTION) {
                log('   Add --production for production database');
            }
        }

        if (errorCount > 0) {
            log('\n⚠️  Some migrations failed. Review errors above.');
        }

        log(`\n📅 Completed at: ${new Date().toISOString()}`);
    } finally {
        await mongoose.disconnect();
        log('\n📡 Disconnected from MongoDB\n');
    }
}

// Execute
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ MIGRATION FAILED:', error.message || error);
        console.error('\n   Your data has NOT been modified (unless partial execution).');
        console.error('   Please review the error and try again.\n');
        process.exit(1);
    });
