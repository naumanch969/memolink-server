import { database } from '../config/database';
import { logger } from '../config/logger';
import { entityMigration } from '../features/entity/entity.migration';

const COMMANDS = {
    migrate: 'Run the full Person -> Entity migration',
    verify: 'Verify migration completeness without making changes',
    archive: 'Archive (soft-delete) legacy Person documents after migration',
    cleanup: 'Remove orphan mentions that reference non-existent entities'
};

async function run() {
    const command = process.argv[2] || 'migrate';

    if (!Object.keys(COMMANDS).includes(command)) {
        logger.error(`Unknown command: ${command}`);
        logger.info('Available commands:');
        Object.entries(COMMANDS).forEach(([cmd, desc]) => {
            logger.info(`  ${cmd}: ${desc}`);
        });
        process.exit(1);
    }

    try {
        logger.info('=========================================');
        logger.info(`Running Migration Script: ${command}`);
        logger.info('=========================================');

        // 1. Connect to DB
        await database.connect();
        logger.info('Database connected.');

        switch (command) {
            case 'migrate': {
                const stats = await entityMigration.migrateAll();
                logger.info('Migration completed.', stats);
                break;
            }

            case 'verify': {
                const verification = await entityMigration.verifyMigration();
                if (verification.success) {
                    logger.info('✅ Verification PASSED - All references are properly mapped');
                } else {
                    logger.warn('⚠️ Verification FAILED - Some references are still unmapped');
                }
                break;
            }

            case 'archive': {
                logger.info('⚠️ This will soft-delete all legacy Person documents.');
                logger.info('Running verification first...');
                const preCheck = await entityMigration.verifyMigration();

                if (!preCheck.success) {
                    logger.error('Cannot archive: Migration verification failed!');
                    logger.error('Run "migrate" command first to complete the migration.');
                    process.exit(1);
                }

                const archiveResult = await entityMigration.archiveLegacyPersons();
                logger.info(`Archived ${archiveResult.archived} legacy Person documents.`);
                break;
            }

            case 'cleanup': {
                const cleanupStats = await entityMigration.cleanupOrphanMentions();
                logger.info('Cleanup completed.', cleanupStats);
                break;
            }
        }

        logger.info('Script completed successfully.');
    } catch (error) {
        logger.error('CRITICAL: Migration Script Failed', error);
        process.exit(1);
    } finally {
        await database.disconnect();
        logger.info('Database connection closed.');
        process.exit(0);
    }
}

// Global Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { promise, reason });
    process.exit(1);
});

run();
