import fs from 'fs';
import path from 'path';
import { FileUtils } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { IntegrityReport, RepairResult } from '../types';

export interface ReportOptions {
  outputDir: string;
  format: 'json' | 'html' | 'markdown' | 'text';
  includeDetails: boolean;
  includeRecommendations: boolean;
  groupByPackage: boolean;
  sortBy: 'integrity' | 'name' | 'timestamp';
  sortOrder: 'asc' | 'desc';
}

export class ReportGenerator {
  private logger = getLogger();

  async generateReport(
    data: IntegrityReport | IntegrityReport[] | RepairResult | RepairResult[],
    options: Partial<ReportOptions> = {}
  ): Promise<string> {
    const fullOptions: ReportOptions = {
      outputDir: options.outputDir || process.cwd(),
      format: options.format || 'markdown',
      includeDetails: options.includeDetails ?? true,
      includeRecommendations: options.includeRecommendations ?? true,
      groupByPackage: options.groupByPackage ?? true,
      sortBy: options.sortBy || 'integrity',
      sortOrder: options.sortOrder || 'desc'
    };

    await FileUtils.ensureDirectoryExists(fullOptions.outputDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dependency-report-${timestamp}`;
    const filepath = path.join(fullOptions.outputDir, `${filename}.${fullOptions.format}`);

    let reportContent: string;

    if (Array.isArray(data)) {
      if (data.length > 0 && 'success' in data[0]) {
        reportContent = this.generateRepairReport(data as RepairResult[], fullOptions);
      } else {
        reportContent = this.generateIntegrityReport(data as IntegrityReport[], fullOptions);
      }
    } else {
      if ('success' in data) {
        reportContent = this.generateRepairReport([data as RepairResult], fullOptions);
      } else {
        reportContent = this.generateIntegrityReport([data as IntegrityReport], fullOptions);
      }
    }

    await FileUtils.writeJsonFile(filepath, reportContent);
    this.logger.info(`Report generated: ${filepath}`);

    return filepath;
  }

  private generateIntegrityReport(reports: IntegrityReport[], options: ReportOptions): string {
    const sortedReports = this.sortReports(reports, options);

    let content = '';
    
    switch (options.format) {
      case 'json':
        content = this.generateJsonIntegrityReport(sortedReports, options);
        break;
      case 'html':
        content = this.generateHtmlIntegrityReport(sortedReports, options);
        break;
      case 'markdown':
        content = this.generateMarkdownIntegrityReport(sortedReports, options);
        break;
      case 'text':
        content = this.generateTextIntegrityReport(sortedReports, options);
        break;
    }

    return content;
  }

  private generateRepairReport(results: RepairResult[], options: ReportOptions): string {
    const sortedResults = this.sortRepairResults(results, options);

    let content = '';
    
    switch (options.format) {
      case 'json':
        content = this.generateJsonRepairReport(sortedResults, options);
        break;
      case 'html':
        content = this.generateHtmlRepairReport(sortedResults, options);
        break;
      case 'markdown':
        content = this.generateMarkdownRepairReport(sortedResults, options);
        break;
      case 'text':
        content = this.generateTextRepairReport(sortedResults, options);
        break;
    }

    return content;
  }

  private generateJsonIntegrityReport(reports: IntegrityReport[], options: ReportOptions): string {
    const reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalPackages: reports.length,
        format: 'json'
      },
      summary: this.calculateIntegritySummary(reports),
      packages: reports.map(report => ({
        name: report.packageName,
        version: report.packageVersion,
        integrity: report.overallIntegrity,
        timestamp: report.timestamp.toISOString(),
        validationResults: options.includeDetails ? report.validationResults : undefined,
        missingFiles: options.includeDetails ? report.missingFiles : undefined,
        extraFiles: options.includeDetails ? report.extraFiles : undefined,
        recommendations: options.includeRecommendations ? report.recommendations : undefined
      }))
    };

    return JSON.stringify(reportData, null, 2);
  }

  private generateJsonRepairReport(results: RepairResult[], options: ReportOptions): string {
    const reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalPackages: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        format: 'json'
      },
      summary: this.calculateRepairSummary(results),
      results: results.map(result => ({
        name: result.packageName,
        version: result.packageVersion,
        success: result.success,
        integrityScore: result.newIntegrityScore,
        timestamp: result.timestamp.toISOString(),
        actionsTaken: options.includeDetails ? result.actionsTaken : undefined,
        errors: options.includeDetails ? result.errors : undefined,
        backupLocation: options.includeDetails ? result.backupLocation : undefined
      }))
    };

    return JSON.stringify(reportData, null, 2);
  }

  private generateMarkdownIntegrityReport(reports: IntegrityReport[], options: ReportOptions): string {
    const summary = this.calculateIntegritySummary(reports);
    
    let content = `# Dependency Integrity Report\n\n`;
    content += `**Generated:** ${new Date().toLocaleString()}\n`;
    content += `**Total Packages:** ${reports.length}\n`;
    content += `**Average Integrity:** ${summary.averageIntegrity}%\n`;
    content += `**Critical Issues:** ${summary.criticalIssues}\n\n`;

    content += `## Summary\n\n`;
    content += `| Integrity Range | Packages |\n`;
    content += `|----------------|----------|\n`;
    for (const [range, count] of Object.entries(summary.packagesByIntegrity)) {
      content += `| ${range}% | ${count} |\n`;
    }
    content += `\n`;

    if (options.includeRecommendations && summary.recommendations.length > 0) {
      content += `## Recommendations\n\n`;
      summary.recommendations.forEach(rec => {
        content += `- ${rec}\n`;
      });
      content += `\n`;
    }

    content += `## Package Details\n\n`;
    
    const sortedReports = this.sortReports(reports, options);
    
    for (const report of sortedReports) {
      content += `### ${report.packageName}@${report.packageVersion}\n\n`;
      content += `**Integrity:** ${report.overallIntegrity}%\n`;
      content += `**Validated:** ${report.timestamp.toLocaleString()}\n\n`;

      if (options.includeDetails) {
        const passed = report.validationResults.filter(r => r.passed).length;
        const failed = report.validationResults.filter(r => !r.passed).length;
        
        content += `**Validation Results:** ${passed} passed, ${failed} failed\n\n`;
        
        if (failed > 0) {
          content += `#### Failed Validations\n`;
          report.validationResults
            .filter(r => !r.passed)
            .forEach(r => {
              content += `- **${r.ruleName}:** ${r.message}\n`;
              if (r.details) {
                content += `  Details: ${JSON.stringify(r.details)}\n`;
              }
            });
          content += `\n`;
        }

        if (report.missingFiles.length > 0) {
          content += `#### Missing Files (${report.missingFiles.length})\n`;
          report.missingFiles.forEach(file => {
            content += `- ${file}\n`;
          });
          content += `\n`;
        }

        if (report.extraFiles.length > 0) {
          content += `#### Extra Files (${report.extraFiles.length})\n`;
          report.extraFiles.slice(0, 10).forEach(file => {
            content += `- ${file}\n`;
          });
          if (report.extraFiles.length > 10) {
            content += `- ... and ${report.extraFiles.length - 10} more\n`;
          }
          content += `\n`;
        }
      }

      if (options.includeRecommendations && report.recommendations.length > 0) {
        content += `#### Recommendations\n`;
        report.recommendations.forEach(rec => {
          content += `- ${rec}\n`;
        });
        content += `\n`;
      }

      content += `---\n\n`;
    }

    return content;
  }

  private generateMarkdownRepairReport(results: RepairResult[], options: ReportOptions): string {
    const summary = this.calculateRepairSummary(results);
    
    let content = `# Dependency Repair Report\n\n`;
    content += `**Generated:** ${new Date().toLocaleString()}\n`;
    content += `**Total Packages:** ${results.length}\n`;
    content += `**Successful:** ${summary.successful}\n`;
    content += `**Failed:** ${summary.failed}\n`;
    content += `**Average Integrity Improvement:** ${summary.averageIntegrityImprovement}%\n\n`;

    content += `## Summary\n\n`;
    content += `| Status | Count |\n`;
    content += `|--------|-------|\n`;
    content += `| ✅ Success | ${summary.successful} |\n`;
    content += `| ❌ Failed | ${summary.failed} |\n`;
    content += `| ⏳ Skipped | ${summary.skipped} |\n`;
    content += `\n`;

    if (summary.errors.length > 0) {
      content += `## Common Errors\n\n`;
      summary.errors.forEach(error => {
        content += `- ${error}\n`;
      });
      content += `\n`;
    }

    content += `## Repair Results\n\n`;
    
    const sortedResults = this.sortRepairResults(results, options);
    
    for (const result of sortedResults) {
      const statusIcon = result.success ? '✅' : '❌';
      const statusText = result.success ? 'Success' : 'Failed';
      
      content += `### ${statusIcon} ${result.packageName}@${result.packageVersion} - ${statusText}\n\n`;
      content += `**Final Integrity:** ${result.newIntegrityScore}%\n`;
      content += `**Completed:** ${result.timestamp.toLocaleString()}\n\n`;

      if (options.includeDetails && result.actionsTaken.length > 0) {
        content += `#### Actions Taken\n`;
        result.actionsTaken.forEach(action => {
          content += `- ${action}\n`;
        });
        content += `\n`;
      }

      if (result.backupLocation) {
        content += `**Backup Location:** ${result.backupLocation}\n\n`;
      }

      if (options.includeDetails && result.errors.length > 0) {
        content += `#### Errors\n`;
        result.errors.forEach(error => {
          content += `- ${error}\n`;
        });
        content += `\n`;
      }

      content += `---\n\n`;
    }

    if (summary.recommendations.length > 0) {
      content += `## Recommendations\n\n`;
      summary.recommendations.forEach(rec => {
        content += `- ${rec}\n`;
      });
      content += `\n`;
    }

    return content;
  }

  private generateHtmlIntegrityReport(reports: IntegrityReport[], options: ReportOptions): string {
    const summary = this.calculateIntegritySummary(reports);
    const sortedReports = this.sortReports(reports, options);

    let content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Integrity Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        h3 { color: #777; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .info { color: #17a2b8; }
        .integrity-high { background-color: #d4edda; }
        .integrity-medium { background-color: #fff3cd; }
        .integrity-low { background-color: #f8d7da; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .badge-success { background-color: #28a745; color: white; }
        .badge-warning { background-color: #ffc107; color: #212529; }
        .badge-danger { background-color: #dc3545; color: white; }
        .summary-box { background-color: #f8f9fa; border-left: 4px solid #007acc; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>📦 Dependency Integrity Report</h1>
    
    <div class="summary-box">
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Packages:</strong> ${reports.length}</p>
        <p><strong>Average Integrity:</strong> <span class="${summary.averageIntegrity >= 80 ? 'success' : summary.averageIntegrity >= 60 ? 'warning' : 'error'}">${summary.averageIntegrity}%</span></p>
        <p><strong>Critical Issues:</strong> <span class="${summary.criticalIssues === 0 ? 'success' : 'error'}">${summary.criticalIssues}</span></p>
    </div>

    <h2>📊 Summary</h2>
    <table>
        <thead>
            <tr>
                <th>Integrity Range</th>
                <th>Packages</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>`;

    for (const [range, count] of Object.entries(summary.packagesByIntegrity)) {
      const [min, max] = range.split('-').map(Number);
      let statusClass = '';
      let statusText = '';
      
      if (max >= 96) {
        statusClass = 'integrity-high';
        statusText = '✅ Excellent';
      } else if (max >= 80) {
        statusClass = 'integrity-medium';
        statusText = '⚠️ Good';
      } else if (max >= 50) {
        statusClass = 'integrity-medium';
        statusText = '⚠️ Fair';
      } else {
        statusClass = 'integrity-low';
        statusText = '❌ Poor';
      }
      
      content += `
            <tr class="${statusClass}">
                <td>${range}%</td>
                <td>${count}</td>
                <td>${statusText}</td>
            </tr>`;
    }

    content += `
        </tbody>
    </table>`;

    if (options.includeRecommendations && summary.recommendations.length > 0) {
      content += `
    <h2>💡 Recommendations</h2>
    <ul>`;
      
      summary.recommendations.forEach(rec => {
        content += `
        <li>${rec}</li>`;
      });
      
      content += `
    </ul>`;
    }

    content += `
    <h2>📋 Package Details</h2>`;

    for (const report of sortedReports) {
      const integrityClass = report.overallIntegrity >= 80 ? 'integrity-high' : 
                           report.overallIntegrity >= 60 ? 'integrity-medium' : 'integrity-low';
      const statusBadge = report.overallIntegrity >= 80 ? 'badge-success' : 
                         report.overallIntegrity >= 60 ? 'badge-warning' : 'badge-danger';
      
      const passed = report.validationResults.filter(r => r.passed).length;
      const failed = report.validationResults.filter(r => !r.passed).length;
      
      content += `
    <div class="${integrityClass}" style="padding: 15px; margin: 15px 0; border-radius: 5px;">
        <h3>${report.packageName}@${report.packageVersion}</h3>
        <p>
            <strong>Integrity:</strong> 
            <span class="badge ${statusBadge}">${report.overallIntegrity}%</span>
        </p>
        <p><strong>Validated:</strong> ${report.timestamp.toLocaleString()}</p>
        <p><strong>Validation Results:</strong> ${passed} passed, ${failed} failed</p>`;

      if (options.includeDetails && failed > 0) {
        content += `
        <h4>Failed Validations</h4>
        <ul>`;
        
        report.validationResults
          .filter(r => !r.passed)
          .forEach(r => {
            content += `
            <li><strong>${r.ruleName}:</strong> ${r.message}</li>`;
          });
        
        content += `
        </ul>`;
      }

      if (options.includeDetails && report.missingFiles.length > 0) {
        content += `
        <h4>Missing Files (${report.missingFiles.length})</h4>
        <ul>`;
        
        report.missingFiles.forEach(file => {
          content += `
            <li>${file}</li>`;
        });
        
        content += `
        </ul>`;
      }

      if (options.includeRecommendations && report.recommendations.length > 0) {
        content += `
        <h4>Recommendations</h4>
        <ul>`;
        
        report.recommendations.forEach(rec => {
          content += `
            <li>${rec}</li>`;
        });
        
        content += `
        </ul>`;
      }

      content += `
    </div>`;
    }

    content += `
</body>
</html>`;

    return content;
  }

  private generateHtmlRepairReport(results: RepairResult[], options: ReportOptions): string {
    const summary = this.calculateRepairSummary(results);
    const sortedResults = this.sortRepairResults(results, options);

    let content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Repair Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        h3 { color: #777; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .info { color: #17a2b8; }
        .success-bg { background-color: #d4edda; }
        .error-bg { background-color: #f8d7da; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .badge-success { background-color: #28a745; color: white; }
        .badge-warning { background-color: #ffc107; color: #212529; }
        .badge-danger { background-color: #dc3545; color: white; }
        .summary-box { background-color: #f8f9fa; border-left: 4px solid #007acc; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>🔧 Dependency Repair Report</h1>
    
    <div class="summary-box">
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Packages:</strong> ${results.length}</p>
        <p><strong>Successful:</strong> <span class="success">${summary.successful}</span></p>
        <p><strong>Failed:</strong> <span class="${summary.failed === 0 ? 'success' : 'error'}">${summary.failed}</span></p>
        <p><strong>Skipped:</strong> ${summary.skipped}</p>
        <p><strong>Average Integrity Improvement:</strong> <span class="${summary.averageIntegrityImprovement > 0 ? 'success' : summary.averageIntegrityImprovement === 0 ? 'warning' : 'error'}">${summary.averageIntegrityImprovement}%</span></p>
    </div>

    <h2>📊 Summary</h2>
    <table>
        <thead>
            <tr>
                <th>Status</th>
                <th>Count</th>
                <th>Percentage</th>
            </tr>
        </thead>
        <tbody>
            <tr class="success-bg">
                <td>✅ Success</td>
                <td>${summary.successful}</td>
                <td>${results.length > 0 ? ((summary.successful / results.length) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr class="${summary.failed === 0 ? 'success-bg' : 'error-bg'}">
                <td>❌ Failed</td>
                <td>${summary.failed}</td>
                <td>${results.length > 0 ? ((summary.failed / results.length) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
                <td>⏳ Skipped</td>
                <td>${summary.skipped}</td>
                <td>${results.length > 0 ? ((summary.skipped / results.length) * 100).toFixed(1) : 0}%</td>
            </tr>
        </tbody>
    </table>`;

    if (summary.errors.length > 0) {
      content += `
    <h2>🚨 Common Errors</h2>
    <ul>`;
      
      summary.errors.forEach(error => {
        content += `
        <li class="error">${error}</li>`;
      });
      
      content += `
    </ul>`;
    }

    content += `
    <h2>📋 Repair Results</h2>`;

    for (const result of sortedResults) {
      const statusClass = result.success ? 'success-bg' : 'error-bg';
      const statusIcon = result.success ? '✅' : '❌';
      const statusText = result.success ? 'Success' : 'Failed';
      
      content += `
    <div class="${statusClass}" style="padding: 15px; margin: 15px 0; border-radius: 5px;">
        <h3>${statusIcon} ${result.packageName}@${result.packageVersion} - ${statusText}</h3>
        <p><strong>Final Integrity:</strong> <span class="badge ${result.newIntegrityScore >= 80 ? 'badge-success' : result.newIntegrityScore >= 60 ? 'badge-warning' : 'badge-danger'}">${result.newIntegrityScore}%</span></p>
        <p><strong>Completed:</strong> ${result.timestamp.toLocaleString()}</p>`;

      if (result.backupLocation) {
        content += `
        <p><strong>Backup Location:</strong> ${result.backupLocation}</p>`;
      }

      if (options.includeDetails && result.actionsTaken.length > 0) {
        content += `
        <h4>Actions Taken</h4>
        <ul>`;
        
        result.actionsTaken.forEach(action => {
          content += `
            <li>${action}</li>`;
        });
        
        content += `
        </ul>`;
      }

      if (options.includeDetails && result.errors.length > 0) {
        content += `
        <h4>Errors</h4>
        <ul>`;
        
        result.errors.forEach(error => {
          content += `
            <li class="error">${error}</li>`;
        });
        
        content += `
        </ul>`;
      }

      content += `
    </div>`;
    }

    if (summary.recommendations.length > 0) {
      content += `
    <h2>💡 Recommendations</h2>
    <ul>`;
      
      summary.recommendations.forEach(rec => {
        content += `
        <li>${rec}</li>`;
      });
      
      content += `
    </ul>`;
    }

    content += `
</body>
</html>`;

    return content;
  }

  private generateTextIntegrityReport(reports: IntegrityReport[], options: ReportOptions): string {
    const summary = this.calculateIntegritySummary(reports);
    const sortedReports = this.sortReports(reports, options);

    let content = `DEPENDENCY INTEGRITY REPORT
=============================

Generated: ${new Date().toLocaleString()}
Total Packages: ${reports.length}
Average Integrity: ${summary.averageIntegrity}%
Critical Issues: ${summary.criticalIssues}

SUMMARY
-------
`;

    for (const [range, count] of Object.entries(summary.packagesByIntegrity)) {
      content += `${range}%: ${count} packages\n`;
    }

    content += `\n`;

    if (options.includeRecommendations && summary.recommendations.length > 0) {
      content += `RECOMMENDATIONS
---------------
`;
      summary.recommendations.forEach(rec => {
        content += `- ${rec}\n`;
      });
      content += `\n`;
    }

    content += `PACKAGE DETAILS
---------------
`;

    for (const report of sortedReports) {
      const passed = report.validationResults.filter(r => r.passed).length;
      const failed = report.validationResults.filter(r => !r.passed).length;
      
      content += `${report.packageName}@${report.packageVersion}\n`;
      content += `  Integrity: ${report.overallIntegrity}%\n`;
      content += `  Validated: ${report.timestamp.toLocaleString()}\n`;
      content += `  Validation: ${passed} passed, ${failed} failed\n`;

      if (options.includeDetails && failed > 0) {
        content += `  Failed validations:\n`;
        report.validationResults
          .filter(r => !r.passed)
          .forEach(r => {
            content += `    - ${r.ruleName}: ${r.message}\n`;
          });
      }

      if (options.includeDetails && report.missingFiles.length > 0) {
        content += `  Missing files (${report.missingFiles.length}):\n`;
        report.missingFiles.slice(0, 5).forEach(file => {
          content += `    - ${file}\n`;
        });
        if (report.missingFiles.length > 5) {
          content += `    ... and ${report.missingFiles.length - 5} more\n`;
        }
      }

      if (options.includeRecommendations && report.recommendations.length > 0) {
        content += `  Recommendations:\n`;
        report.recommendations.forEach(rec => {
          content += `    - ${rec}\n`;
        });
      }

      content += `\n`;
    }

    return content;
  }

  private generateTextRepairReport(results: RepairResult[], options: ReportOptions): string {
    const summary = this.calculateRepairSummary(results);
    const sortedResults = this.sortRepairResults(results, options);

    let content = `DEPENDENCY REPAIR REPORT
=========================

Generated: ${new Date().toLocaleString()}
Total Packages: ${results.length}
Successful: ${summary.successful}
Failed: ${summary.failed}
Skipped: ${summary.skipped}
Average Integrity Improvement: ${summary.averageIntegrityImprovement}%

SUMMARY
-------
✅ Success: ${summary.successful} packages
❌ Failed: ${summary.failed} packages
⏳ Skipped: ${summary.skipped} packages

`;

    if (summary.errors.length > 0) {
      content += `COMMON ERRORS
-------------
`;
      summary.errors.forEach(error => {
        content += `- ${error}\n`;
      });
      content += `\n`;
    }

    content += `REPAIR RESULTS
---------------
`;

    for (const result of sortedResults) {
      const statusIcon = result.success ? '✅' : '❌';
      const statusText = result.success ? 'Success' : 'Failed';
      
      content += `${statusIcon} ${result.packageName}@${result.packageVersion} - ${statusText}\n`;
      content += `  Final Integrity: ${result.newIntegrityScore}%\n`;
      content += `  Completed: ${result.timestamp.toLocaleString()}\n`;

      if (result.backupLocation) {
        content += `  Backup: ${result.backupLocation}\n`;
      }

      if (options.includeDetails && result.actionsTaken.length > 0) {
        content += `  Actions taken:\n`;
        result.actionsTaken.forEach(action => {
          content += `    - ${action}\n`;
        });
      }

      if (options.includeDetails && result.errors.length > 0) {
        content += `  Errors:\n`;
        result.errors.forEach(error => {
          content += `    - ${error}\n`;
        });
      }

      content += `\n`;
    }

    if (summary.recommendations.length > 0) {
      content += `RECOMMENDATIONS
---------------
`;
      summary.recommendations.forEach(rec => {
        content += `- ${rec}\n`;
      });
    }

    return content;
  }

  private sortReports(reports: IntegrityReport[], options: ReportOptions): IntegrityReport[] {
    const sorted = [...reports];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (options.sortBy) {
        case 'integrity':
          comparison = b.overallIntegrity - a.overallIntegrity;
          break;
        case 'name':
          comparison = a.packageName.localeCompare(b.packageName);
          if (comparison === 0) {
            comparison = a.packageVersion.localeCompare(b.packageVersion);
          }
          break;
        case 'timestamp':
          comparison = b.timestamp.getTime() - a.timestamp.getTime();
          break;
      }
      
      return options.sortOrder === 'asc' ? -comparison : comparison;
    });
    
    return sorted;
  }

  private sortRepairResults(results: RepairResult[], options: ReportOptions): RepairResult[] {
    const sorted = [...results];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      if (a.success !== b.success) {
        comparison = a.success ? -1 : 1;
      } else {
        switch (options.sortBy) {
          case 'integrity':
            comparison = b.newIntegrityScore - a.newIntegrityScore;
            break;
          case 'name':
            comparison = a.packageName.localeCompare(b.packageName);
            if (comparison === 0) {
              comparison = a.packageVersion.localeCompare(b.packageVersion);
            }
            break;
          case 'timestamp':
            comparison = b.timestamp.getTime() - a.timestamp.getTime();
            break;
        }
      }
      
      return options.sortOrder === 'asc' ? -comparison : comparison;
    });
    
    return sorted;
  }

  private calculateIntegritySummary(reports: IntegrityReport[]) {
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

  private calculateRepairSummary(results: RepairResult[]) {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.actionsTaken.some(a => a.includes('Skipping') || a.includes('no repair needed'))).length;

    const integrityChanges = results
      .filter(r => r.newIntegrityScore > 0)
      .map(r => r.newIntegrityScore);
    const averageIntegrityImprovement = integrityChanges.length > 0 
      ? Math.round(integrityChanges.reduce((sum, score) => sum + score, 0) / integrityChanges.length)
      : 0;

    const allErrors = results.flatMap(r => r.errors);
    const errorCounts: Record<string, number> = {};
    
    for (const error of allErrors) {
      const errorKey = error.split(':')[0];
      errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
    }

    const commonErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => `${error} (${count} times)`);

    const allRecommendations: string[] = [];
    for (const result of results) {
      if (result.newIntegrityScore < 80) {
        allRecommendations.push(`Consider further repair for ${result.packageName}@${result.packageVersion} (integrity: ${result.newIntegrityScore}%)`);
      }
    }
    
    const uniqueRecommendations = Array.from(new Set(allRecommendations));

    return {
      successful,
      failed,
      skipped,
      averageIntegrityImprovement,
      errors: commonErrors,
      recommendations: uniqueRecommendations
    };
  }
}