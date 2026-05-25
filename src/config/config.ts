import fs from 'fs';
import path from 'path';
import { ConfigurationError } from '../errors/errors';

export interface DependencyFixConfig {
  registryUrl: string;
  timeoutMs: number;
  maxRetries: number;
  backupPath: string;
  cachePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableCache: boolean;
  enableBackup: boolean;
  verifyIntegrity: boolean;
  maxConcurrentDownloads: number;
  blacklist: string[];
  whitelist: string[];
}

const DEFAULT_CONFIG: DependencyFixConfig = {
  registryUrl: 'https://registry.npmjs.org',
  timeoutMs: 30000,
  maxRetries: 3,
  backupPath: '.backup',
  cachePath: '.cache',
  logLevel: 'info',
  enableCache: true,
  enableBackup: true,
  verifyIntegrity: true,
  maxConcurrentDownloads: 5,
  blacklist: [],
  whitelist: []
};

export class ConfigManager {
  private config: DependencyFixConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }

  private getDefaultConfigPath(): string {
    return path.join(process.cwd(), '.dependency-fix.json');
  }

  private loadConfig(): DependencyFixConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...configData };
      }
      return { ...DEFAULT_CONFIG };
    } catch (error) {
      throw new ConfigurationError(`Failed to load config from ${this.configPath}: ${error}`);
    }
  }

  public saveConfig(config: Partial<DependencyFixConfig>): void {
    try {
      this.config = { ...this.config, ...config };
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      throw new ConfigurationError(`Failed to save config to ${this.configPath}: ${error}`);
    }
  }

  public getConfig(): DependencyFixConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<DependencyFixConfig>): void {
    this.saveConfig(updates);
  }

  public resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig({});
  }

  public validateConfig(): string[] {
    const errors: string[] = [];

    if (!this.config.registryUrl.startsWith('http')) {
      errors.push('registryUrl must be a valid URL starting with http or https');
    }

    if (this.config.timeoutMs < 1000) {
      errors.push('timeoutMs must be at least 1000ms');
    }

    if (this.config.maxRetries < 0) {
      errors.push('maxRetries must be non-negative');
    }

    if (this.config.maxConcurrentDownloads < 1) {
      errors.push('maxConcurrentDownloads must be at least 1');
    }

    if (!['debug', 'info', 'warn', 'error'].includes(this.config.logLevel)) {
      errors.push('logLevel must be one of: debug, info, warn, error');
    }

    return errors;
  }

  public getBackupPath(packageName: string, version: string): string {
    const safeName = packageName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeVersion = version.replace(/[^a-zA-Z0-9-._]/g, '_');
    return path.join(this.config.backupPath, `${safeName}@${safeVersion}_${Date.now()}`);
  }

  public getCachePath(packageName: string, version: string): string {
    const safeName = packageName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeVersion = version.replace(/[^a-zA-Z0-9-._]/g, '_');
    return path.join(this.config.cachePath, `${safeName}@${safeVersion}`);
  }

  public shouldProcessPackage(packageName: string): boolean {
    if (this.config.whitelist.length > 0) {
      return this.config.whitelist.includes(packageName);
    }

    if (this.config.blacklist.length > 0) {
      return !this.config.blacklist.includes(packageName);
    }

    return true;
  }
}

export function createDefaultConfig(): DependencyFixConfig {
  return { ...DEFAULT_CONFIG };
}

export function validateConfigPath(configPath: string): boolean {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}