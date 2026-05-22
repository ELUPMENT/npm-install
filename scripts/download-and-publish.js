const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const NODE_MODULES_PATH = path.join(__dirname, '..', 'node_modules');
const LOCAL_REGISTRY = 'http://localhost:4873'; // 本地 Verdaccio 仓库
const PUBLIC_REGISTRY = 'https://registry.npmjs.org'; // 公网 npm 仓库（用于下载）

// Windows 兼容的命令执行函数
function execCommand(command, options = {}) {
  const isWindows = process.platform === 'win32';
  const finalCommand = isWindows ? `cmd /c "${command}"` : command;
  
  try {
    return execSync(finalCommand, {
      stdio: 'inherit',
      timeout: 300000, // 5分钟超时
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
  console.log('\n📖 步骤 1/5: 读取 package.json 中的依赖...\n');
  
  const packageJson = await fs.readJson(PACKAGE_JSON_PATH);
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  // 过滤出需要下载的包（排除项目自身依赖）
  const excludePackages = ['verdaccio', 'fs-extra', 'axios'];
  const targetDeps = Object.entries(allDeps).filter(([name]) => 
    !excludePackages.includes(name) && !name.startsWith('@synway')
  );
  
  if (targetDeps.length === 0) {
    console.log('⚠️  package.json 中没有找到需要下载的依赖');
    return [];
  }
  
  console.log(`✅ 找到 ${targetDeps.length} 个主依赖:\n`);
  targetDeps.forEach(([name, version]) => {
    console.log(`   - ${name}@${version}`);
  });
  console.log();
  
  return targetDeps;
}

// 使用 npm install 完整解析依赖树（从公网下载）
async function installWithFullDependencies(packageName, version) {
  try {
    // 清理版本号前缀（^、~、>= 等）
    const cleanVersion = version.replace(/^[^0-9]*/, '');
    
    console.log(`  📦 从公网下载 ${packageName}@${cleanVersion} 及其所有依赖...`);
    
    // 【关键修改】从公网 npmjs.org 下载，而不是从本地 Verdaccio
    // 因为此时本地 Verdaccio 中还没有这些包
    // --legacy-peer-deps 避免 peer dependency 冲突
    const installCmd = `npm install ${packageName}@${cleanVersion} --registry=${PUBLIC_REGISTRY} --no-save --legacy-peer-deps --no-package-lock`;
    
    execCommand(installCmd);
    
    console.log(`  ✓ ${packageName}@${cleanVersion} 下载成功`);
    
    return {
      name: packageName,
      version: cleanVersion,
      success: true
    };
    
  } catch (error) {
    console.error(`  ✗ ${packageName}@${version} 下载失败:`, error.message);
    return { 
      name: packageName,
      version,
      success: false, 
      error: error.message 
    };
  }
}

// 扫描 node_modules 获取所有已安装的包
async function scanNodeModules() {
  console.log('\n🔍 步骤 2/5: 扫描 node_modules 目录获取完整依赖树...\n');
  
  const installedPackages = new Map();
  const visited = new Set();
  
  async function scanPackage(packagePath, depth = 0) {
    if (depth > 5) return; // 限制深度
    
    const packageJsonPath = path.join(packagePath, 'package.json');
    
    if (!(await fs.pathExists(packageJsonPath))) {
      return;
    }
    
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const packageName = packageJson.name;
      
      // 跳过没有 name 的包
      if (!packageName) {
        return;
      }
      
      const packageVersion = packageJson.version || '0.0.0';
      const packageKey = `${packageName}@${packageVersion}`;
      
      // 避免重复处理
      if (visited.has(packageKey)) {
        return;
      }
      visited.add(packageKey);
      
      // 记录包信息
      installedPackages.set(packageKey, {
        name: packageName,
        version: packageVersion,
        description: packageJson.description || '',
        license: packageJson.license || '',
        depth: depth,
        dependencies: packageJson.dependencies || {},
        path: packagePath
      });
      
      // 递归处理子依赖
      const depsPath = path.join(packagePath, 'node_modules');
      if (await fs.pathExists(depsPath)) {
        const subPackages = await fs.readdir(depsPath);
        for (const subPkg of subPackages) {
          if (subPkg.startsWith('.')) {
            continue; // 跳过隐藏目录
          }
          
          const subPkgPath = path.join(depsPath, subPkg);
          
          // 检查是否是目录
          const stat = await fs.stat(subPkgPath);
          if (!stat.isDirectory()) {
            continue;
          }
          
          // 递归扫描
          await scanPackage(subPkgPath, depth + 1);
        }
      }
    } catch (error) {
      // 忽略错误，继续处理其他包
      console.debug(`扫描 ${packagePath} 时出错:`, error.message);
    }
  }
  
  // 从 node_modules 根目录开始扫描所有顶级包
  if (await fs.pathExists(NODE_MODULES_PATH)) {
    const topLevelPackages = await fs.readdir(NODE_MODULES_PATH);
    
    for (const pkgName of topLevelPackages) {
      if (pkgName.startsWith('.')) {
        continue; // 跳过隐藏目录
      }
      
      const pkgPath = path.join(NODE_MODULES_PATH, pkgName);
      
      // 检查是否是目录
      try {
        const stat = await fs.stat(pkgPath);
        if (!stat.isDirectory()) {
          continue;
        }
        
        // 如果是 @scope 目录，需要进一步遍历
        if (pkgName.startsWith('@')) {
          const scopedPackages = await fs.readdir(pkgPath);
          for (const scopedPkg of scopedPackages) {
            const scopedPkgPath = path.join(pkgPath, scopedPkg);
            await scanPackage(scopedPkgPath, 0);
          }
        } else {
          // 普通包，直接扫描
          await scanPackage(pkgPath, 0);
        }
      } catch (error) {
        console.debug(`检查 ${pkgPath} 时出错:`, error.message);
      }
    }
  }
  
  console.log(`✅ 共扫描到 ${installedPackages.size} 个包\n`);
  
  return Array.from(installedPackages.values());
}

// 同步包到离线目录
async function syncToOffline(packages) {
  console.log('\n📂 步骤 3/5: 同步包到离线目录...\n');
  
  // 先检查 node_modules 是否存在
  if (!(await fs.pathExists(NODE_MODULES_PATH))) {
    console.log('⚠️  node_modules 目录不存在，跳过同步');
    console.log('💡 提示: 请先执行 npm install 下载依赖\n');
    return;
  }
  
  console.log(`📦 准备同步 ${packages.length} 个包到 offline-packages/ 目录\n`);
  
  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  
  for (const pkg of packages) {
    const safeFileName = pkg.name.replace(/\//g, '_').replace(/@/g, 'at_');
    const offlinePath = path.join(OFFLINE_DIR, `${safeFileName}@${pkg.version}`);
    
    // 检查是否已存在
    if (await fs.pathExists(offlinePath)) {
      console.log(`  ⊘ ${pkg.name}@${pkg.version} 已存在，跳过`);
      skippedCount++;
      continue;
    }
    
    try {
      const sourcePath = pkg.path || path.join(NODE_MODULES_PATH, pkg.name);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, offlinePath, { overwrite: true });
        console.log(`  ✓ ${pkg.name}@${pkg.version} 已同步到 ${path.relative(process.cwd(), offlinePath)}`);
        syncedCount++;
      } else {
        console.log(`  ⚠ ${pkg.name}@${pkg.version} 在 node_modules 中未找到`);
        failedCount++;
      }
    } catch (error) {
      console.error(`  ✗ ${pkg.name}@${pkg.version} 同步失败:`, error.message);
      failedCount++;
    }
  }
  
  console.log(`\n✅ 同步完成:`);
  console.log(`   - 成功同步: ${syncedCount} 个`);
  console.log(`   - 跳过(已存在): ${skippedCount} 个`);
  console.log(`   - 失败: ${failedCount} 个`);
  console.log();
}

// 主函数
async function main() {
  // 步骤 1: 确保目录存在
  await ensureDirectories();
  
  // 步骤 2: 读取 package.json 中的依赖
  const dependencies = await readDependencies();
  
  // 步骤 3: 使用 npm install 完整解析依赖树（从公网下载）
  const installResults = await Promise.all(dependencies.map(([name, version]) => 
    installWithFullDependencies(name, version)
  ));
  
  console.log(`\n📊 安装结果统计:`);
  console.log(`   - 成功安装 ${installResults.filter(r => r.success).length} 个包`);
  console.log(`   - 安装失败 ${installResults.filter(r => !r.success).length} 个包`);
  if (installResults.some(r => !r.success)) {
    console.log(`   - 失败详情:\n`);
    installResults.filter(r => !r.success).forEach(r => {
      console.log(`      - ${r.name}@${r.version}: ${r.error}`);
    });
  }
  console.log();
  
  // 步骤 4: 扫描 node_modules 获取所有包
  const allPackages = await scanNodeModules();
  
  console.log(`\n📊 扫描结果统计:`);
  console.log(`   - 总共扫描到 ${allPackages.length} 个包`);
  if (allPackages.length > 0) {
    console.log(`   - 示例包: ${allPackages.slice(0, 5).map(p => p.name).join(', ')}...`);
  }
  console.log();
  
  // 步骤 5: 同步到离线目录
  await syncToOffline(allPackages);
}

main();
