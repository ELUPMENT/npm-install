/**
 * 内网 npm 包发布脚本（独立版本）
 * 
 * 使用说明：
 * 1. 将此脚本和 offline-packages 文件夹复制到内网
 * 2. 修改 INTERNAL_REGISTRY 为内网 npm 仓库地址
 * 3. 确保已登录到内网 npm 仓库
 * 4. 运行: node publish-internal-standalone.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ==================== 配置区域 ====================
// 请修改为您的内网 npm 仓库地址
const INTERNAL_REGISTRY = 'http://your-internal-npm-registry:4873';

// 离线包目录路径（相对于此脚本）
const OFFLINE_DIR = path.join(__dirname, 'offline-packages');
// ================================================

// 发布离线包到内网 npm 仓库
async function publishToInternal() {
  try {
    console.log('\n========================================');
    console.log('  内网 npm 包发布工具');
    console.log('========================================\n');
    console.log(`目标仓库: ${INTERNAL_REGISTRY}\n`);
    
    // 检查离线文件夹是否存在
    if (!fs.existsSync(OFFLINE_DIR)) {
      console.log('✗ 离线文件夹不存在:', OFFLINE_DIR);
      console.log('请确保 offline-packages 文件夹与此脚本在同一目录');
      return;
    }
    
    const packages = fs.readdirSync(OFFLINE_DIR);
    
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
      
      if (!fs.statSync(packagePath).isDirectory()) {
        continue;
      }
      
      console.log(`[${successCount + failCount + 1}/${packages.length}] 正在发布: ${packageName}...`);
      
      try {
        // 检查 package.json
        const packageJsonPath = path.join(packagePath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          throw new Error('缺少 package.json 文件');
        }
        
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Windows 兼容性：使用 cmd /c 执行命令
        const isWindows = process.platform === 'win32';
        const publishCommand = `npm publish --registry ${INTERNAL_REGISTRY}`;
        const finalCommand = isWindows ? `cmd /c "${publishCommand}"` : publishCommand;
        
        // 发布包，添加错误处理
        try {
          execSync(finalCommand, {
            cwd: packagePath,
            stdio: 'inherit',
            timeout: 60000 // 60秒超时
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
    
    const reportPath = path.join(__dirname, 'publish-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    console.log('\n========================================');
    console.log('  发布完成');
    console.log('========================================');
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

// 检查是否已登录到 npm 仓库
function checkLogin() {
  try {
    const whoami = execSync('npm whoami --registry ' + INTERNAL_REGISTRY, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    if (whoami) {
      console.log(`✓ 已登录到 ${INTERNAL_REGISTRY}，用户: ${whoami}\n`);
      return true;
    }
  } catch (error) {
    console.log(`⚠ 未登录到 ${INTERNAL_REGISTRY}`);
    console.log('请先执行: npm login --registry ' + INTERNAL_REGISTRY);
    console.log('或执行: npm adduser --registry ' + INTERNAL_REGISTRY);
    console.log();
    return false;
  }
}

// 主程序
console.log('准备发布离线包到内网 npm 仓库...\n');

if (checkLogin()) {
  publishToInternal();
} else {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('是否继续？(y/n): ', (answer) => {
    rl.close();
    if (answer.toLowerCase() === 'y') {
      publishToInternal();
    } else {
      console.log('已取消操作');
    }
  });
}
