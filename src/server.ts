import Server from './core/server';
import { initCronJobs } from './core/cron';

// Start the server
const server = new Server();
initCronJobs();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
