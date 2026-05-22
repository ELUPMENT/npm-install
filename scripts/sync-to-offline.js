const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');
const SYNC_LOG = path.join(__dirname, '..', 'sync-log.json');
const NODE_MODULES = path.join(__dirname, '..', 'node_modules');

// 递归查找 node_modules 中所有版本的包
async function findAllPackageVersions(packageName) {
  const versions = new Map(); // version -> path
  
  async function searchDir(dir, depth = 0) {
    if (depth > 10) return; // 限制递归深度
    
    const isScopedPackage = packageName.startsWith('@');
    const [scope, scopedName] = isScopedPackage ? packageName.split('/') : [];

    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          // 检查是否是目标包（支持 scoped packages）
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

          if (isScopedPackage && item === scope) {
            const scopedPkgPath = path.join(itemPath, scopedName);
            const pkgJsonPath = path.join(scopedPkgPath, 'package.json');
            if (await fs.pathExists(pkgJsonPath)) {
              try {
                const pkgJson = await fs.readJson(pkgJsonPath);
                const version = pkgJson.version;
                if (version && !versions.has(version)) {
                  versions.set(version, scopedPkgPath);
                }
              } catch (e) {
                // 忽略无效的 package.json
              }
            }
          }
          
          // 递归搜索子目录中的 node_modules 或命名空间目录
          if (item === 'node_modules' || item.startsWith('@') || depth === 0) {
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

// 查找特定版本的包路径
async function findPackagePath(packageName, version) {
  const foundPaths = [];
  
  async function searchDir(dir, depth = 0) {
    if (depth > 10 || foundPaths.length > 0) return; // 找到一个就停止
    
    const isScopedPackage = packageName.startsWith('@');
    const [scope, scopedName] = isScopedPackage ? packageName.split('/') : [];

    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        if (!stat.isDirectory()) continue;

        if (item === packageName) {
          const pkgJsonPath = path.join(itemPath, 'package.json');
          if (await fs.pathExists(pkgJsonPath)) {
            try {
              const pkgJson = await fs.readJson(pkgJsonPath);
              if (pkgJson.version === version) {
                foundPaths.push(itemPath);
                return;
              }
            } catch (e) {
              // 忽略
            }
          }
        }

        if (isScopedPackage && item === scope) {
          const scopedPkgPath = path.join(itemPath, scopedName);
          const pkgJsonPath = path.join(scopedPkgPath, 'package.json');
          if (await fs.pathExists(pkgJsonPath)) {
            try {
              const pkgJson = await fs.readJson(pkgJsonPath);
              if (pkgJson.version === version) {
                foundPaths.push(scopedPkgPath);
                return;
              }
            } catch (e) {
              // 忽略
            }
          }
        }
      }
      
      // 递归搜索 node_modules 和命名空间目录
      for (const item of items) {
        if (item === 'node_modules' || item.startsWith('@') || depth === 0) {
          const subPath = path.join(dir, item);
          if (await fs.pathExists(subPath)) {
            await searchDir(subPath, depth + 1);
            if (foundPaths.length > 0) return;
          }
        }
      }
    } catch (error) {
      // 忽略
    }
  }
  
  await searchDir(NODE_MODULES);
  return foundPaths.length > 0 ? foundPaths[0] : null;
}

// 扫描整个 node_modules，找出所有存在多版本的包
async function scanAllMultiVersionPackages() {
  console.log('\n正在扫描 node_modules 中的所有包版本...');
  
  const allPackages = new Map(); // packageName -> Map(version -> path)
  
  async function scanDir(dir, depth = 0) {
    if (depth > 10) return;
    
    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        // 跳过隐藏文件和 .cache
        if (item.startsWith('.') || item === '.cache') continue;
        
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          // 如果是 node_modules 或命名空间目录，递归扫描
          if (item === 'node_modules' || item.startsWith('@')) {
            await scanDir(itemPath, depth + 1);
          } else {
            // 检查是否是 npm 包（包含 package.json）
            const pkgJsonPath = path.join(itemPath, 'package.json');
            if (await fs.pathExists(pkgJsonPath)) {
              try {
                const pkgJson = await fs.readJson(pkgJsonPath);
                if (pkgJson.name && pkgJson.version) {
                  if (!allPackages.has(pkgJson.name)) {
                    allPackages.set(pkgJson.name, new Map());
                  }
                  // 记录版本和路径的映射
                  allPackages.get(pkgJson.name).set(pkgJson.version, itemPath);
                }
              } catch (e) {
                // 忽略无效文件
              }
            }
            
            // 如果该目录下有 node_modules，也要扫描
            const nmPath = path.join(itemPath, 'node_modules');
            if (await fs.pathExists(nmPath)) {
              await scanDir(nmPath, depth + 1);
            }
          }
        }
      }
    } catch (error) {
      // 忽略错误
    }
  }
  
  await scanDir(NODE_MODULES);
  
  // 过滤出有多版本的包，并转换为 Map(packageName -> Map(version -> path))
  const multiVersionPackages = new Map();
  for (const [name, versionMap] of allPackages) {
    if (versionMap.size > 1) {
      multiVersionPackages.set(name, versionMap);
    }
  }
  
  return multiVersionPackages;
}

// 检查并修复缺失的 npm alias 依赖
async function checkAndFixMissingDependencies() {
  console.log('\n正在检查 packages 目录中所有包的依赖完整性...');
  
  const packageFiles = await fs.readdir(PACKAGES_DIR);
  const missingDeps = new Set();
  
  for (const file of packageFiles) {
    if (!file.endsWith('.json')) continue;
    
    const packageInfoPath = path.join(PACKAGES_DIR, file);
    const packageInfo = await fs.readJson(packageInfoPath);
    
    // 从公网获取该包的完整依赖信息
    try {
      const registry = 'https://registry.npmjs.org';
      const response = await fetch(`${registry}/${packageInfo.name}/${packageInfo.version}`);
      if (!response.ok) continue;
      
      const pkgData = await response.json();
      const dependencies = pkgData.dependencies || {};
      
      // 检查每个依赖是否存在于 node_modules 中
      for (const [depName, depVersion] of Object.entries(dependencies)) {
        // 处理 npm alias: "npm:@actual/package@version"
        let actualDepName = depName;
        let actualDepVersion = depVersion;
        
        if (depVersion.startsWith('npm:')) {
          // 提取实际的包名和版本
          const aliasMatch = depVersion.match(/^npm:(.+)@(.+)$/);
          if (aliasMatch) {
            actualDepName = aliasMatch[1];
            actualDepVersion = aliasMatch[2];
          }
        }
        
        // 检查是否在 node_modules 中存在
        const depPath = path.join(NODE_MODULES, actualDepName.replace(/\//g, path.sep));
        if (!(await fs.pathExists(depPath))) {
          console.log(`  ⚠ 缺失依赖: ${actualDepName}@${actualDepVersion} (被 ${packageInfo.name}@${packageInfo.version} 需要)`);
          missingDeps.add(`${actualDepName}@${actualDepVersion}`);
        }
      }
    } catch (error) {
      console.warn(`  ⚠ 无法检查 ${packageInfo.name}@${packageInfo.version} 的依赖: ${error.message}`);
    }
  }
  
  // 下载缺失的依赖
  if (missingDeps.size > 0) {
    console.log(`\n发现 ${missingDeps.length} 个缺失的依赖，开始下载...\n`);
    
    const registry = 'https://registry.npmjs.org';
    let successCount = 0;
    let failCount = 0;
    
    for (const depSpec of missingDeps) {
      try {
        console.log(`  下载: ${depSpec}...`);
        const installCmd = `npm install ${depSpec} --registry=${registry} --no-save --legacy-peer-deps`;
        execSync(installCmd, { stdio: 'pipe' });
        console.log(`  ✓ ${depSpec} 下载成功`);
        successCount++;
      } catch (error) {
        console.error(`  ✗ ${depSpec} 下载失败: ${error.message}`);
        failCount++;
      }
    }
    
    console.log(`\n✓ 依赖修复完成: 成功 ${successCount} 个, 失败 ${failCount} 个\n`);
  } else {
    console.log('✓ 所有依赖完整，无需修复\n');
  }
}

// 清理旧的命名空间目录（避免重复）
async function cleanupOldNamespaceDirs() {
  try {
    const items = await fs.readdir(OFFLINE_DIR);
    let cleanedCount = 0;
    
    for (const item of items) {
      // 跳过 at_ 开头的文件夹和 package.json 文件
      if (item.startsWith('at_') || item.endsWith('.json')) continue;
      
      // 检查是否是命名空间目录（@开头）或普通包目录
      const itemPath = path.join(OFFLINE_DIR, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        // 如果是 @ 开头的命名空间目录，删除它
        if (item.startsWith('@')) {
          console.log(`  删除旧命名空间目录: ${item}`);
          await fs.remove(itemPath);
          cleanedCount++;
        } else if (!item.includes('@')) {
          // 如果是不包含版本号的普通目录（如 postcss），也删除
          // 因为我们统一使用 packageName@version 格式
          const hasPackageJson = await fs.pathExists(path.join(itemPath, 'package.json'));
          if (hasPackageJson) {
            console.log(`  删除旧格式目录: ${item}`);
            await fs.remove(itemPath);
            cleanedCount++;
          }
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`✓ 已清理 ${cleanedCount} 个旧格式目录\n`);
    } else {
      console.log('✓ 无需清理\n');
    }
  } catch (error) {
    console.warn('⚠ 清理旧目录时出错:', error.message, '\n');
  }
}

// 同步所有已安装的包到离线文件夹（支持多版本）
async function syncToOffline() {
  try {
    console.log('\n=== 同步依赖包到离线文件夹（增强版 - 支持多版本） ===\n');
    
    // 确保离线目录存在
    await fs.ensureDir(OFFLINE_DIR);
    
    // 清理旧的命名空间目录（避免重复）
    console.log('🧹 清理 offline-packages 中的旧命名空间目录...');
    await cleanupOldNamespaceDirs();
    
    // 第0步：检查并修复缺失的 npm alias 依赖
    console.log('\n🔍 步骤 0: 检查依赖完整性...');
    await checkAndFixMissingDependencies();
    
    // 第1步：扫描并同步所有多版本的传递依赖
    console.log('\n📦 步骤 1: 扫描 node_modules 中所有多版本的包...');
    const multiVersionPackages = await scanAllMultiVersionPackages();
    
    let totalSuccessCount = 0;
    let totalFailCount = 0;
    let totalMultiVersionCount = 0;
    const allSyncResults = [];
    
    if (multiVersionPackages.size > 0) {
      console.log(`发现 ${multiVersionPackages.size} 个有多版本的包:\n`);
      
      for (const [packageName, versionMap] of multiVersionPackages) {
        console.log(`正在处理: ${packageName} (${versionMap.size} 个版本)...`);
        
        const safeFileName = packageName.replace(/\//g, '_').replace(/@/g, 'at_');
        
        try {
          // 为每个版本创建独立文件夹
          for (const [version, pkgPath] of versionMap) {
            const versionedFileName = `${safeFileName}@${version}`;
            const offlinePackagePath = path.join(OFFLINE_DIR, versionedFileName);
            
            await fs.copy(pkgPath, offlinePackagePath);
            console.log(`  ✓ ${packageName}@${version} 同步成功`);
            
            allSyncResults.push({
              name: packageName,
              version: version,
              status: 'success',
              syncTime: new Date().toISOString(),
              offlinePath: offlinePackagePath,
              isMultiVersion: true,
              isTransitive: true
            });
            
            totalSuccessCount++;
          }
          
          totalMultiVersionCount++;
        } catch (error) {
          console.error(`  ✗ ${packageName} 同步失败:`, error.message);
          totalFailCount++;
        }
      }
      
      console.log(`\n✓ 多版本传递依赖同步完成: ${totalSuccessCount} 个版本\n`);
    } else {
      console.log('未发现多版本的传递依赖\n');
    }
    
    // 读取所有包信息
    const packageFiles = await fs.readdir(PACKAGES_DIR);
    
    if (packageFiles.length === 0) {
      console.log('没有需要同步的包');
      return;
    }
    
    let successCount = totalSuccessCount;
    let failCount = totalFailCount;
    let multiVersionCount = totalMultiVersionCount;
    const syncResults = allSyncResults;
    
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
        
        // 如果只有一个版本，也按版本目录同步
        if (versions.size === 1) {
          const [version, pkgPath] = versions.entries().next().value;
          const versionedFileName = `${safeFileName}@${version}`;
          const offlinePackagePath = path.join(OFFLINE_DIR, versionedFileName);
          
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
