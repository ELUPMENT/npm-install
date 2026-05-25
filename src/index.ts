// 避免循环引用，只导出类型和工厂函数
export { ConfigManager, createDefaultConfig, validateConfigPath } from './config';
export type { DependencyFixConfig } from './config';

export * from './errors';

export { FileUtils, NpmUtils, Logger, getLogger, setDefaultLogger } from './utils';
export type { LogLevel, LogEntry, LoggerConfig, NpmPackageInfo, NpmRegistryConfig } from './utils';

export { PackageValidator, ApiValidator } from './validators';
export type { ValidationRule, ValidationResult, IntegrityReport, ApiValidationOptions } from './validators';

export { PackageFixer } from './fixers';
export type { FixOptions, RepairResult } from './fixers';

export { ReportGenerator } from './reporters';
export type { ReportOptions } from './reporters';

export { DependencyMonitor, createMonitor, withMonitoring } from './monitoring';
export type { MonitoringEvent, PerformanceMetrics } from './monitoring';

export { createDependencyFixAPI } from './api';
export type { DependencyFixConfig as APIDependencyFixConfig } from './api';

export type {
  FileType,
  FileInfo,
  DependencyPackage,
  ValidationRule as ValidationRuleType,
  ValidationResult as ValidationResultType,
  IntegrityReport as IntegrityReportType,
  DownloadOptions,
  FixOptions as FixOptionsType,
  RepairResult as RepairResultType
} from './types';