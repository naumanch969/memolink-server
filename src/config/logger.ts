import { logViewerService } from '../core/monitoring/log-viewer.service';
import { config } from './env';


export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = config.LOG_LEVEL as LogLevel || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    let metaString = '';

    if (meta) {
      if (meta instanceof Error) {
        metaString = ` ${meta.message}${meta.stack ? `\n${meta.stack}` : ''}`;
      } else {
        try {
          metaString = ` ${JSON.stringify(meta)}`;
        } catch (e) {
          metaString = ' [Circular or Complex Metadata]';
        }
      }
    }

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
  }

  public error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, meta));
      logViewerService.addLog(LogLevel.ERROR, message, meta);
    }
  }

  public warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
      logViewerService.addLog(LogLevel.WARN, message, meta);
    }
  }

  public info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, meta));
      logViewerService.addLog(LogLevel.INFO, message, meta);
    }
  }

  public debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
      logViewerService.addLog(LogLevel.DEBUG, message, meta);
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

export const logger = new Logger();
export default logger;
