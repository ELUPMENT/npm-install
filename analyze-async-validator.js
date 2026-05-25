const fs = require('fs');
const path = require('path');

console.log('=== async-validator依赖包完整性分析 ===\n');

// 分析本地async-validator包
const localPackagePath = path.join(__dirname, 'offline-packages', 'async-validator@4.2.5');
console.log('1. 本地包结构分析:');
console.log(`   路径: ${localPackagePath}`);

if (fs.existsSync(localPackagePath)) {
    const files = [];
    const dirs = [];
    
    function scanDir(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            const relativePath = path.relative(localPackagePath, fullPath);
            
            if (stat.isDirectory()) {
                dirs.push(relativePath);
                scanDir(fullPath);
            } else {
                files.push(relativePath);
            }
        }
    }
    
    scanDir(localPackagePath);
    
    console.log(`   文件数量: ${files.length}`);
    console.log(`   目录数量: ${dirs.length}`);
    
    console.log('\n   关键文件检查:');
    const requiredFiles = [
        'package.json',
        'README.md',
        'LICENSE.md',
        'dist-node/index.js',
        'dist-types/index.d.ts'
    ];
    
    for (const requiredFile of requiredFiles) {
        const exists = fs.existsSync(path.join(localPackagePath, requiredFile));
        console.log(`   - ${requiredFile}: ${exists ? '✅ 存在' : '❌ 缺失'}`);
    }
    
    console.log('\n   可能的缺失文件检查:');
    const potentialMissingFiles = [
        'src/',
        'lib/',
        'test/',
        '__tests__/',
        '.gitignore',
        '.npmignore',
        'tsconfig.json',
        'jest.config.js'
    ];
    
    let missingCount = 0;
    for (const file of potentialMissingFiles) {
        const fullPath = path.join(localPackagePath, file);
        const exists = fs.existsSync(fullPath);
        if (!exists && !file.includes('/')) {
            // 检查是否是目录
            const isDir = file.endsWith('/');
            if (isDir) {
                console.log(`   - ${file}: ❌ 目录缺失`);
                missingCount++;
            } else {
                console.log(`   - ${file}: ⚠️  可能缺失`);
            }
        }
    }
    
    // 检查package.json的files字段
    const packageJson = JSON.parse(fs.readFileSync(path.join(localPackagePath, 'package.json'), 'utf8'));
    console.log('\n   2. package.json分析:');
    console.log(`   name: ${packageJson.name}`);
    console.log(`   version: ${packageJson.version}`);
    console.log(`   files字段: ${JSON.stringify(packageJson.files)}`);
    console.log(`   main: ${packageJson.main}`);
    console.log(`   types: ${packageJson.types}`);
    
    // 检查实际文件是否匹配files字段配置
    console.log('\n   3. 与npm官方包对比:');
    console.log('   ⚠️  本地包可能缺少以下内容:');
    console.log('   - 源代码文件 (src/ 或 lib/ 目录)');
    console.log('   - 测试文件 (test/ 或 __tests__/ 目录)');
    console.log('   - 构建配置文件 (tsconfig.json, jest.config.js等)');
    console.log('   - 开发工具配置 (.gitignore, .npmignore等)');
    
    console.log('\n   4. 完整性评估:');
    const hasDistFiles = files.some(f => f.includes('dist-'));
    const hasPackageJson = files.includes('package.json');
    const hasReadme = files.includes('README.md');
    const hasLicense = files.includes('LICENSE.md');
    
    if (hasDistFiles && hasPackageJson && hasReadme && hasLicense) {
        console.log('   ✅ 基本运行文件完整');
    } else {
        console.log('   ❌ 基本运行文件不完整');
    }
    
    const hasSourceCode = files.some(f => f.includes('src/') || f.includes('lib/'));
    const hasTests = files.some(f => f.includes('test/') || f.includes('__tests__/'));
    const hasBuildConfig = files.some(f => f.endsWith('.json') && (f.includes('tsconfig') || f.includes('jest')));
    
    if (!hasSourceCode) {
        console.log('   ⚠️  缺少源代码文件，无法进行调试和二次开发');
    }
    if (!hasTests) {
        console.log('   ⚠️  缺少测试文件，无法验证功能完整性');
    }
    if (!hasBuildConfig) {
        console.log('   ⚠️  缺少构建配置文件，无法进行自定义构建');
    }
    
    console.log('\n   5. 修复建议:');
    console.log('   - 从npm官方仓库重新下载完整包');
    console.log('   - 验证包的完整性，包括源码、测试和配置文件');
    console.log('   - 更新离线包存储机制，确保包完整下载');
    
} else {
    console.log('   ❌ 本地包目录不存在');
}

console.log('\n=== 分析完成 ===');