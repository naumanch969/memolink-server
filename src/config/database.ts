import mongoose from 'mongoose';
import { config } from './env';

class Database {
  private static instance: Database;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Database already connected');
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
      console.log('✅ Database connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('❌ Database connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ Database disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ Database reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('❌ Database connection failed:', error);
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
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error);
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
