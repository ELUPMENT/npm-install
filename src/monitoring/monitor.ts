import { getLogger, Logger, LoggerConfig } from '../utils/logger';
import { DependencyError } from '../errors/errors';
import { RepairResult, IntegrityReport } from '../types';

export interface MonitoringEvent {
  type: 'VALIDATION_STARTED' | 'VALIDATION_COMPLETED' | 
        'REPAIR_STARTED' | 'REPAIR_COMPLETED' | 
        'ERROR' | 'WARNING' | 'INFO';
  timestamp: Date;
  packageName?: string;
  packageVersion?: string;
  message: string;
  data?: Record<string, any>;
  error?: Error;
}

export interface PerformanceMetrics {
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  packagesProcessed: number;
  packagesSucceeded: number;
  packagesFailed: number;
  totalIntegrityScore: number;
  averageIntegrityScore: number;
  errors: string[];
  warnings: string[];
}

export class DependencyMonitor {
  private logger: Logger;
  private events: MonitoringEvent[] = [];
  private metrics: PerformanceMetrics;
  private isMonitoring = false;

  constructor(loggerConfig?: Partial<LoggerConfig>) {
    this.logger = getLogger(loggerConfig);
    this.metrics = this.createEmptyMetrics();
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      startTime: new Date(),
      packagesProcessed: 0,
      packagesSucceeded: 0,
      packagesFailed: 0,
      totalIntegrityScore: 0,
      averageIntegrityScore: 0,
      errors: [],
      warnings: []
    };
  }

  startMonitoring(): void {
    this.isMonitoring = true;
    this.metrics = this.createEmptyMetrics();
    this.events = [];
    
    this.logger.info('Dependency monitoring started');
    this.addEvent('INFO', 'Monitoring started');
  }

  stopMonitoring(): PerformanceMetrics {
    this.isMonitoring = false;
    this.metrics.endTime = new Date();
    this.metrics.durationMs = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
    
    if (this.metrics.packagesProcessed > 0) {
      this.metrics.averageIntegrityScore = Math.round(
        this.metrics.totalIntegrityScore / this.metrics.packagesProcessed
      );
    }

    this.logger.info('Dependency monitoring stopped', {
      durationMs: this.metrics.durationMs,
      packagesProcessed: this.metrics.packagesProcessed,
      packagesSucceeded: this.metrics.packagesSucceeded,
      packagesFailed: this.metrics.packagesFailed,
      averageIntegrityScore: this.metrics.averageIntegrityScore
    });

    this.addEvent('INFO', 'Monitoring stopped', {
      durationMs: this.metrics.durationMs,
      packagesProcessed: this.metrics.packagesProcessed
    });

    return { ...this.metrics };
  }

  recordValidationStart(packageName: string, packageVersion: string): void {
    if (!this.isMonitoring) return;

    this.addEvent('VALIDATION_STARTED', `Validation started for ${packageName}@${packageVersion}`, {
      packageName,
      packageVersion
    });

    this.logger.info(`Validation started for ${packageName}@${packageVersion}`);
  }

  recordValidationComplete(
    packageName: string, 
    packageVersion: string, 
    report: IntegrityReport
  ): void {
    if (!this.isMonitoring) return;

    this.metrics.packagesProcessed++;
    this.metrics.totalIntegrityScore += report.overallIntegrity;

    this.addEvent('VALIDATION_COMPLETED', `Validation completed for ${packageName}@${packageVersion}`, {
      packageName,
      packageVersion,
      integrityScore: report.overallIntegrity,
      passedRules: report.validationResults.filter(r => r.passed).length,
      failedRules: report.validationResults.filter(r => !r.passed).length,
      missingFiles: report.missingFiles.length,
      extraFiles: report.extraFiles.length
    });

    this.logger.info(`Validation completed for ${packageName}@${packageVersion}`, {
      integrityScore: report.overallIntegrity,
      passedRules: report.validationResults.filter(r => r.passed).length,
      failedRules: report.validationResults.filter(r => !r.passed).length
    });

    if (report.overallIntegrity < 80) {
      this.metrics.warnings.push(
        `Low integrity for ${packageName}@${packageVersion}: ${report.overallIntegrity}%`
      );
      this.addEvent('WARNING', `Low integrity for ${packageName}@${packageVersion}`, {
        packageName,
        packageVersion,
        integrityScore: report.overallIntegrity
      });
    }
  }

  recordRepairStart(packageName: string, packageVersion: string): void {
    if (!this.isMonitoring) return;

    this.addEvent('REPAIR_STARTED', `Repair started for ${packageName}@${packageVersion}`, {
      packageName,
      packageVersion
    });

    this.logger.info(`Repair started for ${packageName}@${packageVersion}`);
  }

  recordRepairComplete(result: RepairResult): void {
    if (!this.isMonitoring) return;

    if (result.success) {
      this.metrics.packagesSucceeded++;
      this.addEvent('REPAIR_COMPLETED', `Repair completed successfully for ${result.packageName}@${result.packageVersion}`, {
        packageName: result.packageName,
        packageVersion: result.packageVersion,
        integrityScore: result.newIntegrityScore,
        actionsTaken: result.actionsTaken.length
      });

      this.logger.info(`Repair completed successfully for ${result.packageName}@${result.packageVersion}`, {
        integrityScore: result.newIntegrityScore,
        actionsTaken: result.actionsTaken
      });
    } else {
      this.metrics.packagesFailed++;
      this.metrics.errors.push(
        `Repair failed for ${result.packageName}@${result.packageVersion}: ${result.errors.join(', ')}`
      );

      this.addEvent('ERROR', `Repair failed for ${result.packageName}@${result.packageVersion}`, {
        packageName: result.packageName,
        packageVersion: result.packageVersion,
        errors: result.errors
      });

      this.logger.error(`Repair failed for ${result.packageName}@${result.packageVersion}`, {
        errors: result.errors
      });
    }
  }

  recordError(error: Error, context?: Record<string, any>): void {
    if (!this.isMonitoring) return;

    const errorMessage = error instanceof DependencyError 
      ? `${error.code}: ${error.message}`
      : error.message;

    this.metrics.errors.push(errorMessage);

    this.addEvent('ERROR', errorMessage, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...context
    });

    this.logger.error(errorMessage, { error, ...context });
  }

  recordWarning(message: string, context?: Record<string, any>): void {
    if (!this.isMonitoring) return;

    this.metrics.warnings.push(message);

    this.addEvent('WARNING', message, context);

    this.logger.warn(message, context);
  }

  recordInfo(message: string, context?: Record<string, any>): void {
    if (!this.isMonitoring) return;

    this.addEvent('INFO', message, context);

    this.logger.info(message, context);
  }

  getEvents(filter?: {
    type?: MonitoringEvent['type'];
    packageName?: string;
    startTime?: Date;
    endTime?: Date;
  }): MonitoringEvent[] {
    let filteredEvents = [...this.events];

    if (filter) {
      if (filter.type) {
        filteredEvents = filteredEvents.filter(event => event.type === filter.type);
      }
      if (filter.packageName) {
        filteredEvents = filteredEvents.filter(event => event.packageName === filter.packageName);
      }
      if (filter.startTime) {
        filteredEvents = filteredEvents.filter(event => event.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filteredEvents = filteredEvents.filter(event => event.timestamp <= filter.endTime!);
      }
    }

    return filteredEvents;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  clearEvents(): void {
    this.events = [];
    this.logger.info('Monitoring events cleared');
  }

  getEventStats(): {
    total: number;
    byType: Record<string, number>;
    byPackage: Record<string, number>;
    errorCount: number;
    warningCount: number;
  } {
    const byType: Record<string, number> = {};
    const byPackage: Record<string, number> = {};
    let errorCount = 0;
    let warningCount = 0;

    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;

      if (event.packageName) {
        const key = `${event.packageName}@${event.packageVersion || 'unknown'}`;
        byPackage[key] = (byPackage[key] || 0) + 1;
      }

      if (event.type === 'ERROR') errorCount++;
      if (event.type === 'WARNING') warningCount++;
    }

    return {
      total: this.events.length,
      byType,
      byPackage,
      errorCount,
      warningCount
    };
  }

  generateReport(): {
    metrics: PerformanceMetrics;
    eventStats: ReturnType<DependencyMonitor['getEventStats']>;
    recentEvents: MonitoringEvent[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const eventStats = this.getEventStats();
    const recentEvents = this.events.slice(-50);
    const recommendations = this.generateRecommendations();

    return {
      metrics,
      eventStats,
      recentEvents,
      recommendations
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.errors.length > 0) {
      const errorRate = this.metrics.packagesProcessed > 0 
        ? (this.metrics.errors.length / this.metrics.packagesProcessed) * 100 
        : 0;
      
      if (errorRate > 10) {
        recommendations.push('High error rate detected. Consider checking network connectivity and registry configuration.');
      }
    }

    if (this.metrics.averageIntegrityScore < 80) {
      recommendations.push('Low average package integrity. Consider running repair on all packages.');
    }

    if (this.metrics.packagesFailed > 0) {
      recommendations.push('Some packages failed repair. Check error logs for details.');
    }

    if (this.metrics.warnings.length > 0) {
      recommendations.push('Multiple warnings detected. Review warning messages for potential issues.');
    }

    const eventStats = this.getEventStats();
    if (eventStats.errorCount > eventStats.warningCount) {
      recommendations.push('More errors than warnings. Focus on resolving critical issues first.');
    }

    return recommendations;
  }

  private addEvent(
    type: MonitoringEvent['type'],
    message: string,
    data?: Record<string, any>
  ): void {
    const event: MonitoringEvent = {
      type,
      timestamp: new Date(),
      message,
      data
    };

    this.events.push(event);

    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
  }
}

export function createMonitor(loggerConfig?: Partial<LoggerConfig>): DependencyMonitor {
  return new DependencyMonitor(loggerConfig);
}

export function withMonitoring<T extends any[], R>(
  monitor: DependencyMonitor,
  operation: string,
  fn: (...args: T) => Promise<R>,
  context?: Record<string, any>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    monitor.recordInfo(`${operation} started`, context);

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      monitor.recordInfo(`${operation} completed successfully`, {
        ...context,
        durationMs: duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      monitor.recordError(error instanceof Error ? error : new Error(String(error)), {
        ...context,
        durationMs: duration,
        operation
      });

      throw error;
    }
  };
}