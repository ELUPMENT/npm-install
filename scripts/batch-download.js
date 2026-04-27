const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

// Windows 兼容的命令执行函数
function execCommand(command, options = {}) {
  const isWindows = process.platform === 'win32';
  const finalCommand = isWindows ? `cmd /c "${command}"` : command;
  
  try {
    return execSync(finalCommand, {
      stdio: 'inherit',
      timeout: 120000, // 120秒超时
      ...options
    });
  } catch (error) {
    throw new Error(`命令执行失败: ${command}\n${error.message}`);
  }
}

// 确保目录存在
async function ensureDirectories() {
  await fs.ensureDir(PACKAGES_DIR);
  await fs.ensureDir(DOCS_DIR);
  await fs.ensureDir(OFFLINE_DIR);
}

// 从 package.json 读取依赖
async function readDependencies() {
  console.log('📖 读取 package.json 中的依赖...\n');
  
  const packageJson = await fs.readJson(PACKAGE_JSON_PATH);
  const dependencies = packageJson.dependencies || {};
  
  // 过滤出需要下载的包（排除 verdaccio、fs-extra、axios等项目依赖）
  const excludePackages = ['verdaccio', 'fs-extra', 'axios'];
  const targetDeps = Object.entries(dependencies).filter(([name]) => 
    !excludePackages.includes(name)
  );
  
  if (targetDeps.length === 0) {
    console.log('⚠️  package.json 中没有找到需要下载的依赖');
    console.log('\n💡 提示:');
    console.log('   在 package.json 的 dependencies 中添加需要的包，例如:');
    console.log('   "dependencies": {');
    console.log('     "lodash": "^4.17.21",');
    console.log('     "express": "^4.18.2"');
    console.log('   }');
    return [];
  }
  
  console.log(`找到 ${targetDeps.length} 个依赖:\n`);
  targetDeps.forEach(([name, version]) => {
    console.log(`  - ${name}@${version}`);
  });
  console.log();
  
  return targetDeps;
}

// 下载单个包
async function downloadPackage(name, version) {
  console.log(`\n[${name}@${version}] 开始下载...`);
  
  try {
    // 清理版本号前缀（^、~、>= 等）
    const cleanVersion = version.replace(/^[^0-9]*/, '');
    
    // 安装包，添加 --legacy-peer-deps 避免 peer dependency 冲突
    const installCmd = `npm install ${name}@${cleanVersion} --registry=http://localhost:4873 --no-save --legacy-peer-deps`;
    execCommand(installCmd, { stdio: 'pipe' });
    
    console.log(`✓ ${name}@${cleanVersion} 下载成功`);
    
    // 获取包的完整信息
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules', name);
    const packageJsonPath = path.join(nodeModulesPath, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      const packageInfo = await fs.readJson(packageJsonPath);
      
      // 保存包信息
      const safeFileName = name.replace(/\//g, '_').replace(/@/g, 'at_');
      const infoPath = path.join(PACKAGES_DIR, `${safeFileName}.json`);
      
      await fs.writeJson(infoPath, {
        name: packageInfo.name,
        version: packageInfo.version,
        description: packageInfo.description || '',
        license: packageInfo.license || '',
        author: packageInfo.author || '',
        repository: packageInfo.repository || '',
        homepage: packageInfo.homepage || '',
        installedAt: new Date().toISOString(),
        source: 'batch-download'
      }, { spaces: 2 });
      
      console.log(`✓ ${name} 信息已保存`);
      
      return {
        name: packageInfo.name,
        version: packageInfo.version,
        success: true
      };
    }
    
    return { name, version, success: false, error: 'package.json not found' };
    
  } catch (error) {
    console.error(`✗ ${name}@${version} 下载失败:`, error.message);
    return { name, version, success: false, error: error.message };
  }
}

// 同步包到离线文件夹
async function syncToOffline(packageName) {
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules', packageName);
  const safeFileName = packageName.replace(/\//g, '_').replace(/@/g, 'at_');
  const targetPath = path.join(OFFLINE_DIR, safeFileName);
  
  if (await fs.pathExists(nodeModulesPath)) {
    try {
      await fs.copy(nodeModulesPath, targetPath, { overwrite: true });
      console.log(`✓ ${packageName} 已同步到离线文件夹`);
      return true;
    } catch (error) {
      console.error(`✗ ${packageName} 同步失败:`, error.message);
      return false;
    }
  } else {
    console.log(`⚠ ${packageName} 在 node_modules 中不存在`);
    return false;
  }
}

// 生成文档
async function generateDocumentation(packageInfo) {
  const safeFileName = packageInfo.name.replace(/\//g, '_').replace(/@/g, 'at_');
  const docPath = path.join(DOCS_DIR, `${safeFileName}.md`);
  
  const docContent = `# ${packageInfo.name}

## 基本信息

- **版本**: ${packageInfo.version}
- **描述**: ${packageInfo.description || '无'}
- **许可证**: ${packageInfo.license || '未知'}
- **作者**: ${typeof packageInfo.author === 'object' ? packageInfo.author.name || packageInfo.author : packageInfo.author || '未知'}
- **安装时间**: ${new Date(packageInfo.installedAt).toLocaleString('zh-CN')}
- **来源**: 批量下载

${packageInfo.homepage ? `## 主页\n\n[${packageInfo.homepage}](${packageInfo.homepage})\n` : ''}
${packageInfo.repository ? `## 仓库\n\n[${typeof packageInfo.repository.url === 'string' ? packageInfo.repository.url : JSON.stringify(packageInfo.repository)}](${typeof packageInfo.repository.url === 'string' ? packageInfo.repository.url.replace('.git', '') : ''})\n` : ''}

## 使用说明

\`\`\`bash
npm install ${packageInfo.name}@${packageInfo.version} --registry=http://localhost:4873
\`\`\`

---

*本文档由批量下载工具自动生成*
`;
  
  await fs.writeFile(docPath, docContent, 'utf8');
  console.log(`✓ ${packageInfo.name} 文档已生成`);
}

// 主函数
async function batchDownload() {
  try {
    console.log('\n=== 批量依赖下载工具 ===\n');
    
    // 确保目录存在
    await ensureDirectories();
    
    // 读取依赖
    const dependencies = await readDependencies();
    
    if (dependencies.length === 0) {
      return;
    }
    
    // 询问用户确认
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question(`是否继续下载这 ${dependencies.length} 个依赖? (y/n): `, resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('\n已取消操作');
      return;
    }
    
    console.log('\n开始批量下载...\n');
    
    // 下载所有依赖
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < dependencies.length; i++) {
      const [name, version] = dependencies[i];
      console.log(`\n[${i + 1}/${dependencies.length}] 处理 ${name}@${version}...`);
      
      const result = await downloadPackage(name, version);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    console.log('\n\n=== 下载完成 ===');
    console.log(`总计: ${dependencies.length} 个包`);
    console.log(`成功: ${successCount} 个`);
    console.log(`失败: ${failCount} 个\n`);
    
    // 同步到离线文件夹
    console.log('\n=== 同步到离线文件夹 ===\n');
    
    let syncedCount = 0;
    for (const result of results) {
      if (result.success) {
        const synced = await syncToOffline(result.name);
        if (synced) {
          syncedCount++;
        }
      }
    }
    
    console.log(`\n✓ 已同步 ${syncedCount} 个包到离线文件夹`);
    
    // 生成文档
    console.log('\n=== 生成文档 ===\n');
    
    const successfulResults = results.filter(r => r.success);
    for (const result of successfulResults) {
      const packageInfoPath = path.join(PACKAGES_DIR, `${result.name.replace(/\//g, '_').replace(/@/g, 'at_')}.json`);
      if (await fs.pathExists(packageInfoPath)) {
        const packageInfo = await fs.readJson(packageInfoPath);
        await generateDocumentation(packageInfo);
      }
    }
    
    console.log(`\n✓ 已生成 ${successfulResults.length} 个包的文档`);
    
    // 生成汇总报告
    const reportPath = path.join(__dirname, '..', 'batch-download-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      totalPackages: dependencies.length,
      successCount: successCount,
      failCount: failCount,
      syncedCount: syncedCount,
      results: results
    };
    
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`\n📊 下载报告已保存到: ${reportPath}`);
    
    console.log('\n=== 批量下载完成 ===\n');
    
    if (failCount > 0) {
      console.log('⚠️  部分包下载失败，请检查错误信息');
      console.log('失败的包:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.name}@${r.version}: ${r.error}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 批量下载失败:', error.message);
    console.error(error.stack);
  }
}

batchDownload();
