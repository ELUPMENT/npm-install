import fs from 'fs';
import path from 'path';
import { FileUtils } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { ValidationResult } from '../types';
import { ValidationError } from '../errors/errors';

export interface ApiValidationOptions {
  checkExports: boolean;
  checkTypes: boolean;
  checkRuntime: boolean;
  timeoutMs: number;
}

export class ApiValidator {
  private logger = getLogger();

  async validatePackageApi(
    packageDir: string,
    options: Partial<ApiValidationOptions> = {}
  ): Promise<ValidationResult[]> {
    const fullOptions: ApiValidationOptions = {
      checkExports: options.checkExports ?? true,
      checkTypes: options.checkTypes ?? true,
      checkRuntime: options.checkRuntime ?? true,
      timeoutMs: options.timeoutMs ?? 10000
    };

    this.logger.info(`Validating package API for ${packageDir}`, { options: fullOptions });

    const results: ValidationResult[] = [];

    try {
      const packageJsonPath = path.join(packageDir, 'package.json');
      if (!(await FileUtils.fileExists(packageJsonPath))) {
        throw new ValidationError('package.json not found');
      }

      const packageJson = await FileUtils.readJsonFile<any>(packageJsonPath);

      if (fullOptions.checkExports) {
        const exportResults = await this.validateExports(packageDir, packageJson);
        results.push(...exportResults);
      }

      if (fullOptions.checkTypes) {
        const typeResults = await this.validateTypes(packageDir, packageJson);
        results.push(...typeResults);
      }

      if (fullOptions.checkRuntime) {
        const runtimeResults = await this.validateRuntime(packageDir, packageJson);
        results.push(...runtimeResults);
      }

    } catch (error) {
      results.push({
        ruleName: 'api_validation_error',
        passed: false,
        message: `API validation failed: ${error}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }

    return results;
  }

  private async validateExports(packageDir: string, packageJson: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const exportKeys = ['main', 'module', 'browser', 'types', 'typings', 'exports'];
    const exportFiles = new Set<string>();

    for (const key of exportKeys) {
      if (packageJson[key]) {
        const exportValue = packageJson[key];
        
        if (typeof exportValue === 'string') {
          exportFiles.add(exportValue);
        } else if (typeof exportValue === 'object') {
          this.collectExportPaths(exportValue, exportFiles);
        }
      }
    }

    for (const exportFile of exportFiles) {
      const exportPath = path.join(packageDir, exportFile);
      const exists = await FileUtils.fileExists(exportPath);

      results.push({
        ruleName: `export_${exportFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
        passed: exists,
        message: exists 
          ? `Export file exists: ${exportFile}`
          : `Export file missing: ${exportFile}`,
        details: { exportFile, exists }
      });
    }

    if (exportFiles.size === 0) {
      results.push({
        ruleName: 'no_exports_defined',
        passed: false,
        message: 'No exports defined in package.json',
        details: { exportKeys }
      });
    }

    return results;
  }

  private collectExportPaths(exportObj: any, exportFiles: Set<string>): void {
    if (typeof exportObj === 'string') {
      exportFiles.add(exportObj);
    } else if (typeof exportObj === 'object' && exportObj !== null) {
      for (const value of Object.values(exportObj)) {
        if (typeof value === 'string') {
          exportFiles.add(value);
        } else if (typeof value === 'object' && value !== null) {
          this.collectExportPaths(value, exportFiles);
        }
      }
    }
  }

  private async validateTypes(packageDir: string, packageJson: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const typeFiles = new Set<string>();

    if (packageJson.types || packageJson.typings) {
      const typeFile = packageJson.types || packageJson.typings;
      typeFiles.add(typeFile);
    }

    if (packageJson.exports) {
      this.collectTypeExports(packageJson.exports, typeFiles);
    }

    for (const typeFile of typeFiles) {
      const typePath = path.join(packageDir, typeFile);
      const exists = await FileUtils.fileExists(typePath);

      results.push({
        ruleName: `type_file_${typeFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
        passed: exists,
        message: exists
          ? `Type definition file exists: ${typeFile}`
          : `Type definition file missing: ${typeFile}`,
        details: { typeFile, exists }
      });

      if (exists) {
        const content = await fs.promises.readFile(typePath, 'utf-8').catch(() => '');
        const hasTypeDeclarations = content.includes('declare') || content.includes('export') || content.includes('interface');

        results.push({
          ruleName: `type_file_valid_${typeFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
          passed: hasTypeDeclarations,
          message: hasTypeDeclarations
            ? `Type definition file contains valid declarations: ${typeFile}`
            : `Type definition file appears empty or invalid: ${typeFile}`,
          details: { typeFile, hasTypeDeclarations }
        });
      }
    }

    const dtsFiles = await this.findFilesByPattern(packageDir, /\.d\.ts$/);
    if (dtsFiles.length > 0) {
      results.push({
        ruleName: 'has_type_declarations',
        passed: true,
        message: `Found ${dtsFiles.length} .d.ts files`,
        details: { dtsFiles: dtsFiles.map(f => path.relative(packageDir, f)) }
      });
    }

    return results;
  }

  private collectTypeExports(exportsObj: any, typeFiles: Set<string>): void {
    if (typeof exportsObj === 'string') {
      return;
    }

    if (typeof exportsObj === 'object' && exportsObj !== null) {
      for (const [key, value] of Object.entries(exportsObj)) {
        if (key === 'types' || key === 'typings') {
          if (typeof value === 'string') {
            typeFiles.add(value);
          }
        } else if (typeof value === 'object' && value !== null) {
          this.collectTypeExports(value, typeFiles);
        }
      }
    }
  }

  private async validateRuntime(packageDir: string, packageJson: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const mainEntry = packageJson.main || 'index.js';
    const mainPath = path.join(packageDir, mainEntry);

    const mainExists = await FileUtils.fileExists(mainPath);
    results.push({
      ruleName: 'main_entry_exists',
      passed: mainExists,
      message: mainExists
        ? `Main entry point exists: ${mainEntry}`
        : `Main entry point missing: ${mainEntry}`,
      details: { mainEntry, exists: mainExists }
    });

    if (mainExists) {
      try {
        const content = await fs.promises.readFile(mainPath, 'utf-8');
        const isExecutable = content.trim().length > 0;
        const hasExports = content.includes('module.exports') || content.includes('export') || content.includes('export default');

        results.push({
          ruleName: 'main_entry_valid',
          passed: isExecutable && hasExports,
          message: isExecutable && hasExports
            ? `Main entry point is valid JavaScript/TypeScript`
            : `Main entry point may be invalid: ${!isExecutable ? 'empty file' : 'no exports found'}`,
          details: { isExecutable, hasExports }
        });
      } catch (error) {
        results.push({
          ruleName: 'main_entry_read_error',
          passed: false,
          message: `Failed to read main entry point: ${error}`,
          details: { error: error instanceof Error ? error.message : String(error) }
        });
      }
    }

    const jsFiles = await this.findFilesByPattern(packageDir, /\.(js|mjs|cjs)$/);
    const hasJsFiles = jsFiles.length > 0;
    results.push({
      ruleName: 'has_javascript_files',
      passed: hasJsFiles,
      message: hasJsFiles
        ? `Found ${jsFiles.length} JavaScript files`
        : 'No JavaScript files found',
      details: { jsFileCount: jsFiles.length }
    });

    if (packageJson.bin) {
      const binResults = await this.validateBinFiles(packageDir, packageJson.bin);
      results.push(...binResults);
    }

    const requireResults = await this.validateRequireStatements(packageDir);
    results.push(...requireResults);

    return results;
  }

  private async validateBinFiles(packageDir: string, binConfig: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (typeof binConfig === 'string') {
      const binPath = path.join(packageDir, binConfig);
      const exists = await FileUtils.fileExists(binPath);

      results.push({
        ruleName: 'bin_file_exists',
        passed: exists,
        message: exists
          ? `Binary file exists: ${binConfig}`
          : `Binary file missing: ${binConfig}`,
        details: { binFile: binConfig, exists }
      });

      if (exists) {
        const isExecutable = await this.checkFileExecutable(binPath);
        results.push({
          ruleName: 'bin_file_executable',
          passed: isExecutable,
          message: isExecutable
            ? `Binary file is executable: ${binConfig}`
            : `Binary file is not executable: ${binConfig}`,
          details: { binFile: binConfig, isExecutable }
        });
      }
    } else if (typeof binConfig === 'object') {
      for (const [binName, binPath] of Object.entries(binConfig)) {
        const fullPath = path.join(packageDir, binPath as string);
        const exists = await FileUtils.fileExists(fullPath);

        results.push({
          ruleName: `bin_${binName}_exists`,
          passed: exists,
          message: exists
            ? `Binary file exists: ${binName} -> ${binPath}`
            : `Binary file missing: ${binName} -> ${binPath}`,
          details: { binName, binPath, exists }
        });

        if (exists) {
          const isExecutable = await this.checkFileExecutable(fullPath);
          results.push({
            ruleName: `bin_${binName}_executable`,
            passed: isExecutable,
            message: isExecutable
              ? `Binary file is executable: ${binName}`
              : `Binary file is not executable: ${binName}`,
            details: { binName, isExecutable }
          });
        }
      }
    }

    return results;
  }

  private async checkFileExecutable(filePath: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content.startsWith('#!/');
    } catch {
      return false;
    }
  }

  private async validateRequireStatements(packageDir: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const jsFiles = await this.findFilesByPattern(packageDir, /\.(js|mjs|cjs)$/);

    const unresolvedRequires: string[] = [];

    for (const jsFile of jsFiles.slice(0, 10)) {
      try {
        const content = await fs.promises.readFile(jsFile, 'utf-8');
        const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
        const importMatches = content.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];

        const allImports = [...requireMatches, ...importMatches];
        const externalImports = allImports
          .map(match => {
            const matchResult = match.match(/['"]([^'"]+)['"]/);
            return matchResult ? matchResult[1] : null;
          })
          .filter((importPath): importPath is string => 
            importPath !== null && 
            !importPath.startsWith('.') && 
            !importPath.startsWith('/') &&
            !importPath.startsWith('@/')
          );

        for (const importPath of externalImports) {
          const resolved = await this.resolveImport(packageDir, jsFile, importPath);
          if (!resolved) {
            unresolvedRequires.push(`${path.relative(packageDir, jsFile)} -> ${importPath}`);
          }
        }
      } catch (error) {
        this.logger.debug(`Failed to analyze imports in ${jsFile}: ${error}`);
      }
    }

    if (unresolvedRequires.length > 0) {
      results.push({
        ruleName: 'unresolved_requires',
        passed: false,
        message: `Found ${unresolvedRequires.length} potentially unresolved imports`,
        details: { unresolvedRequires: unresolvedRequires.slice(0, 5) }
      });
    } else {
      results.push({
        ruleName: 'no_unresolved_requires',
        passed: true,
        message: 'No unresolved imports found in sampled files'
      });
    }

    return results;
  }

  private async resolveImport(packageDir: string, filePath: string, importPath: string): Promise<boolean> {
    const nodeModulesPath = path.join(packageDir, 'node_modules', importPath);
    if (await FileUtils.fileExists(nodeModulesPath) || await FileUtils.directoryExists(nodeModulesPath)) {
      return true;
    }

    const parentDir = path.dirname(filePath);
    const relativePath = path.join(parentDir, importPath);
    
    if (await FileUtils.fileExists(relativePath) || await FileUtils.directoryExists(relativePath)) {
      return true;
    }

    if (importPath.startsWith('@')) {
      const [scope, packageName] = importPath.split('/');
      const scopedPath = path.join(packageDir, 'node_modules', scope, packageName);
      return await FileUtils.fileExists(scopedPath) || await FileUtils.directoryExists(scopedPath);
    }

    return false;
  }

  private async findFilesByPattern(dir: string, pattern: RegExp): Promise<string[]> {
    try {
      const allFiles = await FileUtils.listFiles(dir, true);
      return allFiles.filter(file => {
        const relativePath = path.relative(dir, file);
        return pattern.test(relativePath) && !relativePath.includes('node_modules');
      });
    } catch {
      return [];
    }
  }

  async validatePackageCompatibility(packageDir: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      const packageJsonPath = path.join(packageDir, 'package.json');
      if (!(await FileUtils.fileExists(packageJsonPath))) {
        throw new ValidationError('package.json not found');
      }

      const packageJson = await FileUtils.readJsonFile<any>(packageJsonPath);

      const engines = packageJson.engines;
      if (engines) {
        if (engines.node) {
          results.push({
            ruleName: 'node_version_specified',
            passed: true,
            message: `Node.js version requirement: ${engines.node}`,
            details: { nodeVersion: engines.node }
          });
        }

        if (engines.npm) {
          results.push({
            ruleName: 'npm_version_specified',
            passed: true,
            message: `npm version requirement: ${engines.npm}`,
            details: { npmVersion: engines.npm }
          });
        }
      } else {
        results.push({
          ruleName: 'no_engines_specified',
          passed: true,
          message: 'No engine requirements specified',
          details: {}
        });
      }

      const os = packageJson.os;
      if (os && Array.isArray(os)) {
        results.push({
          ruleName: 'os_restrictions',
          passed: true,
          message: `OS restrictions: ${os.join(', ')}`,
          details: { os }
        });
      }

      const cpu = packageJson.cpu;
      if (cpu && Array.isArray(cpu)) {
        results.push({
          ruleName: 'cpu_restrictions',
          passed: true,
          message: `CPU restrictions: ${cpu.join(', ')}`,
          details: { cpu }
        });
      }

    } catch (error) {
      results.push({
        ruleName: 'compatibility_check_error',
        passed: false,
        message: `Compatibility check failed: ${error}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }

    return results;
  }
}