const fs = require('fs-extra');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');

async function cleanDuplicatePackages() {
  console.log('\n=== 清理重复的包信息文件 ===\n');
  
  const files = await fs.readdir(PACKAGES_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(`找到 ${jsonFiles.length} 个 JSON 文件:\n`);
  
  // 按包名分组
  const packageMap = new Map();
  
  for (const file of jsonFiles) {
    try {
      const info = await fs.readJson(path.join(PACKAGES_DIR, file));
      const packageName = info.name;
      
      if (!packageMap.has(packageName)) {
        packageMap.set(packageName, []);
      }
      
      packageMap.get(packageName).push({
        file: file,
        path: path.join(PACKAGES_DIR, file),
        installedAt: info.installedAt || 'unknown'
      });
    } catch (error) {
      console.error(`✗ 读取文件失败: ${file}`, error.message);
    }
  }
  
  // 找出重复的包
  let duplicateCount = 0;
  let deletedCount = 0;
  
  console.log('检查重复的包...\n');
  
  for (const [packageName, fileList] of packageMap) {
    if (fileList.length > 1) {
      console.log(`⚠️  发现重复: ${packageName} (${fileList.length} 个文件)`);
      duplicateCount++;
      
      // 按安装时间排序，保留最新的
      fileList.sort((a, b) => {
        return new Date(b.installedAt) - new Date(a.installedAt);
      });
      
      console.log(`   保留: ${fileList[0].file} (最新: ${fileList[0].installedAt})`);
      
      // 删除旧的文件
      for (let i = 1; i < fileList.length; i++) {
        const oldFile = fileList[i];
        console.log(`   删除: ${oldFile.file} (旧: ${oldFile.installedAt})`);
        
        // 检查是否是旧格式（以 @ 开头）
        if (oldFile.file.startsWith('@')) {
          console.log(`   → 这是旧格式文件，应该删除`);
        }
        
        await fs.remove(oldFile.path);
        deletedCount++;
      }
      console.log();
    }
  }
  
  // 总结
  console.log('=== 清理完成 ===\n');
  console.log(`重复的包: ${duplicateCount} 个`);
  console.log(`删除的文件: ${deletedCount} 个`);
  console.log(`剩余的包: ${packageMap.size} 个\n`);
  
  if (deletedCount > 0) {
    console.log('💡 建议:');
    console.log('   现在可以重新运行同步命令:');
    console.log('   npm run sync-to-offline\n');
  }
}

cleanDuplicatePackages().catch(console.error);


