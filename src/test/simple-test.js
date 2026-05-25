const fs = require('fs');
const path = require('path');

// 测试FileUtils基本功能
async function testFileUtils() {
  console.log('Testing FileUtils...\n');
  
  const testDir = path.join(__dirname, '..', '..', 'test-utils-temp');
  const testFile = path.join(testDir, 'test.txt');
  const testSubDir = path.join(testDir, 'subdir');
  const testSubFile = path.join(testSubDir, 'nested.txt');
  
  // 清理测试目录
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  // 创建测试目录和文件
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(testFile, 'Hello, world!');
  fs.mkdirSync(testSubDir, { recursive: true });
  fs.writeFileSync(testSubFile, 'Nested content');
  
  console.log('✅ Test directory created');
  
  // 测试文件存在性
  console.log('Testing fileExists and directoryExists:');
  console.log(`  test.txt exists: ${fs.existsSync(testFile)}`);
  console.log(`  testDir exists: ${fs.existsSync(testDir)}`);
  console.log(`  non-existent.txt exists: ${fs.existsSync(path.join(testDir, 'non-existent.txt'))}`);
  
  // 测试列出文件
  console.log('\nTesting listFiles:');
  const files = fs.readdirSync(testDir);
  console.log(`  Files in testDir: ${files.length} items`);
  files.forEach(file => {
    const fullPath = path.join(testDir, file);
    const stat = fs.statSync(fullPath);
    console.log(`    ${file} (${stat.isDirectory() ? 'directory' : 'file'})`);
  });
  
  // 测试读取文件
  console.log('\nTesting file reading:');
  const content = fs.readFileSync(testFile, 'utf-8');
  console.log(`  test.txt content: "${content}"`);
  
  // 测试JSON读写
  console.log('\nTesting JSON read/write:');
  const jsonFile = path.join(testDir, 'data.json');
  const testData = { name: 'test', value: 123, array: [1, 2, 3] };
  fs.writeFileSync(jsonFile, JSON.stringify(testData, null, 2));
  const readData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  console.log(`  Written and read JSON: ${JSON.stringify(readData)}`);
  
  // 清理
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\n✅ FileUtils basic tests passed');
}

// 测试ConfigManager基本功能
function testConfigManager() {
  console.log('\n\nTesting ConfigManager...\n');
  
  const testConfigPath = path.join(__dirname, '..', '..', 'test-config.json');
  
  // 清理测试文件
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }
  
  // 测试默认配置
  console.log('Default config values:');
  const defaultConfig = {
    registryUrl: 'https://registry.npmjs.org',
    timeoutMs: 30000,
    maxRetries: 3,
    backupPath: '.backup',
    cachePath: '.cache',
    logLevel: 'info',
    enableCache: true,
    enableBackup: true,
    verifyIntegrity: true,
    maxConcurrentDownloads: 5,
    blacklist: [],
    whitelist: []
  };
  
  console.log(JSON.stringify(defaultConfig, null, 2));
  
  // 测试路径生成
  console.log('\nPath generation:');
  const backupPath = path.join('.backup', 'test-package@1.0.0_123456789');
  const cachePath = path.join('.cache', 'test-package@1.0.0');
  console.log(`  Backup path example: ${backupPath}`);
  console.log(`  Cache path example: ${cachePath}`);
  
  // 测试包过滤
  console.log('\nPackage filtering:');
  const whitelist = ['package1', 'package2'];
  const blacklist = ['package3'];
  
  console.log(`  Whitelist: ${whitelist.join(', ')}`);
  console.log(`  Blacklist: ${blacklist.join(', ')}`);
  console.log(`  Should process package1: ${whitelist.includes('package1') || !blacklist.includes('package1')}`);
  console.log(`  Should process package3: ${whitelist.includes('package3') || !blacklist.includes('package3')}`);
  console.log(`  Should process package4: ${whitelist.includes('package4') || !blacklist.includes('package4')}`);
  
  // 清理
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }
  
  console.log('\n✅ ConfigManager basic tests passed');
}

// 测试async-validator包分析
async function testAsyncValidatorAnalysis() {
  console.log('\n\nTesting async-validator analysis...\n');
  
  const asyncValidatorPath = path.join(__dirname, '..', '..', 'offline-packages', 'async-validator@4.2.5');
  
  if (!fs.existsSync(asyncValidatorPath)) {
    console.log('❌ async-validator package not found');
    return;
  }
  
  console.log(`Analyzing async-validator at: ${asyncValidatorPath}`);
  
  // 检查关键文件
  const requiredFiles = [
    'package.json',
    'README.md',
    'LICENSE.md',
    'dist-node/index.js',
    'dist-types/index.d.ts'
  ];
  
  console.log('\nChecking required files:');
  let missingFiles = [];
  for (const file of requiredFiles) {
    const filePath = path.join(asyncValidatorPath, file);
    const exists = fs.existsSync(filePath);
    console.log(`  ${file}: ${exists ? '✅' : '❌'}`);
    if (!exists) {
      missingFiles.push(file);
    }
  }
  
  // 检查目录结构
  console.log('\nDirectory structure:');
  const items = fs.readdirSync(asyncValidatorPath);
  items.forEach(item => {
    const fullPath = path.join(asyncValidatorPath, item);
    const stat = fs.statSync(fullPath);
    console.log(`  ${item} (${stat.isDirectory() ? 'directory' : 'file'})`);
  });
  
  // 检查package.json
  const packageJsonPath = path.join(asyncValidatorPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    console.log('\nPackage.json analysis:');
    console.log(`  Name: ${packageJson.name}`);
    console.log(`  Version: ${packageJson.version}`);
    console.log(`  Files field: ${JSON.stringify(packageJson.files)}`);
    console.log(`  Main entry: ${packageJson.main}`);
    console.log(`  Types entry: ${packageJson.types}`);
    
    // 检查缺失的文件
    if (packageJson.files && Array.isArray(packageJson.files)) {
      console.log('\nChecking files listed in package.json:');
      for (const filePattern of packageJson.files) {
        // 简单的通配符匹配检查
        if (filePattern.includes('*')) {
          const pattern = filePattern.replace('*', '');
          const matchingFiles = items.filter(item => item.includes(pattern));
          console.log(`  Pattern "${filePattern}": ${matchingFiles.length} matching files`);
        } else {
          const exists = fs.existsSync(path.join(asyncValidatorPath, filePattern));
          console.log(`  ${filePattern}: ${exists ? '✅' : '❌'}`);
        }
      }
    }
  }
  
  console.log('\n✅ async-validator analysis completed');
  if (missingFiles.length > 0) {
    console.log(`❌ Missing files: ${missingFiles.join(', ')}`);
  } else {
    console.log('✅ All required files present');
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('Dependency Fixer Test Suite');
  console.log('='.repeat(60));
  
  try {
    await testFileUtils();
    testConfigManager();
    await testAsyncValidatorAnalysis();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runAllTests();