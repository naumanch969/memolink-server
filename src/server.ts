import * as Sentry from '@sentry/node';
import 'apminsight';
import { config } from './config/env';
import { initCronJobs } from './core/cron';
import Server from './core/server';
import { initAgentQueue } from './features/agent/agent.queue';
import { initEmailQueue } from './features/email/queue/email.queue';

// Initialize Sentry
if (config.SENTRY_DSN_URL) {
  Sentry.init({
    dsn: config.SENTRY_DSN_URL,
    environment: config.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}

// Start the server
const server = new Server();
initCronJobs();
initAgentQueue();
initEmailQueue();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
