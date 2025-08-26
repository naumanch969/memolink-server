const { spawn } = require('child_process');
const path = require('path');

// Set environment variables for testing
process.env.PORT = '5001';
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://localhost:27017/memolink';
process.env.JWT_SECRET = 'test-secret-key';
process.env.CORS_ORIGIN = 'http://localhost:3000';

console.log('🚀 Starting MemoLink Server in test mode...');
console.log('📊 Environment:', process.env.NODE_ENV);
console.log('🔗 Port:', process.env.PORT);

// Start the server
const server = spawn('node', ['dist/server.js'], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`🛑 Server process exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  server.kill('SIGTERM');
});
