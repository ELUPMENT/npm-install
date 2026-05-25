import fs from 'fs';
import path from 'path';
import { GlobExpander, GlobExpandResult } from './glob-expander';

export interface PackageJsonFixResult {
  packageName: string;
  packageVersion: string;
  originalFiles: string[];
  fixedFiles: string[];
  globResults: GlobExpandResult[];
  wasModified: boolean;
  backupPath: string | null;
  changes: string[];
}

export interface FixOptions {
  dryRun: boolean;
  createBackup: boolean;
  verifyAfterFix: boolean;
}

export class FilesFieldFixer {
  static fixPackageJson(
    packageDir: string,
    options: Partial<FixOptions> = {}
  ): PackageJsonFixResult {
    const fullOptions: FixOptions = {
      dryRun: options.dryRun ?? false,
      createBackup: options.createBackup ?? true,
      verifyAfterFix: options.verifyAfterFix ?? true
    };

    const packageJsonPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json not found in ${packageDir}`);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const packageName = packageJson.name || 'unknown';
    const packageVersion = packageJson.version || 'unknown';
    const originalFiles: string[] = packageJson.files || [];

    if (!Array.isArray(originalFiles) || originalFiles.length === 0) {
      return {
        packageName,
        packageVersion,
        originalFiles,
        fixedFiles: originalFiles,
        globResults: [],
        wasModified: false,
        backupPath: null,
        changes: ['No files field found or empty, nothing to fix']
      };
    }

    const globResults = GlobExpander.expandGlobPatterns(originalFiles, packageDir);
    const hasGlobs = globResults.some(r => r.isGlob);

    if (!hasGlobs) {
      return {
        packageName,
        packageVersion,
        originalFiles,
        fixedFiles: originalFiles,
        globResults,
        wasModified: false,
        backupPath: null,
        changes: ['No glob patterns found in files field, nothing to fix']
      };
    }

    const fixedFiles = GlobExpander.expandFilesField(originalFiles, packageDir);
    const wasModified = JSON.stringify(originalFiles) !== JSON.stringify(fixedFiles);

    if (!wasModified) {
      return {
        packageName,
        packageVersion,
        originalFiles,
        fixedFiles,
        globResults,
        wasModified: false,
        backupPath: null,
        changes: ['Glob patterns expanded but no changes needed']
      };
    }

    const changes: string[] = [];
    let backupPath: string | null = null;

    for (const result of globResults) {
      if (result.isGlob && result.matchedDirs.length > 0) {
        changes.push(
          `Expanded glob "${result.original}" → [${result.expanded.map(f => `"${f}"`).join(', ')}]`
        );
      }
    }

    if (fullOptions.dryRun) {
      changes.push('Dry run mode - no changes written');
      return {
        packageName,
        packageVersion,
        originalFiles,
        fixedFiles,
        globResults,
        wasModified: true,
        backupPath: null,
        changes
      };
    }

    if (fullOptions.createBackup) {
      backupPath = packageJsonPath + '.bak';
      fs.copyFileSync(packageJsonPath, backupPath);
      changes.push(`Backup created at ${backupPath}`);
    }

    packageJson.files = fixedFiles;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    changes.push(`Updated files field in package.json`);

    if (fullOptions.verifyAfterFix) {
      const verification = this.verifyFix(packageDir, originalFiles, fixedFiles);
      if (verification.success) {
        changes.push('Verification passed: all directories now accessible');
      } else {
        changes.push(`Verification warning: ${verification.issues.join(', ')}`);
      }
    }

    return {
      packageName,
      packageVersion,
      originalFiles,
      fixedFiles,
      globResults,
      wasModified: true,
      backupPath,
      changes
    };
  }

  private static verifyFix(
    packageDir: string,
    originalFiles: string[],
    fixedFiles: string[]
  ): { success: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const entry of fixedFiles) {
      const normalizedEntry = entry.replace(/\/$/, '');
      const fullPath = path.join(packageDir, normalizedEntry);

      if (!fs.existsSync(fullPath)) {
        const wasInOriginal = originalFiles.includes(entry);
        if (wasInOriginal) {
          issues.push(`Original entry "${entry}" not found on disk`);
        }
      }
    }

    return {
      success: issues.length === 0,
      issues
    };
  }

  static rollbackFix(backupPath: string, packageJsonPath: string): boolean {
    if (!fs.existsSync(backupPath)) {
      return false;
    }

    try {
      fs.copyFileSync(backupPath, packageJsonPath);
      fs.unlinkSync(backupPath);
      return true;
    } catch {
      return false;
    }
  }

  static fixMultiplePackages(
    packageDirs: string[],
    options: Partial<FixOptions> = {}
  ): PackageJsonFixResult[] {
    const results: PackageJsonFixResult[] = [];

    for (const dir of packageDirs) {
      try {
        const result = this.fixPackageJson(dir, options);
        results.push(result);
      } catch (error) {
        results.push({
          packageName: 'unknown',
          packageVersion: 'unknown',
          originalFiles: [],
          fixedFiles: [],
          globResults: [],
          wasModified: false,
          backupPath: null,
          changes: [`Error: ${error instanceof Error ? error.message : String(error)}`]
        });
      }
    }

    return results;
  }
}