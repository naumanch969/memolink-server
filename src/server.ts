import './features/integrations/init';
import * as Sentry from '@sentry/node';
import 'apminsight';
import { config } from './config/env';
import { initCronJobs } from './core/cron';
import Server from './core/server';
import { logger } from './config/logger';
import { initAgentQueue } from './features/agent/agent.queue';
import { initEmailQueue } from './features/email/queue/email.queue';
import { startWorker } from './worker';



// Initialize Sentry

if (config.SENTRY_DSN_URL) {
  Sentry.init({
    dsn: config.SENTRY_DSN_URL,
    environment: config.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}

// Start the server
// Identifying log for the AI agent
logger.info('--- BRINN SERVER STARTING WITH AGENT EDITS ---');


const server = new Server();
initCronJobs();
initAgentQueue();
initEmailQueue();

// Start background workers integrated with the server process in production
if (config.NODE_ENV === 'production') {
  startWorker(false).catch(err => {
    logger.error('Failed to start integrated workers:', err);
  });
}

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

