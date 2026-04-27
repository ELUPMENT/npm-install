const fs = require('fs-extra');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const NODE_MODULES = path.join(__dirname, '..', 'node_modules');
const OFFLINE_DIR = path.join(__dirname, '..', 'offline-packages');

async function diagnosePackages() {
  console.log('\n=== NPM 包同步诊断工具 ===\n');
  
  // 1. 检查 packages 目录
  console.log('📁 检查 packages/ 目录...');
  const packageFiles = await fs.readdir(PACKAGES_DIR);
  const jsonFiles = packageFiles.filter(f => f.endsWith('.json'));
  
  console.log(`找到 ${jsonFiles.length} 个包信息文件:\n`);
  
  const packages = [];
  for (const file of jsonFiles) {
    const info = await fs.readJson(path.join(PACKAGES_DIR, file));
    packages.push({
      file: file,
      name: info.name,
      version: info.version
    });
    console.log(`  - 文件: ${file}`);
    console.log(`    包名: ${info.name}`);
    console.log(`    版本: ${info.version}\n`);
  }
  
  // 2. 检查 node_modules 中的实际安装情况
  console.log('\n📦 检查 node_modules/ 中的实际安装情况...\n');
  
  let foundCount = 0;
  let missingCount = 0;
  
  for (const pkg of packages) {
    const actualPath = path.join(NODE_MODULES, pkg.name);
    const exists = await fs.pathExists(actualPath);
    
    if (exists) {
      console.log(`✓ ${pkg.name}@${pkg.version} - 已安装`);
      foundCount++;
    } else {
      console.log(`✗ ${pkg.name}@${pkg.version} - 未安装`);
      missingCount++;
    }
  }
  
  // 3. 检查 offline-packages 目录
  console.log('\n📂 检查 offline-packages/ 目录...\n');
  const offlineExists = await fs.pathExists(OFFLINE_DIR);
  if (offlineExists) {
    const offlineFiles = await fs.readdir(OFFLINE_DIR);
    console.log(`离线文件夹中有 ${offlineFiles.length} 个包:\n`);
    offlineFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
  } else {
    console.log('离线文件夹不存在');
  }
  
  // 4. 总结和建议
  console.log('\n\n=== 诊断总结 ===\n');
  console.log(`包信息文件: ${packages.length} 个`);
  console.log(`实际已安装: ${foundCount} 个`);
  console.log(`缺失的包: ${missingCount} 个`);
  
  if (missingCount > 0) {
    console.log('\n⚠️  发现以下问题:\n');
    
    // 找出缺失的包
    const missingPackages = packages.filter(pkg => {
      const actualPath = path.join(NODE_MODULES, pkg.name);
      return !fs.pathExistsSync(actualPath);
    });
    
    console.log('缺失的包列表:');
    missingPackages.forEach(pkg => {
      console.log(`  - ${pkg.name}@${pkg.version} (文件: ${pkg.file})`);
    });
    
    console.log('\n💡 建议操作:\n');
    console.log('1. 清理重复的包信息文件:');
    console.log('   检查 packages/ 目录，删除旧格式的文件（如 @types_node.json）');
    console.log('   只保留新格式的文件（如 at_types_node.json）\n');
    
    console.log('2. 重新安装缺失的包:');
    const uniqueMissingNames = [...new Set(missingPackages.map(p => p.name))];
    uniqueMissingNames.forEach(name => {
      console.log(`   npm install ${name} --registry=http://localhost:4873`);
    });
    
    console.log('\n3. 或者使用自动依赖安装:');
    console.log('   npm run add-deps');
    console.log('   输入主包名，系统会自动安装所有依赖\n');
  } else {
    console.log('\n✅ 所有包都已正确安装！');
  }
  
  console.log('\n=== 诊断完成 ===\n');
}

diagnosePackages().catch(console.error);
