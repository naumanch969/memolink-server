import { createServer, Server as HttpServer } from 'http';
import database from '../config/database';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { verifyMetricsIndexes } from '../features/monitoring/metric.model';
import { MetricsService } from '../features/monitoring/metrics.service';
import { startDailyRollupJob } from '../features/monitoring/rollup.job';
import app from './app';
import { SocketManager } from './socket/socket.manager';
import { bufferManager } from './telemetry/buffer.manager';

class Server {
  private server: HttpServer;
  private socketManager: SocketManager | null = null;

  constructor() {
    this.server = createServer(app);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await database.connect();
      await verifyMetricsIndexes();

      // Initialize Sockets
      this.socketManager = new SocketManager(this.server);

      // Start Telemetry
      MetricsService.startSystemMetricsCollection();
      startDailyRollupJob();

      // Start server
      this.server.listen(Number(config.PORT), '0.0.0.0', () => {
        logger.info(`Server running on port ${config.PORT} `, {
          environment: config.NODE_ENV,
          port: config.PORT,
          timestamp: new Date().toISOString(),
        });
      });

      // Handle server errors
      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.syscall !== 'listen') {
          throw error;
        }

        const bind = typeof config.PORT === 'string' ? 'Pipe ' + config.PORT : 'Port ' + config.PORT;

        switch (error.code) {
          case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
          case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);
            process.exit(1);
            break;
          default:
            throw error;
        }
      });

      // Graceful shutdown
      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`${signal} received, shutting down gracefully`);

    if (this.server) {
      this.server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await bufferManager.flush();
          logger.info('Telemetry buffer flushed');

          await database.disconnect();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during database disconnection:', error);
          process.exit(1);
        }
      });
    } else {
      process.exit(0);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default Server;
