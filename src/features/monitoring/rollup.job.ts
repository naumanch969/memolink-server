import cron from 'node-cron';
import { logger } from '../../config/logger';
import { SystemMetric } from './metric.model';

/**
 * Starts the daily rollup job for metrics.
 * Aggregates hourly metrics into daily summaries to save space.
 */
export const startDailyRollupJob = () => {
    // Run at 00:05 everyday (to allow any late flushes from 23:59 to complete)
    cron.schedule('5 0 * * *', async () => {
        logger.info('[Rollup] Starting daily metric rollup...');
        try {
            await performRollup();
        } catch (error) {
            logger.error('[Rollup] Failed to perform daily rollup', error);
        }
    });

    logger.info('Daily Metric Rollup Job scheduled (00:05 daily)');
};

/**
 * Aggregates hourly metrics (YYYY-MM-DD:HH) into daily metrics (YYYY-MM-DD).
 * Deletes the original hourly records after successful aggregation.
 */
export async function performRollup() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 2);

    // Format YYYY-MM-DD using local time to match BufferManager
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Regex for hourly metrics of that day: "^YYYY-MM-DD:\d{2}$"
    const hourlyPattern = new RegExp(`^${dateStr}:\\d{2}$`);

    logger.info(`[Rollup] Processing metrics for date: ${dateStr}`);

    // Fetch all hourly metrics for that day
    const metrics = await SystemMetric.find({ period: hourlyPattern });

    if (metrics.length === 0) {
        logger.info(`[Rollup] No hourly metrics found for ${dateStr}, skipping.`);
        return;
    }

    // Aggregation Logic in Memory (safer than complex mongo pipeline for now)
    const aggregated: Record<string, { value: number, op: string, count: number }> = {};

    for (const m of metrics) {
        const key = m.key;
        // Fallback heuristic for older metrics without metadata.op
        const op = m.metadata?.op || (key.startsWith('system:') ? 'max' : 'sum');
        const val = m.value;

        if (!aggregated[key]) {
            aggregated[key] = { value: val, op, count: 1 };
        } else {
            if (op === 'max') {
                aggregated[key].value = Math.max(aggregated[key].value, val);
            } else {
                aggregated[key].value += val;
            }
            aggregated[key].count++;
        }
    }

    // Prepare Bulk Operations
    const operations = Object.entries(aggregated).map(([key, data]) => ({
        updateOne: {
            filter: { key, period: dateStr },
            update: {
                $set: {
                    value: data.value,
                    lastUpdatedAt: new Date(),
                    metadata: {
                        op: data.op,
                        rollup: true,
                        samples: data.count
                    }
                }
            },
            upsert: true
        }
    }));

    if (operations.length > 0) {
        // Execute Bulk Write
        await SystemMetric.bulkWrite(operations);

        // Delete original hourly metrics
        const deleteResult = await SystemMetric.deleteMany({ period: hourlyPattern });

        logger.info(`[Rollup] Successfully aggregated ${metrics.length} hourly metrics into ${operations.length} daily metrics for ${dateStr}. Deleted ${deleteResult.deletedCount} hourly records.`);
    }
}
