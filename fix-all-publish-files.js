const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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

function countFiles(dir) {
  let count = 0;
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === 'node_modules' || item === '.git') continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) count += countFiles(fullPath);
      else count++;
    }
  } catch {}
  return count;
}

function findPackageDirectories(rootDir) {
  const packages = [];
  try {
    const items = fs.readdirSync(rootDir);
    for (const item of items) {
      const fullPath = path.join(rootDir, item);
      const stat = fs.statSync(fullPath);
      if (!stat.isDirectory()) continue;
      
      const packageJsonPath = path.join(fullPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          packages.push({
            dir: fullPath,
            name: pkg.name || item,
            version: pkg.version || 'unknown',
            files: pkg.files || [],
            main: pkg.main,
            module: pkg.module,
            types: pkg.types || pkg.typings
          });
        } catch {
          packages.push({ dir: fullPath, name: item, version: 'unknown', files: [], main: null, module: null, types: null });
        }
      }
    }
  } catch {}
  return packages;
}

function diagnosePackage(pkg) {
  const issues = [];
  const { dir, name, version, files, main, module, types } = pkg;

  // 问题1: files字段包含glob模式
  if (files.length > 0) {
    const globResults = GlobExpander.expandGlobPatterns(files, dir);
    const hasGlobs = globResults.filter(r => r.isGlob && r.matchedDirs.length > 0);
    
    if (hasGlobs.length > 0) {
      for (const glob of hasGlobs) {
        issues.push({
          type: 'glob_pattern',
          severity: 'warning',
          message: `files字段包含glob模式 "${glob.original}"，展开为 [${glob.expanded.join(', ')}]`,
          original: glob.original,
          expanded: glob.expanded
        });
      }
    }
  }

  // 问题2: 入口文件缺失
  const entryPoints = { main, module, types };
  for (const [field, entry] of Object.entries(entryPoints)) {
    if (entry) {
      const entryPath = path.join(dir, entry);
      if (!fs.existsSync(entryPath)) {
        issues.push({
          type: 'missing_entry',
          severity: 'critical',
          message: `入口文件缺失: ${field}="${entry}"`,
          field,
          entry
        });
      }
    }
  }

  // 问题3: files字段声明的目录不存在
  if (files.length > 0) {
    const expandedFiles = GlobExpander.expandFilesField(files, dir);
    for (const entry of expandedFiles) {
      const normalizedEntry = entry.replace(/\/$/, '');
      const fullPath = path.join(dir, normalizedEntry);
      if (!fs.existsSync(fullPath) && normalizedEntry !== 'bin') {
        // bin目录可能不存在但不是严重问题
        const isCritical = entry === 'bin/' ? false : true;
        issues.push({
          type: 'missing_dir_in_files',
          severity: isCritical ? 'warning' : 'info',
          message: `files字段声明的目录不存在: "${entry}"`,
          entry
        });
      }
    }
  }

  // 问题4: 本地有重要目录但files字段未覆盖
  if (files.length > 0) {
    try {
      const localDirs = fs.readdirSync(dir)
        .filter(item => fs.statSync(path.join(dir, item)).isDirectory());
      
      const expandedFiles = GlobExpander.expandFilesField(files, dir);
      const coveredDirs = new Set(expandedFiles.map(e => e.replace(/\/$/, '')));
      
      const importantPatterns = ['dist', 'lib', 'src', 'bin', 'types', 'es', 'cjs', 'mjs', 'build'];
      const uncoveredImportant = localDirs.filter(d => {
        if (coveredDirs.has(d)) return false;
        if (d === 'node_modules' || d === '.git' || d === 'test' || d === '__tests__') return false;
        return importantPatterns.some(p => d.startsWith(p) || d === p);
      });

      if (uncoveredImportant.length > 0) {
        issues.push({
          type: 'uncovered_dirs',
          severity: 'warning',
          message: `重要目录未被files字段覆盖: [${uncoveredImportant.join(', ')}]`,
          dirs: uncoveredImportant
        });
      }
    } catch {}
  }

  return issues;
}

function fixPackage(pkg, options = {}) {
  const { dryRun = false, createBackup = true } = options;
  const { dir, name, version } = pkg;
  const packageJsonPath = path.join(dir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) return null;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const originalFiles = packageJson.files || [];

  if (originalFiles.length === 0) return null;

  const globResults = GlobExpander.expandGlobPatterns(originalFiles, dir);
  const hasGlobs = globResults.some(r => r.isGlob && r.matchedDirs.length > 0);

  if (!hasGlobs) return null;

  const fixedFiles = GlobExpander.expandFilesField(originalFiles, dir);
  if (JSON.stringify(originalFiles) === JSON.stringify(fixedFiles)) return null;

  const result = {
    name,
    version,
    dir,
    originalFiles: [...originalFiles],
    fixedFiles: [...fixedFiles],
    backupPath: null,
    dryRun
  };

  if (dryRun) return result;

  if (createBackup) {
    const backupPath = packageJsonPath + '.bak';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(packageJsonPath, backupPath);
      result.backupPath = backupPath;
    }
  }

  packageJson.files = fixedFiles;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

  return result;
}

function verifyWithNpmPack(dir) {
  try {
    const output = execSync('npm pack --dry-run 2>&1', {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 30000
    });

    const fileCountMatch = output.match(/total files:\s*(\d+)/i);
    const sizeMatch = output.match(/package size:\s*([\d.]+\s*[kKMmGg]?B)/i);
    const unpackedMatch = output.match(/unpacked size:\s*([\d.]+\s*[kKMmGg]?B)/i);

    return {
      success: true,
      fileCount: fileCountMatch ? parseInt(fileCountMatch[1]) : 0,
      packageSize: sizeMatch ? sizeMatch[1] : 'unknown',
      unpackedSize: unpackedMatch ? unpackedMatch[1] : 'unknown',
      output
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const skipVerify = args.includes('--skip-verify') || args.includes('-s');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const fixAll = args.includes('--fix-all') || args.includes('-f');
  const onlyDiagnose = args.includes('--diagnose') || !fixAll;

  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  离线依赖包 npm publish 文件完整性批量修复工具          ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log();
  console.log(`模式: ${onlyDiagnose && !fixAll ? '仅诊断' : '诊断+修复'}${dryRun ? ' (模拟运行)' : ''}`);

  const offlinePackagesDir = path.join(__dirname, 'offline-packages');
  if (!fs.existsSync(offlinePackagesDir)) {
    console.error('❌ 未找到 offline-packages 目录');
    process.exit(1);
  }

  // 步骤1: 扫描所有包
  console.log('\n📋 步骤1: 扫描所有离线依赖包...');
  const allPackages = findPackageDirectories(offlinePackagesDir);
  console.log(`   共找到 ${allPackages.length} 个包`);

  // 步骤2: 诊断所有包
  console.log('\n📋 步骤2: 诊断所有包的 files 字段问题...');
  const problemPackages = [];
  const diagnosisResults = [];

  for (const pkg of allPackages) {
    const issues = diagnosePackage(pkg);
    if (issues.length > 0) {
      diagnosisResults.push({ ...pkg, issues });
      
      const hasCriticalOrWarning = issues.some(i => i.severity === 'critical' || i.severity === 'warning');
      if (hasCriticalOrWarning) {
        problemPackages.push({ ...pkg, issues });
      }
    }
  }

  console.log(`   诊断完成: ${problemPackages.length} 个包存在问题`);

  // 分类统计
  const globIssues = problemPackages.filter(p => p.issues.some(i => i.type === 'glob_pattern'));
  const missingEntryIssues = problemPackages.filter(p => p.issues.some(i => i.type === 'missing_entry'));
  const uncoveredDirIssues = problemPackages.filter(p => p.issues.some(i => i.type === 'uncovered_dirs'));
  const missingDirInFiles = problemPackages.filter(p => p.issues.some(i => i.type === 'missing_dir_in_files'));

  console.log('\n📊 问题分类统计:');
  console.log(`   glob模式问题: ${globIssues.length} 个包`);
  console.log(`   入口文件缺失: ${missingEntryIssues.length} 个包`);
  console.log(`   目录未覆盖:   ${uncoveredDirIssues.length} 个包`);
  console.log(`   声明目录不存在: ${missingDirInFiles.length} 个包`);

  // 显示有问题的包列表
  if (problemPackages.length > 0) {
    console.log('\n📋 有问题的包详细列表:');
    console.log('-'.repeat(80));
    
    for (const pkg of problemPackages) {
      const severityIcon = pkg.issues.some(i => i.severity === 'critical') ? '🔴' : 
                          pkg.issues.some(i => i.severity === 'warning') ? '🟡' : '🔵';
      console.log(`\n${severityIcon} ${pkg.name}@${pkg.version}`);
      console.log(`   目录: ${pkg.dir}`);
      
      for (const issue of pkg.issues) {
        const icon = issue.severity === 'critical' ? '❌' : 
                    issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${issue.message}`);
        
        if (verbose && issue.type === 'glob_pattern') {
          console.log(`      原始: "${issue.original}" → 展开: [${issue.expanded.join(', ')}]`);
        }
      }

      if (pkg.files.length > 0 && verbose) {
        console.log(`   files字段: ${JSON.stringify(pkg.files)}`);
      }
    }
  }

  // 步骤3: 修复所有有glob问题的包
  const packagesToFix = globIssues;
  
  if (packagesToFix.length === 0) {
    console.log('\n✅ 没有发现需要修复的glob模式问题');
  } else if (onlyDiagnose && !fixAll) {
    console.log(`\n💡 发现 ${packagesToFix.length} 个包需要修复 glob 模式`);
    console.log('   运行以下命令进行修复:');
    console.log('   node fix-all-publish-files.js --fix-all');
    console.log('   node fix-all-publish-files.js --fix-all --dry-run  # 模拟运行');
  } else {
    console.log(`\n📋 步骤3: 修复 ${packagesToFix.length} 个包的 files 字段...`);
    console.log('-'.repeat(80));

    const fixResults = [];
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const pkg of packagesToFix) {
      try {
        const result = fixPackage(pkg, { dryRun, createBackup: true });
        
        if (result) {
          fixResults.push(result);
          fixedCount++;
          console.log(`\n✅ ${pkg.name}@${pkg.version}`);
          console.log(`   修复前: ${JSON.stringify(result.originalFiles)}`);
          console.log(`   修复后: ${JSON.stringify(result.fixedFiles)}`);
          if (result.backupPath) {
            console.log(`   备份: ${result.backupPath}`);
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        console.log(`\n❌ ${pkg.name}@${pkg.version}: ${error.message}`);
      }
    }

    console.log('\n' + '-'.repeat(80));
    console.log(`修复统计: ✅ 修复 ${fixedCount} 个, ⏭️ 跳过 ${skippedCount} 个, ❌ 错误 ${errorCount} 个`);
  }

  // 步骤4: 验证修复后的包（用npm pack --dry-run）
  if (fixAll && !dryRun && !skipVerify && globIssues.length > 0) {
    console.log('\n📋 步骤4: 使用 npm pack --dry-run 验证修复结果...');
    console.log('-'.repeat(80));

    for (const pkg of globIssues) {
      try {
        const preLocalCount = countFiles(pkg.dir);
        const packResult = verifyWithNpmPack(pkg.dir);

        if (packResult.success) {
          const ratio = packResult.fileCount / preLocalCount;
          const status = ratio >= 0.8 ? '✅' : ratio >= 0.5 ? '⚠️' : '❌';
          
          console.log(`\n${status} ${pkg.name}@${pkg.version}`);
          console.log(`   本地文件: ${preLocalCount} 个`);
          console.log(`   npm pack: ${packResult.fileCount} 个, ${packResult.packageSize}`);
          console.log(`   覆盖率: ${(ratio * 100).toFixed(1)}%`);
          
          if (ratio < 0.8) {
            console.log(`   ⚠️  覆盖率偏低，可能有文件被意外排除`);
          }
        } else {
          console.log(`\n⚠️  ${pkg.name}@${pkg.version}: npm pack 执行失败`);
        }
      } catch (error) {
        console.log(`\n⚠️  ${pkg.name}@${pkg.version}: 验证失败 - ${error.message}`);
      }
    }
  }

  // 步骤5: 检查入口文件缺失的包（这类问题files字段修复无法解决）
  if (missingEntryIssues.length > 0) {
    console.log('\n📋 步骤5: 入口文件缺失的包（需要重新下载）:');
    console.log('-'.repeat(80));
    
    for (const pkg of missingEntryIssues) {
      const missingEntries = pkg.issues.filter(i => i.type === 'missing_entry');
      console.log(`\n🔴 ${pkg.name}@${pkg.version}`);
      for (const issue of missingEntries) {
        console.log(`   ❌ ${issue.field}: ${issue.entry}`);
      }
      console.log(`   💡 建议: 从npm仓库重新下载完整包`);
    }
  }

  // 步骤6: 生成报告
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║  修复报告总结                                              ║');
  console.log('╚' + '═'.repeat(58) + '╝');

  console.log(`\n总包数: ${allPackages.length}`);
  console.log(`有问题包数: ${problemPackages.length}`);
  console.log(`  - glob模式问题: ${globIssues.length}`);
  console.log(`  - 入口文件缺失: ${missingEntryIssues.length}`);
  console.log(`  - 目录未覆盖: ${uncoveredDirIssues.length}`);
  console.log(`  - 声明目录不存在: ${missingDirInFiles.length}`);

  if (fixAll && !onlyDiagnose) {
    console.log(`\n修复模式: ${dryRun ? '模拟运行' : '实际修复'}`);
    console.log(`修复的包: ${globIssues.length}`);
  }

  // 保存报告到文件
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `publish-fix-report-${timestamp}.json`);
  
  const report = {
    timestamp: new Date().toISOString(),
    totalPackages: allPackages.length,
    problemPackages: problemPackages.length,
    categories: {
      globPattern: globIssues.length,
      missingEntry: missingEntryIssues.length,
      uncoveredDirs: uncoveredDirIssues.length,
      missingDirInFiles: missingDirInFiles.length
    },
    details: problemPackages.map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      dir: pkg.dir,
      files: pkg.files,
      issues: pkg.issues.map(i => ({
        type: i.type,
        severity: i.severity,
        message: i.message
      }))
    }))
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n📄 报告已保存: ${reportPath}`);

  // 提供后续操作建议
  console.log('\n💡 后续操作建议:');
  if (globIssues.length > 0 && onlyDiagnose && !fixAll) {
    console.log('   1. 修复所有glob模式问题:');
    console.log('      node fix-all-publish-files.js --fix-all');
    console.log('   2. 模拟运行（不修改文件）:');
    console.log('      node fix-all-publish-files.js --fix-all --dry-run');
  }
  if (missingEntryIssues.length > 0) {
    console.log('   3. 入口文件缺失的包需要重新从npm下载:');
    for (const pkg of missingEntryIssues.slice(0, 5)) {
      console.log(`      - ${pkg.name}@${pkg.version}`);
    }
    if (missingEntryIssues.length > 5) {
      console.log(`      ... 还有 ${missingEntryIssues.length - 5} 个`);
    }
  }
  console.log('   4. 修复后重新发布到内网仓库:');
  console.log('      cd offline-packages/<package-dir> && npm publish --registry http://localhost:4873');
}

main().catch(error => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});