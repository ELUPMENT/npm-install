export type FileType = 'FILE' | 'DIRECTORY' | 'SYMLINK';

export interface FileInfo {
  path: string;
  name: string;
  type: FileType;
  size: number;
  modified: Date;
  permissions: string;
}

export interface DependencyPackage {
  name: string;
  version: string;
  location: string;
  integrity: boolean;
  missingFiles: string[];
  extraFiles: string[];
  packageJson: Record<string, any>;
  lastChecked: Date;
}

export interface ValidationRule {
  name: string;
  description: string;
  check: (fileInfo: FileInfo) => boolean | Promise<boolean>;
  weight: number;
}

export interface ValidationResult {
  ruleName: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface IntegrityReport {
  packageName: string;
  packageVersion: string;
  overallIntegrity: number;
  validationResults: ValidationResult[];
  missingFiles: string[];
  extraFiles: string[];
  recommendations: string[];
  timestamp: Date;
}

export interface DownloadOptions {
  registryUrl: string;
  timeout: number;
  retryCount: number;
  useCache: boolean;
  verifyIntegrity: boolean;
}

export interface FixOptions {
  backupOriginal: boolean;
  forceReinstall: boolean;
  preserveLocalChanges: boolean;
  dryRun: boolean;
}

export interface RepairResult {
  success: boolean;
  packageName: string;
  packageVersion: string;
  actionsTaken: string[];
  errors: string[];
  backupLocation?: string;
  newIntegrityScore: number;
  timestamp: Date;
}