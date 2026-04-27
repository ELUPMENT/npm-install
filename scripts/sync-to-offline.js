const fs = require('fs-extra');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');
const SYNC_LOG = path.join(__dirname, '..', 'sync-log.json');
const NODE_MODULES = path.join(__dirname, '..', 'node_modules');

// 递归查找 node_modules 中所有版本的包
async function findAllPackageVersions(packageName) {
  const versions = new Map(); // version -> path
  
  async function searchDir(dir, depth = 0) {
    if (depth > 10) return; // 限制递归深度
    
    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          // 检查是否是目标包
          if (item === packageName) {
            const pkgJsonPath = path.join(itemPath, 'package.json');
            if (await fs.pathExists(pkgJsonPath)) {
              try {
                const pkgJson = await fs.readJson(pkgJsonPath);
                const version = pkgJson.version;
                if (version && !versions.has(version)) {
                  versions.set(version, itemPath);
                }
              } catch (e) {
                // 忽略无效的 package.json
              }
            }
          }
          
          // 递归搜索子目录中的 node_modules
          if (item === 'node_modules' || depth === 0) {
            await searchDir(itemPath, depth + 1);
          }
        }
      }
    } catch (error) {
      // 忽略权限错误或不存在的路径
    }
  }
  
  await searchDir(NODE_MODULES);
  return versions;
}

// 同步所有已安装的包到离线文件夹（支持多版本）
async function syncToOffline() {
  try {
    console.log('\n=== 同步依赖包到离线文件夹（增强版 - 支持多版本） ===\n');
    
    // 确保离线目录存在
    await fs.ensureDir(OFFLINE_DIR);
    
    // 读取所有包信息
    const packageFiles = await fs.readdir(PACKAGES_DIR);
    
    if (packageFiles.length === 0) {
      console.log('没有需要同步的包');
      return;
    }
    
    const syncResults = [];
    let successCount = 0;
    let failCount = 0;
    let multiVersionCount = 0;
    
    for (const file of packageFiles) {
      if (!file.endsWith('.json')) continue;
      
      const packageInfoPath = path.join(PACKAGES_DIR, file);
      const packageInfo = await fs.readJson(packageInfoPath);
      
      const packageName = packageInfo.name;
      
      // Windows 兼容的文件名处理：替换 / 和 @ 符号
      const safeFileName = packageName.replace(/\//g, '_').replace(/@/g, 'at_');
      
      console.log(`\n正在同步: ${packageName}...`);
      
      try {
        // 查找所有版本
        const versions = await findAllPackageVersions(packageName);
        
        if (versions.size === 0) {
          console.log(`⚠ ${packageName} 在 node_modules 中不存在`);
          
          syncResults.push({
            name: packageName,
            version: packageInfo.version,
            status: 'failed',
            reason: 'Package not found in node_modules',
            syncTime: new Date().toISOString()
          });
          
          failCount++;
          continue;
        }
        
        // 如果只有一个版本，使用原有逻辑
        if (versions.size === 1) {
          const [version, pkgPath] = versions.entries().next().value;
          const offlinePackagePath = path.join(OFFLINE_DIR, safeFileName);
          
          await fs.copy(pkgPath, offlinePackagePath);
          console.log(`✓ ${packageName}@${version} 同步成功`);
          
          syncResults.push({
            name: packageName,
            version: version,
            status: 'success',
            syncTime: new Date().toISOString(),
            offlinePath: offlinePackagePath
          });
          
          successCount++;
        } else {
          // 多个版本，为每个版本创建独立文件夹
          console.log(`  发现 ${versions.size} 个版本:`);
          multiVersionCount++;
          
          for (const [version, pkgPath] of versions) {
            const versionedFileName = `${safeFileName}@${version}`;
            const offlinePackagePath = path.join(OFFLINE_DIR, versionedFileName);
            
            await fs.copy(pkgPath, offlinePackagePath);
            console.log(`  ✓ ${packageName}@${version} 同步成功`);
            
            syncResults.push({
              name: packageName,
              version: version,
              status: 'success',
              syncTime: new Date().toISOString(),
              offlinePath: offlinePackagePath,
              isMultiVersion: true
            });
            
            successCount++;
          }
        }
      } catch (error) {
        console.error(`✗ ${packageName} 同步失败:`, error.message);
        
        syncResults.push({
          name: packageName,
          version: packageInfo.version,
          status: 'failed',
          error: error.message,
          syncTime: new Date().toISOString()
        });
        
        failCount++;
      }
    }
    
    // 保存同步日志
    const syncLog = {
      lastSyncTime: new Date().toISOString(),
      totalPackages: packageFiles.length,
      successCount: successCount,
      failCount: failCount,
      multiVersionPackages: multiVersionCount,
      results: syncResults
    };
    
    await fs.writeJson(SYNC_LOG, syncLog, { spaces: 2 });
    
    console.log('\n=== 同步完成 ===');
    console.log(`总计: ${packageFiles.length} 个包`);
    console.log(`成功: ${successCount} 个（包含 ${multiVersionCount} 个多版本包）`);
    console.log(`失败: ${failCount} 个`);
    console.log(`\n同步日志已保存到: ${SYNC_LOG}`);
    
  } catch (error) {
    console.error('✗ 同步失败:', error.message);
  }
}

syncToOffline();
