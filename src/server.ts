import Server from './core/server';

// Start the server
const server = new Server();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
