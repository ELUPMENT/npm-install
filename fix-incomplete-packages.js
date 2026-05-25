const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function downloadAndFixPackage(packageName, version, targetDir, registry = 'https://registry.npmjs.org') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`修复包: ${packageName}@${version}`);
  console.log(`${'='.repeat(60)}`);

  const packageDir = targetDir || path.join(__dirname, 'offline-packages', `${packageName}@${version}`);
  
  // 步骤1: 检查当前状态
  const packageJsonPath = path.join(packageDir, 'package.json');
  let originalFiles = [];
  let originalMain = '';
  let originalTypes = '';
  let originalModule = '';

  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    originalFiles = pkg.files || [];
    originalMain = pkg.main || '';
    originalTypes = pkg.types || pkg.typings || '';
    originalModule = pkg.module || '';
    
    console.log(`当前状态:`);
    console.log(`  files: ${JSON.stringify(originalFiles)}`);
    console.log(`  main: ${originalMain}`);
    console.log(`  types: ${originalTypes}`);
    console.log(`  module: ${originalModule}`);

    // 检查入口文件
    const entryPoints = { main: originalMain, types: originalTypes, module: originalModule };
    const missingEntries = [];
    for (const [field, entry] of Object.entries(entryPoints)) {
      if (entry) {
        const entryPath = path.join(packageDir, entry);
        if (!fs.existsSync(entryPath)) {
          missingEntries.push({ field, entry });
          console.log(`  ❌ ${field}: ${entry} (缺失)`);
        } else {
          console.log(`  ✅ ${field}: ${entry}`);
        }
      }
    }

    // 检查files字段的glob模式
    if (originalFiles.length > 0) {
      const hasGlob = originalFiles.some(f => /[*?[\]{}]/.test(f));
      if (hasGlob) {
        console.log(`  ⚠️  files字段包含glob模式`);
      }
    }
  }

  // 步骤2: 从npm下载完整包
  console.log(`\n从npm下载完整包...`);
  const tempDir = path.join(__dirname, '.temp-fix', `${packageName}@${version}_${Date.now()}`);
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 下载tarball
    const tarballUrl = `${registry}/${packageName}/-/${packageName}-${version}.tgz`;
    const tarballPath = path.join(tempDir, 'package.tgz');
    
    console.log(`  下载: npm pack ${packageName}@${version}`);
    
    // 使用npm pack下载
    try {
      execSync(`npm pack ${packageName}@${version} --registry=${registry}`, {
        cwd: tempDir,
        encoding: 'utf-8',
        timeout: 60000,
        stdio: 'pipe'
      });
    } catch {
      // 如果npm pack失败，尝试直接下载
      console.log(`  npm pack失败，尝试直接下载tarball...`);
      try {
        execSync(`curl -sL -o package.tgz "${tarballUrl}"`, {
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 60000,
          stdio: 'pipe'
        });
      } catch {
        // 尝试使用PowerShell下载
        console.log(`  使用PowerShell下载...`);
        execSync(`powershell "Invoke-WebRequest -Uri '${tarballUrl}' -OutFile 'package.tgz'"`, {
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 60000,
          stdio: 'pipe'
        });
      }
    }

    // 解压tarball
    console.log(`  解压tarball...`);
    const extractDir = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    // 查找tgz文件
    const tgzFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.tgz'));
    if (tgzFiles.length === 0) {
      throw new Error('未找到下载的tgz文件');
    }

    const tgzPath = path.join(tempDir, tgzFiles[0]);
    
    // 使用npm install方式获取完整包（最可靠）
    console.log(`  使用npm install获取完整包...`);
    const npmInstallDir = path.join(tempDir, 'npm-pkg');
    fs.mkdirSync(npmInstallDir, { recursive: true });
    
    // 创建临时package.json
    fs.writeFileSync(path.join(npmInstallDir, 'package.json'), '{}', 'utf-8');
    
    execSync(`npm install ${packageName}@${version} --registry=${registry} --no-save --no-package-lock`, {
      cwd: npmInstallDir,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe'
    });
    
    const installedDir = path.join(npmInstallDir, 'node_modules', packageName);
    if (!fs.existsSync(installedDir)) {
      throw new Error('npm install后未找到包目录');
    }
    
    // 将installed目录作为sourceDir
    const sourceDirFromNpm = installedDir;

    const sourceDir = sourceDirFromNpm;

    // 步骤3: 分析下载的完整包
    console.log(`\n分析下载的完整包...`);
    const downloadedPkg = JSON.parse(fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf-8'));
    const downloadedFiles = downloadedPkg.files || [];
    
    console.log(`  下载的files字段: ${JSON.stringify(downloadedFiles)}`);
    console.log(`  下载的main: ${downloadedPkg.main || 'N/A'}`);
    console.log(`  下载的types: ${downloadedPkg.types || downloadedPkg.typings || 'N/A'}`);
    console.log(`  下载的module: ${downloadedPkg.module || 'N/A'}`);

    // 列出下载包中的文件
    const downloadedFileList = [];
    function listAllFiles(dir, base = '') {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item === 'node_modules' || item === '.git') continue;
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        const relativePath = base ? `${base}/${item}` : item;
        if (stat.isDirectory()) {
          listAllFiles(fullPath, relativePath);
        } else {
          downloadedFileList.push(relativePath);
        }
      }
    }
    listAllFiles(sourceDir);
    console.log(`  下载的文件数: ${downloadedFileList.length}`);

    // 步骤4: 备份原目录
    const backupDir = packageDir + '.bak';
    if (fs.existsSync(packageDir) && !fs.existsSync(backupDir)) {
      console.log(`\n备份原目录到: ${backupDir}`);
      fs.cpSync(packageDir, backupDir, { recursive: true });
    }

    // 步骤5: 用完整包替换
    console.log(`\n用完整包替换原目录内容...`);
    
    // 删除原目录内容（保留目录本身）
    const items = fs.readdirSync(packageDir);
    for (const item of items) {
      if (item === 'package.json.bak') continue;
      const fullPath = path.join(packageDir, item);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }

    // 复制完整包内容
    const sourceItems = fs.readdirSync(sourceDir);
    for (const item of sourceItems) {
      const srcPath = path.join(sourceDir, item);
      const destPath = path.join(packageDir, item);
      fs.cpSync(srcPath, destPath, { recursive: true });
    }

    console.log(`✅ 完整包已替换原目录内容`);

    // 步骤6: 修复files字段中的glob模式
    const newPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const newFiles = newPkg.files || [];

    if (newFiles.length > 0 && newFiles.some(f => /[*?[\]{}]/.test(f))) {
      console.log(`\n修复files字段中的glob模式...`);
      
      // 简单的glob展开
      const expandedFiles = [];
      for (const entry of newFiles) {
        if (/[(*?[\]{}]/.test(entry)) {
          // 这是glob模式，尝试展开
          const normalizedPattern = entry.replace(/\/$/, '').replace(/\*$/, '');
          const matchedItems = fs.readdirSync(packageDir).filter(item => {
            const fullPath = path.join(packageDir, item);
            return fs.statSync(fullPath).isDirectory() && item.startsWith(normalizedPattern.replace(/\/$/, ''));
          });
          
          if (matchedItems.length > 0) {
            for (const match of matchedItems) {
              expandedFiles.push(entry.endsWith('/') ? `${match}/` : match);
            }
            console.log(`  "${entry}" → [${matchedItems.map(m => entry.endsWith('/') ? `"${m}/"` : `"${m}"`).join(', ')}]`);
          } else {
            expandedFiles.push(entry);
          }
        } else {
          expandedFiles.push(entry);
        }
      }
      
      newPkg.files = expandedFiles;
      fs.writeFileSync(packageJsonPath, JSON.stringify(newPkg, null, 2), 'utf-8');
      console.log(`  修复后files: ${JSON.stringify(expandedFiles)}`);
    }

    // 步骤7: 验证修复结果
    console.log(`\n验证修复结果...`);
    const fixedPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const fixedEntries = {
      main: fixedPkg.main,
      types: fixedPkg.types || fixedPkg.typings,
      module: fixedPkg.module
    };

    let allGood = true;
    for (const [field, entry] of Object.entries(fixedEntries)) {
      if (entry) {
        let entryPath = path.join(packageDir, entry);
        let exists = fs.existsSync(entryPath);
        // 如果没有扩展名，尝试自动补全
        if (!exists && !path.extname(entryPath)) {
          const extensions = ['.js', '.cjs', '.mjs', '.d.ts', '/index.js', '/index.d.ts'];
          for (const ext of extensions) {
            if (fs.existsSync(entryPath + ext)) {
              exists = true;
              break;
            }
          }
        }
        console.log(`  ${exists ? '✅' : '❌'} ${field}: ${entry}`);
        if (!exists) allGood = false;
      }
    }

    // 用npm pack验证
    try {
      const packOutput = execSync('npm pack --dry-run 2>&1', {
        cwd: packageDir,
        encoding: 'utf-8',
        timeout: 30000
      });
      
      const fileCountMatch = packOutput.match(/total files:\s*(\d+)/i);
      const sizeMatch = packOutput.match(/package size:\s*([\d.]+\s*[kKMmGg]?B)/i);
      
      if (fileCountMatch && sizeMatch) {
        console.log(`  npm pack: ${fileCountMatch[1]} 文件, ${sizeMatch[1]}`);
      }
    } catch {}

    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });

    return {
      success: allGood,
      packageName,
      version,
      packageDir,
      backupDir: fs.existsSync(backupDir) ? backupDir : null
    };

  } catch (error) {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    console.log(`\n❌ 修复失败: ${error.message}`);
    return { success: false, packageName, version, error: error.message };
  }
}

// 需要修复的包列表
const PACKAGES_TO_FIX = [
  'abort-controller@3.0.0',
  'agent-base@6.0.2',
  'https-proxy-agent@5.0.1',
  'http-proxy-agent@5.0.0',
  'combined-stream@1.0.8',
  'delayed-stream@1.0.0',
  'form-data@4.0.5',
  'tough-cookie@4.1.4',
  'commander@2.20.3',
  'cookie-signature@1.0.6',
  'decimal.js@10.6.0',
  'extend@3.0.2',
  'function-bind@1.1.2',
  'ms@2.0.0',
  'ms@2.1.2',
  'ms@2.1.3',
  'nwsapi@2.2.23',
  'speakingurl@14.0.1',
  'utils-merge@1.0.1',
  'xtend@4.0.2',
  'source-map@0.6.1',
  'fast-safe-stringify@2.1.1',
  'event-target-shim@5.0.1',
  'clipanion@4.0.0-rc.4',
  'typanion@3.14.0',
  'at_eslint-community_eslint-utils@4.9.1',
  'at_eslint-community_regexpp@4.12.2',
];

async function main() {
  const args = process.argv.slice(2);
  const registry = args.find(a => a.startsWith('--registry='))?.split('=')[1] 
    || 'https://registry.npmjs.org';
  const specificPkg = args.find(a => !a.startsWith('--'));

  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  离线依赖包完整修复工具 (重新下载+glob修复)            ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nRegistry: ${registry}`);

  let packagesToFix = [];

  if (specificPkg) {
    // 修复指定的包
    const [name, version] = specificPkg.includes('@') && !specificPkg.startsWith('@') 
      ? specificPkg.split('@') 
      : [specificPkg, ''];
    
    if (!version) {
      // 从offline-packages目录查找版本
      const offlineDir = path.join(__dirname, 'offline-packages');
      const dirs = fs.readdirSync(offlineDir).filter(d => d.startsWith(`${name}@`));
      if (dirs.length > 0) {
        packagesToFix = dirs.map(d => d);
      } else {
        console.error(`❌ 未找到包: ${name}`);
        process.exit(1);
      }
    } else {
      packagesToFix = [specificPkg];
    }
  } else {
    // 修复所有已知有问题的包 - 自动从offline-packages扫描
    console.log('\n自动扫描需要修复的包...');
    const offlineDir = path.join(__dirname, 'offline-packages');
    const allDirs = fs.readdirSync(offlineDir);
    
    for (const dirName of allDirs) {
      const pkgDir = path.join(offlineDir, dirName);
      if (!fs.statSync(pkgDir).isDirectory()) continue;
      if (dirName.endsWith('.bak')) continue; // 跳过备份目录
      
      const pkgJsonPath = path.join(pkgDir, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;
      
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const entryPoints = { main: pkg.main, types: pkg.types || pkg.typings, module: pkg.module };
        
        for (const [field, entry] of Object.entries(entryPoints)) {
          if (entry) {
            let entryPath = path.join(pkgDir, entry);
            let exists = fs.existsSync(entryPath);
            if (!exists && !path.extname(entryPath)) {
              const extensions = ['.js', '.cjs', '.mjs', '.d.ts'];
              for (const ext of extensions) {
                if (fs.existsSync(entryPath + ext)) { exists = true; break; }
              }
            }
            if (!exists) {
              packagesToFix.push(dirName);
              break;
            }
          }
        }
      } catch {}
    }
    
    console.log(`发现 ${packagesToFix.length} 个入口文件缺失的包`);
  }

  console.log(`\n将修复 ${packagesToFix.length} 个包`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const pkg of packagesToFix) {
    // 从目录名解析包名和版本（目录名格式：name@version 或 at_scope_name@version）
    const atIndex = pkg.lastIndexOf('@');
    let name = pkg.substring(0, atIndex);
    const version = pkg.substring(atIndex + 1);
    
    // 处理scoped包的目录名（at_scope_name -> @scope/name）
    if (name.startsWith('at_')) {
      name = name.replace(/^at_/, '@').replace(/_/g, '/');
      // 更精确的转换：at_babel_parser -> @babel/parser
      const parts = name.split('/');
      if (parts.length >= 2) {
        name = parts[0] + '/' + parts.slice(1).join('/');
      }
    }
    
    const packageDir = path.join(__dirname, 'offline-packages', pkg);
    
    const result = downloadAndFixPackage(name, version, packageDir, registry);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // 总结
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║  修复总结                                                  ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\n总计: ${packagesToFix.length} 个包`);
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${failCount} 个`);

  if (successCount > 0) {
    console.log('\n修复后可重新发布:');
    for (const result of results.filter(r => r.success)) {
      console.log(`  cd offline-packages/${result.packageName}@${result.version} && npm publish --registry http://localhost:4873`);
    }
  }

  if (failCount > 0) {
    console.log('\n失败的包:');
    for (const result of results.filter(r => !r.success)) {
      console.log(`  ❌ ${result.packageName}@${result.version}: ${result.error || 'unknown error'}`);
    }
  }

  // 保存报告
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `full-fix-report-${timestamp}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: packagesToFix.length,
    success: successCount,
    failed: failCount,
    results: results.map(r => ({
      packageName: r.packageName,
      version: r.version,
      success: r.success,
      error: r.error || null
    }))
  }, null, 2), 'utf-8');
  
  console.log(`\n📄 报告已保存: ${reportPath}`);
}

main().catch(error => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});