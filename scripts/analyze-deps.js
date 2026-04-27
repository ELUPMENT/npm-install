const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');

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
    stdio: options.stdio || 'pipe',
    ...options
  });
}

// 分析包的完整依赖树
async function analyzePackage() {
  try {
    console.log('\n=== 分析 npm 包依赖树 ===\n');
    
    const packageName = await askQuestion('请输入要分析的包名: ');
    if (!packageName) {
      console.log('包名不能为空');
      rl.close();
      return;
    }

    const version = await askQuestion('请输入版本号 (留空使用最新版本): ') || 'latest';
    
    console.log(`\n正在分析 ${packageName}@${version}...`);
    
    // 获取包的详细信息（Windows 兼容）
    const infoOutput = execCommand(
      `npm view ${packageName}@${version} --json --registry=https://registry.npmjs.org/`
    );
    
    const packageInfo = JSON.parse(infoOutput);
    
    console.log(`\n=== ${packageName}@${packageInfo.version} ===`);
    console.log(`描述: ${packageInfo.description || '无'}`);
    console.log(`许可证: ${packageInfo.license || '未知'}`);
    console.log(`作者: ${packageInfo.author?.name || packageInfo.author || '未知'}`);
    
    // 显示所有依赖
    const deps = packageInfo.dependencies || {};
    const devDeps = packageInfo.devDependencies || {};
    const peerDeps = packageInfo.peerDependencies || {};
    const optionalDeps = packageInfo.optionalDependencies || {};
    
    console.log(`\n📦 直接依赖 (${Object.keys(deps).length} 个):`);
    if (Object.keys(deps).length > 0) {
      Object.entries(deps).forEach(([name, ver]) => {
        console.log(`  ├─ ${name}: ${ver}`);
      });
    } else {
      console.log('  无');
    }
    
    console.log(`\n🔧 开发依赖 (${Object.keys(devDeps).length} 个):`);
    if (Object.keys(devDeps).length > 0) {
      Object.entries(devDeps).forEach(([name, ver]) => {
        console.log(`  ├─ ${name}: ${ver}`);
      });
    } else {
      console.log('  无');
    }
    
    console.log(`\n🤝 对等依赖 (${Object.keys(peerDeps).length} 个):`);
    if (Object.keys(peerDeps).length > 0) {
      Object.entries(peerDeps).forEach(([name, ver]) => {
        console.log(`  ├─ ${name}: ${ver}`);
      });
    } else {
      console.log('  无');
    }
    
    console.log(`\n⭐ 可选依赖 (${Object.keys(optionalDeps).length} 个):`);
    if (Object.keys(optionalDeps).length > 0) {
      Object.entries(optionalDeps).forEach(([name, ver]) => {
        console.log(`  ├─ ${name}: ${ver}`);
      });
    } else {
      console.log('  无');
    }
    
    // 计算总依赖数
    const totalDeps = Object.keys(deps).length + Object.keys(devDeps).length + 
                      Object.keys(peerDeps).length + Object.keys(optionalDeps).length;
    
    console.log(`\n=== 依赖统计 ===`);
    console.log(`总计: ${totalDeps} 个依赖`);
    console.log(`  - 直接依赖: ${Object.keys(deps).length}`);
    console.log(`  - 开发依赖: ${Object.keys(devDeps).length}`);
    console.log(`  - 对等依赖: ${Object.keys(peerDeps).length}`);
    console.log(`  - 可选依赖: ${Object.keys(optionalDeps).length}`);
    
    // 保存分析报告
    const report = {
      name: packageName,
      version: packageInfo.version,
      description: packageInfo.description || '',
      license: packageInfo.license || '',
      author: packageInfo.author?.name || packageInfo.author || '',
      dependencies: deps,
      devDependencies: devDeps,
      peerDependencies: peerDeps,
      optionalDependencies: optionalDeps,
      totalDependencies: totalDeps,
      analyzedAt: new Date().toISOString()
    };
    
    const reportsDir = path.join(__dirname, '..', 'reports');
    await fs.ensureDir(reportsDir);
    
    // Windows 兼容的文件名处理
    const safeFileName = packageName.replace(/\//g, '_').replace(/@/g, 'at_');
    const reportPath = path.join(reportsDir, `${safeFileName}-deps.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    console.log(`\n✓ 分析报告已保存到: ${reportPath}`);
    
    // 询问是否安装所有依赖
    const installAll = await askQuestion('\n是否安装所有这些依赖? (y/n): ');
    if (installAll.toLowerCase() === 'y') {
      await installAllDependencies(packageName, packageInfo.version, deps);
    }
    
  } catch (error) {
    console.error('✗ 分析失败:', error.message);
  } finally {
    rl.close();
  }
}

// 安装所有依赖
async function installAllDependencies(packageName, packageVersion, deps) {
  try {
    console.log('\n开始安装所有依赖...');
    
    const packagesToInstall = [
      `${packageName}@${packageVersion}`,
      ...Object.entries(deps).map(([name, ver]) => `${name}@${ver.replace(/[^0-9.]/g, '') || 'latest'}`)
    ];
    
    console.log(`需要安装 ${packagesToInstall.length} 个包:`);
    packagesToInstall.forEach((pkg, index) => {
      console.log(`  ${index + 1}. ${pkg}`);
    });
    
    const confirm = await askQuestion('\n是否继续? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('已取消操作');
      return;
    }
    
    for (const pkg of packagesToInstall) {
      try {
        console.log(`\n安装 ${pkg}...`);
        // Windows 兼容
        execCommand(`npm install ${pkg} --registry=http://localhost:4873 --no-save`, { stdio: 'inherit' });
        console.log(`✓ ${pkg} 安装成功`);
      } catch (error) {
        console.error(`✗ ${pkg} 安装失败: ${error.message}`);
      }
    }
    
    console.log('\n✓ 所有依赖安装完成!');
    
  } catch (error) {
    console.error('✗ 安装过程出错:', error.message);
  }
}

analyzePackage();
