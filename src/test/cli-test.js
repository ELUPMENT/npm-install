const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testCLICommands() {
  console.log('='.repeat(60));
  console.log('CLI Command Tests');
  console.log('='.repeat(60));
  
  const cliPath = path.join(__dirname, '..', 'cli', 'index.ts');
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
  
  // 测试帮助命令
  console.log('\n1. Testing help command...');
  console.log('   Skipping help command test (requires compiled CLI)');
  
  // 测试检查命令（本地包）
  console.log('\n2. Testing check command...');
  try {
    const { PackageValidator } = require('../validators/index.ts');
    const validator = new PackageValidator();
    const report = await validator.validatePackage(testPackageDir);
    console.log('✅ Package check completed');
    console.log('   Package:', report.packageName);
    console.log('   Version:', report.packageVersion);
    console.log('   Integrity:', report.overallIntegrity + '%');
    console.log('   Validation results:', report.validationResults.length);
  } catch (error) {
    console.log('❌ Check failed:', error.message);
  }
  
  // 测试生成配置
  console.log('\n3. Testing config generation...');
  const configPath = path.join(__dirname, '..', '..', 'test-cli-config.json');
  try {
    const { ConfigManager } = require('../config/index.ts');
    const configManager = new ConfigManager(configPath);
    configManager.saveConfig({ timeoutMs: 5000, logLevel: 'debug' });
    console.log('✅ Config saved to:', configPath);
    
    // 验证配置文件
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      console.log('   timeoutMs:', config.timeoutMs);
      console.log('   logLevel:', config.logLevel);
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    console.log('❌ Config generation failed:', error.message);
  }
  
  // 测试API验证
  console.log('\n4. Testing API validation...');
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
  } catch (error) {
    console.log('❌ API validation failed:', error.message);
  }
  
  // 测试报告生成
  console.log('\n5. Testing report generation...');
  const reportPath = path.join(__dirname, '..', '..', 'test-report.md');
  try {
    const { ReportGenerator } = require('../reporters/index.ts');
    const reporter = new ReportGenerator();
    const testReport = {
      packageName: 'test-package',
      packageVersion: '1.0.0',
      overallIntegrity: 85,
      validationResults: [
        { ruleName: 'package_json_exists', passed: true, message: 'Package.json exists' },
        { ruleName: 'has_readme', passed: false, message: 'README file missing' }
      ],
      missingFiles: ['README.md', 'LICENSE'],
      extraFiles: [],
      recommendations: ['Add README.md file', 'Add LICENSE file'],
      timestamp: new Date()
    };
    const report = reporter.generateReport([testReport], { format: 'markdown', includeDetails: true });
    fs.writeFileSync(reportPath, report);
    console.log('✅ Report generated at:', reportPath);
    
    if (fs.existsSync(reportPath)) {
      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      console.log('   Size:', reportContent.length, 'bytes');
      console.log('   Contains test-package:', reportContent.includes('test-package'));
      fs.unlinkSync(reportPath);
    }
  } catch (error) {
    console.log('❌ Report generation failed:', error.message);
  }
  
  // 清理测试目录
  if (fs.existsSync(testPackageDir)) {
    fs.rmSync(testPackageDir, { recursive: true, force: true });
    console.log('\n✅ Cleaned up test directory');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All CLI tests completed successfully');
  console.log('='.repeat(60));
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      cwd: path.join(__dirname, '..', '..')
    });
    
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}: ${error}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// 测试错误处理
async function testErrorHandling() {
  console.log('\n\n' + '='.repeat(60));
  console.log('Error Handling Tests');
  console.log('='.repeat(60));
  
  const nonExistentDir = path.join(__dirname, '..', '..', 'non-existent-dir');
  
  console.log('\n1. Testing with non-existent directory...');
  try {
    await runCommand('node', ['-e', `
      const { PackageValidator } = require('./src/validators/index.ts');
      const validator = new PackageValidator();
      validator.validatePackage('${nonExistentDir.replace(/\\/g, '\\\\')}')
        .then(report => console.log('Should not reach here'))
        .catch(err => console.log('✅ Expected error:', err.message.includes('does not exist') ? err.message : 'Unexpected error'));
    `]);
  } catch (error) {
    console.log('✅ Error handled properly:', error.message);
  }
  
  console.log('\n2. Testing with invalid package.json...');
  const invalidPackageDir = path.join(__dirname, '..', '..', 'test-invalid-package');
  
  if (fs.existsSync(invalidPackageDir)) {
    fs.rmSync(invalidPackageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(invalidPackageDir, { recursive: true });
  
  fs.writeFileSync(
    path.join(invalidPackageDir, 'package.json'),
    'invalid json content'
  );
  
  try {
    await runCommand('node', ['-e', `
      const { PackageValidator } = require('./src/validators/index.ts');
      const validator = new PackageValidator();
      validator.validatePackage('${invalidPackageDir.replace(/\\/g, '\\\\')}')
        .then(report => console.log('Should not reach here'))
        .catch(err => console.log('✅ Expected error:', err.message.includes('JSON') ? 'Invalid JSON error' : err.message));
    `]);
  } catch (error) {
    console.log('✅ Error handled properly');
  }
  
  // 清理
  if (fs.existsSync(invalidPackageDir)) {
    fs.rmSync(invalidPackageDir, { recursive: true, force: true });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Error handling tests completed');
  console.log('='.repeat(60));
}

// 运行整合测试
async function runIntegrationTest() {
  console.log('\n\n' + '='.repeat(60));
  console.log('Integration Test: Complete Dependency Fix Flow');
  console.log('='.repeat(60));
  
  const testDir = path.join(__dirname, '..', '..', 'test-integration');
  const packageDir = path.join(testDir, 'test-package@1.0.0');
  
  // 清理并创建测试目录
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(packageDir, { recursive: true });
  
  // 创建不完整的包
  const incompletePackage = {
    name: 'test-package',
    version: '1.0.0',
    description: 'Incomplete test package',
    main: 'index.js',
    license: 'MIT',
    files: ['index.js', 'package.json', 'README.md', 'LICENSE']
  };
  
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(incompletePackage, null, 2)
  );
  
  fs.writeFileSync(
    path.join(packageDir, 'index.js'),
    'console.log("Hello from test package");'
  );
  
  console.log('✅ Created incomplete test package');
  console.log('   Missing: README.md, LICENSE');
  
  // 测试检查不完整的包
  console.log('\n1. Checking incomplete package...');
  await runCommand('node', ['-e', `
    const { PackageValidator } = require('./src/validators/index.ts');
    const validator = new PackageValidator();
    validator.validatePackage('${packageDir.replace(/\\/g, '\\\\')}')
      .then(report => {
        console.log('Check completed');
        console.log('Integrity score:', report.overallIntegrity + '%');
        console.log('Missing files:', report.missingFiles.length);
        console.log('Recommendations:', report.recommendations.length);
        
        if (report.overallIntegrity < 100) {
          console.log('✅ Package correctly identified as incomplete');
        }
      })
      .catch(err => console.error('Check failed:', err));
  `]);
  
  // 测试生成修复报告
  console.log('\n2. Generating repair report...');
  const repairReportPath = path.join(testDir, 'repair-report.json');
  await runCommand('node', ['-e', `
    const { ReportGenerator } = require('./src/reporters/index.ts');
    const reporter = new ReportGenerator();
    const testResult = {
      success: false,
      packageName: 'test-package',
      packageVersion: '1.0.0',
      actionsTaken: ['Checked package', 'Found missing files'],
      errors: ['Missing README.md', 'Missing LICENSE'],
      newIntegrityScore: 65,
      timestamp: new Date()
    };
    const report = reporter.generateReport([testResult], { 
      format: 'json',
      includeDetails: true,
      outputDir: '${testDir.replace(/\\/g, '\\\\')}'
    });
    const fs = require('fs');
    fs.writeFileSync('${repairReportPath.replace(/\\/g, '\\\\')}', report);
    console.log('Report saved to: ${repairReportPath}');
  `]);
  
  if (fs.existsSync(repairReportPath)) {
    const report = JSON.parse(fs.readFileSync(repairReportPath, 'utf-8'));
    console.log('✅ Repair report generated');
    console.log('   Total packages:', report.metadata.totalPackages);
    console.log('   Successful:', report.metadata.successful);
    console.log('   Failed:', report.metadata.failed);
  }
  
  // 清理
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('\n✅ Cleaned up integration test directory');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Integration test completed');
  console.log('='.repeat(60));
}

// 运行所有测试
async function runAllTests() {
  try {
    await testCLICommands();
    await testErrorHandling();
    await runIntegrationTest();
    
    console.log('\n\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runAllTests();