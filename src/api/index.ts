import path from 'path';
import { ConfigManager, DependencyFixConfig } from '../config';
import { PackageValidator, ApiValidator } from '../validators';
import { PackageFixer, type FixOptions } from '../fixers';
import { ReportGenerator, type ReportOptions } from '../reporters';
import { DependencyMonitor, type MonitoringEvent, type PerformanceMetrics } from '../monitoring';
import { FileUtils } from '../utils/file-utils';
import { IntegrityReport, RepairResult } from '../types';

export class DependencyFixAPI {
  private configManager: ConfigManager;
  private validator: PackageValidator;
  private apiValidator: ApiValidator;
  private fixer: PackageFixer;
  private reporter: ReportGenerator;
  private monitor: DependencyMonitor;

  constructor(config?: Partial<DependencyFixConfig>) {
    this.configManager = new ConfigManager();
    if (config) {
      this.configManager.updateConfig(config);
    }
    this.validator = new PackageValidator();
    this.apiValidator = new ApiValidator();
    this.fixer = new PackageFixer(this.configManager);
    this.reporter = new ReportGenerator();
    this.monitor = new DependencyMonitor();
  }

  async checkPackage(packageDir: string): Promise<IntegrityReport> {
    this.monitor.startMonitoring();
    this.monitor.recordValidationStart('unknown', 'unknown');

    try {
      const report = await this.validator.validatePackage(packageDir);
      this.monitor.recordValidationComplete(report.packageName, report.packageVersion, report);
      
      const stats = this.monitor.stopMonitoring();
      console.log(`Package check completed in ${stats.durationMs}ms`);
      
      return report;
    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packageDir });
      this.monitor.stopMonitoring();
      throw error;
    }
  }

  async checkAllPackages(packagesDir: string, pattern: string = '**/'): Promise<IntegrityReport[]> {
    this.monitor.startMonitoring();
    this.monitor.recordInfo('Bulk package check started', { packagesDir });

    try {
      const packageDirs = await this.findPackageDirectories(packagesDir, pattern);
      
      if (packageDirs.length === 0) {
        throw new Error(`No package directories found in ${packagesDir}`);
      }

      const reports = await this.validator.validateMultiplePackages(packageDirs);
      
      const stats = this.monitor.stopMonitoring();
      console.log(`Bulk check completed in ${stats.durationMs}ms, processed ${reports.length} packages`);
      
      return reports;
    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packagesDir });
      this.monitor.stopMonitoring();
      throw error;
    }
  }

  async fixPackage(packageDir: string, options: any = {}): Promise<RepairResult> {
    this.monitor.startMonitoring();

    try {
      const result = await this.fixer.fixPackage(packageDir, options);
      this.monitor.recordRepairComplete(result);
      
      const stats = this.monitor.stopMonitoring();
      console.log(`Package fix completed in ${stats.durationMs}ms`);
      
      return result;
    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packageDir });
      this.monitor.stopMonitoring();
      throw error;
    }
  }

  async fixAllPackages(packagesDir: string, options: any = {}, pattern: string = '**/'): Promise<RepairResult[]> {
    this.monitor.startMonitoring();
    this.monitor.recordInfo('Bulk package fix started', { packagesDir });

    try {
      const packageDirs = await this.findPackageDirectories(packagesDir, pattern);
      
      if (packageDirs.length === 0) {
        throw new Error(`No package directories found in ${packagesDir}`);
      }

      const results = await this.fixer.fixMultiplePackages(packageDirs, options);
      
      const stats = this.monitor.stopMonitoring();
      console.log(`Bulk fix completed in ${stats.durationMs}ms, processed ${results.length} packages`);
      
      return results;
    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packagesDir });
      this.monitor.stopMonitoring();
      throw error;
    }
  }

  async validatePackageApi(packageDir: string, options?: any): Promise<any[]> {
    try {
      const results = await this.apiValidator.validatePackageApi(packageDir, options);
      const compatibilityResults = await this.apiValidator.validatePackageCompatibility(packageDir);
      
      return [...results, ...compatibilityResults];
    } catch (error) {
      throw new Error(`API validation failed: ${error}`);
    }
  }

  async generateReport(
    data: IntegrityReport | IntegrityReport[] | RepairResult | RepairResult[],
    options: any = {}
  ): Promise<string> {
    try {
      const reportPath = await this.reporter.generateReport(data, options);
      console.log(`Report generated at: ${reportPath}`);
      return reportPath;
    } catch (error) {
      throw new Error(`Report generation failed: ${error}`);
    }
  }

  async generateConfig(outputPath: string): Promise<void> {
    try {
      const defaultConfig = this.configManager.getConfig();
      await FileUtils.writeJsonFile(outputPath, defaultConfig);
      console.log(`Configuration file generated at: ${outputPath}`);
    } catch (error) {
      throw new Error(`Config generation failed: ${error}`);
    }
  }

  getMonitoringStats(): {
    events: MonitoringEvent[];
    metrics: PerformanceMetrics;
    eventStats: ReturnType<DependencyMonitor['getEventStats']>;
    recommendations: string[];
  } {
    const events = this.monitor.getEvents();
    const metrics = this.monitor.getMetrics();
    const eventStats = this.monitor.getEventStats();
    const report = this.monitor.generateReport();

    return {
      events,
      metrics,
      eventStats,
      recommendations: report.recommendations
    };
  }

  clearMonitoringStats(): void {
    this.monitor.clearEvents();
    console.log('Monitoring statistics cleared');
  }

  startMonitoring(): void {
    this.monitor.startMonitoring();
  }

  stopMonitoring(): PerformanceMetrics {
    return this.monitor.stopMonitoring();
  }

  updateConfig(config: Partial<DependencyFixConfig>): void {
    this.configManager.updateConfig(config);
  }

  getConfig(): DependencyFixConfig {
    return this.configManager.getConfig();
  }

  private async findPackageDirectories(rootDir: string): Promise<string[]> {
    try {
      const allDirs = await FileUtils.listFiles(rootDir, false);
      const packageDirs: string[] = [];

      for (const dir of allDirs) {
        const packageJsonPath = path.join(dir, 'package.json');
        if (await FileUtils.fileExists(packageJsonPath)) {
          packageDirs.push(dir);
        }
      }

      return packageDirs;
    } catch (error) {
      console.error('Error finding package directories:', error);
      return [];
    }
  }
}

export function createDependencyFixAPI(config?: Partial<DependencyFixConfig>): DependencyFixAPI {
  return new DependencyFixAPI(config);
}

// 导出类型
export type { 
  DependencyFixConfig, 
  IntegrityReport, 
  RepairResult 
};

// 从其他模块导出类型
export type { FixOptions } from '../fixers';
export type { ReportOptions } from '../reporters';
export type { MonitoringEvent, PerformanceMetrics } from '../monitoring';