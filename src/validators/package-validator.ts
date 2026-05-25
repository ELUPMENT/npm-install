import fs from 'fs';
import path from 'path';
import { FileUtils } from '../utils/file-utils';
import { NpmUtils, NpmPackageInfo } from '../utils/npm-utils';
import { 
  ValidationRule, 
  ValidationResult, 
  IntegrityReport
} from '../types';
import { getLogger } from '../utils/logger';
import { IntegrityError } from '../errors/errors';

export class PackageValidator {
  private npmUtils: NpmUtils;
  private logger = getLogger();

  constructor(npmUtils?: NpmUtils) {
    this.npmUtils = npmUtils || new NpmUtils();
  }

  private getStandardRules(): ValidationRule[] {
    return [
      {
        name: 'package_json_exists',
        description: 'Check if package.json exists',
        check: async (fileInfo) => {
          const packageJsonPath = path.join(fileInfo.path, 'package.json');
          return await FileUtils.fileExists(packageJsonPath);
        },
        weight: 10
      },
      {
        name: 'package_json_valid',
        description: 'Check if package.json is valid JSON',
        check: async (fileInfo) => {
          const packageJsonPath = path.join(fileInfo.path, 'package.json');
          try {
            const content = await FileUtils.readJsonFile(packageJsonPath);
            return typeof content === 'object' && content !== null;
          } catch {
            return false;
          }
        },
        weight: 10
      },
      {
        name: 'has_main_entry',
        description: 'Check if package has main entry point',
        check: async (fileInfo) => {
          const packageJsonPath = path.join(fileInfo.path, 'package.json');
          try {
            const pkg = await FileUtils.readJsonFile<any>(packageJsonPath);
            return !!pkg.main;
          } catch {
            return false;
          }
        },
        weight: 5
      },
      {
        name: 'has_readme',
        description: 'Check if README file exists',
        check: async (fileInfo) => {
          const readmePatterns = ['README.md', 'README', 'README.txt'];
          for (const pattern of readmePatterns) {
            const readmePath = path.join(fileInfo.path, pattern);
            if (await FileUtils.fileExists(readmePath)) {
              return true;
            }
          }
          return false;
        },
        weight: 3
      },
      {
        name: 'has_license',
        description: 'Check if LICENSE file exists',
        check: async (fileInfo) => {
          const licensePatterns = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
          for (const pattern of licensePatterns) {
            const licensePath = path.join(fileInfo.path, pattern);
            if (await FileUtils.fileExists(licensePath)) {
              return true;
            }
          }
          return false;
        },
        weight: 3
      },
      {
        name: 'has_source_code',
        description: 'Check if source code directories exist',
        check: async (fileInfo) => {
          const sourceDirs = ['src', 'lib', 'source', 'source-code'];
          for (const dir of sourceDirs) {
            const sourceDir = path.join(fileInfo.path, dir);
            if (await FileUtils.directoryExists(sourceDir)) {
              return true;
            }
          }
          return false;
        },
        weight: 8
      },
      {
        name: 'has_tests',
        description: 'Check if test directories exist',
        check: async (fileInfo) => {
          const testDirs = ['test', '__tests__', 'tests', 'spec'];
          for (const dir of testDirs) {
            const testDir = path.join(fileInfo.path, dir);
            if (await FileUtils.directoryExists(testDir)) {
              return true;
            }
          }
          return false;
        },
        weight: 5
      },
      {
        name: 'has_build_config',
        description: 'Check if build configuration files exist',
        check: async (fileInfo) => {
          const buildFiles = ['tsconfig.json', 'webpack.config.js', 'rollup.config.js', 'vite.config.js', 'jest.config.js'];
          for (const file of buildFiles) {
            const configPath = path.join(fileInfo.path, file);
            if (await FileUtils.fileExists(configPath)) {
              return true;
            }
          }
          return false;
        },
        weight: 4
      },
      {
        name: 'files_match_package_json',
        description: 'Check if files in package.json exist',
        check: async (fileInfo) => {
          const packageJsonPath = path.join(fileInfo.path, 'package.json');
          try {
            const pkg = await FileUtils.readJsonFile<any>(packageJsonPath);
            
            if (!pkg.files || !Array.isArray(pkg.files)) {
              return true;
            }

            const requiredFiles = [
              ...pkg.files,
              pkg.main,
              pkg.types,
              pkg.module,
              ...(pkg.bin ? Object.values(pkg.bin) : [])
            ].filter(Boolean);

            for (const file of requiredFiles) {
              const filePath = path.join(fileInfo.path, file);
              if (!(await FileUtils.fileExists(filePath)) && !(await FileUtils.directoryExists(filePath))) {
                this.logger.warn(`Missing file in package ${pkg.name}: ${file}`);
                return false;
              }
            }
            return true;
          } catch {
            return false;
          }
        },
        weight: 7
      },
      {
        name: 'no_symlinks',
        description: 'Check for broken symlinks',
        check: async (fileInfo) => {
          try {
            const files = await FileUtils.listFiles(fileInfo.path, true);
            for (const file of files) {
              if (await FileUtils.isSymbolicLink(file)) {
                try {
                  await fs.promises.stat(file);
                } catch {
                  this.logger.warn(`Broken symlink found: ${file}`);
                  return false;
                }
              }
            }
            return true;
          } catch {
            return false;
          }
        },
        weight: 3
      }
    ];
  }

  private async checkAgainstNpmRegistry(packageDir: string, packageName: string, version: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      const npmInfo = await this.npmUtils.getPackageInfo(packageName, version);
      const localPackageJsonPath = path.join(packageDir, 'package.json');
      
      if (await FileUtils.fileExists(localPackageJsonPath)) {
        const localPkg = await FileUtils.readJsonFile<any>(localPackageJsonPath);
        
        results.push({
          ruleName: 'version_match',
          passed: localPkg.version === npmInfo.version,
          message: localPkg.version === npmInfo.version 
            ? `Version matches npm registry (${npmInfo.version})`
            : `Version mismatch: local=${localPkg.version}, npm=${npmInfo.version}`
        });

        results.push({
          ruleName: 'name_match',
          passed: localPkg.name === npmInfo.name,
          message: localPkg.name === npmInfo.name
            ? `Package name matches npm registry`
            : `Package name mismatch: local=${localPkg.name}, npm=${npmInfo.name}`
        });

        const npmFiles = await this.npmUtils.getPackageFileList(packageName, version);
        const localFiles = await FileUtils.listFiles(packageDir, false);
        const normalizedLocalFiles = localFiles.map(f => path.relative(packageDir, f));

        const missingFiles = npmFiles.filter(file => !normalizedLocalFiles.includes(file));
        const extraFiles = normalizedLocalFiles.filter(file => !npmFiles.includes(file));

        if (missingFiles.length > 0) {
          results.push({
            ruleName: 'npm_files_completeness',
            passed: false,
            message: `Missing ${missingFiles.length} files compared to npm registry`,
            details: { missingFiles }
          });
        } else {
          results.push({
            ruleName: 'npm_files_completeness',
            passed: true,
            message: 'All npm registry files are present'
          });
        }

        if (extraFiles.length > 0) {
          results.push({
            ruleName: 'extra_files_present',
            passed: true,
            message: `Found ${extraFiles.length} extra files not in npm registry`,
            details: { extraFiles }
          });
        }
      }
    } catch (error) {
      results.push({
        ruleName: 'npm_registry_check',
        passed: false,
        message: `Failed to check against npm registry: ${error}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }

    return results;
  }

  async validatePackage(packageDir: string): Promise<IntegrityReport> {
    this.logger.info(`Validating package at ${packageDir}`);

    const validationResults: ValidationResult[] = [];
    let packageName = 'unknown';
    let packageVersion = 'unknown';

    try {
      const packageJsonPath = path.join(packageDir, 'package.json');
      if (await FileUtils.fileExists(packageJsonPath)) {
        const pkg = await FileUtils.readJsonFile<any>(packageJsonPath);
        packageName = pkg.name || 'unknown';
        packageVersion = pkg.version || 'unknown';
      }

      const standardRules = this.getStandardRules();
      const fileInfo = await FileUtils.getFileInfo(packageDir);

      for (const rule of standardRules) {
        try {
          const passed = await rule.check(fileInfo);
          validationResults.push({
            ruleName: rule.name,
            passed,
            message: passed 
              ? `${rule.description} - Passed`
              : `${rule.description} - Failed`
          });
        } catch (error) {
          validationResults.push({
            ruleName: rule.name,
            passed: false,
            message: `${rule.description} - Error: ${error}`,
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      }

      const npmResults = await this.checkAgainstNpmRegistry(packageDir, packageName, packageVersion);
      validationResults.push(...npmResults);

      const passedRules = validationResults.filter(r => r.passed).length;
      const totalRules = validationResults.length;
      const overallIntegrity = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 0;

      const missingFiles: string[] = [];
      const extraFiles: string[] = [];

      validationResults.forEach(result => {
        if (result.details?.missingFiles) {
          missingFiles.push(...result.details.missingFiles);
        }
        if (result.details?.extraFiles) {
          extraFiles.push(...result.details.extraFiles);
        }
      });

      const recommendations: string[] = [];
      const failedRules = validationResults.filter(r => !r.passed);

      if (failedRules.length > 0) {
        if (failedRules.some(r => r.ruleName === 'package_json_exists' || r.ruleName === 'package_json_valid')) {
          recommendations.push('Package.json is missing or invalid. This is a critical issue.');
        }
        if (failedRules.some(r => r.ruleName === 'npm_files_completeness')) {
          recommendations.push('Package is missing files compared to npm registry. Consider re-downloading.');
        }
        if (failedRules.some(r => r.ruleName === 'has_source_code')) {
          recommendations.push('Source code directories are missing. This may affect debugging and development.');
        }
        if (failedRules.some(r => r.ruleName === 'has_tests')) {
          recommendations.push('Test directories are missing. Unable to verify package functionality.');
        }
      }

      if (overallIntegrity < 80) {
        recommendations.push('Package integrity is low. Consider using the repair tool to fix issues.');
      }

      const report: IntegrityReport = {
        packageName,
        packageVersion,
        overallIntegrity,
        validationResults,
        missingFiles: Array.from(new Set(missingFiles)),
        extraFiles: Array.from(new Set(extraFiles)),
        recommendations,
        timestamp: new Date()
      };

      this.logger.info(`Validation completed for ${packageName}@${packageVersion}: ${overallIntegrity}% integrity`);
      return report;

    } catch (error) {
      this.logger.error(`Failed to validate package at ${packageDir}`, { error });
      throw new IntegrityError(`Package validation failed: ${error}`, packageName, packageVersion);
    }
  }

  async validateMultiplePackages(packageDirs: string[]): Promise<IntegrityReport[]> {
    const reports: IntegrityReport[] = [];

    for (const dir of packageDirs) {
      try {
        const report = await this.validatePackage(dir);
        reports.push(report);
      } catch (error) {
        this.logger.error(`Failed to validate package at ${dir}`, { error });
        reports.push({
          packageName: 'unknown',
          packageVersion: 'unknown',
          overallIntegrity: 0,
          validationResults: [{
            ruleName: 'validation_error',
            passed: false,
            message: `Failed to validate package: ${error}`,
            details: { error: error instanceof Error ? error.message : String(error) }
          }],
          missingFiles: [],
          extraFiles: [],
          recommendations: ['Package validation failed completely'],
          timestamp: new Date()
        });
      }
    }

    return reports;
  }

  async generateValidationSummary(reports: IntegrityReport[]): Promise<{
    totalPackages: number;
    averageIntegrity: number;
    packagesByIntegrity: Record<string, number>;
    criticalIssues: number;
    recommendations: string[];
  }> {
    const totalPackages = reports.length;
    const totalIntegrity = reports.reduce((sum, report) => sum + report.overallIntegrity, 0);
    const averageIntegrity = totalPackages > 0 ? Math.round(totalIntegrity / totalPackages) : 0;

    const packagesByIntegrity: Record<string, number> = {
      '0-49': 0,
      '50-79': 0,
      '80-95': 0,
      '96-100': 0
    };

    for (const report of reports) {
      if (report.overallIntegrity < 50) {
        packagesByIntegrity['0-49']++;
      } else if (report.overallIntegrity < 80) {
        packagesByIntegrity['50-79']++;
      } else if (report.overallIntegrity < 96) {
        packagesByIntegrity['80-95']++;
      } else {
        packagesByIntegrity['96-100']++;
      }
    }

    const criticalIssues = reports.filter(report => 
      report.validationResults.some(r => 
        !r.passed && ['package_json_exists', 'package_json_valid', 'npm_registry_check'].includes(r.ruleName)
      )
    ).length;

    const allRecommendations = reports.flatMap(report => report.recommendations);
    const uniqueRecommendations = Array.from(new Set(allRecommendations));

    return {
      totalPackages,
      averageIntegrity,
      packagesByIntegrity,
      criticalIssues,
      recommendations: uniqueRecommendations
    };
  }
}