type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'performance';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: this.formatTimestamp(),
      meta
    };

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';

    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}${metaStr}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}${metaStr}`);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(`${prefix} ${message}${metaStr}`);
        }
        break;
      case 'performance':
        if (this.isDevelopment) {
          console.log(`${prefix} ${message}${metaStr}`);
        }
        break;
      default:
        console.log(`${prefix} ${message}${metaStr}`);
    }
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | any): void {
    const meta = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    this.log('error', message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  performance(system: string, duration: number, meta?: any): void {
    this.log('performance', `${system} took ${duration.toFixed(2)}ms`, meta);
  }

  gameEvent(event: string, data?: any): void {
    this.info(`Game Event: ${event}`, data);
  }

  networkEvent(event: string, data?: any): void {
    this.debug(`Network Event: ${event}`, data);
  }
}

export const logger = new Logger();
