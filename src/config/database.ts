import mongoose from 'mongoose';
import { telemetryPlugin } from '../core/telemetry/mongoose.plugin';
import { config } from './env';
import { logger } from './logger';

// Telemetry Plugin for Mongo, Register global plugins before any models are compiled
mongoose.plugin(telemetryPlugin);

class Database {
  private static instance: Database;
  private isConnected = false;

  private constructor() { }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      const options = {
        maxPoolSize: 10,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      };

      await mongoose.connect(config.MONGODB_URI, options);

      this.isConnected = true;
      logger.info('Database connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('Database connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('Database disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('Database reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      logger.error('Database connection failed:', error as Error);
      this.isConnected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database:', error as Error);
      throw error;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getConnection(): typeof mongoose.connection {
    return mongoose.connection;
  }
}

export const database = Database.getInstance();
export default database;
