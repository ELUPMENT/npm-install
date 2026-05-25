import fs from 'fs';
import path from 'path';
import { FileUtils } from '../utils/file-utils';
import { NpmUtils } from '../utils/npm-utils';
import { getLogger } from '../utils/logger';
import { ConfigManager } from '../config/config';
import { PackageValidator } from '../validators/package-validator';
import { 
  NetworkError, 
  FileSystemError, 
  IntegrityError,
  DependencyError 
} from '../errors/errors';
import { RepairResult } from '../types';

export interface FixOptions {
  backupOriginal: boolean;
  forceReinstall: boolean;
  preserveLocalChanges: boolean;
  dryRun: boolean;
  registryUrl?: string;
}

export class PackageFixer {
  private npmUtils: NpmUtils;
  private validator: PackageValidator;
  private configManager: ConfigManager;
  private logger = getLogger();

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
    this.npmUtils = new NpmUtils({
      registryUrl: this.configManager.getConfig().registryUrl,
      timeout: this.configManager.getConfig().timeoutMs,
      maxRetries: this.configManager.getConfig().maxRetries
    });
    this.validator = new PackageValidator(this.npmUtils);
  }

  async fixPackage(
    packageDir: string,
    options: Partial<FixOptions> = {}
  ): Promise<RepairResult> {
    const fullOptions: FixOptions = {
      backupOriginal: options.backupOriginal ?? this.configManager.getConfig().enableBackup,
      forceReinstall: options.forceReinstall ?? false,
      preserveLocalChanges: options.preserveLocalChanges ?? true,
      dryRun: options.dryRun ?? false
    };

    this.logger.info(`Starting package fix for directory: ${packageDir}`, { options: fullOptions });

    const actionsTaken: string[] = [];
    const errors: string[] = [];
    let backupLocation: string | undefined;
    let newIntegrityScore = 0;

    try {
      if (!(await FileUtils.directoryExists(packageDir))) {
        throw new FileSystemError(`Package directory does not exist: ${packageDir}`);
      }

      const packageJsonPath = path.join(packageDir, 'package.json');
      if (!(await FileUtils.fileExists(packageJsonPath))) {
        throw new FileSystemError(`package.json not found in ${packageDir}`);
      }

      const packageJson = await FileUtils.readJsonFile<any>(packageJsonPath);
      const packageName = packageJson.name;
      const packageVersion = packageJson.version;

      if (!packageName || !packageVersion) {
        throw new IntegrityError('Invalid package.json: missing name or version');
      }

      this.logger.info(`Fixing package: ${packageName}@${packageVersion}`);

      const initialReport = await this.validator.validatePackage(packageDir);
      const initialIntegrity = initialReport.overallIntegrity;
      
      this.logger.info(`Initial integrity: ${initialIntegrity}%`);

      if (initialIntegrity >= 95 && !fullOptions.forceReinstall) {
        this.logger.info(`Package integrity is already high (${initialIntegrity}%). Skipping repair.`);
        return {
          success: true,
          packageName,
          packageVersion,
          actionsTaken: ['Package integrity already high, no repair needed'],
          errors: [],
          newIntegrityScore: initialIntegrity,
          timestamp: new Date()
        };
      }

      const criticalFailures = initialReport.validationResults.filter(
        r => !r.passed && ['package_json_exists', 'package_json_valid', 'npm_registry_check'].includes(r.ruleName)
      );

      if (criticalFailures.length > 0) {
        this.logger.warn(`Critical issues detected: ${criticalFailures.map(f => f.ruleName).join(', ')}`);
      }

      if (fullOptions.dryRun) {
        this.logger.info('Dry run mode - skipping actual fixes');
        return {
          success: true,
          packageName,
          packageVersion,
          actionsTaken: ['Dry run completed - no changes made'],
          errors: [],
          newIntegrityScore: initialIntegrity,
          timestamp: new Date()
        };
      }

      if (fullOptions.backupOriginal) {
        try {
          backupLocation = this.configManager.getBackupPath(packageName, packageVersion);
          await FileUtils.copyDirectory(packageDir, backupLocation);
          actionsTaken.push(`Created backup at ${backupLocation}`);
          this.logger.info(`Backup created at ${backupLocation}`);
        } catch (error) {
          errors.push(`Failed to create backup: ${error}`);
          this.logger.error('Failed to create backup', { error });
          if (!fullOptions.forceReinstall) {
            throw new FileSystemError(`Backup failed and forceReinstall is not enabled: ${error}`);
          }
        }
      }

      const missingFiles = initialReport.missingFiles;
      const npmFiles = await this.npmUtils.getPackageFileList(packageName, packageVersion);

      if (missingFiles.length === 0 && !fullOptions.forceReinstall) {
        this.logger.info('No missing files detected, skipping download');
      } else {
        const tempDir = path.join(this.configManager.getConfig().cachePath, 'temp-download', `${packageName}@${packageVersion}_${Date.now()}`);
        
        try {
          await FileUtils.ensureDirectoryExists(tempDir);

          this.logger.info(`Downloading package ${packageName}@${packageVersion} from npm registry`);
          const tarballPath = await this.npmUtils.downloadPackageTarball(packageName, packageVersion, tempDir);
          actionsTaken.push(`Downloaded package from npm registry`);

          const extractDir = path.join(tempDir, 'extracted');
          await this.npmUtils.extractTarball(tarballPath, extractDir);
          actionsTaken.push(`Extracted package tarball`);

          const extractedPackageDir = path.join(extractDir, 'package');
          if (!(await FileUtils.directoryExists(extractedPackageDir))) {
            throw new FileSystemError(`Extracted package directory not found in ${extractDir}`);
          }

          await this.mergePackageFiles(packageDir, extractedPackageDir, missingFiles, npmFiles, fullOptions.preserveLocalChanges);
          actionsTaken.push(`Merged package files`);

          await FileUtils.deleteDirectory(tempDir);
          this.logger.info(`Cleaned up temporary directory: ${tempDir}`);
        } catch (error) {
          errors.push(`Failed to download and merge package: ${error}`);
          this.logger.error('Failed to download and merge package', { error });
          
          if (fullOptions.forceReinstall) {
            this.logger.warn('Force reinstall failed, package may be partially corrupted');
          } else {
            throw new NetworkError(`Package download failed: ${error}`, packageName, packageVersion);
          }
        }
      }

      const finalReport = await this.validator.validatePackage(packageDir);
      newIntegrityScore = finalReport.overallIntegrity;
      actionsTaken.push(`Final integrity score: ${newIntegrityScore}%`);

      if (newIntegrityScore < initialIntegrity) {
        errors.push(`Package integrity decreased from ${initialIntegrity}% to ${newIntegrityScore}%`);
        this.logger.warn(`Package integrity decreased from ${initialIntegrity}% to ${newIntegrityScore}%`);
      } else if (newIntegrityScore > initialIntegrity) {
        this.logger.info(`Package integrity improved from ${initialIntegrity}% to ${newIntegrityScore}%`);
      } else {
        this.logger.info(`Package integrity unchanged: ${newIntegrityScore}%`);
      }

      if (errors.length > 0) {
        this.logger.warn(`Package fix completed with ${errors.length} errors`, { errors });
      } else {
        this.logger.info(`Package fix completed successfully for ${packageName}@${packageVersion}`);
      }

      return {
        success: errors.length === 0,
        packageName,
        packageVersion,
        actionsTaken,
        errors,
        backupLocation,
        newIntegrityScore,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof DependencyError ? error.message : String(error);
      this.logger.error(`Package fix failed for ${packageDir}`, { error: errorMessage });
      
      return {
        success: false,
        packageName: 'unknown',
        packageVersion: 'unknown',
        actionsTaken,
        errors: [...errors, errorMessage],
        backupLocation,
        newIntegrityScore: 0,
        timestamp: new Date()
      };
    }
  }

  private async mergePackageFiles(
    targetDir: string,
    sourceDir: string,
    missingFiles: string[],
    npmFiles: string[], // 这个参数暂时未使用，但保留接口
    preserveLocalChanges: boolean
  ): Promise<void> {
    this.logger.info(`Merging package files from ${sourceDir} to ${targetDir}`);

    const sourceFiles = await FileUtils.listFiles(sourceDir, true);
    const targetFiles = await FileUtils.listFiles(targetDir, true);

    const normalizedTargetFiles = targetFiles.map(f => FileUtils.normalizePath(path.relative(targetDir, f)));
    const normalizedSourceFiles = sourceFiles.map(f => FileUtils.normalizePath(path.relative(sourceDir, f)));

    for (const sourceFile of sourceFiles) {
      const relativePath = FileUtils.normalizePath(path.relative(sourceDir, sourceFile));
      const targetPath = path.join(targetDir, relativePath);

      if (preserveLocalChanges && normalizedTargetFiles.includes(relativePath)) {
        const isCriticalFile = this.isCriticalFile(relativePath);
        const isMissingFile = missingFiles.includes(relativePath);

        if (!isCriticalFile && !isMissingFile) {
          this.logger.debug(`Preserving local file: ${relativePath}`);
          continue;
        }
      }

      if (await FileUtils.fileExists(targetPath)) {
        const targetStats = await fs.promises.stat(targetPath);
        const sourceStats = await fs.promises.stat(sourceFile);

        if (targetStats.isDirectory() && sourceStats.isDirectory()) {
          continue;
        }

        if (!targetStats.isDirectory() && !sourceStats.isDirectory()) {
          if (preserveLocalChanges && !missingFiles.includes(relativePath) && !this.shouldOverwriteFile(relativePath)) {
            this.logger.debug(`Skipping file (preserve local changes): ${relativePath}`);
            continue;
          }
        }
      }

      await FileUtils.ensureDirectoryExists(path.dirname(targetPath));

      if ((await fs.promises.stat(sourceFile)).isDirectory()) {
        if (!(await FileUtils.directoryExists(targetPath))) {
          await fs.promises.mkdir(targetPath, { recursive: true });
        }
      } else {
        await FileUtils.copyFile(sourceFile, targetPath);
        this.logger.debug(`Copied file: ${relativePath}`);
      }
    }

    if (!preserveLocalChanges) {
      const filesToRemove = normalizedTargetFiles.filter(
        file => !normalizedSourceFiles.includes(file) && !this.isProtectedFile(file)
      );

      for (const file of filesToRemove) {
        const fullPath = path.join(targetDir, file);
        try {
          if (await FileUtils.fileExists(fullPath)) {
            await FileUtils.deleteFile(fullPath);
            this.logger.debug(`Removed extra file: ${file}`);
          } else if (await FileUtils.directoryExists(fullPath)) {
            await FileUtils.deleteDirectory(fullPath);
            this.logger.debug(`Removed extra directory: ${file}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to remove file ${file}: ${error}`);
        }
      }
    }
  }

  private isCriticalFile(filePath: string): boolean {
    const criticalFiles = [
      'package.json',
      'README.md',
      'LICENSE',
      'LICENSE.md',
      'LICENSE.txt',
      'CHANGELOG.md',
      'CHANGELOG',
      'AUTHORS',
      'CONTRIBUTORS'
    ];

    const criticalPatterns = [
      /^src\//,
      /^lib\//,
      /^dist\//,
      /^dist-.*\//,
      /^bin\//,
      /\.d\.ts$/,
      /\.js$/,
      /\.cjs$/,
      /\.mjs$/
    ];

    if (criticalFiles.includes(filePath)) {
      return true;
    }

    for (const pattern of criticalPatterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }

    return false;
  }

  private shouldOverwriteFile(filePath: string): boolean {
    const skipPatterns = [
      /^\.git\//,
      /^node_modules\//,
      /\.log$/,
      /\.tmp$/,
      /^tmp\//,
      /^temp\//,
      /\.swp$/,
      /\.swo$/,
      /~$/
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    return true;
  }

  private isProtectedFile(filePath: string): boolean {
    const protectedFiles = [
      '.gitignore',
      '.npmignore',
      '.gitattributes',
      '.editorconfig',
      '.eslintrc',
      '.prettierrc',
      '.prettierignore',
      '.eslintignore',
      '.git/'
    ];

    const protectedPatterns = [
      /^\.git\//,
      /^\.vscode\//,
      /^\.idea\//,
      /^node_modules\//,
      /^coverage\//,
      /^dist\//,
      /^build\//,
      /^\.env/,
      /\.local$/,
      /\.config\.js$/,
      /\.config\.json$/
    ];

    if (protectedFiles.includes(filePath)) {
      return true;
    }

    for (const pattern of protectedPatterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }

    return false;
  }

  async fixMultiplePackages(
    packageDirs: string[],
    options: Partial<FixOptions> = {}
  ): Promise<RepairResult[]> {
    const results: RepairResult[] = [];
    const config = this.configManager.getConfig();
    const maxConcurrent = options.dryRun ? 1 : config.maxConcurrentDownloads;

    const batches = [];
    for (let i = 0; i < packageDirs.length; i += maxConcurrent) {
      batches.push(packageDirs.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(dir => this.fixPackage(dir, options));
      const batchResults = await Promise.allSettled(batchPromises);

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const dir = batch[i];

        if (result.status === 'fulfilled') {
          results.push(result.value);
          this.logger.info(`Fix completed for ${dir}: ${result.value.success ? 'success' : 'failed'}`);
        } else {
          this.logger.error(`Fix failed for ${dir}:`, { error: result.reason });
          results.push({
            success: false,
            packageName: 'unknown',
            packageVersion: 'unknown',
            actionsTaken: [],
            errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
            newIntegrityScore: 0,
            timestamp: new Date()
          });
        }
      }
    }

    return results;
  }

  async rollbackFix(backupPath: string, targetDir: string): Promise<void> {
    this.logger.info(`Rolling back fix from backup: ${backupPath} to ${targetDir}`);

    if (!(await FileUtils.directoryExists(backupPath))) {
      throw new FileSystemError(`Backup directory does not exist: ${backupPath}`);
    }

    if (await FileUtils.directoryExists(targetDir)) {
      await FileUtils.deleteDirectory(targetDir);
    }

    await FileUtils.copyDirectory(backupPath, targetDir);
    this.logger.info(`Rollback completed successfully`);
  }
}