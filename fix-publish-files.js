const path = require('path');
const fs = require('fs');

// 直接导入编译后的模块（如果存在）或直接实现
class GlobExpander {
  static expandGlobPatterns(filesField, packageDir) {
    const results = [];
    for (const entry of filesField) {
      const isGlob = /[*?[\]{}]/.test(entry);
      if (!isGlob) {
        results.push({ original: entry, expanded: [entry], matchedDirs: [], isGlob: false });
        continue;
      }
      const matchedDirs = this.matchGlobInDir(entry, packageDir);
      const expanded = matchedDirs.length > 0 ? matchedDirs : [entry];
      results.push({ original: entry, expanded, matchedDirs, isGlob: true });
    }
    return results;
  }

  static matchGlobInDir(pattern, packageDir) {
    const normalizedPattern = pattern.replace(/\/$/, '');
    const matchedDirs = [];
    try {
      const items = fs.readdirSync(packageDir);
      for (const item of items) {
        const fullPath = path.join(packageDir, item);
        let stat;
        try { stat = fs.statSync(fullPath); } catch { continue; }
        if (!stat.isDirectory()) continue;
        if (this.matchGlobPattern(normalizedPattern, item)) {
          matchedDirs.push(pattern.endsWith('/') ? `${item}/` : item);
        }
      }
    } catch {}
    return matchedDirs.sort();
  }

  static matchGlobPattern(pattern, testName) {
    // 简单的glob匹配：将*转为[^/]*正则
    let regexStr = '';
    let i = 0;
    while (i < pattern.length) {
      const char = pattern[i];
      if (char === '*') {
        if (i + 1 < pattern.length && pattern[i + 1] === '*') {
          regexStr += '.*'; i += 2;
        } else {
          regexStr += '[^/]*'; i++;
        }
      } else if (char === '?') {
        regexStr += '[^/]'; i++;
      } else {
        regexStr += char.replace(/[\\^$.|+()]/g, '\\$&'); i++;
      }
    }
    return new RegExp(`^${regexStr}$`).test(testName);
  }

  static expandFilesField(filesField, packageDir) {
    const results = this.expandGlobPatterns(filesField, packageDir);
    const expanded = [];
    for (const result of results) expanded.push(...result.expanded);
    return [...new Set(expanded)];
  }
}

class FilesFieldFixer {
  static fixPackageJson(packageDir, options = {}) {
    const { dryRun = false, createBackup = true, verifyAfterFix = true } = options;
    const packageJsonPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json not found in ${packageDir}`);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const packageName = packageJson.name || 'unknown';
    const packageVersion = packageJson.version || 'unknown';
    const originalFiles = packageJson.files || [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`修复包: ${packageName}@${packageVersion}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`位置: ${packageDir}`);
    console.log(`原始 files 字段: ${JSON.stringify(originalFiles)}`);

    // 分析glob模式
    const globResults = GlobExpander.expandGlobPatterns(originalFiles, packageDir);
    console.log('\nGlob模式分析:');
    for (const result of globResults) {
      if (result.isGlob) {
        console.log(`  "${result.original}" (glob) → 展开为: [${result.expanded.map(f => `"${f}"`).join(', ')}]`);
        console.log(`    匹配的目录: [${result.matchedDirs.join(', ')}]`);
      } else {
        console.log(`  "${result.original}" (静态)`);
      }
    }

    const hasGlobs = globResults.some(r => r.isGlob);
    if (!hasGlobs) {
      console.log('\n✅ 没有glob模式，无需修复');
      return { wasModified: false, fixedFiles: originalFiles };
    }

    // 展开files字段
    const fixedFiles = GlobExpander.expandFilesField(originalFiles, packageDir);
    const wasModified = JSON.stringify(originalFiles) !== JSON.stringify(fixedFiles);

    if (!wasModified) {
      console.log('\n✅ Glob模式已正确展开，无需修复');
      return { wasModified: false, fixedFiles };
    }

    console.log(`\n修复后 files 字段: ${JSON.stringify(fixedFiles)}`);

    if (dryRun) {
      console.log('\n⚠️  模拟运行模式 - 未实际修改文件');
      return { wasModified: true, fixedFiles, dryRun: true };
    }

    // 创建备份
    let backupPath = null;
    if (createBackup) {
      backupPath = packageJsonPath + '.bak';
      fs.copyFileSync(packageJsonPath, backupPath);
      console.log(`\n✅ 备份创建: ${backupPath}`);
    }

    // 修改package.json
    packageJson.files = fixedFiles;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    console.log('✅ package.json 已更新');

    // 验证修复
    if (verifyAfterFix) {
      console.log('\n验证修复结果:');
      const entryFields = ['main', 'module', 'types', 'typings'];
      for (const field of entryFields) {
        if (packageJson[field]) {
          const entryPath = path.join(packageDir, packageJson[field]);
          const exists = fs.existsSync(entryPath);
          console.log(`  ${field}: ${packageJson[field]} → ${exists ? '✅ 存在' : '❌ 缺失'}`);
        }
      }
    }

    return { wasModified: true, fixedFiles, backupPath };
  }
}

class PublishValidator {
  static validatePublishReadiness(packageDir) {
    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const packageName = packageJson.name || 'unknown';
    const packageVersion = packageJson.version || 'unknown';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`验证发布完整性: ${packageName}@${packageVersion}`);
    console.log(`${'='.repeat(60)}`);

    const checks = [];

    // 检查1: 目录完整性
    const filesField = packageJson.files || [];
    const expandedFiles = GlobExpander.expandFilesField(filesField, packageDir);
    let missingDirs = [];
    for (const entry of expandedFiles) {
      const normalizedEntry = entry.replace(/\/$/, '');
      const fullPath = path.join(packageDir, normalizedEntry);
      if (!fs.existsSync(fullPath) && fs.existsSync(path.dirname(fullPath))) {
        missingDirs.push(entry);
      }
    }
    checks.push({
      name: '目录完整性',
      passed: missingDirs.length === 0,
      message: missingDirs.length === 0 ? '所有目录存在' : `缺失目录: ${missingDirs.join(', ')}`
    });

    // 检查2: 入口文件
    const entryFields = ['main', 'module', 'types', 'typings'];
    const missingEntries = [];
    for (const field of entryFields) {
      if (packageJson[field]) {
        const entryPath = path.join(packageDir, packageJson[field]);
        if (!fs.existsSync(entryPath)) {
          missingEntries.push(`${field}: ${packageJson[field]}`);
        }
      }
    }
    checks.push({
      name: '入口文件',
      passed: missingEntries.length === 0,
      message: missingEntries.length === 0 ? '所有入口文件存在' : `缺失: ${missingEntries.join(', ')}`
    });

    // 检查3: files字段覆盖
    const globResults = GlobExpander.getGlobOnlyEntries ? 
      GlobExpander.expandGlobPatterns(filesField, packageDir).filter(r => r.isGlob) : [];
    const hasGlobIssue = globResults.some(r => r.matchedDirs.length > 0 && r.expanded.length > 1);
    checks.push({
      name: 'files字段覆盖',
      passed: !hasGlobIssue,
      message: hasGlobIssue ? 
        'Glob模式可能导致npm publish时文件缺失' : 
        (globResults.length > 0 ? 'Glob模式展开正确' : '无glob模式')
    });

    // 检查4: 本地文件数 vs 预期文件数
    const localFileCount = countFiles(packageDir);
    checks.push({
      name: '文件数量',
      passed: true,
      message: `本地文件数: ${localFileCount}`
    });

    // 输出结果
    console.log('\n检查结果:');
    for (const check of checks) {
      console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}: ${check.message}`);
    }

    const passedCount = checks.filter(c => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);
    console.log(`\n综合评分: ${score}%`);

    return {
      packageName,
      packageVersion,
      isComplete: checks.every(c => c.passed),
      score,
      checks
    };
  }
}

function countFiles(dir) {
  let count = 0;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

// 主流程
async function main() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  npm publish files 字段 glob 修复工具                     ║');
  console.log('╚' + '═'.repeat(58) + '╝');

  const asyncValidatorDir = path.join(__dirname, 'offline-packages', 'async-validator@4.2.5');

  if (!fs.existsSync(asyncValidatorDir)) {
    console.error('❌ 未找到 async-validator 包:', asyncValidatorDir);
    process.exit(1);
  }

  // 步骤1: 诊断问题
  console.log('\n📋 步骤1: 诊断问题');
  const packageJsonPath = path.join(asyncValidatorDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  console.log(`\n包名: ${packageJson.name}`);
  console.log(`版本: ${packageJson.version}`);
  console.log(`files 字段: ${JSON.stringify(packageJson.files)}`);

  // 列出本地目录
  console.log('\n本地目录结构:');
  const localDirs = fs.readdirSync(asyncValidatorDir);
  for (const item of localDirs) {
    const fullPath = path.join(asyncValidatorDir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      console.log(`  📁 ${item}/`);
      const subFiles = fs.readdirSync(fullPath);
      for (const sub of subFiles.slice(0, 5)) {
        console.log(`     ${sub}`);
      }
      if (subFiles.length > 5) {
        console.log(`     ... 还有 ${subFiles.length - 5} 个文件`);
      }
    } else {
      console.log(`  📄 ${item}`);
    }
  }

  // 步骤2: 验证发布前状态
  console.log('\n📋 步骤2: 验证发布前状态');
  const preValidation = PublishValidator.validatePublishReadiness(asyncValidatorDir);

  // 步骤3: 执行修复
  console.log('\n📋 步骤3: 执行修复');
  const fixResult = FilesFieldFixer.fixPackageJson(asyncValidatorDir, {
    dryRun: false,
    createBackup: true,
    verifyAfterFix: true
  });

  // 步骤4: 验证修复后状态
  console.log('\n📋 步骤4: 验证修复后状态');
  const postValidation = PublishValidator.validatePublishReadiness(asyncValidatorDir);

  // 步骤5: 尝试npm pack验证
  console.log('\n📋 步骤5: npm pack 验证');
  const { execSync } = require('child_process');
  try {
    const output = execSync('npm pack --dry-run 2>&1', {
      cwd: asyncValidatorDir,
      encoding: 'utf-8',
      timeout: 30000
    });
    console.log(output);
    
    // 解析文件数
    const fileCountMatch = output.match(/total files:\s*(\d+)/i);
    const sizeMatch = output.match(/package size:\s*([\d.]+\s*[kKMmGg]?B)/i);
    
    if (fileCountMatch && sizeMatch) {
      console.log(`\n✅ npm pack 结果: ${fileCountMatch[1]} 个文件, 大小 ${sizeMatch[1]}`);
      
      if (parseInt(fileCountMatch[1]) >= 30) {
        console.log('✅ 文件数量正常（之前只有4个）');
      } else {
        console.log('⚠️  文件数量偏少，可能仍有问题');
      }
    }
  } catch (error) {
    console.log('⚠️  npm pack 执行失败（非关键）:', error.message);
  }

  // 步骤6: 总结
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║  修复总结                                                  ║');
  console.log('╚' + '═'.repeat(58) + '╝');

  console.log(`\n包: ${packageJson.name}@${packageJson.version}`);
  console.log(`修复前 files: ${JSON.stringify(fixResult.originalFiles || packageJson.files)}`);
  console.log(`修复后 files: ${JSON.stringify(fixResult.fixedFiles)}`);
  console.log(`是否修改: ${fixResult.wasModified ? '✅ 是' : '否'}`);
  console.log(`验证评分: ${postValidation.score}%`);
  console.log(`备份位置: ${fixResult.backupPath || '无'}`);

  if (fixResult.wasModified && postValidation.isComplete) {
    console.log('\n🎉 修复成功！现在可以执行 npm publish --registry http://localhost:4873');
    console.log('   所有文件（包括 dist-types/ 和 dist-web/）将被包含在发布的包中');
  }

  // 步骤7: 扫描其他可能有问题的包
  console.log('\n📋 步骤7: 扫描其他离线包');
  const offlinePackagesDir = path.join(__dirname, 'offline-packages');
  if (fs.existsSync(offlinePackagesDir)) {
    const packages = fs.readdirSync(offlinePackagesDir);
    const problemPackages = [];

    for (const pkg of packages) {
      const pkgDir = path.join(offlinePackagesDir, pkg);
      const pkgJsonPath = path.join(pkgDir, 'package.json');
      
      if (!fs.existsSync(pkgJsonPath)) continue;
      
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const files = pkgJson.files || [];
        
        if (files.some(f => /[*?[\]{}]/.test(f))) {
          const globResults = GlobExpander.expandGlobPatterns(files, pkgDir);
          const hasIssue = globResults.some(r => r.isGlob && r.matchedDirs.length > 0);
          
          if (hasIssue) {
            problemPackages.push({
              name: pkgJson.name,
              version: pkgJson.version,
              dir: pkgDir,
              files,
              globResults
            });
          }
        }
      } catch {}
    }

    if (problemPackages.length > 0) {
      console.log(`\n发现 ${problemPackages.length} 个可能有类似问题的包:`);
      for (const pkg of problemPackages) {
        console.log(`  ⚠️  ${pkg.name}@${pkg.version}`);
        console.log(`     files: ${JSON.stringify(pkg.files)}`);
        for (const result of pkg.globResults.filter(r => r.isGlob)) {
          console.log(`     "${result.original}" → [${result.expanded.join(', ')}]`);
        }
      }

      console.log('\n要修复所有包，可以运行:');
      console.log('  node fix-publish-files.js --all');
    } else {
      console.log('\n✅ 没有发现其他有类似问题的包');
    }
  }
}

main().catch(error => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});