const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');

// 确保目录存在
async function ensureDirectories() {
  await fs.ensureDir(PACKAGES_DIR);
  await fs.ensureDir(DOCS_DIR);
  await fs.ensureDir(OFFLINE_DIR);
}

// 询问用户输入
function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

// Windows 兼容的命令执行函数
function execCommand(command, options = {}) {
  try {
    // Windows 兼容性：使用 cmd /c 执行命令
    const isWindows = process.platform === 'win32';
    const finalCommand = isWindows ? `cmd /c "${command}"` : command;
    
    return execSync(finalCommand, {
      encoding: 'utf8',
      stdio: options.stdio || 'pipe',
      ...options
    });
  } catch (error) {
    throw new Error(`命令执行失败: ${command}\n错误: ${error.message}`);
  }
}

// 获取包的完整依赖树信息
function getPackageInfo(packageName, version) {
  try {
    console.log(`\n正在获取 ${packageName}@${version} 的依赖信息...`);
    
    // 获取包的详细信息（包括依赖）
    const infoOutput = execCommand(
      `npm view ${packageName}@${version} --json --registry=https://registry.npmjs.org/`
    );
    
    const packageInfo = JSON.parse(infoOutput);
    
    // 提取所有依赖
    const allDependencies = {
      dependencies: packageInfo.dependencies || {},
      devDependencies: packageInfo.devDependencies || {},
      peerDependencies: packageInfo.peerDependencies || {},
      optionalDependencies: packageInfo.optionalDependencies || {}
    };
    
    console.log(`✓ 找到 ${packageName}@${packageInfo.version}`);
    console.log(`  - 直接依赖: ${Object.keys(allDependencies.dependencies).length} 个`);
    console.log(`  - 开发依赖: ${Object.keys(allDependencies.devDependencies).length} 个`);
    console.log(`  - 对等依赖: ${Object.keys(allDependencies.peerDependencies).length} 个`);
    
    return {
      name: packageName,
      version: packageInfo.version,
      description: packageInfo.description || '',
      dependencies: allDependencies.dependencies,
      peerDependencies: allDependencies.peerDependencies,
      allDependencies: allDependencies
    };
  } catch (error) {
    console.error(`✗ 获取包信息失败: ${error.message}`);
    return null;
  }
}

// 递归解析依赖树
async function resolveDependencyTree(packageName, version, depth = 0, visited = new Set()) {
  const indent = '  '.repeat(depth);
  const packageKey = `${packageName}@${version}`;
  
  // 避免循环依赖
  if (visited.has(packageKey)) {
    console.log(`${indent}⊘ ${packageKey} (已访问)`);
    return [];
  }
  
  visited.add(packageKey);
  
  const info = getPackageInfo(packageName, version);
  if (!info) {
    return [];
  }
  
  const result = [{
    name: packageName,
    version: info.version,
    description: info.description,
    dependencies: info.dependencies,
    peerDependencies: info.peerDependencies,
    depth: depth
  }];
  
  // 递归处理直接依赖
  if (depth < 3 && Object.keys(info.dependencies).length > 0) {
    console.log(`${indent}└─ 正在解析 ${packageName} 的依赖...`);
    
    for (const [depName, depVersion] of Object.entries(info.dependencies)) {
      // 清理版本号（去除 ^ ~ 等符号）
      const cleanVersion = depVersion.replace(/[^0-9.]/g, '') || 'latest';
      const subDeps = await resolveDependencyTree(depName, cleanVersion, depth + 1, visited);
      result.push(...subDeps);
    }
  }
  
  return result;
}

// 批量安装依赖
async function installPackages(packages) {
  const uniquePackages = [...new Set(packages.map(p => `${p.name}@${p.version}`))];
  
  console.log(`\n开始安装 ${uniquePackages.length} 个包...`);
  
  let successCount = 0;
  let failCount = 0;
  const results = [];
  
  for (const packageSpec of uniquePackages) {
    try {
      console.log(`\n[${successCount + failCount + 1}/${uniquePackages.length}] 安装 ${packageSpec}...`);
      
      // 添加 --legacy-peer-deps 避免 peer dependency 冲突
      const installCmd = `npm install ${packageSpec} --registry=http://localhost:4873 --no-save --legacy-peer-deps`;
      execSync(installCmd, { stdio: 'inherit' });
      
      console.log(`✓ ${packageSpec} 安装成功`);
      successCount++;
      
      results.push({
        spec: packageSpec,
        status: 'success'
      });
      
      // 添加小延迟，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`✗ ${packageSpec} 安装失败: ${error.message}`);
      failCount++;
      
      results.push({
        spec: packageSpec,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  console.log(`\n=== 安装完成 ===`);
  console.log(`成功: ${successCount} 个`);
  console.log(`失败: ${failCount} 个`);
  
  return results;
}

// 保存所有包的信息
async function savePackageInfos(packages) {
  console.log('\n正在保存包信息...');
  
  for (const pkg of packages) {
    const packageInfo = {
      name: pkg.name,
      version: pkg.version,
      installedAt: new Date().toISOString(),
      registry: 'http://localhost:4873',
      description: pkg.description || '',
      dependencies: pkg.dependencies || {},
      peerDependencies: pkg.peerDependencies || {},
      isTransitive: pkg.depth > 0, // 是否为传递依赖
      depth: pkg.depth || 0
    };
    
    // Windows 兼容的文件名处理：替换 / 和 @ 符号
    const safeFileName = pkg.name.replace(/\//g, '_').replace(/@/g, 'at_');
    const packageJsonPath = path.join(PACKAGES_DIR, `${safeFileName}.json`);
    await fs.writeJson(packageJsonPath, packageInfo, { spaces: 2 });
  }
  
  console.log(`✓ 已保存 ${packages.length} 个包的信息`);
}

// 添加依赖包（包含所有关联依赖）
async function addPackageWithDependencies() {
  try {
    console.log('\n=== 添加 npm 依赖包（包含所有关联依赖） ===\n');
    
    const packageName = await askQuestion('请输入包名: ');
    if (!packageName) {
      console.log('包名不能为空');
      rl.close();
      return;
    }

    const version = await askQuestion('请输入版本号 (留空使用最新版本): ') || 'latest';
    
    console.log(`\n正在分析 ${packageName}@${version} 及其所有依赖...`);
    
    // 1. 解析完整的依赖树
    const dependencyTree = await resolveDependencyTree(packageName, version);
    
    console.log(`\n=== 依赖树解析完成 ===`);
    console.log(`总共需要安装 ${dependencyTree.length} 个包:`);
    dependencyTree.forEach((pkg, index) => {
      const indent = '  '.repeat(pkg.depth);
      console.log(`  ${index + 1}. ${indent}${pkg.name}@${pkg.version} (层级: ${pkg.depth})`);
    });
    
    // 2. 确认安装
    const confirm = await askQuestion('\n是否继续安装所有这些包? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('已取消操作');
      rl.close();
      return;
    }
    
    // 3. 批量安装所有包
    const installResults = await installPackages(dependencyTree);
    
    // 4. 保存所有包的信息
    await savePackageInfos(dependencyTree);
    
    // 5. 生成文档
    const generateDocs = await askQuestion('\n是否为所有包生成文档? (y/n): ');
    if (generateDocs.toLowerCase() === 'y') {
      await generateDocumentationForAll(dependencyTree);
    }
    
    // 6. 同步到离线文件夹
    const syncToOffline = await askQuestion('\n是否同步所有包到离线文件夹? (y/n): ');
    if (syncToOffline.toLowerCase() === 'y') {
      await syncAllToOffline();
    }
    
    console.log('\n✓ 依赖包添加完成!');
    
  } catch (error) {
    console.error('✗ 添加依赖包失败:', error.message);
  } finally {
    rl.close();
  }
}

// 为所有包生成文档
async function generateDocumentationForAll(packages) {
  console.log('\n正在生成所有包的文档...');
  
  const summaryDoc = `# NPM 私有仓库依赖清单

## 概述

- **总包数**: ${packages.length}
- **最后更新**: ${new Date().toLocaleString('zh-CN')}
- **仓库地址**: http://localhost:4873

## 依赖列表

| 包名 | 版本 | 层级 | 描述 | 文档链接 |
|------|------|------|------|----------|
${packages.map(pkg => {
  // Windows 兼容的文件名处理
  const safeFileName = pkg.name.replace(/\//g, '_').replace(/@/g, 'at_');
  const docLink = `${safeFileName}.md`;
  const level = pkg.depth === 0 ? '主包' : `L${pkg.depth}`;
  return `| ${pkg.name} | ${pkg.version} | ${level} | ${pkg.description || ''} | [查看](${docLink}) |`;
}).join('\n')}

## 层级说明

- **主包**: 您主动安装的包
- **L1/L2/L3**: 传递依赖的层级

---

*文档自动生成于 ${new Date().toLocaleString('zh-CN')}*
`;
  
  const summaryPath = path.join(DOCS_DIR, 'README.md');
  await fs.writeFile(summaryPath, summaryDoc, 'utf8');
  console.log(`✓ 汇总文档已保存到: ${summaryPath}`);
  
  // 为每个包生成单独文档
  let generatedCount = 0;
  for (const pkg of packages) {
    const docContent = `# ${pkg.name} 依赖文档

## 基本信息

- **包名**: ${pkg.name}
- **版本**: ${pkg.version}
- **安装时间**: ${new Date().toLocaleString('zh-CN')}
- **仓库地址**: http://localhost:4873
- **依赖层级**: ${pkg.depth === 0 ? '主包' : `L${pkg.depth} (传递依赖)`}
- **描述**: ${pkg.description || ''}

## 安装命令

\`\`\`bash
npm install ${pkg.name}@${pkg.version} --registry=http://localhost:4873
\`\`\`

${Object.keys(pkg.dependencies || {}).length > 0 ? `
## 直接依赖

| 依赖包 | 版本要求 |
|--------|----------|
${Object.entries(pkg.dependencies).map(([name, ver]) => `| ${name} | ${ver} |`).join('\n')}
` : ''}

${Object.keys(pkg.peerDependencies || {}).length > 0 ? `
## 对等依赖

| 依赖包 | 版本要求 |
|--------|----------|
${Object.entries(pkg.peerDependencies).map(([name, ver]) => `| ${name} | ${ver} |`).join('\n')}
` : ''}

## 使用说明

官方文档: https://www.npmjs.com/package/${pkg.name}

## 注意事项

1. ${pkg.depth === 0 ? '这是您主动安装的主包' : '这是作为其他包的依赖自动安装的'}
2. 该依赖已通过 Verdaccio 私有仓库管理
3. 内网使用时，请确保配置了正确的 registry 地址

---

*文档生成时间: ${new Date().toLocaleString('zh-CN')}*
`;
    
    // Windows 兼容的文件名处理
    const safeFileName = pkg.name.replace(/\//g, '_').replace(/@/g, 'at_');
    const docPath = path.join(DOCS_DIR, `${safeFileName}.md`);
    await fs.writeFile(docPath, docContent, 'utf8');
    generatedCount++;
  }
  
  console.log(`✓ 已生成 ${generatedCount} 个包文档`);
}

// 同步所有包到离线文件夹
async function syncAllToOffline() {
  console.log('\n正在同步所有包到离线文件夹...');
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  const packageFiles = await fs.readdir(PACKAGES_DIR);
  
  let syncedCount = 0;
  let skippedCount = 0;
  
  for (const file of packageFiles) {
    if (!file.endsWith('.json')) continue;
    
    const packageInfoPath = path.join(PACKAGES_DIR, file);
    const packageInfo = await fs.readJson(packageInfoPath);
    
    const packageName = packageInfo.name;
    
    // Windows 兼容的文件名处理
    const safeFileName = packageName.replace(/\//g, '_').replace(/@/g, 'at_');
    const sourcePath = path.join(nodeModulesPath, packageName);
    const targetPath = path.join(OFFLINE_DIR, safeFileName);
    
    console.log(`正在同步: ${packageName}...`);
    
    if (await fs.pathExists(sourcePath)) {
      try {
        await fs.copy(sourcePath, targetPath);
        console.log(`✓ ${packageName} 同步成功`);
        syncedCount++;
      } catch (error) {
        console.error(`✗ ${packageName} 同步失败:`, error.message);
      }
    } else {
      console.log(`⚠ ${packageName} 在 node_modules 中不存在，跳过`);
      skippedCount++;
    }
  }
  
  console.log(`\n=== 同步完成 ===`);
  console.log(`成功: ${syncedCount} 个`);
  console.log(`跳过: ${skippedCount} 个`);
}

// 运行主函数
ensureDirectories().then(() => {
  addPackageWithDependencies();
});
