import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GlobExpander } from './glob-expander';

export interface PublishValidationResult {
  packageName: string;
  packageVersion: string;
  isComplete: boolean;
  score: number;
  checks: ValidationCheck[];
  issues: string[];
  recommendations: string[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export class PublishValidator {
  static validatePublishReadiness(
    packageDir: string
  ): PublishValidationResult {
    const packageJsonPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json not found in ${packageDir}`);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const packageName = packageJson.name || 'unknown';
    const packageVersion = packageJson.version || 'unknown';
    const checks: ValidationCheck[] = [];
    const issues: string[] = [];
    const recommendations: string[] = [];

    this.checkDirectoryIntegrity(packageDir, packageJson, checks, issues);
    this.checkEntryFiles(packageDir, packageJson, checks, issues);
    this.checkFilesFieldCoverage(packageDir, packageJson, checks, issues, recommendations);
    this.checkPackageSize(packageDir, packageJson, checks, issues);
    this.checkUnexpectedExclusions(packageDir, packageJson, checks, issues, recommendations);

    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;
    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    const isComplete = issues.length === 0;

    return {
      packageName,
      packageVersion,
      isComplete,
      score,
      checks,
      issues,
      recommendations
    };
  }

  private static checkDirectoryIntegrity(
    packageDir: string,
    packageJson: any,
    checks: ValidationCheck[],
    issues: string[]
  ): void {
    const filesField: string[] = packageJson.files || [];
    const expandedFiles = GlobExpander.expandFilesField(filesField, packageDir);

    const missingDirs: string[] = [];
    for (const entry of expandedFiles) {
      const normalizedEntry = entry.replace(/\/$/, '');
      const fullPath = path.join(packageDir, normalizedEntry);

      if (!fs.existsSync(fullPath)) {
        const stat = fs.statSync(path.dirname(fullPath), { throwIfNoEntry: false });
        if (stat && stat.isDirectory()) {
          missingDirs.push(entry);
        }
      }
    }

    if (missingDirs.length === 0) {
      checks.push({
        name: 'directory_integrity',
        passed: true,
        message: 'All directories in files field exist'
      });
    } else {
      checks.push({
        name: 'directory_integrity',
        passed: false,
        message: `Missing directories: ${missingDirs.join(', ')}`,
        details: { missingDirs }
      });
      issues.push(`Missing directories: ${missingDirs.join(', ')}`);
    }
  }

  private static checkEntryFiles(
    packageDir: string,
    packageJson: any,
    checks: ValidationCheck[],
    issues: string[]
  ): void {
    const entryFields = ['main', 'module', 'types', 'typings', 'browser'];
    const missingEntries: string[] = [];

    for (const field of entryFields) {
      if (packageJson[field]) {
        const entryPath = path.join(packageDir, packageJson[field]);
        if (!fs.existsSync(entryPath)) {
          missingEntries.push(`${field}: ${packageJson[field]}`);
        }
      }
    }

    if (missingEntries.length === 0) {
      checks.push({
        name: 'entry_files',
        passed: true,
        message: 'All entry point files exist'
      });
    } else {
      checks.push({
        name: 'entry_files',
        passed: false,
        message: `Missing entry files: ${missingEntries.join(', ')}`,
        details: { missingEntries }
      });
      issues.push(`Missing entry files: ${missingEntries.join(', ')}`);
    }
  }

  private static checkFilesFieldCoverage(
    packageDir: string,
    packageJson: any,
    checks: ValidationCheck[],
    issues: string[],
    recommendations: string[]
  ): void {
    const filesField: string[] = packageJson.files || [];

    if (filesField.length === 0) {
      checks.push({
        name: 'files_field_coverage',
        passed: true,
        message: 'No files field - all files will be included'
      });
      return;
    }

    const globResults = GlobExpander.getGlobOnlyEntries(filesField, packageDir);
    const incompleteGlobs = GlobExpander.getIncompleteGlobs(filesField, packageDir);

    if (globResults.length === 0) {
      checks.push({
        name: 'files_field_coverage',
        passed: true,
        message: 'No glob patterns in files field'
      });
      return;
    }

    if (incompleteGlobs.length > 0) {
      const globDetails = incompleteGlobs.map(g =>
        `"${g.original}" only matches [${g.matchedDirs.join(', ')}] but should also include other directories`
      ).join('; ');

      checks.push({
        name: 'files_field_coverage',
        passed: false,
        message: `Glob patterns in files field may not match all directories during npm publish`,
        details: { incompleteGlobs, globDetails }
      });
      issues.push('Glob patterns in files field may cause incomplete npm publish');

      recommendations.push(
        'Replace glob patterns in files field with explicit directory lists',
        `Example: Change ["dist-*/"] to [${incompleteGlobs.flatMap(g => g.expanded).map(e => `"${e}"`).join(', ')}]`
      );
    } else {
      checks.push({
        name: 'files_field_coverage',
        passed: true,
        message: `Glob patterns expand correctly (${globResults.length} patterns)`
      });
    }
  }

  private static checkPackageSize(
    packageDir: string,
    packageJson: any,
    checks: ValidationCheck[],
    issues: string[]
  ): void {
    try {
      const tarballOutput = execSync('npm pack --dry-run 2>&1', {
        cwd: packageDir,
        encoding: 'utf-8',
        timeout: 30000
      });

      const sizeMatch = tarballOutput.match(/package size:\s*([\d.]+\s*[kKMmGg]?B)/i);
      const fileCountMatch = tarballOutput.match(/total files:\s*(\d+)/i);

      if (sizeMatch && fileCountMatch) {
        const reportedSize = sizeMatch[1];
        const reportedFiles = parseInt(fileCountMatch[1], 10);

        const localFileCount = this.countLocalFiles(packageDir);

        if (reportedFiles < localFileCount * 0.5) {
          checks.push({
            name: 'package_size',
            passed: false,
            message: `Tarball has ${reportedFiles} files (${reportedSize}), but local has ${localFileCount} files - possible incomplete publish`,
            details: { reportedSize, reportedFiles, localFileCount }
          });
          issues.push(`Tarball file count (${reportedFiles}) is significantly less than local (${localFileCount})`);
        } else {
          checks.push({
            name: 'package_size',
            passed: true,
            message: `Tarball size: ${reportedSize}, ${reportedFiles} files`,
            details: { reportedSize, reportedFiles, localFileCount }
          });
        }
      } else {
        checks.push({
          name: 'package_size',
          passed: true,
          message: 'Could not parse npm pack output'
        });
      }
    } catch (error) {
      checks.push({
        name: 'package_size',
        passed: true,
        message: 'npm pack --dry-run failed (non-critical)',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  private static checkUnexpectedExclusions(
    packageDir: string,
    packageJson: any,
    checks: ValidationCheck[],
    issues: string[],
    recommendations: string[]
  ): void {
    const filesField: string[] = packageJson.files || [];

    if (filesField.length === 0) {
      checks.push({
        name: 'unexpected_exclusions',
        passed: true,
        message: 'No files field - no exclusion risk'
      });
      return;
    }

    const expandedFiles = GlobExpander.expandFilesField(filesField, packageDir);
    const localDirs = this.getLocalDirectories(packageDir);

    const coveredDirs = new Set<string>();
    for (const entry of expandedFiles) {
      const normalized = entry.replace(/\/$/, '');
      if (localDirs.includes(normalized)) {
        coveredDirs.add(normalized);
      }
    }

    const importantDirPatterns = ['dist', 'lib', 'src', 'bin', 'types'];
    const uncoveredImportant = localDirs.filter(dir => {
      if (coveredDirs.has(dir)) return false;
      return importantDirPatterns.some(pattern => dir.startsWith(pattern) || dir === pattern);
    });

    if (uncoveredImportant.length > 0) {
      checks.push({
        name: 'unexpected_exclusions',
        passed: false,
        message: `Important directories not covered by files field: ${uncoveredImportant.join(', ')}`,
        details: { uncoveredImportant }
      });
      issues.push(`Important directories excluded: ${uncoveredImportant.join(', ')}`);
      recommendations.push(
        `Add these directories to files field: ${uncoveredImportant.map(d => `"${d}/"`).join(', ')}`
      );
    } else {
      checks.push({
        name: 'unexpected_exclusions',
        passed: true,
        message: 'All important directories covered by files field'
      });
    }
  }

  private static countLocalFiles(dir: string): number {
    let count = 0;
    const items = fs.readdirSync(dir);

    for (const item of items) {
      if (item === 'node_modules' || item === '.git') continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        count += this.countLocalFiles(fullPath);
      } else {
        count++;
      }
    }

    return count;
  }

  private static getLocalDirectories(dir: string): string[] {
    const dirs: string[] = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
          dirs.push(item);
        }
      }
    } catch {}
    return dirs;
  }
}