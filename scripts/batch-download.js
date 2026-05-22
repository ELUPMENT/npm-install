const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const NODE_MODULES_PATH = path.join(__dirname, '..', 'node_modules');
const PUBLIC_REGISTRY = 'https://registry.npmjs.org';

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

// 公网 npm registry
function getCurrentRegistry() {
  return PUBLIC_REGISTRY;
}

async function downloadPackage(packageName, version) {
  console.log(`\n正在下载 ${packageName}@${version}...`);
  
  try {
    // 清理版本号前缀（^、~、>= 等）
    const cleanVersion = version.replace(/^[^0-9]*/, '');
    
    // 获取当前 registry 配置
    const registry = getCurrentRegistry();
    
    // 【核心改进】使用 npm install 自动解析并安装所有依赖（包括子依赖）
    // --legacy-peer-deps 避免 peer dependency 冲突
    // npm 会自动递归下载所有层级的依赖
    const installCmd = `npm install ${packageName}@${cleanVersion} --registry=${registry} --no-save --legacy-peer-deps --no-package-lock`;
    
    console.log(`  执行命令: ${installCmd}`);
    execCommand(installCmd, { stdio: 'pipe' });
    
    console.log(`✓ ${packageName}@${cleanVersion} 及其所有依赖安装成功`);
    
    // 获取已安装的包的完整依赖树信息
    const installedPackages = await getInstalledDependencyTree(packageName);
    
    return {
      mainPackage: { name: packageName, version: cleanVersion },
      allDependencies: installedPackages,
      success: true
    };
    
  } catch (error) {
    console.error(`✗ ${packageName}@${version} 安装失败:`, error.message);
    return { 
      mainPackage: { name: packageName, version },
      success: false, 
      error: error.message 
    };
  }
}

// 【新增】获取已安装的依赖树
async function getInstalledDependencyTree(rootPackageName) {
  const installedPackages = [];
  const visited = new Set();
  
  // 递归扫描 node_modules 中的所有包
  async function scanPackage(packagePath, depth = 0) {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const hasPackageJson = await fs.pathExists(packageJsonPath);

    if (hasPackageJson) {
      const packageJson = await fs.readJson(packageJsonPath);
      const packageName = packageJson.name;
      const packageVersion = packageJson.version;
      const packageKey = `${packageName}@${packageVersion}`;
      
      // 避免重复处理
      if (visited.has(packageKey)) {
        return;
      }
      visited.add(packageKey);
      
      // 记录包信息
      installedPackages.push({
        name: packageName,
        version: packageVersion,
        description: packageJson.description || '',
        license: packageJson.license || '',
        depth: depth,
        isRoot: depth === 0,
        dependencies: packageJson.dependencies || {},
        installedAt: new Date().toISOString(),
        path: packagePath
      });
    }

    // 递归处理子依赖或 scoped 目录
    if (depth < 10) {
      if (hasPackageJson) {
        const depsPath = path.join(packagePath, 'node_modules');
        if (await fs.pathExists(depsPath)) {
          const subPackages = await fs.readdir(depsPath);
          for (const subPkg of subPackages) {
            if (!subPkg.startsWith('.')) {
              await scanPackage(path.join(depsPath, subPkg), depth + 1);
            }
          }
        }
      } else {
        const items = await fs.readdir(packagePath);
        for (const item of items) {
          if (item.startsWith('.')) continue;
          const childPath = path.join(packagePath, item);
          if ((await fs.stat(childPath)).isDirectory()) {
            await scanPackage(childPath, depth + 1);
          }
        }
      }
    }
  }
  
  // 从根包开始扫描
  const rootPackagePath = path.join(NODE_MODULES_PATH, rootPackageName);
  if (await fs.pathExists(rootPackagePath)) {
    await scanPackage(rootPackagePath, 0);
  }
  
  return installedPackages;
}

// 保存包信息到 packages 目录
async function savePackageInfo(packageInfo) {
  const safeFileName = packageInfo.name.replace(/\//g, '_').replace(/@/g, 'at_');
  const infoPath = path.join(PACKAGES_DIR, `${safeFileName}.json`);
  
  await fs.writeJson(infoPath, {
    name: packageInfo.name,
    version: packageInfo.version,
    description: packageInfo.description || '',
    license: packageInfo.license || '',
    installedAt: packageInfo.installedAt,
    source: 'batch-download',
    isTransitive: !packageInfo.isRoot,
    depth: packageInfo.depth || 0
  }, { spaces: 2 });
}

// 同步包到离线文件夹
async function syncToOffline(packageInfo) {
  const sourcePath = packageInfo.path || path.join(NODE_MODULES_PATH, packageInfo.name);
  const safeFileName = packageInfo.name.replace(/\//g, '_').replace(/@/g, 'at_');
  const versionedTargetPath = path.join(OFFLINE_DIR, `${safeFileName}@${packageInfo.version}`);
  
  if (await fs.pathExists(sourcePath)) {
    try {
      await fs.copy(sourcePath, versionedTargetPath, { overwrite: true });
      console.log(`✓ ${packageInfo.name}@${packageInfo.version} 已同步到离线文件夹`);
      return true;
    } catch (error) {
      console.error(`✗ ${packageInfo.name}@${packageInfo.version} 同步失败:`, error.message);
      return false;
    }
  } else {
    console.log(`⚠ ${packageInfo.name}@${packageInfo.version} 在 node_modules 中不存在`);
    return false;
  }
}

// 生成文档
async function generateDocumentation(packageInfo) {
  console.log(`正在为 ${packageInfo.name} 生成文档...`);
  
  // 获取当前 registry 配置
  const registry = getCurrentRegistry();
  
  const docPath = path.join(DOCS_DIR, `${packageInfo.name.replace(/\//g, '_').replace(/@/g, 'at_')}.md`);
  
  const docContent = `# ${packageInfo.name}

## 基本信息

- **版本**: ${packageInfo.version}
- **描述**: ${packageInfo.description || '无'}
- **许可证**: ${packageInfo.license || '未知'}
- **安装时间**: ${new Date(packageInfo.installedAt).toLocaleString('zh-CN')}
- **来源**: 批量下载（含完整依赖链）
- **依赖层级**: ${packageInfo.isRoot ? '主包' : `L${packageInfo.depth} (传递依赖)`}

${packageInfo.homepage ? `## 主页\n\n[${packageInfo.homepage}](${packageInfo.homepage})\n` : ''}
${packageInfo.repository ? `## 仓库\n\n[${typeof packageInfo.repository.url === 'string' ? packageInfo.repository.url : JSON.stringify(packageInfo.repository)}](${typeof packageInfo.repository.url === 'string' ? packageInfo.repository.url.replace('.git', '') : ''})\n` : ''}

## 使用说明

\`\`\`bash
npm install ${packageInfo.name}@${packageInfo.version} --registry=${registry}
\`\`\`

---

*本文档由批量下载工具自动生成，包含完整依赖链*
`;
  
  await fs.writeFile(docPath, docContent, 'utf8');
  console.log(`✓ ${packageInfo.name} 文档已生成`);
}

// 主函数
async function batchDownload() {
  try {
    console.log('\n=== 批量依赖下载工具（完整版） ===\n');
    console.log('特性: 自动下载主包及其所有子依赖，形成完整依赖链\n');
    
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
      rl.question(`是否继续下载这 ${dependencies.length} 个主依赖（将自动下载所有子依赖）? (y/n): `, resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('\n已取消操作');
      return;
    }
    
    console.log('\n开始批量下载（每个包都会下载完整依赖链）...\n');
    
    // 下载所有主依赖
    const allResults = [];
    let totalSuccessCount = 0;
    let totalFailCount = 0;
    let allInstalledPackages = new Map(); // 用于去重
    
    for (let i = 0; i < dependencies.length; i++) {
      const [name, version] = dependencies[i];
      console.log(`\n========== [${i + 1}/${dependencies.length}] 处理主依赖: ${name}@${version} ==========`);
      
      const result = await downloadPackage(name, version);
      allResults.push(result);
      
      if (result.success) {
        totalSuccessCount++;
        
        // 收集所有安装的包（包括子依赖）
        result.allDependencies.forEach(pkg => {
          const key = `${pkg.name}@${pkg.version}`;
          if (!allInstalledPackages.has(key)) {
            allInstalledPackages.set(key, pkg);
          }
        });
        
        console.log(`✓ ${name} 及其 ${result.allDependencies.length - 1} 个子依赖安装完成`);
      } else {
        totalFailCount++;
        console.error(`✗ ${name} 安装失败`);
      }
    }
    
    console.log('\n\n=== 下载完成 ===');
    console.log(`主依赖总计: ${dependencies.length} 个`);
    console.log(`成功: ${totalSuccessCount} 个`);
    console.log(`失败: ${totalFailCount} 个`);
    console.log(`所有包（含子依赖）总计: ${allInstalledPackages.size} 个\n`);
    
    // 保存所有包的信息
    console.log('\n=== 保存包信息 ===\n');
    let savedCount = 0;
    for (const [key, pkgInfo] of allInstalledPackages) {
      await savePackageInfo(pkgInfo);
      savedCount++;
    }
    console.log(`✓ 已保存 ${savedCount} 个包的信息`);
    
    // 同步到离线文件夹
    console.log('\n=== 同步到离线文件夹 ===\n');
    
    let syncedCount = 0;
    for (const [key, pkgInfo] of allInstalledPackages) {
      const synced = await syncToOffline(pkgInfo);
      if (synced) {
        syncedCount++;
      }
    }
    
    console.log(`\n✓ 已同步 ${syncedCount} 个包到离线文件夹`);
    
    // 生成文档
    console.log('\n=== 生成文档 ===\n');
    
    let docCount = 0;
    for (const [key, pkgInfo] of allInstalledPackages) {
      await generateDocumentation(pkgInfo);
      docCount++;
    }
    
    console.log(`\n✓ 已生成 ${docCount} 个包的文档`);
    
    // 生成汇总报告
    const reportPath = path.join(__dirname, '..', 'batch-download-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      totalMainPackages: dependencies.length,
      totalAllPackages: allInstalledPackages.size,
      successCount: totalSuccessCount,
      failCount: totalFailCount,
      syncedCount: syncedCount,
      results: allResults.map(r => ({
        mainPackage: r.mainPackage,
        success: r.success,
        totalDependencies: r.allDependencies ? r.allDependencies.length : 0,
        error: r.error
      }))
    };
    
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`\n📊 下载报告已保存到: ${reportPath}`);
    
    console.log('\n=== 批量下载完成 ===\n');
    
    if (totalFailCount > 0) {
      console.log('⚠️  部分包下载失败，请检查错误信息');
      console.log('失败的包:');
      allResults.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.mainPackage.name}@${r.mainPackage.version}: ${r.error}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 批量下载失败:', error.message);
    console.error(error.stack);
  }
}

batchDownload();
