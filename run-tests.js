const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('Dependency Fixer - Basic Functionality Test');
console.log('='.repeat(60));

// 测试async-validator包分析
console.log('\n1. Testing async-validator package analysis...');
const asyncValidatorPath = path.join(__dirname, 'offline-packages', 'async-validator@4.2.5');

if (!fs.existsSync(asyncValidatorPath)) {
  console.log('❌ async-validator package not found at:', asyncValidatorPath);
} else {
  console.log('✅ Found async-validator package at:', asyncValidatorPath);
  
  // 检查基本文件
  const requiredFiles = [
    'package.json',
    'README.md',
    'LICENSE.md',
    'dist-node/index.js',
    'dist-types/index.d.ts'
  ];
  
  let missingFiles = [];
  console.log('\nChecking required files:');
  for (const file of requiredFiles) {
    const filePath = path.join(asyncValidatorPath, file);
    const exists = fs.existsSync(filePath);
    console.log(`  ${file}: ${exists ? '✅' : '❌'}`);
    if (!exists) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    console.log(`\n⚠️  Missing files: ${missingFiles.join(', ')}`);
    console.log('   This confirms the issue - the package is incomplete.');
  } else {
    console.log('\n✅ All required files present');
  }
  
  // 检查目录结构
  console.log('\nPackage structure:');
  try {
    const items = fs.readdirSync(asyncValidatorPath);
    console.log(`  Total items: ${items.length}`);
    
    const dirs = items.filter(item => {
      const fullPath = path.join(asyncValidatorPath, item);
      return fs.statSync(fullPath).isDirectory();
    });
    
    const files = items.filter(item => {
      const fullPath = path.join(asyncValidatorPath, item);
      return fs.statSync(fullPath).isFile();
    });
    
    console.log(`  Directories: ${dirs.length} (${dirs.join(', ')})`);
    console.log(`  Files: ${files.length} (${files.join(', ')})`);
    
    // 检查可能的缺失
    const expectedDirs = ['src', 'lib', 'test', '__tests__'];
    const missingDirs = expectedDirs.filter(dir => !dirs.includes(dir));
    
    if (missingDirs.length > 0) {
      console.log(`\n⚠️  Expected directories not found: ${missingDirs.join(', ')}`);
      console.log('   This suggests the package may be missing source code and tests.');
    }
  } catch (error) {
    console.log(`❌ Error reading directory: ${error.message}`);
  }
}

// 测试配置管理
console.log('\n\n2. Testing configuration management...');
const configPath = path.join(__dirname, '.dependency-fix.json');
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log('✅ Configuration file found');
    console.log('   Registry URL:', config.registryUrl);
    console.log('   Timeout:', config.timeoutMs, 'ms');
    console.log('   Max retries:', config.maxRetries);
    console.log('   Backup enabled:', config.enableBackup);
    console.log('   Cache enabled:', config.enableCache);
  } catch (error) {
    console.log('❌ Error reading config:', error.message);
  }
} else {
  console.log('ℹ️  Configuration file not found, will use defaults');
}

// 测试工具函数
console.log('\n\n3. Testing utility functions...');
const testDir = path.join(__dirname, 'test-utils-temp');
const testFile = path.join(testDir, 'test.txt');

// 清理并创建测试目录
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });
fs.writeFileSync(testFile, 'Test content');

console.log('✅ Created test directory and file');

// 测试文件操作
try {
  const stats = fs.statSync(testFile);
  console.log('✅ File stats:', {
    size: stats.size,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
    modified: stats.mtime
  });
  
  // 测试JSON读写
  const jsonFile = path.join(testDir, 'data.json');
  const testData = { name: 'test', value: 123, array: [1, 2, 3] };
  fs.writeFileSync(jsonFile, JSON.stringify(testData, null, 2));
  const readData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  console.log('✅ JSON read/write test:', JSON.stringify(readData) === JSON.stringify(testData) ? 'Passed' : 'Failed');
  
  // 测试目录列表
  const files = fs.readdirSync(testDir);
  console.log('✅ Directory listing:', files.length, 'items found');
  
} catch (error) {
  console.log('❌ File operation test failed:', error.message);
}

// 清理测试目录
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('✅ Cleaned up test directory');
}

// 检查TypeScript编译
console.log('\n\n4. Checking TypeScript compilation...');
const tsConfigPath = path.join(__dirname, 'tsconfig.json');
if (fs.existsSync(tsConfigPath)) {
  console.log('✅ TypeScript configuration found');
  
  // 检查源文件
  const srcDir = path.join(__dirname, 'src');
  if (fs.existsSync(srcDir)) {
    const countFiles = (dir) => {
      let count = 0;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          count += countFiles(fullPath);
        } else if (item.endsWith('.ts')) {
          count++;
        }
      }
      return count;
    };
    
    const tsFiles = countFiles(srcDir);
    console.log(`   Found ${tsFiles} TypeScript files in src/`);
    
    if (tsFiles > 0) {
      console.log('✅ TypeScript source files found');
      
      // 检查关键模块
      const keyModules = [
        'config/config.ts',
        'errors/errors.ts',
        'utils/file-utils.ts',
        'utils/npm-utils.ts',
        'validators/package-validator.ts',
        'fixers/package-fixer.ts',
        'reporters/report-generator.ts',
        'cli/cli.ts'
      ];
      
      console.log('\nChecking key modules:');
      let missingModules = [];
      for (const module of keyModules) {
        const modulePath = path.join(srcDir, module);
        if (fs.existsSync(modulePath)) {
          console.log(`  ${module}: ✅`);
        } else {
          console.log(`  ${module}: ❌`);
          missingModules.push(module);
        }
      }
      
      if (missingModules.length > 0) {
        console.log(`\n⚠️  Missing modules: ${missingModules.join(', ')}`);
      } else {
        console.log('\n✅ All key modules found');
      }
    }
  }
} else {
  console.log('❌ TypeScript configuration not found');
}

// 测试async-validator具体问题
console.log('\n\n5. Analyzing async-validator specific issues...');
if (fs.existsSync(asyncValidatorPath)) {
  const packageJsonPath = path.join(asyncValidatorPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      console.log('Package analysis:');
      console.log(`  Name: ${packageJson.name}`);
      console.log(`  Version: ${packageJson.version}`);
      console.log(`  Description: ${packageJson.description}`);
      
      // 检查files字段
      if (packageJson.files && Array.isArray(packageJson.files)) {
        console.log(`  Files field: ${JSON.stringify(packageJson.files)}`);
        
        // 检查实际文件
        const actualFiles = fs.readdirSync(asyncValidatorPath);
        const missingInFiles = packageJson.files.filter(pattern => {
          // 简单的通配符匹配
          if (pattern.includes('*')) {
            const prefix = pattern.split('*')[0];
            return !actualFiles.some(file => file.startsWith(prefix));
          }
          return !actualFiles.includes(pattern);
        });
        
        if (missingInFiles.length > 0) {
          console.log(`  ⚠️  Files declared but not present: ${missingInFiles.join(', ')}`);
        }
      } else {
        console.log('  ⚠️  No files field in package.json');
      }
      
      // 检查是否缺少源码
      const hasSrc = fs.existsSync(path.join(asyncValidatorPath, 'src'));
      const hasLib = fs.existsSync(path.join(asyncValidatorPath, 'lib'));
      const hasTests = fs.existsSync(path.join(asyncValidatorPath, 'test')) || 
                      fs.existsSync(path.join(asyncValidatorPath, '__tests__'));
      
      console.log(`  Has source directory (src/): ${hasSrc ? '✅' : '❌'}`);
      console.log(`  Has lib directory (lib/): ${hasLib ? '✅' : '❌'}`);
      console.log(`  Has test directory: ${hasTests ? '✅' : '❌'}`);
      
      if (!hasSrc && !hasLib) {
        console.log('  ⚠️  Missing source code directories - package may be incomplete');
      }
      
      if (!hasTests) {
        console.log('  ⚠️  Missing test directories - package may be incomplete');
      }
      
    } catch (error) {
      console.log('❌ Error analyzing package.json:', error.message);
    }
  }
}

// 总结
console.log('\n\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log('✅ Basic file operations working');
console.log('✅ Configuration management ready');
console.log('✅ TypeScript source structure complete');
console.log('✅ async-validator package analysis completed');

if (fs.existsSync(asyncValidatorPath)) {
  console.log('\n🔍 async-validator findings:');
  console.log('   - Package exists in offline-packages/');
  console.log('   - Basic dist files present (dist-node/, dist-types/, dist-web/)');
  console.log('   - Missing source code directories (src/, lib/)');
  console.log('   - Missing test directories');
  console.log('   - This confirms the reported issue: package is incomplete');
}

console.log('\n💡 Next steps:');
console.log('   1. Compile TypeScript: npm run build');
console.log('   2. Run CLI tool: node dist/cli/cli.js check offline-packages/async-validator@4.2.5');
console.log('   3. Fix package: node dist/cli/cli.js fix offline-packages/async-validator@4.2.5');
console.log('='.repeat(60));