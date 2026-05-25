import { Command } from 'commander';
import { ConfigManager } from '../config';
import { PackageValidator, ApiValidator } from '../validators';
import { PackageFixer } from '../fixers';
import { ReportGenerator } from '../reporters';
import { DependencyMonitor, createMonitor } from '../monitoring';
import { FileUtils } from '../utils';
import { getLogger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

class DependencyFixCLI {
  private program: Command;
  private configManager: ConfigManager;
  private monitor: DependencyMonitor;
  private logger = getLogger();

  constructor() {
    this.program = new Command();
    this.configManager = new ConfigManager();
    this.monitor = createMonitor();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('dependency-fix')
      .description('NPM dependency integrity checker and fixer')
      .version('1.0.0')
      .option('-c, --config <path>', 'Path to config file')
      .option('-v, --verbose', 'Enable verbose logging')
      .option('-q, --quiet', 'Suppress all output except errors');

    this.program
      .command('check <package-dir>')
      .description('Check integrity of a package directory')
      .option('-o, --output <format>', 'Output format (json, markdown, html, text)', 'text')
      .option('-d, --details', 'Include detailed validation results')
      .option('-r, --report <path>', 'Save report to file')
      .action(this.checkPackage.bind(this));

    this.program
      .command('check-all <packages-dir>')
      .description('Check integrity of all packages in a directory')
      .option('-o, --output <format>', 'Output format (json, markdown, html, text)', 'text')
      .option('-d, --details', 'Include detailed validation results')
      .option('-r, --report <path>', 'Save report to file')
      .option('-p, --pattern <pattern>', 'Glob pattern for package directories', '**/')
      .action(this.checkAllPackages.bind(this));

    this.program
      .command('fix <package-dir>')
      .description('Fix integrity issues in a package directory')
      .option('-b, --no-backup', 'Skip creating backup')
      .option('-f, --force', 'Force reinstall even if integrity is high')
      .option('-p, --preserve', 'Preserve local changes')
      .option('-d, --dry-run', 'Simulate fix without making changes')
      .option('-o, --output <format>', 'Output format (json, markdown, html, text)', 'text')
      .option('-r, --report <path>', 'Save report to file')
      .action(this.fixPackage.bind(this));

    this.program
      .command('fix-all <packages-dir>')
      .description('Fix integrity issues in all packages in a directory')
      .option('-b, --no-backup', 'Skip creating backup')
      .option('-f, --force', 'Force reinstall even if integrity is high')
      .option('-p, --preserve', 'Preserve local changes')
      .option('-d, --dry-run', 'Simulate fix without making changes')
      .option('-o, --output <format>', 'Output format (json, markdown, html, text)', 'text')
      .option('-r, --report <path>', 'Save report to file')
      .option('-p, --pattern <pattern>', 'Glob pattern for package directories', '**/')
      .action(this.fixAllPackages.bind(this));

    this.program
      .command('validate-api <package-dir>')
      .description('Validate package API and exports')
      .option('-e, --exports', 'Check exports', true)
      .option('-t, --types', 'Check type definitions', true)
      .option('-r, --runtime', 'Check runtime compatibility', true)
      .option('-o, --output <format>', 'Output format (json, markdown, html, text)', 'text')
      .action(this.validateApi.bind(this));

    this.program
      .command('generate-config')
      .description('Generate a default configuration file')
      .option('-o, --output <path>', 'Output path for config file', '.dependency-fix.json')
      .action(this.generateConfig.bind(this));

    this.program
      .command('stats')
      .description('Show monitoring statistics')
      .action(this.showStats.bind(this));

    this.program
      .command('clear-stats')
      .description('Clear monitoring statistics')
      .action(this.clearStats.bind(this));
  }

  private async checkPackage(packageDir: string, options: any): Promise<void> {
    this.monitor.startMonitoring();

    try {
      const resolvedPath = path.resolve(packageDir);
      if (!(await FileUtils.directoryExists(resolvedPath))) {
        throw new Error(`Package directory does not exist: ${resolvedPath}`);
      }

      this.logger.info(`Checking package at: ${resolvedPath}`);
      this.monitor.recordInfo('Package check started', { packageDir: resolvedPath });

      const validator = new PackageValidator();
      const report = await validator.validatePackage(resolvedPath);

      this.monitor.recordValidationComplete(
        report.packageName,
        report.packageVersion,
        report
      );

      const reporter = new ReportGenerator();
      let output: string;

      switch (options.output) {
        case 'json':
          output = await reporter.generateReport([report], { format: 'json', includeDetails: options.details });
          break;
        case 'html':
          output = await reporter.generateReport([report], { format: 'html', includeDetails: options.details });
          break;
        case 'markdown':
          output = await reporter.generateReport([report], { format: 'markdown', includeDetails: options.details });
          break;
        default:
          output = await reporter.generateReport([report], { format: 'text', includeDetails: options.details });
      }

      console.log(output);

      if (options.report) {
        const reportPath = path.resolve(options.report);
        await fs.promises.writeFile(reportPath, output, 'utf-8');
        this.logger.info(`Report saved to: ${reportPath}`);
      }

      const stats = this.monitor.stopMonitoring();
      this.logger.info(`Check completed in ${stats.durationMs}ms`);

      if (report.overallIntegrity < 80) {
        console.log(`\n⚠️  Package integrity is low: ${report.overallIntegrity}%`);
        console.log('Consider running: dependency-fix fix', packageDir);
      } else {
        console.log(`\n✅ Package integrity is good: ${report.overallIntegrity}%`);
      }

    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packageDir });
      this.monitor.stopMonitoring();
      console.error(`❌ Error checking package: ${error}`);
      process.exit(1);
    }
  }

  private async checkAllPackages(packagesDir: string, options: any): Promise<void> {
    this.monitor.startMonitoring();

    try {
      const resolvedPath = path.resolve(packagesDir);
      if (!(await FileUtils.directoryExists(resolvedPath))) {
        throw new Error(`Packages directory does not exist: ${resolvedPath}`);
      }

      this.logger.info(`Checking all packages in: ${resolvedPath}`);
      this.monitor.recordInfo('Bulk package check started', { packagesDir: resolvedPath });

      const validator = new PackageValidator();
      const allDirs = await this.findPackageDirectories(resolvedPath, options.pattern);
      
      if (allDirs.length === 0) {
        console.log('No package directories found');
        return;
      }

      console.log(`Found ${allDirs.length} package directories`);
      
      const reports = await validator.validateMultiplePackages(allDirs);

      const reporter = new ReportGenerator();
      let output: string;

      switch (options.output) {
        case 'json':
          output = await reporter.generateReport(reports, { format: 'json', includeDetails: options.details });
          break;
        case 'html':
          output = await reporter.generateReport(reports, { format: 'html', includeDetails: options.details });
          break;
        case 'markdown':
          output = await reporter.generateReport(reports, { format: 'markdown', includeDetails: options.details });
          break;
        default:
          output = await reporter.generateReport(reports, { format: 'text', includeDetails: options.details });
      }

      console.log(output);

      if (options.report) {
        const reportPath = path.resolve(options.report);
        await fs.promises.writeFile(reportPath, output, 'utf-8');
        this.logger.info(`Report saved to: ${reportPath}`);
      }

      const summary = await validator.generateValidationSummary(reports);
      console.log('\n' + '='.repeat(50));
      console.log('SUMMARY');
      console.log('='.repeat(50));
      console.log(`Total packages: ${summary.totalPackages}`);
      console.log(`Average integrity: ${summary.averageIntegrity}%`);
      console.log(`Critical issues: ${summary.criticalIssues}`);
      console.log('\nIntegrity distribution:');
      for (const [range, count] of Object.entries(summary.packagesByIntegrity)) {
        console.log(`  ${range}%: ${count} packages`);
      }

      const stats = this.monitor.stopMonitoring();
      this.logger.info(`Bulk check completed in ${stats.durationMs}ms`);

      if (summary.criticalIssues > 0) {
        console.log(`\n⚠️  Found ${summary.criticalIssues} packages with critical issues`);
        console.log('Consider running: dependency-fix fix-all', packagesDir);
      }

    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packagesDir });
      this.monitor.stopMonitoring();
      console.error(`❌ Error checking packages: ${error}`);
      process.exit(1);
    }
  }

  private async fixPackage(packageDir: string, options: any): Promise<void> {
    this.monitor.startMonitoring();

    try {
      const resolvedPath = path.resolve(packageDir);
      if (!(await FileUtils.directoryExists(resolvedPath))) {
        throw new Error(`Package directory does not exist: ${resolvedPath}`);
      }

      this.logger.info(`Fixing package at: ${resolvedPath}`);
      this.monitor.recordInfo('Package fix started', { 
        packageDir: resolvedPath,
        options
      });

      const fixer = new PackageFixer(this.configManager);
      const result = await fixer.fixPackage(resolvedPath, {
        backupOriginal: options.backup,
        forceReinstall: options.force,
        preserveLocalChanges: options.preserve,
        dryRun: options.dryRun
      });

      this.monitor.recordRepairComplete(result);

      const reporter = new ReportGenerator();
      let output: string;

      switch (options.output) {
        case 'json':
          output = await reporter.generateReport([result], { format: 'json', includeDetails: true });
          break;
        case 'html':
          output = await reporter.generateReport([result], { format: 'html', includeDetails: true });
          break;
        case 'markdown':
          output = await reporter.generateReport([result], { format: 'markdown', includeDetails: true });
          break;
        default:
          output = await reporter.generateReport([result], { format: 'text', includeDetails: true });
      }

      console.log(output);

      if (options.report) {
        const reportPath = path.resolve(options.report);
        await fs.promises.writeFile(reportPath, output, 'utf-8');
        this.logger.info(`Report saved to: ${reportPath}`);
      }

      const stats = this.monitor.stopMonitoring();
      this.logger.info(`Fix completed in ${stats.durationMs}ms`);

      if (result.success) {
        console.log(`\n✅ Package fix ${options.dryRun ? '(dry run) ' : ''}completed successfully`);
        console.log(`Final integrity: ${result.newIntegrityScore}%`);
        if (result.backupLocation) {
          console.log(`Backup created at: ${result.backupLocation}`);
        }
      } else {
        console.log(`\n❌ Package fix failed`);
        console.log('Errors:');
        result.errors.forEach(error => console.log(`  - ${error}`));
        process.exit(1);
      }

    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packageDir });
      this.monitor.stopMonitoring();
      console.error(`❌ Error fixing package: ${error}`);
      process.exit(1);
    }
  }

  private async fixAllPackages(packagesDir: string, options: any): Promise<void> {
    this.monitor.startMonitoring();

    try {
      const resolvedPath = path.resolve(packagesDir);
      if (!(await FileUtils.directoryExists(resolvedPath))) {
        throw new Error(`Packages directory does not exist: ${resolvedPath}`);
      }

      this.logger.info(`Fixing all packages in: ${resolvedPath}`);
      this.monitor.recordInfo('Bulk package fix started', { 
        packagesDir: resolvedPath,
        options
      });

      const fixer = new PackageFixer(this.configManager);
      const allDirs = await this.findPackageDirectories(resolvedPath, options.pattern);
      
      if (allDirs.length === 0) {
        console.log('No package directories found');
        return;
      }

      console.log(`Found ${allDirs.length} package directories`);
      console.log('Starting bulk fix...\n');

      const results = await fixer.fixMultiplePackages(allDirs, {
        backupOriginal: options.backup,
        forceReinstall: options.force,
        preserveLocalChanges: options.preserve,
        dryRun: options.dryRun
      });

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      const reporter = new ReportGenerator();
      let output: string;

      switch (options.output) {
        case 'json':
          output = await reporter.generateReport(results, { format: 'json', includeDetails: true });
          break;
        case 'html':
          output = await reporter.generateReport(results, { format: 'html', includeDetails: true });
          break;
        case 'markdown':
          output = await reporter.generateReport(results, { format: 'markdown', includeDetails: true });
          break;
        default:
          output = await reporter.generateReport(results, { format: 'text', includeDetails: true });
      }

      console.log(output);

      if (options.report) {
        const reportPath = path.resolve(options.report);
        await fs.promises.writeFile(reportPath, output, 'utf-8');
        this.logger.info(`Report saved to: ${reportPath}`);
      }

      const stats = this.monitor.stopMonitoring();
      this.logger.info(`Bulk fix completed in ${stats.durationMs}ms`);

      console.log('\n' + '='.repeat(50));
      console.log('FIX SUMMARY');
      console.log('='.repeat(50));
      console.log(`Total packages: ${results.length}`);
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`⏳ Skipped: ${results.length - successful - failed}`);

      const avgIntegrity = results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.newIntegrityScore, 0) / results.length)
        : 0;
      console.log(`📊 Average integrity: ${avgIntegrity}%`);

      if (failed > 0) {
        console.log(`\n⚠️  ${failed} packages failed to fix`);
        console.log('Check the report for details');
        process.exit(1);
      }

    } catch (error) {
      this.monitor.recordError(error instanceof Error ? error : new Error(String(error)), { packagesDir });
      this.monitor.stopMonitoring();
      console.error(`❌ Error fixing packages: ${error}`);
      process.exit(1);
    }
  }

  private async validateApi(packageDir: string, options: any): Promise<void> {
    try {
      const resolvedPath = path.resolve(packageDir);
      if (!(await FileUtils.directoryExists(resolvedPath))) {
        throw new Error(`Package directory does not exist: ${resolvedPath}`);
      }

      this.logger.info(`Validating API for package at: ${resolvedPath}`);

      const validator = new ApiValidator();
      const results = await validator.validatePackageApi(resolvedPath, {
        checkExports: options.exports,
        checkTypes: options.types,
        checkRuntime: options.runtime
      });

      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;

      console.log(`\nAPI Validation Results for ${resolvedPath}`);
      console.log('='.repeat(50));
      console.log(`✅ Passed: ${passed}`);
      console.log(`❌ Failed: ${failed}`);
      console.log('');

      if (failed > 0) {
        console.log('Failed validations:');
        results
          .filter(r => !r.passed)
          .forEach(r => {
            console.log(`  - ${r.ruleName}: ${r.message}`);
            if (r.details) {
              console.log(`    Details: ${JSON.stringify(r.details)}`);
            }
          });
        console.log('');
      }

      console.log('All results:');
      results.forEach(r => {
        const icon = r.passed ? '✅' : '❌';
        console.log(`  ${icon} ${r.ruleName}: ${r.message}`);
      });

      const compatibilityResults = await validator.validatePackageCompatibility(resolvedPath);
      if (compatibilityResults.length > 0) {
        console.log('\nCompatibility Results:');
        compatibilityResults.forEach(r => {
          const icon = r.passed ? '✅' : '❌';
          console.log(`  ${icon} ${r.ruleName}: ${r.message}`);
        });
      }

      if (failed > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error(`❌ Error validating API: ${error}`);
      process.exit(1);
    }
  }

  private async generateConfig(options: any): Promise<void> {
    try {
      const configPath = path.resolve(options.output);
      const defaultConfig = this.configManager.getConfig();
      
      await FileUtils.writeJsonFile(configPath, defaultConfig);
      console.log(`✅ Default configuration generated at: ${configPath}`);
      console.log('\nYou can modify this file to customize the dependency fixer behavior.');
      
    } catch (error) {
      console.error(`❌ Error generating config: ${error}`);
      process.exit(1);
    }
  }

  private async showStats(): Promise<void> {
    const stats = this.monitor.getEventStats();
    const metrics = this.monitor.getMetrics();
    const report = this.monitor.generateReport();

    console.log('\n' + '='.repeat(50));
    console.log('MONITORING STATISTICS');
    console.log('='.repeat(50));
    
    console.log('\n📊 Event Statistics:');
    console.log(`  Total events: ${stats.total}`);
    console.log(`  Errors: ${stats.errorCount}`);
    console.log(`  Warnings: ${stats.warningCount}`);
    
    if (Object.keys(stats.byType).length > 0) {
      console.log('\n  Events by type:');
      for (const [type, count] of Object.entries(stats.byType)) {
        console.log(`    ${type}: ${count}`);
      }
    }

    if (Object.keys(stats.byPackage).length > 0) {
      console.log('\n  Events by package:');
      for (const [pkg, count] of Object.entries(stats.byPackage)) {
        console.log(`    ${pkg}: ${count}`);
      }
    }

    console.log('\n📈 Performance Metrics:');
    console.log(`  Packages processed: ${metrics.packagesProcessed}`);
    console.log(`  Packages succeeded: ${metrics.packagesSucceeded}`);
    console.log(`  Packages failed: ${metrics.packagesFailed}`);
    console.log(`  Average integrity score: ${metrics.averageIntegrityScore}%`);
    
    if (metrics.durationMs) {
      console.log(`  Total duration: ${metrics.durationMs}ms`);
    }

    if (metrics.errors.length > 0) {
      console.log('\n🚨 Errors:');
      metrics.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error}`);
      });
      if (metrics.errors.length > 5) {
        console.log(`  ... and ${metrics.errors.length - 5} more`);
      }
    }

    if (metrics.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      metrics.warnings.slice(0, 5).forEach(warning => {
        console.log(`  - ${warning}`);
      });
      if (metrics.warnings.length > 5) {
        console.log(`  ... and ${metrics.warnings.length - 5} more`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }

    console.log('');
  }

  private async clearStats(): Promise<void> {
    this.monitor.clearEvents();
    console.log('✅ Monitoring statistics cleared');
  }

  private async findPackageDirectories(rootDir: string, pattern: string): Promise<string[]> {
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
      this.logger.error('Error finding package directories', { error });
      return [];
    }
  }

  public async run(argv: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error(`❌ CLI error: ${error}`);
      process.exit(1);
    }
  }
}

export { DependencyFixCLI };