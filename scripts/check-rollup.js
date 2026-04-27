const fs = require('fs-extra');
const path = require('path');

console.log('\n=== Rollup 包完整性检查 ===\n');

async function checkRollup() {
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules', 'rollup');
  const offlinePath = path.join(__dirname, '..', 'offline-packages', 'rollup');
  
  console.log('1️⃣  检查 node_modules/rollup...');
  if (await fs.pathExists(nodeModulesPath)) {
    const pkgPath = path.join(nodeModulesPath, 'package.json');
    const pkg = await fs.readJson(pkgPath);
    
    console.log(`   ✅ 版本: ${pkg.version}`);
    console.log(`   ✅ 包含 scripts: ${!!pkg.scripts}`);
    console.log(`   ✅ Scripts 数量: ${Object.keys(pkg.scripts || {}).length}`);
    
    // 检查关键文件
    const criticalFiles = [
      'dist/rollup.js',
      'dist/bin/rollup',
      'package.json'
    ];
    
    console.log('\n   关键文件检查:');
    for (const file of criticalFiles) {
      const exists = await fs.pathExists(path.join(nodeModulesPath, file));
      console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    }
  } else {
    console.log('   ❌ rollup 未安装');
  }
  
  console.log('\n2️⃣  检查 offline-packages/rollup...');
  if (await fs.pathExists(offlinePath)) {
    const pkgPath = path.join(offlinePath, 'package.json');
    const pkg = await fs.readJson(pkgPath);
    
    console.log(`   ✅ 版本: ${pkg.version}`);
    console.log(`   ✅ 包含 scripts: ${!!pkg.scripts}`);
    console.log(`   ✅ Scripts 数量: ${Object.keys(pkg.scripts || {}).length}`);
    
    // 检查关键文件
    const criticalFiles = [
      'dist/rollup.js',
      'dist/bin/rollup',
      'package.json'
    ];
    
    console.log('\n   关键文件检查:');
    for (const file of criticalFiles) {
      const exists = await fs.pathExists(path.join(offlinePath, file));
      console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    }
    
    // 检查目录结构
    const files = await fs.readdir(offlinePath);
    console.log(`\n   📁 目录内容 (${files.length} 项):`);
    files.slice(0, 10).forEach(file => {
      console.log(`      - ${file}`);
    });
    if (files.length > 10) {
      console.log(`      ... 还有 ${files.length - 10} 项`);
    }
  } else {
    console.log('   ❌ rollup 未同步到离线文件夹');
    console.log('   💡 运行: npm run sync-to-offline');
  }
  
  console.log('\n3️⃣  对比分析...');
  
  if (await fs.pathExists(nodeModulesPath) && await fs.pathExists(offlinePath)) {
    const nodePkg = await fs.readJson(path.join(nodeModulesPath, 'package.json'));
    const offlinePkg = await fs.readJson(path.join(offlinePath, 'package.json'));
    
    const nodeScriptsCount = Object.keys(nodePkg.scripts || {}).length;
    const offlineScriptsCount = Object.keys(offlinePkg.scripts || {}).length;
    
    console.log(`   node_modules scripts: ${nodeScriptsCount} 个`);
    console.log(`   offline scripts: ${offlineScriptsCount} 个`);
    
    if (nodeScriptsCount === offlineScriptsCount) {
      console.log('   ✅ Scripts 字段完整同步');
    } else {
      console.log('   ⚠️  Scripts 数量不一致！');
      
      // 找出差异
      const nodeScripts = new Set(Object.keys(nodePkg.scripts || {}));
      const offlineScripts = new Set(Object.keys(offlinePkg.scripts || {}));
      
      const missing = [...nodeScripts].filter(s => !offlineScripts.has(s));
      if (missing.length > 0) {
        console.log('\n   缺失的 scripts:');
        missing.forEach(s => console.log(`      - ${s}`));
      }
    }
  }
  
  console.log('\n=== 检查完成 ===\n');
}

checkRollup().catch(console.error);
