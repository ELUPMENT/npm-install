const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');
const INTERNAL_REGISTRY = 'http://10.1.11.113:7000'; // 修改为内网 npm 仓库地址

// 发布离线包到内网 npm 仓库
async function publishToInternal() {
  try {
    console.log('\n=== 发布离线包到内网 npm 仓库 ===\n');
    console.log(`目标仓库: ${INTERNAL_REGISTRY}\n`);
    
    // 检查离线文件夹是否存在
    if (!(await fs.pathExists(OFFLINE_DIR))) {
      console.log('✗ 离线文件夹不存在:', OFFLINE_DIR);
      console.log('请先运行 "npm run sync-to-offline" 同步依赖包');
      return;
    }
    
    const packages = await fs.readdir(OFFLINE_DIR);
    
    if (packages.length === 0) {
      console.log('没有需要发布的离线包');
      return;
    }
    
    console.log(`找到 ${packages.length} 个离线包，开始发布...\n`);
    
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    for (const packageName of packages) {
      const packagePath = path.join(OFFLINE_DIR, packageName);
      
      if (!(await fs.stat(packagePath)).isDirectory()) {
        continue;
      }
      
      console.log(`正在发布: ${packageName}...`);
      
      try {
        // 检查 package.json
        const packageJsonPath = path.join(packagePath, 'package.json');
        if (!(await fs.pathExists(packageJsonPath))) {
          throw new Error('缺少 package.json 文件');
        }
        
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Windows 兼容性：使用 cross-spawn 或直接执行
        const isWindows = process.platform === 'win32';
        
        // 设置 registry
        const setRegistryCmd = isWindows 
          ? `cd /d "${packagePath}" && npm config set registry ${INTERNAL_REGISTRY}`
          : `cd "${packagePath}" && npm config set registry ${INTERNAL_REGISTRY}`;
        
        execSync(setRegistryCmd, { stdio: 'pipe' });
        
        // 发布包，添加错误处理和离线模式支持
        const publishCmd = isWindows
          ? `cd /d "${packagePath}" && npm publish --registry ${INTERNAL_REGISTRY} --offline`
          : `cd "${packagePath}" && npm publish --registry ${INTERNAL_REGISTRY} --offline`;
        
        try {
          execSync(publishCmd, {
            stdio: 'inherit',
            timeout: 60000, // 60秒超时
            env: {
              ...process.env,
              // 强制使用离线模式，不访问上游仓库
              NPM_CONFIG_OFFLINE: 'true'
            }
          });
          
          console.log(`✓ ${packageName} 发布成功\n`);
          
          results.push({
            name: packageName,
            version: packageJson.version,
            status: 'success',
            publishTime: new Date().toISOString()
          });
          
          successCount++;
          
        } catch (publishError) {
          // 处理 E409 冲突错误（版本已存在）
          const errorMessage = publishError.message || '';
          
          if (errorMessage.includes('E409') || 
              errorMessage.includes('Conflict') ||
              errorMessage.includes('already exists')) {
            
            console.log(`⚠ ${packageName}@${packageJson.version} 已存在，跳过发布\n`);
            
            results.push({
              name: packageName,
              version: packageJson.version,
              status: 'skipped',
              reason: 'Version already exists (E409)',
              publishTime: new Date().toISOString()
            });
            
            // E409 不算失败，算跳过
            successCount++;
            
          } else if (errorMessage.includes('E403') || 
                     errorMessage.includes('Forbidden') ||
                     errorMessage.includes('Unauthorized')) {
            
            console.error(`✗ ${packageName} 发布失败: 权限不足 (E403)\n`);
            console.error('   请确认已登录到内网 npm 仓库');
            console.error('   运行: npm login --registry ' + INTERNAL_REGISTRY);
            
            results.push({
              name: packageName,
              version: packageJson.version,
              status: 'failed',
              error: 'Permission denied (E403)',
              publishTime: new Date().toISOString()
            });
            
            failCount++;
            
          } else if (errorMessage.includes('E503') || 
                     errorMessage.includes('uplink down') ||
                     errorMessage.includes('Service Unavailable')) {
            
            console.error(`✗ ${packageName} 发布失败: 上游仓库不可用 (E503)\n`);
            console.error('   原因: 内网 Verdaccio 的上游连接 (uplink) 无法访问');
            console.error('   解决方案:');
            console.error('   1. 联系内网管理员检查 Verdaccio 配置');
            console.error('   2. 确认内网服务器可以访问外部 npm 仓库');
            console.error('   3. 或者修改 Verdaccio 配置，禁用上游代理');
            console.error('   4. 使用 --offline 模式发布（已自动尝试）');
            
            results.push({
              name: packageName,
              version: packageJson.version,
              status: 'failed',
              error: 'Uplink down (E503)',
              publishTime: new Date().toISOString()
            });
            
            failCount++;
            
          } else if (errorMessage.includes('E404') || 
                     errorMessage.includes('Not found')) {
            
            console.error(`✗ ${packageName} 发布失败: 仓库不存在 (E404)\n`);
            console.error('   请检查内网地址是否正确: ' + INTERNAL_REGISTRY);
            
            results.push({
              name: packageName,
              version: packageJson.version,
              status: 'failed',
              error: 'Registry not found (E404)',
              publishTime: new Date().toISOString()
            });
            
            failCount++;
            
          } else {
            // 其他错误
            throw publishError;
          }
        }
        
      } catch (error) {
        console.error(`✗ ${packageName} 发布失败:`, error.message, '\n');
        
        results.push({
          name: packageName,
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
      targetRegistry: INTERNAL_REGISTRY,
      totalPackages: packages.length,
      successCount: successCount,
      failCount: failCount,
      results: results
    };
    
    const reportPath = path.join(__dirname, '..', 'publish-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    console.log('\n=== 发布完成 ===');
    console.log(`总计: ${packages.length} 个包`);
    console.log(`成功: ${successCount} 个`);
    console.log(`失败: ${failCount} 个`);
    console.log(`\n发布报告已保存到: ${reportPath}`);
    
    if (failCount > 0) {
      console.log('\n⚠ 部分包发布失败，请检查错误信息');
    }
    
  } catch (error) {
    console.error('✗ 发布过程出错:', error.message);
  }
}

publishToInternal();
