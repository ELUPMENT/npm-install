const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');
const LOCAL_REGISTRY = 'http://localhost:4873'; // 本地 Verdaccio 地址

// 检查包是否已在本地仓库中存在
async function checkPackageExists(packageName, version) {
  try {
    const url = `${LOCAL_REGISTRY}/${encodeURIComponent(packageName)}/${version}`;
    const response = await axios.head(url, { 
      timeout: 5000,
      validateStatus: (status) => status < 500
    });
    
    return response.status === 200;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false;
    }
    console.warn(`⚠ 无法检查 ${packageName}@${version} 是否存在，将尝试发布`);
    return null;
  }
}

// 递归查找所有包含 package.json 的目录
async function findPackages(dir, packages = []) {
  const items = await fs.readdir(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = await fs.stat(itemPath);
    
    if (stat.isDirectory()) {
      const packageJsonPath = path.join(itemPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        // 这是一个 npm 包目录
        packages.push(itemPath);
      } else {
        // 递归查找子目录
        await findPackages(itemPath, packages);
      }
    }
  }
  
  return packages;
}

// 临时移除 package.json 中的 scripts 字段
async function temporarilyRemoveScripts(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  const backupPath = path.join(packagePath, 'package.json.backup');
  
  // 读取原始 package.json
  const packageJson = await fs.readJson(packageJsonPath);
  
  // 如果有 scripts 字段或 publishConfig.provenance，备份并移除
  let modified = false;
  
  if (packageJson.scripts) {
    delete packageJson.scripts;
    modified = true;
  }
  
  if (packageJson.publishConfig && packageJson.publishConfig.provenance) {
    delete packageJson.publishConfig.provenance;
    // 如果 publishConfig 变为空对象，也删除它
    if (Object.keys(packageJson.publishConfig).length === 0) {
      delete packageJson.publishConfig;
    }
    modified = true;
  }
  
  if (modified) {
    await fs.copyFile(packageJsonPath, backupPath);
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    return true;
  }
  
  return false;
}

// 恢复 package.json 中的 scripts 字段
async function restoreScripts(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  const backupPath = path.join(packagePath, 'package.json.backup');
  
  if (await fs.pathExists(backupPath)) {
    await fs.move(backupPath, packageJsonPath, { overwrite: true });
    return true;
  }
  
  return false;
}

// 发布离线包到本地 Verdaccio
async function publishToLocal() {
  try {
    console.log('\n=== 发布离线包到本地 Verdaccio 仓库 ===\n');
    console.log(`目标仓库: ${LOCAL_REGISTRY}\n`);
    console.log('策略: 仅发布本地仓库中不存在的包版本，已存在的包将被跳过\n');
    
    // 第0步：同步所有包到离线文件夹（支持多版本）
    console.log('🔄 步骤 0: 同步 node_modules 中的所有包版本到 offline-packages...\n');
    const syncScriptPath = path.join(__dirname, 'sync-to-offline.js');
    
    if (await fs.pathExists(syncScriptPath)) {
      try {
        const isWindows = process.platform === 'win32';
        const command = isWindows ? `cmd /c "node "${syncScriptPath}""` : `node "${syncScriptPath}"`;
        execSync(command, { stdio: 'inherit' });
        console.log('\n✓ 同步完成，offline-packages 已包含所有版本\n');
      } catch (syncError) {
        console.warn('⚠ 同步失败，将继续使用现有的 offline-packages\n');
        console.warn('   错误信息:', syncError.message, '\n');
      }
    } else {
      console.warn('⚠ 未找到 sync-to-offline.js 脚本，跳过同步步骤\n');
    }
    
    // 检查离线文件夹是否存在
    if (!(await fs.pathExists(OFFLINE_DIR))) {
      console.log('✗ 离线文件夹不存在:', OFFLINE_DIR);
      console.log('请先运行 "npm run sync-to-offline" 同步依赖包');
      return;
    }
    
    // 递归查找所有包
    console.log('正在扫描离线包目录...');
    const packageDirs = await findPackages(OFFLINE_DIR);
    
    if (packageDirs.length === 0) {
      console.log('没有需要发布的离线包');
      return;
    }
    
    console.log(`找到 ${packageDirs.length} 个离线包，开始检查并发布...\n`);
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const results = [];
    
    for (const packagePath of packageDirs) {
      try {
        // 检查 package.json
        const packageJsonPath = path.join(packagePath, 'package.json');
        if (!(await fs.pathExists(packageJsonPath))) {
          continue;
        }
        
        const packageJson = await fs.readJson(packageJsonPath);
        const packageName = packageJson.name;
        const version = packageJson.version;
        
        console.log(`正在处理: ${packageName}@${version}...`);
        
        // 在发布前检查包是否已存在
        console.log(`  检查 ${packageName}@${version} 是否已存在于本地仓库...`);
        const exists = await checkPackageExists(packageName, version);
        
        if (exists === true) {
          console.log(`⊘ ${packageName}@${version} 已存在，跳过发布\n`);
          skippedCount++;
          
          results.push({
            name: packageName,
            version: version,
            status: 'skipped',
            reason: 'Package already exists in local registry',
            publishTime: new Date().toISOString()
          });
          
          continue;
        }
        
        // Windows 兼容性
        const isWindows = process.platform === 'win32';
        
        // 创建临时 .npmrc 文件以配置本地仓库
        const npmrcPath = path.join(packagePath, '.npmrc');
        let npmrcContent = `registry=${LOCAL_REGISTRY}\nalways-auth=false\n`;
        
        // 对于 scoped packages，添加特殊的注册表配置
        if (packageName.startsWith('@')) {
          const scope = packageName.split('/')[0];
          npmrcContent += `${scope}:registry=${LOCAL_REGISTRY}\n`;
        }
        
        await fs.writeFile(npmrcPath, npmrcContent);
        
        let scriptsRemoved = false;
        
        try {
          // 第一次尝试：使用 --ignore-scripts 和 --registry 发布
          const publishCmd = isWindows
            ? `cd /d "${packagePath}" && npm publish --registry ${LOCAL_REGISTRY} --offline --ignore-scripts`
            : `cd "${packagePath}" && npm publish --registry ${LOCAL_REGISTRY} --offline --ignore-scripts`;
          
          execSync(publishCmd, {
            stdio: 'pipe',
            timeout: 60000,
            env: {
              ...process.env,
              NPM_CONFIG_OFFLINE: 'true',
              NPM_CONFIG_REGISTRY: LOCAL_REGISTRY
            }
          });
          
          console.log(`✓ ${packageName}@${version} 发布成功\n`);
          
          results.push({
            name: packageName,
            version: version,
            status: 'success',
            publishTime: new Date().toISOString()
          });
          
          successCount++;
          
        } catch (publishError) {
          const errorMessage = publishError.message || '';
          
          if (errorMessage.includes('E409') || 
              errorMessage.includes('Conflict') ||
              errorMessage.includes('already exists')) {
            
            console.log(`⊘ ${packageName}@${version} 已存在（二次确认），跳过发布\n`);
            skippedCount++;
            results.push({
              name: packageName,
              version: version,
              status: 'skipped',
              reason: 'Version already exists (E409)',
              publishTime: new Date().toISOString()
            });
            
          } else if (errorMessage.includes('E401') || 
                     errorMessage.includes('Unauthorized') ||
                     errorMessage.includes('ENEEDAUTH')) {
            
            console.error(`✗ ${packageName}@${version} 发布失败: 需要认证\n`);
            console.error('   Verdaccio 配置可能需要调整');
            console.error('   请确认 config.yaml 中 publish 设置为 $all');
            
            results.push({
              name: packageName,
              version: version,
              status: 'failed',
              error: 'Authentication required',
              publishTime: new Date().toISOString()
            });
            failCount++;
            
          } else {
            // 其他错误，可能是构建脚本问题，尝试移除 scripts 后重新发布
            console.log(`  ⚠ 首次发布失败，尝试移除 scripts 字段后重新发布...`);
            
            try {
              scriptsRemoved = await temporarilyRemoveScripts(packagePath);
              
              if (scriptsRemoved) {
                console.log(`  ℹ 已临时移除 scripts 字段`);
                
                // 第二次尝试：移除 scripts 后发布，指定注册表
                const retryCmd = isWindows
                  ? `cd /d "${packagePath}" && npm publish --registry ${LOCAL_REGISTRY} --offline`
                  : `cd "${packagePath}" && npm publish --registry ${LOCAL_REGISTRY} --offline`;
                
                execSync(retryCmd, {
                  stdio: 'pipe',
                  timeout: 60000,
                  env: {
                    ...process.env,
                    NPM_CONFIG_OFFLINE: 'true',
                    NPM_CONFIG_REGISTRY: LOCAL_REGISTRY
                  }
                });
                
                console.log(`✓ ${packageName}@${version} 发布成功（移除 scripts 后）\n`);
                
                results.push({
                  name: packageName,
                  version: version,
                  status: 'success',
                  method: 'removed-scripts',
                  publishTime: new Date().toISOString()
                });
                
                successCount++;
              } else {
                throw publishError;
              }
              
            } catch (retryError) {
              console.error(`✗ ${packageName}@${version} 发布失败:`, retryError.message, '\n');
              
              results.push({
                name: packageName,
                version: version,
                status: 'failed',
                error: retryError.message,
                publishTime: new Date().toISOString()
              });
              failCount++;
            }
          }
        } finally {
          // 清理临时 .npmrc 文件
          if (await fs.pathExists(npmrcPath)) {
            await fs.remove(npmrcPath);
          }
          
          // 恢复 scripts 字段
          if (scriptsRemoved) {
            await restoreScripts(packagePath);
            console.log(`  ℹ 已恢复 scripts 字段`);
          }
        }
        
      } catch (error) {
        const relativePath = path.relative(OFFLINE_DIR, packagePath);
        console.error(`✗ ${relativePath} 发布失败:`, error.message, '\n');
        
        results.push({
          name: packagePath,
          status: 'failed',
          error: error.message,
          publishTime: new Date().toISOString()
        });
        failCount++;
      }
    }
    
    // 生成发布报告
    const report = {
      publishTime: new Date().toISOString(),
      targetRegistry: LOCAL_REGISTRY,
      totalPackages: packageDirs.length,
      successCount: successCount,
      skippedCount: skippedCount,
      failCount: failCount,
      results: results
    };
    
    const reportPath = path.join(__dirname, '..', 'publish-local-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    console.log('\n=== 发布完成 ===');
    console.log(`总计: ${packageDirs.length} 个包`);
    console.log(`成功发布: ${successCount} 个`);
    console.log(`跳过(已存在): ${skippedCount} 个`);
    console.log(`失败: ${failCount} 个`);
    console.log(`\n发布报告已保存到: ${reportPath}`);
    
    if (failCount > 0) {
      console.log('\n⚠ 部分包发布失败，请检查错误信息');
    }
    
  } catch (error) {
    console.error('✗ 发布过程出错:', error.message);
  }
}

publishToLocal();
