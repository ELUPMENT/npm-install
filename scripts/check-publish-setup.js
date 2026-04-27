const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n=== 内网发布前置检查 ===\n');

let allPassed = true;

// 1. 检查 publish-to-internal.js 配置
console.log('1️⃣  检查内网仓库配置...');
try {
  const scriptPath = path.join(__dirname, 'publish-to-internal.js');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const match = scriptContent.match(/const INTERNAL_REGISTRY = '([^']+)'/);
  
  if (!match) {
    console.log('   ❌ 未找到内网仓库配置');
    allPassed = false;
  } else {
    const registry = match[1];
    if (registry.includes('your-internal-npm-registry')) {
      console.log(`   ❌ 内网地址仍是占位符: ${registry}`);
      console.log('   💡 运行以下命令配置:');
      console.log('      npm run configure-internal');
      allPassed = false;
    } else {
      console.log(`   ✅ 内网地址已配置: ${registry}`);
    }
  }
} catch (error) {
  console.log('   ❌ 读取配置文件失败:', error.message);
  allPassed = false;
}

console.log();

// 2. 检查离线包目录
console.log('2️⃣  检查离线包目录...');
const offlineDir = path.join(__dirname, '..', 'offline-packages');
if (!fs.existsSync(offlineDir)) {
  console.log('   ❌ 离线包目录不存在');
  console.log('   💡 运行以下命令同步:');
  console.log('      npm run sync-to-offline');
  allPassed = false;
} else {
  const packages = fs.readdirSync(offlineDir).filter(f => {
    const stat = fs.statSync(path.join(offlineDir, f));
    return stat.isDirectory();
  });
  
  if (packages.length === 0) {
    console.log('   ⚠️  离线包目录为空');
    console.log('   💡 运行以下命令同步:');
    console.log('      npm run sync-to-offline');
  } else {
    console.log(`   ✅ 找到 ${packages.length} 个离线包`);
  }
}

console.log();

// 3. 检查登录状态（可选）
console.log('3️⃣  检查登录状态...');
try {
  const scriptPath = path.join(__dirname, 'publish-to-internal.js');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const match = scriptContent.match(/const INTERNAL_REGISTRY = '([^']+)'/);
  
  if (match && !match[1].includes('your-internal-npm-registry')) {
    const registry = match[1];
    try {
      const output = execSync(`npm whoami --registry ${registry}`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      console.log(`   ✅ 已登录，用户: ${output}`);
    } catch (error) {
      console.log('   ⚠️  未登录或登录已过期');
      console.log('   💡 运行以下命令登录:');
      console.log(`      npm login --registry ${registry}`);
      // 不设置为失败，因为可以稍后登录
    }
  }
} catch (error) {
  // 忽略错误
}

console.log();

// 4. 总结
console.log('=== 检查总结 ===\n');

if (allPassed) {
  console.log('✅ 所有检查通过！可以执行发布\n');
  console.log('🚀 发布命令:');
  console.log('   npm run publish-to-internal');
  console.log();
  console.log('或使用批处理:');
  console.log('   publish-internal.bat');
} else {
  console.log('❌ 发现配置问题，请先修复\n');
  console.log('💡 建议操作:');
  console.log('   1. 配置内网地址: npm run configure-internal');
  console.log('   2. 同步离线包: npm run sync-to-offline');
  console.log('   3. 登录到仓库: npm login --registry <内网地址>');
  console.log('   4. 重新检查: npm run check-publish-setup');
}

console.log();
