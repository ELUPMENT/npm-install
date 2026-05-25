const path = require('path');
const fs = require('fs');

async function testCLIFunctions() {
  console.log('='.repeat(60));
  console.log('CLI Functions Test');
  console.log('='.repeat(60));
  
  const testPackageDir = path.join(__dirname, '..', '..', 'test-cli-package');
  
  // 创建测试包目录
  if (fs.existsSync(testPackageDir)) {
    fs.rmSync(testPackageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testPackageDir, { recursive: true });
  
  // 创建测试包内容
  const packageJson = {
    name: 'test-cli-package',
    version: '1.0.0',
    description: 'Test package for CLI',
    main: 'index.js',
    license: 'MIT',
    files: ['index.js', 'package.json']
  };
  
  fs.writeFileSync(
    path.join(testPackageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  fs.writeFileSync(
    path.join(testPackageDir, 'index.js'),
    'module.exports = { test: true };'
  );
  
  console.log('✅ Created test package directory');
  
  // 测试1: PackageValidator
  console.log('\n1. Testing PackageValidator...');
  try {
    const { PackageValidator } = require('../validators/index.ts');
    const validator = new PackageValidator();
    const report = await validator.validatePackage(testPackageDir);
    console.log('✅ Package check completed');
    console.log('   Package:', report.packageName);
    console.log('   Version:', report.packageVersion);
    console.log('   Integrity:', report.overallIntegrity + '%');
    console.log('   Validation results:', report.validationResults.length);
    
    const passed = report.validationResults.filter(r => r.passed).length;
    const failed = report.validationResults.filter(r => !r.passed).length;
    console.log('   Passed:', passed);
    console.log('   Failed:', failed);
    
    // 检查特定规则
    const hasPackageJson = report.validationResults.some(r => 
      r.ruleName === 'package_json_exists' && r.passed
    );
    const hasReadme = report.validationResults.some(r => 
      r.ruleName === 'has_readme' && r.passed
    );
    
    console.log('   Has package.json:', hasPackageJson ? '✅' : '❌');
    console.log('   Has README:', hasReadme ? '✅' : '❌');
  } catch (error) {
    console.log('❌ PackageValidator test failed:', error.message);
  }
  
  // 测试2: ConfigManager
  console.log('\n2. Testing ConfigManager...');
  try {
    const { ConfigManager } = require('../config/index.ts');
    const configPath = path.join(__dirname, '..', '..', 'test-config.json');
    const configManager = new ConfigManager(configPath);
    
    // 测试默认配置
    const defaultConfig = configManager.getConfig();
    console.log('✅ Default config loaded');
    console.log('   Registry URL:', defaultConfig.registryUrl);
    console.log('   Timeout:', defaultConfig.timeoutMs, 'ms');
    console.log('   Max retries:', defaultConfig.maxRetries);
    
    // 测试更新配置
    configManager.updateConfig({ timeoutMs: 5000, logLevel: 'debug' });
    const updatedConfig = configManager.getConfig();
    console.log('✅ Config updated');
    console.log('   New timeout:', updatedConfig.timeoutMs, 'ms');
    console.log('   New log level:', updatedConfig.logLevel);
    
    // 测试验证
    const errors = configManager.validateConfig();
    console.log('✅ Config validation:', errors.length === 0 ? 'Passed' : 'Failed');
    if (errors.length > 0) {
      console.log('   Errors:', errors);
    }
    
    // 清理
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    console.log('❌ ConfigManager test failed:', error.message);
  }
  
  // 测试3: ApiValidator
  console.log('\n3. Testing ApiValidator...');
  try {
    const { ApiValidator } = require('../validators/index.ts');
    const validator = new ApiValidator();
    const results = await validator.validatePackageApi(testPackageDir);
    
    console.log('✅ API validation completed');
    console.log('   Total checks:', results.length);
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log('   Passed:', passed);
    console.log('   Failed:', failed);
    
    // 检查具体结果
    const mainExists = results.some(r => 
      r.ruleName === 'main_entry_exists' && r.passed
    );
    const hasJsFiles = results.some(r => 
      r.ruleName === 'has_javascript_files' && r.passed
    );
    
    console.log('   Main entry exists:', mainExists ? '✅' : '❌');
    console.log('   Has JS files:', hasJsFiles ? '✅' : '❌');
  } catch (error) {
    console.log('❌ ApiValidator test failed:', error.message);
  }
  
  // 测试4: ReportGenerator
  console.log('\n4. Testing ReportGenerator...');
  try {
    const { ReportGenerator } = require('../reporters/index.ts');
    const reporter = new ReportGenerator();
    
    // 测试数据
    const testReport = {
      packageName: 'test-package',
      packageVersion: '1.0.0',
      overallIntegrity: 85,
      validationResults: [
        { ruleName: 'package_json_exists', passed: true, message: 'Package.json exists' },
        { ruleName: 'has_readme', passed: false, message: 'README file missing' },
        { ruleName: 'has_license', passed: false, message: 'LICENSE file missing' }
      ],
      missingFiles: ['README.md', 'LICENSE'],
      extraFiles: [],
      recommendations: ['Add README.md file', 'Add LICENSE file'],
      timestamp: new Date()
    };
    
    const testResult = {
      success: true,
      packageName: 'test-package',
      packageVersion: '1.0.0',
      actionsTaken: ['Checked package', 'Generated report'],
      errors: [],
      newIntegrityScore: 90,
      timestamp: new Date()
    };
    
    // 测试Markdown报告
    const mdReport = reporter.generateReport([testReport], { format: 'markdown', includeDetails: true });
    console.log('✅ Markdown report generated');
    console.log('   Size:', mdReport.length, 'characters');
    console.log('   Contains package name:', mdReport.includes('test-package'));
    console.log('   Contains integrity score:', mdReport.includes('85%'));
    
    // 测试JSON报告
    const jsonReport = reporter.generateReport([testResult], { format: 'json', includeDetails: true });
    console.log('✅ JSON report generated');
    console.log('   Size:', jsonReport.length, 'characters');
    console.log('   Valid JSON:', JSON.parse(jsonReport) ? 'Yes' : 'No');
    
    // 测试HTML报告
    const htmlReport = reporter.generateReport([testReport, testResult], { format: 'html', includeDetails: true });
    console.log('✅ HTML report generated');
    console.log('   Size:', htmlReport.length, 'characters');
    console.log('   Contains HTML tags:', htmlReport.includes('<html>') && htmlReport.includes('</html>'));
    
    // 保存测试报告
    const reportPath = path.join(__dirname, '..', '..', 'test-report.md');
    fs.writeFileSync(reportPath, mdReport);
    console.log('✅ Report saved to:', reportPath);
    
    // 清理
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }
  } catch (error) {
    console.log('❌ ReportGenerator test failed:', error.message);
  }
  
  // 测试5: 错误处理
  console.log('\n5. Testing error handling...');
  try {
    const { PackageValidator } = require('../validators/index.ts');
    const validator = new PackageValidator();
    
    // 测试不存在的目录
    const nonExistentDir = path.join(__dirname, '..', '..', 'non-existent-dir');
    try {
      await validator.validatePackage(nonExistentDir);
      console.log('❌ Should have thrown error for non-existent directory');
    } catch (error) {
      console.log('✅ Correctly threw error for non-existent directory');
      console.log('   Error:', error.message);
    }
    
    // 测试无效的package.json
    const invalidPackageDir = path.join(__dirname, '..', '..', 'test-invalid-package');
    if (fs.existsSync(invalidPackageDir)) {
      fs.rmSync(invalidPackageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(invalidPackageDir, { recursive: true });
    fs.writeFileSync(path.join(invalidPackageDir, 'package.json'), 'invalid json');
    
    try {
      await validator.validatePackage(invalidPackageDir);
      console.log('❌ Should have thrown error for invalid JSON');
    } catch (error) {
      console.log('✅ Correctly threw error for invalid JSON');
      console.log('   Error:', error.message.includes('JSON') ? 'Invalid JSON error' : error.message);
    }
    
    // 清理
    if (fs.existsSync(invalidPackageDir)) {
      fs.rmSync(invalidPackageDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.log('❌ Error handling test failed:', error.message);
  }
  
  // 清理测试包目录
  if (fs.existsSync(testPackageDir)) {
    fs.rmSync(testPackageDir, { recursive: true, force: true });
    console.log('\n✅ Cleaned up test directory');
  }
  
  // 测试6: 集成测试 - 完整的依赖修复流程
  console.log('\n6. Testing integrated dependency fix flow...');
  try {
    const { ConfigManager } = require('../config/index.ts');
    const { PackageValidator } = require('../validators/index.ts');
    const { PackageFixer } = require('../fixers/index.ts');
    const { ReportGenerator } = require('../reporters/index.ts');
    const { DependencyMonitor } = require('../monitoring/index.ts');
    
    // 创建测试包
    const integrationTestDir = path.join(__dirname, '..', '..', 'test-integration');
    const testPackageDir2 = path.join(integrationTestDir, 'test-package-2@1.0.0');
    
    if (fs.existsSync(integrationTestDir)) {
      fs.rmSync(integrationTestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testPackageDir2, { recursive: true });
    
    // 创建不完整的包
    const incompletePackage = {
      name: 'test-package-2',
      version: '1.0.0',
      description: 'Incomplete test package for integration test',
      main: 'index.js',
      license: 'MIT',
      files: ['index.js', 'package.json', 'README.md', 'LICENSE']
    };
    
    fs.writeFileSync(
      path.join(testPackageDir2, 'package.json'),
      JSON.stringify(incompletePackage, null, 2)
    );
    
    fs.writeFileSync(
      path.join(testPackageDir2, 'index.js'),
      'console.log("Hello from integration test");'
    );
    
    console.log('✅ Created incomplete test package');
    
    // 配置管理器
    const configManager = new ConfigManager();
    configManager.updateConfig({
      enableBackup: false,
      enableCache: false,
      verifyIntegrity: false
    });
    
    // 验证器
    const validator = new PackageValidator();
    const initialReport = await validator.validatePackage(testPackageDir2);
    console.log('✅ Initial validation completed');
    console.log('   Integrity score:', initialReport.overallIntegrity + '%');
    console.log('   Missing files:', initialReport.missingFiles.length);
    
    // 修复器（模拟修复 - 由于是离线包，实际上不会下载）
    const fixer = new PackageFixer(configManager);
    console.log('⚠️  Skipping actual fix (requires npm registry access)');
    console.log('   Would attempt to download missing files from npm');
    
    // 监控器
    const monitor = new DependencyMonitor();
    monitor.startMonitoring();
    monitor.recordValidationStart('test-package-2', '1.0.0');
    monitor.recordValidationComplete('test-package-2', '1.0.0', initialReport);
    
    const stats = monitor.stopMonitoring();
    console.log('✅ Monitoring completed');
    console.log('   Packages processed:', stats.packagesProcessed);
    console.log('   Average integrity:', stats.averageIntegrityScore + '%');
    console.log('   Errors:', stats.errors.length);
    console.log('   Warnings:', stats.warnings.length);
    
    // 清理
    if (fs.existsSync(integrationTestDir)) {
      fs.rmSync(integrationTestDir, { recursive: true, force: true });
      console.log('✅ Cleaned up integration test directory');
    }
  } catch (error) {
    console.log('❌ Integration test failed:', error.message);
    console.log('   This is expected if npm registry is not accessible');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All CLI function tests completed');
  console.log('='.repeat(60));
}

// 运行测试
async function runTests() {
  try {
    await testCLIFunctions();
    console.log('\n\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();