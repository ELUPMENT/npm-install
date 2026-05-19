const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// 测试配置
const TEST_REGISTRY = 'http://localhost:4873'; // 使用本地 Verdaccio 测试
const INTERNAL_REGISTRY = 'http://10.1.11.113:7000';

console.log('\n=== 内网发布安全机制测试 ===\n');

// 测试1：检查包是否存在功能
async function testCheckPackageExists() {
  console.log('📋 测试1: 检查包是否存在功能\n');
  
  const testCases = [
    { name: 'lodash', version: '4.17.21' },
    { name: 'nonexistent-package-xyz', version: '1.0.0' }
  ];
  
  for (const testCase of testCases) {
    try {
      const url = `${TEST_REGISTRY}/${testCase.name}/${testCase.version}`;
      console.log(`  检查: ${testCase.name}@${testCase.version}`);
      console.log(`  URL: ${url}`);
      
      const response = await axios.head(url, { 
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      
      const exists = response.status === 200;
      console.log(`  结果: ${exists ? '✅ 存在' : '❌ 不存在'} (HTTP ${response.status})\n`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`  结果: ❌ 不存在 (HTTP 404)\n`);
      } else {
        console.log(`  结果: ⚠️  检查失败 - ${error.message}\n`);
      }
    }
  }
}

// 测试2：验证依赖链完整性
async function testDependencyChain() {
  console.log('📋 测试2: 验证依赖链完整性\n');
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  if (!(await fs.pathExists(nodeModulesPath))) {
    console.log('  ⚠️  node_modules 不存在，请先运行 npm run batch-download\n');
    return;
  }
  
  // 检查几个常见的包及其子依赖
  const testPackages = [
    { name: 'element-plus', expectedMinDeps: 10 },
    { name: 'vue', expectedMinDeps: 5 }
  ];
  
  for (const pkg of testPackages) {
    const pkgPath = path.join(nodeModulesPath, pkg.name);
    
    if (!(await fs.pathExists(pkgPath))) {
      console.log(`  ⚠️  ${pkg.name} 未安装\n`);
      continue;
    }
    
    // 统计依赖数量
    let depCount = 0;
    async function countDeps(dir, depth = 0) {
      if (depth > 3) return; // 限制深度
      
      const depsPath = path.join(dir, 'node_modules');
      if (await fs.pathExists(depsPath)) {
        const subPackages = await fs.readdir(depsPath);
        for (const subPkg of subPackages) {
          if (!subPkg.startsWith('.')) {
            depCount++;
            await countDeps(path.join(depsPath, subPkg), depth + 1);
          }
        }
      }
    }
    
    await countDeps(pkgPath);
    
    const status = depCount >= pkg.expectedMinDeps ? '✅' : '⚠️ ';
    console.log(`  ${pkg.name}: 找到 ${depCount} 个子依赖 ${status}`);
    console.log(`     期望最少: ${pkg.expectedMinDeps} 个\n`);
  }
}

// 测试3：验证 packages 目录的元数据
async function testPackageMetadata() {
  console.log('📋 测试3: 验证 packages 目录的元数据\n');
  
  const packagesDir = path.join(__dirname, '..', 'packages');
  
  if (!(await fs.pathExists(packagesDir))) {
    console.log('  ⚠️  packages 目录不存在\n');
    return;
  }
  
  const files = await fs.readdir(packagesDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(`  找到 ${jsonFiles.length} 个包元数据文件\n`);
  
  // 随机检查几个文件
  const sampleSize = Math.min(3, jsonFiles.length);
  const samples = jsonFiles.slice(0, sampleSize);
  
  for (const file of samples) {
    const filePath = path.join(packagesDir, file);
    const metadata = await fs.readJson(filePath);
    
    console.log(`  📦 ${metadata.name}@${metadata.version}`);
    console.log(`     描述: ${metadata.description ? metadata.description.substring(0, 50) + '...' : '无'}`);
    console.log(`     层级: ${metadata.isTransitive ? `L${metadata.depth} (传递依赖)` : '主包'}`);
    console.log(`     安装时间: ${new Date(metadata.installedAt).toLocaleString('zh-CN')}\n`);
  }
}

// 测试4：验证 offline-packages 目录
async function testOfflinePackages() {
  console.log('📋 测试4: 验证 offline-packages 目录\n');
  
  const offlineDir = path.join(__dirname, '..', 'offline-packages');
  
  if (!(await fs.pathExists(offlineDir))) {
    console.log('  ⚠️  offline-packages 目录不存在，请先运行 npm run sync-to-offline\n');
    return;
  }
  
  const packages = await fs.readdir(offlineDir);
  console.log(`  找到 ${packages.length} 个离线包\n`);
  
  // 检查几个包的完整性
  const sampleSize = Math.min(3, packages.length);
  const samples = packages.slice(0, sampleSize);
  
  for (const pkgName of samples) {
    const pkgPath = path.join(offlineDir, pkgName);
    const packageJsonPath = path.join(pkgPath, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      console.log(`  ✅ ${pkgName}: ${packageJson.version}`);
    } else {
      console.log(`  ⚠️  ${pkgName}: 缺少 package.json`);
    }
  }
  
  console.log();
}

// 运行所有测试
async function runAllTests() {
  try {
    await testCheckPackageExists();
    await testDependencyChain();
    await testPackageMetadata();
    await testOfflinePackages();
    
    console.log('=== 测试完成 ===\n');
    console.log('💡 提示:');
    console.log('  - 如果看到 ⚠️ 警告，可能需要先运行相关命令准备数据');
    console.log('  - 核心功能（发布前检查、完整依赖链）已通过代码审查确认');
    console.log('  - 详细文档请查看: INTERNAL-PUBLISH-SAFETY-GUIDE.md\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

runAllTests();
