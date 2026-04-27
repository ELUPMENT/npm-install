const fs = require('fs');
const path = require('path');

console.log('\n=== 项目配置检查 ===\n');

let allGood = true;

// 检查 Node.js 版本
console.log('1. 检查 Node.js...');
try {
  const version = process.version;
  console.log(`   ✓ Node.js: ${version}`);
  
  const major = parseInt(version.split('.')[0].substring(1));
  if (major < 14) {
    console.log('   ⚠ 建议升级到 Node.js 14 或更高版本');
  }
} catch (error) {
  console.log('   ✗ 无法获取 Node.js 版本');
  allGood = false;
}

// 检查 npm 版本
console.log('\n2. 检查 npm...');
try {
  const { execSync } = require('child_process');
  const npmVersion = execSync('npm -v', { encoding: 'utf8' }).trim();
  console.log(`   ✓ npm: ${npmVersion}`);
} catch (error) {
  console.log('   ✗ 无法获取 npm 版本');
  allGood = false;
}

// 检查必要文件
console.log('\n3. 检查项目文件...');
const requiredFiles = [
  'package.json',
  'verdaccio/config.yaml',
  'scripts/add-package.js',
  'scripts/sync-to-offline.js',
  'scripts/generate-docs.js',
  'scripts/publish-to-internal.js',
  'scripts/publish-internal-standalone.js',
  'README.md',
  'INTERNAL-PUBLISH-GUIDE.md'
];

requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ✗ 缺少: ${file}`);
    allGood = false;
  }
});

// 检查目录结构
console.log('\n4. 检查目录结构...');
const requiredDirs = ['packages', 'docs', 'offline-packages'];

requiredDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✓ ${dir}/`);
  } else {
    console.log(`   ✗ 缺少目录: ${dir}/`);
    allGood = false;
  }
});

// 检查 node_modules
console.log('\n5. 检查依赖安装...');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  const packageJsonPath = path.join(nodeModulesPath, 'verdaccio', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    console.log('   ✓ Verdaccio 已安装');
  } else {
    console.log('   ⚠ Verdaccio 未安装，请运行: npm install');
    allGood = false;
  }
} else {
  console.log('   ⚠ node_modules 不存在，请运行: npm install');
  allGood = false;
}

// 检查 Verdaccio 配置
console.log('\n6. 检查 Verdaccio 配置...');
const configPath = path.join(__dirname, '..', 'verdaccio', 'config.yaml');
if (fs.existsSync(configPath)) {
  const config = fs.readFileSync(configPath, 'utf8');
  
  // 检查关键配置项
  const checks = [
    { key: 'storage:', desc: '存储路径' },
    { key: 'uplinks:', desc: '上游仓库' },
    { key: 'packages:', desc: '包权限' },
    { key: 'auth:', desc: '认证配置' }
  ];
  
  checks.forEach(check => {
    if (config.includes(check.key)) {
      console.log(`   ✓ ${check.desc} 已配置`);
    } else {
      console.log(`   ⚠ ${check.desc} 未配置`);
    }
  });
} else {
  console.log('   ✗ Verdaccio 配置文件不存在');
  allGood = false;
}

// 总结
console.log('\n========================================');
if (allGood) {
  console.log('  ✓ 所有检查通过！');
  console.log('========================================');
  console.log('\n下一步：');
  console.log('  1. 运行 start.bat 启动 Verdaccio');
  console.log('  2. 或使用命令: npm start');
  console.log('  3. 查看 QUICKSTART.md 了解更多信息');
} else {
  console.log('  ⚠ 部分检查未通过，请修复后重试');
  console.log('========================================');
  console.log('\n建议操作：');
  console.log('  1. 确保所有文件都已正确复制');
  console.log('  2. 运行: npm install 安装依赖');
  console.log('  3. 重新运行此检查脚本');
}
console.log('');
