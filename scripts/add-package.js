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
const PUBLIC_REGISTRY = 'https://registry.npmjs.org';

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
  const isWindows = process.platform === 'win32';
  const finalCommand = isWindows ? `cmd /c "${command}"` : command;
  
  return execSync(finalCommand, {
    encoding: 'utf8',
    stdio: options.stdio || 'inherit',
    ...options
  });
}

// 使用公网 npm registry
function getCurrentRegistry() {
  return PUBLIC_REGISTRY;
}

async function addPackage() {
  try {
    console.log('\n=== 添加 npm 依赖包 ===\n');
    
    const packageName = await askQuestion('请输入包名: ');
    if (!packageName) {
      console.log('包名不能为空');
      rl.close();
      return;
    }

    const version = await askQuestion('请输入版本号 (留空使用最新版本): ') || 'latest';
    
    // 使用公网 npm registry 下载依赖
    const registry = PUBLIC_REGISTRY;
    console.log(`📦 使用 registry: ${registry}\n`);
    
    console.log(`正在下载 ${packageName}@${version}...`);
    
    // 执行 npm install（Windows 兼容），添加 --legacy-peer-deps 避免依赖冲突
    const installCmd = `npm install ${packageName}@${version} --registry=${registry} --legacy-peer-deps --no-package-lock`;
    execCommand(installCmd);
    
    console.log(`✓ 成功下载 ${packageName}@${version}`);
    
    // 记录包信息
    const packageInfo = {
      name: packageName,
      version: version,
      installedAt: new Date().toISOString(),
      registry: registry
    };
    
    // Windows 兼容的文件名处理：替换 / 和 @ 符号
    const safeFileName = packageName.replace(/\//g, '_').replace(/@/g, 'at_');
    const packageJsonPath = path.join(PACKAGES_DIR, `${safeFileName}.json`);
    await fs.writeJson(packageJsonPath, packageInfo, { spaces: 2 });
    
    console.log(`✓ 包信息已保存到 ${packageJsonPath}`);
    
    // 询问是否生成文档
    const generateDocs = await askQuestion('\n是否生成依赖文档? (y/n): ');
    if (generateDocs.toLowerCase() === 'y') {
      await generateDocumentation(packageName, version, packageInfo);
    }
    
    // 询问是否同步到离线文件夹
    const syncToOffline = await askQuestion('\n是否同步到离线文件夹? (y/n): ');
    if (syncToOffline.toLowerCase() === 'y') {
      await syncToOfflineFolder(packageName);
    }
    
    console.log('\n✓ 依赖包添加完成!');
    
  } catch (error) {
    console.error('✗ 添加依赖包失败:', error.message);
  } finally {
    rl.close();
  }
}

// 生成文档
async function generateDocumentation(packageName, version, packageInfo) {
  console.log('\n正在生成文档...');
  
  const docContent = `# ${packageName} 依赖文档

## 基本信息

- **包名**: ${packageName}
- **版本**: ${version}
- **安装时间**: ${packageInfo.installedAt}
- **仓库地址**: ${packageInfo.registry}

## 安装命令

\`\`\`bash
npm install ${packageName}@${version} --registry=http://localhost:4873
\`\`\`

## 使用说明

请参考官方文档: https://www.npmjs.com/package/${packageName}

## 注意事项

1. 该依赖已通过 Verdaccio 私有仓库管理
2. 内网使用时，请确保配置了正确的 registry 地址
3. 建议在内网环境中使用离线包进行安装

---

*文档生成时间: ${new Date().toLocaleString('zh-CN')}*
`;
  
  const docPath = path.join(DOCS_DIR, `${packageName.replace('/', '_')}.md`);
  await fs.writeFile(docPath, docContent, 'utf8');
  
  console.log(`✓ 文档已保存到 ${docPath}`);
}

// 同步到离线文件夹
async function syncToOfflineFolder(packageName) {
  console.log('\n正在同步到离线文件夹...');
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules', packageName);
  const offlinePackagePath = path.join(OFFLINE_DIR, packageName.replace('/', '_'));
  
  if (await fs.pathExists(nodeModulesPath)) {
    await fs.copy(nodeModulesPath, offlinePackagePath);
    console.log(`✓ 已同步到 ${offlinePackagePath}`);
  } else {
    console.log(`⚠ 未找到包文件: ${nodeModulesPath}`);
  }
}

// 运行主函数
ensureDirectories().then(() => {
  addPackage();
});
