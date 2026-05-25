export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logFilePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  format?: 'json' | 'text';
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export class Logger {
  private config: LoggerConfig;
  private logEntries: LogEntry[] = [];
  private fileStream: fs.WriteStream | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || 'info',
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      logFilePath: config.logFilePath,
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024,
      maxFiles: config.maxFiles || 5,
      format: config.format || 'text'
    };

    if (this.config.enableFile && this.config.logFilePath) {
      this.setupFileLogging();
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const message = entry.message;

    let formatted = `[${timestamp}] ${levelStr} ${message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      formatted += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      formatted += `\n${entry.error.stack || entry.error.message}`;
    }

    return formatted;
  }

  private formatJson(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      context: entry.context || null,
      error: entry.error ? {
        message: entry.error.message,
        stack: entry.error.stack,
        name: entry.error.name
      } : null
    });
  }

  private writeToConsole(entry: LogEntry): void {
    const formatted = this.formatMessage(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.config.enableFile || !this.config.logFilePath || !this.fileStream) {
      return;
    }

    try {
      const formatted = this.config.format === 'json' 
        ? this.formatJson(entry) 
        : this.formatMessage(entry);

      await new Promise<void>((resolve, reject) => {
        this.fileStream!.write(formatted + '\n', (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      await this.rotateLogFileIfNeeded();
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  private async setupFileLogging(): Promise<void> {
    if (!this.config.logFilePath) {
      return;
    }

    try {
      await fs.promises.mkdir(path.dirname(this.config.logFilePath), { recursive: true });
      this.fileStream = fs.createWriteStream(this.config.logFilePath, { flags: 'a', encoding: 'utf-8' });
    } catch (error) {
      console.error('Failed to setup file logging:', error);
      this.config.enableFile = false;
    }
  }

  private async rotateLogFileIfNeeded(): Promise<void> {
    if (!this.config.logFilePath || !this.fileStream) {
      return;
    }

    try {
      const stats = await fs.promises.stat(this.config.logFilePath);
      if (stats.size > (this.config.maxFileSize || 10 * 1024 * 1024)) {
        await this.rotateLogFile();
      }
    } catch (error) {
      console.error('Failed to check log file size:', error);
    }
  }

  private async rotateLogFile(): Promise<void> {
    if (!this.config.logFilePath || !this.fileStream) {
      return;
    }

    try {
      this.fileStream.end();

      for (let i = (this.config.maxFiles || 5) - 1; i > 0; i--) {
        const oldFile = `${this.config.logFilePath}.${i}`;
        const newFile = `${this.config.logFilePath}.${i + 1}`;

        if (await FileUtils.fileExists(oldFile)) {
          await fs.promises.rename(oldFile, newFile);
        }
      }

      const backupFile = `${this.config.logFilePath}.1`;
      await fs.promises.rename(this.config.logFilePath, backupFile);

      this.fileStream = fs.createWriteStream(this.config.logFilePath, { flags: 'a', encoding: 'utf-8' });
    } catch (error) {
      console.error('Failed to rotate log file:', error);
      this.fileStream = fs.createWriteStream(this.config.logFilePath, { flags: 'a', encoding: 'utf-8' });
    }
  }

  async log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error
    };

    this.logEntries.push(entry);

    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    if (this.config.enableFile) {
      await this.writeToFile(entry);
    }
  }

  debug(message: string, context?: Record<string, any>): Promise<void> {
    return this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): Promise<void> {
    return this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): Promise<void> {
    return this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>, error?: Error): Promise<void> {
    return this.log('error', message, context, error);
  }

  getEntries(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logEntries.filter(entry => LOG_LEVELS[entry.level] >= LOG_LEVELS[level]);
    }
    return [...this.logEntries];
  }

  clearEntries(): void {
    this.logEntries = [];
  }

  async flush(): Promise<void> {
    if (this.fileStream) {
      await new Promise<void>((resolve, reject) => {
        this.fileStream!.end(() => {
          this.fileStream = null;
          resolve();
        });
      });
    }
  }

  async dispose(): Promise<void> {
    await this.flush();
  }
}

let defaultLogger: Logger | null = null;

export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger(config);
  }
  return defaultLogger;
}

export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

const fs = require('fs');
const path = require('path');
import { FileUtils } from './file-utils';