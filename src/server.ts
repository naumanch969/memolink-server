import { initCronJobs } from './core/cron';
import Server from './core/server';
import { initAgentQueue } from './features/agent/agent.queue';

// Start the server
const server = new Server();
initCronJobs();
initAgentQueue();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
