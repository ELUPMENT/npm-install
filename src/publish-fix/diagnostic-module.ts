import fs from 'fs';
import path from 'path';
import { GlobExpander, GlobExpandResult } from './glob-expander';
import { PublishValidator, PublishValidationResult } from './publish-validator';

export interface DiagnosticResult {
  packageName: string;
  packageVersion: string;
  packageDir: string;
  hasProblem: boolean;
  severity: 'critical' | 'warning' | 'info';
  problemType: string;
  description: string;
  globAnalysis: GlobExpandResult[];
  validation: PublishValidationResult;
  affectedFiles: string[];
  suggestedFix: string[];
}

export class DiagnosticModule {
  static diagnose(packageDir: string): DiagnosticResult {
    const packageJsonPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return {
        packageName: 'unknown',
        packageVersion: 'unknown',
        packageDir,
        hasProblem: true,
        severity: 'critical',
        problemType: 'missing_package_json',
        description: 'package.json not found',
        globAnalysis: [],
        validation: {
          packageName: 'unknown',
          packageVersion: 'unknown',
          isComplete: false,
          score: 0,
          checks: [],
          issues: ['package.json not found'],
          recommendations: []
        },
        affectedFiles: [],
        suggestedFix: []
      };
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const packageName = packageJson.name || 'unknown';
    const packageVersion = packageJson.version || 'unknown';
    const filesField: string[] = packageJson.files || [];

    const globAnalysis = GlobExpander.expandGlobPatterns(filesField, packageDir);
    const validation = PublishValidator.validatePublishReadiness(packageDir);

    const incompleteGlobs = GlobExpander.getIncompleteGlobs(filesField, packageDir);
    const hasProblem = incompleteGlobs.length > 0 || validation.issues.length > 0;

    let severity: 'critical' | 'warning' | 'info' = 'info';
    let problemType = 'none';
    let description = 'No problems detected';

    if (incompleteGlobs.length > 0) {
      const globDescriptions = incompleteGlobs.map(g =>
        `"${g.original}" matches [${g.matchedDirs.join(', ')}] but may miss directories during npm publish`
      ).join('; ');

      const hasMissingEntryFiles = validation.checks.some(
        c => c.name === 'entry_files' && !c.passed
      );

      if (hasMissingEntryFiles) {
        severity = 'critical';
        problemType = 'glob_incomplete_with_missing_entries';
        description = `Glob patterns cause incomplete publish AND missing entry files: ${globDescriptions}`;
      } else {
        severity = 'warning';
        problemType = 'glob_incomplete';
        description = `Glob patterns may cause incomplete publish: ${globDescriptions}`;
      }
    } else if (validation.issues.length > 0) {
      severity = 'warning';
      problemType = 'validation_issues';
      description = `Validation issues: ${validation.issues.join('; ')}`;
    }

    const affectedFiles = this.computeAffectedFiles(
      packageDir,
      packageJson,
      incompleteGlobs
    );

    const suggestedFix = this.generateSuggestedFix(
      filesField,
      globAnalysis,
      incompleteGlobs
    );

    return {
      packageName,
      packageVersion,
      packageDir,
      hasProblem,
      severity,
      problemType,
      description,
      globAnalysis,
      validation,
      affectedFiles,
      suggestedFix
    };
  }

  private static computeAffectedFiles(
    packageDir: string,
    packageJson: any,
    incompleteGlobs: GlobExpandResult[]
  ): string[] {
    const affected: string[] = [];

    const entryFields = ['main', 'module', 'types', 'typings', 'browser'];
    for (const field of entryFields) {
      if (packageJson[field]) {
        const entryPath = path.join(packageDir, packageJson[field]);
        if (!fs.existsSync(entryPath)) {
          affected.push(`${field}: ${packageJson[field]} (missing)`);
        }
      }
    }

    for (const glob of incompleteGlobs) {
      const expectedDirs = glob.expanded.filter(e => !glob.matchedDirs.includes(e));
      for (const dir of expectedDirs) {
        const normalizedDir = dir.replace(/\/$/, '');
        const fullPath = path.join(packageDir, normalizedDir);
        if (fs.existsSync(fullPath)) {
          const files = this.listDirFiles(fullPath);
          affected.push(...files.map(f => `${dir}${f}`));
        }
      }
    }

    return affected;
  }

  private static listDirFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const subFiles = this.listDirFiles(fullPath);
          files.push(...subFiles.map(f => `${item}/${f}`));
        } else {
          files.push(item);
        }
      }
    } catch {}
    return files;
  }

  private static generateSuggestedFix(
    filesField: string[],
    globAnalysis: GlobExpandResult[],
    incompleteGlobs: GlobExpandResult[]
  ): string[] {
    if (incompleteGlobs.length === 0) {
      return ['No fix needed - no incomplete glob patterns detected'];
    }

    const fix: string[] = [];
    const newFilesField: string[] = [];

    for (const result of globAnalysis) {
      if (result.isGlob && result.matchedDirs.length > 0) {
        newFilesField.push(...result.expanded);
        fix.push(`Replace "${result.original}" with [${result.expanded.map(e => `"${e}"`).join(', ')}]`);
      } else {
        newFilesField.push(result.original);
      }
    }

    fix.push('');
    fix.push('Suggested files field:');
    fix.push(JSON.stringify(newFilesField, null, 2));

    return fix;
  }

  static diagnoseMultiple(packageDirs: string[]): DiagnosticResult[] {
    return packageDirs.map(dir => {
      try {
        return this.diagnose(dir);
      } catch (error) {
        return {
          packageName: 'unknown',
          packageVersion: 'unknown',
          packageDir: dir,
          hasProblem: true,
          severity: 'critical',
          problemType: 'diagnosis_error',
          description: `Diagnosis failed: ${error instanceof Error ? error.message : String(error)}`,
          globAnalysis: [],
          validation: {
            packageName: 'unknown',
            packageVersion: 'unknown',
            isComplete: false,
            score: 0,
            checks: [],
            issues: [],
            recommendations: []
          },
          affectedFiles: [],
          suggestedFix: []
        };
      }
    });
  }
}