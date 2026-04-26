import './features/integrations/init';
import 'apminsight';
import http from 'http';
import mongoose from 'mongoose';
import { config } from './config/env';
import { logger } from './config/logger';
import redisConnection from './config/redis';
import { queueService } from './core/queue/queue.service';
import { getAgentQueue } from './features/agent/agent.queue';
import { initAgentWorker } from './features/agent/agent.worker';
import { getEmailQueue } from './features/email/queue/email.queue';
import { initEmailWorker } from './features/email/queue/email.worker';
import { getEnrichmentQueue } from './features/enrichment/enrichment.queue';
import { initEnrichmentWorker } from './features/enrichment/enrichment.worker';
import notificationWorker from './features/notification/notification.worker';
import { initMediaWorker } from './features/media/media.worker';
import { getMediaQueue } from './features/media/media.queue';
import { monitoringService } from './features/monitoring/monitoring.service';

// Validate environment variables
if (!config.MONGODB_URI) {
    logger.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
}

if (!config.REDIS_URL) {
    logger.error('REDIS_URL is not defined in environment variables');
    process.exit(1);
}

async function startWorker() {
    try {
        logger.info('Starting Worker Process...');

        // 1. Connect to MongoDB
        await mongoose.connect(config.MONGODB_URI);
        logger.info('Worker connected to MongoDB');

        // 2. Ensure Redis connection
        // The singleton connects automatically, but we can check status
        redisConnection.on('ready', () => {
            logger.info('Redis connection ready for workers');
        });

        // 3. DEV ONLY: Clear queues on startup to prevent zombie jobs
        if (config.NODE_ENV === 'development') {
            logger.info('Development mode detected: Cleaning queues...');

            const emailQueue = getEmailQueue();
            const agentQueue = getAgentQueue();
            const enrichmentQueue = getEnrichmentQueue();
            const mediaQueue = getMediaQueue();

            // Clear statistics
            const counts = await enrichmentQueue.getJobCounts();
            logger.info('Enrichment Queue Status Before Clear:', counts);

            // drain() clears wait, delayed, and paused
            await emailQueue.drain();
            await agentQueue.drain();
            await mediaQueue.drain();
            
            // For enrichment, we want a clean slate in dev to fix lock errors
            // DISABLED: obliterate is too destructive and wipes valid waiting jobs on restart
            // await enrichmentQueue.obliterate({ force: true });
            // logger.info('Enrichment Queue cleanup skipped for safety');
        }

        // 4. Register Workers Here
        initAgentWorker();
        initEmailWorker();
        initEnrichmentWorker();
        initMediaWorker();

        // 5. Workers handle their own internal startup protocols (including healing)
        // graphWorker.start();
        notificationWorker.start();

        logger.info('Worker service initialized. Waiting for jobs...');

        // 6. Start Health Check Server (Required for Render Web Services)
        const healthPort = config.PORT;
        http.createServer(async (req, res) => {
            const url = req.url || '/';

            // CORS-like headers for easier browser debugging
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            try {
                if (url === '/' || url === '/status') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        message: 'Brinn Worker Service',
                        version: config.npm_package_version || '1.1.0',
                        status: 'running',
                        timestamp: new Date().toISOString(),
                        endpoints: {
                            health: '/health',
                            queues: '/queues'
                        }
                    }));
                } 
                else if (url === '/health') {
                    const health = await monitoringService.getFullHealth();
                    const statusCode = health.status === 'unhealthy' ? 503 : 200;
                    res.writeHead(statusCode);
                    res.end(JSON.stringify(health));
                }
                else if (url === '/queues') {
                    const queueStats = await monitoringService.getJobQueues();
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        status: 'success',
                        timestamp: new Date().toISOString(),
                        queues: queueStats
                    }));
                }
                else {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Not Found' }));
                }
            } catch (err) {
                logger.error('Health server error:', err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
        }).listen(healthPort, () => {
            logger.info(`Worker monitoring server listening on port ${healthPort}`);
        });

        // Graceful Shutdown
        const shutdown = async (signal: string) => {
            logger.info(`${signal} received. Shutting down worker...`);
            try {
                await notificationWorker.stop();

                await queueService.close();
                await mongoose.disconnect();
                // Redis connection is shared, but we can disconnect it last
                redisConnection.disconnect();
                logger.info('Worker shutdown complete');
                process.exit(0);
            } catch (err) {
                logger.error('Error during shutdown:', err);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start worker:', error);
        process.exit(1);
    }
}

startWorker();
