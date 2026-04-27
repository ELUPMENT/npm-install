const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n=== NPM Cache 清理工具 ===\n');

async function cleanNpmCache() {
  try {
    console.log('🔍 检查 npm 缓存...');
    
    // 获取缓存路径
    const cachePath = execSync('npm config get cache', { encoding: 'utf8' }).trim();
    console.log(`缓存路径: ${cachePath}\n`);
    
    // 检查缓存大小
    try {
      const stats = await fs.stat(cachePath);
      if (stats.isDirectory()) {
        console.log('✅ 缓存目录存在');
      }
    } catch (error) {
      console.log('⚠️  缓存目录不存在或无法访问');
    }
    
    console.log('\n🗑️  清理选项:\n');
    console.log('1. 清理所有缓存（推荐）');
    console.log('2. 只清理特定包的缓存');
    console.log('3. 验证缓存完整性');
    console.log('4. 取消\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('请选择 (1-4): ', resolve);
    });
    
    rl.close();
    
    switch (answer.trim()) {
      case '1':
        console.log('\n正在清理所有 npm 缓存...\n');
        try {
          execSync('npm cache clean --force', { stdio: 'inherit' });
          console.log('\n✅ 缓存清理完成！');
        } catch (error) {
          console.error('\n❌ 缓存清理失败:', error.message);
        }
        break;
        
      case '2':
        const packageName = await new Promise((resolve) => {
          rl.question('请输入包名 (例如: form-data): ', resolve);
        });
        console.log(`\n正在清理 ${packageName} 的缓存...`);
        
        // npm 没有直接清理单个包的命令，需要手动删除
        const packageCacheDir = path.join(cachePath, packageName.replace('/', '-'));
        if (await fs.pathExists(packageCacheDir)) {
          await fs.remove(packageCacheDir);
          console.log(`✅ ${packageName} 缓存已清理`);
        } else {
          console.log(`⚠️  ${packageName} 缓存不存在`);
        }
        break;
        
      case '3':
        console.log('\n正在验证缓存完整性...\n');
        try {
          execSync('npm cache verify', { stdio: 'inherit' });
          console.log('\n✅ 缓存验证完成！');
        } catch (error) {
          console.error('\n❌ 缓存验证失败:', error.message);
        }
        break;
        
      case '4':
        console.log('\n已取消操作');
        break;
        
      default:
        console.log('\n❌ 无效选择');
    }
    
    console.log('\n💡 提示:');
    console.log('   清理缓存后，建议重新安装包:');
    console.log('   npm install <package> --registry=http://localhost:4873\n');
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  }
}

cleanNpmCache();
