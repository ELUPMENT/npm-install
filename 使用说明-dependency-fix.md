# Dependency Fixer 使用说明

## 快速解决 async-validator 依赖不完整问题

### 问题描述
在内网环境中使用 pnpm 下载 async-validator 包时，可能只下载了编译后的文件（dist-node/, dist-types/, dist-web/），但缺少：
- 源代码目录（src/ 或 lib/）
- 测试文件（test/ 或 __tests__/）
- 构建配置文件（tsconfig.json、jest.config.js 等）
- 开发工具配置（.gitignore、.npmignore 等）

### 解决方案

#### 方法1：使用 CLI 工具（推荐）

1. **安装工具**
```bash
# 在项目根目录执行
npm install
npm run build
```

2. **检查 async-validator 包状态**
```bash
# 检查单个包
node dist/cli/cli.js check offline-packages/async-validator@4.2.5

# 检查所有包
node dist/cli/cli.js check-all offline-packages
```

3. **修复 async-validator 包**
```bash
# 修复单个包（自动备份）
node dist/cli/cli.js fix offline-packages/async-validator@4.2.5

# 修复所有不完整的包
node dist/cli/cli.js fix-all offline-packages

# 强制重新安装（即使完整性高）
node dist/cli/cli.js fix offline-packages/async-validator@4.2.5 --force

# 模拟运行（不实际修改）
node dist/cli/cli.js fix offline-packages/async-validator@4.2.5 --dry-run
```

4. **生成修复报告**
```bash
# 生成 HTML 报告
node dist/cli/cli.js check offline-packages/async-validator@4.2.5 -o html -r report.html

# 生成 Markdown 报告
node dist/cli/cli.js check offline-packages/async-validator@4.2.5 -o markdown -r report.md

# 生成 JSON 报告（用于自动化处理）
node dist/cli/cli.js check offline-packages/async-validator@4.2.5 -o json -r report.json
```

#### 方法2：使用 API 编程方式

```javascript
const { createDependencyFixAPI } = require('./dist/api');

// 创建 API 实例
const api = createDependencyFixAPI({
  registryUrl: 'https://registry.npmjs.org',
  enableBackup: true,
  enableCache: true
});

// 检查 async-validator 包
async function checkAsyncValidator() {
  try {
    const report = await api.checkPackage('offline-packages/async-validator@4.2.5');
    
    console.log(`包名: ${report.packageName}`);
    console.log(`版本: ${report.packageVersion}`);
    console.log(`完整性评分: ${report.overallIntegrity}%`);
    
    if (report.overallIntegrity < 80) {
      console.log('⚠️  包不完整，需要修复');
      console.log('缺失文件:', report.missingFiles);
      console.log('建议:', report.recommendations);
      
      // 自动修复
      const result = await api.fixPackage('offline-packages/async-validator@4.2.5', {
        backupOriginal: true,
        forceReinstall: false
      });
      
      if (result.success) {
        console.log(`✅ 修复成功，新完整性: ${result.newIntegrityScore}%`);
      } else {
        console.log('❌ 修复失败:', result.errors);
      }
    } else {
      console.log('✅ 包完整性良好');
    }
  } catch (error) {
    console.error('检查失败:', error.message);
  }
}

checkAsyncValidator();
```

#### 方法3：批量处理脚本

创建 `fix-dependencies.js` 文件：

```javascript
const { createDependencyFixAPI } = require('./dist/api');

async function fixAllDependencies() {
  const api = createDependencyFixAPI({
    logLevel: 'info',
    enableBackup: true,
    maxConcurrentDownloads: 3
  });

  console.log('开始检查所有依赖包...');
  
  // 1. 检查所有包
  const reports = await api.checkAllPackages('offline-packages');
  
  // 2. 筛选需要修复的包
  const packagesToFix = reports.filter(report => report.overallIntegrity < 80);
  
  console.log(`共检查 ${reports.length} 个包`);
  console.log(`需要修复 ${packagesToFix.length} 个包`);
  
  if (packagesToFix.length === 0) {
    console.log('✅ 所有包完整性良好');
    return;
  }
  
  // 3. 显示需要修复的包
  console.log('\n需要修复的包:');
  packagesToFix.forEach(report => {
    console.log(`  ${report.packageName}@${report.packageVersion} - ${report.overallIntegrity}%`);
    console.log(`    缺失文件: ${report.missingFiles.length} 个`);
  });
  
  // 4. 确认修复
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('\n是否开始修复？(y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y') {
      console.log('\n开始修复...');
      
      // 5. 批量修复
      const results = await api.fixAllPackages('offline-packages');
      
      // 6. 生成报告
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`\n修复完成:`);
      console.log(`  ✅ 成功: ${successful} 个`);
      console.log(`  ❌ 失败: ${failed} 个`);
      
      // 7. 保存报告
      await api.generateReport(results, {
        format: 'markdown',
        outputDir: './reports',
        includeDetails: true
      });
      
      console.log('报告已保存到 ./reports/ 目录');
    } else {
      console.log('已取消修复');
    }
    
    readline.close();
  });
}

fixAllDependencies().catch(console.error);
```

运行脚本：
```bash
node fix-dependencies.js
```

### 配置说明

#### 配置文件位置
工具会在当前目录查找 `.dependency-fix.json` 文件，如果不存在则使用默认配置。

#### 自定义配置示例
创建 `.dependency-fix.json` 文件：

```json
{
  "registryUrl": "https://registry.npm.taobao.org",
  "timeoutMs": 60000,
  "maxRetries": 5,
  "backupPath": "./dependency-backups",
  "cachePath": "./dependency-cache",
  "logLevel": "debug",
  "enableCache": true,
  "enableBackup": true,
  "verifyIntegrity": true,
  "maxConcurrentDownloads": 3,
  "blacklist": ["internal-package-1", "internal-package-2"],
  "whitelist": []
}
```

#### 环境变量支持
```bash
# 使用内网镜像
export NPM_REGISTRY=https://registry.npm.taobao.org

# 启用调试日志
export LOG_LEVEL=debug

# 禁用备份
export ENABLE_BACKUP=false
```

### 常见问题解决

#### 1. 网络连接问题
```bash
# 使用代理
export HTTPS_PROXY=http://proxy.company.com:8080
export HTTP_PROXY=http://proxy.company.com:8080

# 或使用内网镜像
node dist/cli/cli.js check offline-packages/async-validator@4.2.5 --config custom-config.json
```

在 `custom-config.json` 中：
```json
{
  "registryUrl": "http://your-internal-npm-registry",
  "timeoutMs": 120000
}
```

#### 2. 权限问题
```bash
# Windows: 以管理员身份运行
# Linux/Mac: 使用 sudo
sudo node dist/cli/cli.js fix offline-packages/async-validator@4.2.5
```

#### 3. 内存不足
```bash
# 减少并发数
export MAX_CONCURRENT_DOWNLOADS=2
node dist/cli/cli.js fix-all offline-packages
```

#### 4. 跳过特定包
在配置文件中：
```json
{
  "blacklist": ["large-package", "problematic-package"],
  "whitelist": ["async-validator", "lodash"]
}
```

### 高级用法

#### 1. 集成到 CI/CD 流水线
```yaml
# .gitlab-ci.yml 示例
stages:
  - validate-dependencies

validate-dependencies:
  stage: validate-dependencies
  script:
    - npm install
    - npm run build
    - node dist/cli/cli.js check-all offline-packages --output json --report dependency-report.json
  artifacts:
    paths:
      - dependency-report.json
    when: always
```

#### 2. 定时检查脚本
创建 `cron-check.js`：

```javascript
const { createDependencyFixAPI } = require('./dist/api');
const fs = require('fs');
const path = require('path');

async function scheduledCheck() {
  const api = createDependencyFixAPI();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    console.log(`[${new Date().toISOString()}] 开始定时检查...`);
    
    // 检查所有包
    const reports = await api.checkAllPackages('offline-packages');
    
    // 生成报告
    const reportFile = path.join('./reports', `check-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(reports, null, 2));
    
    // 检查是否需要修复
    const needsFix = reports.filter(r => r.overallIntegrity < 80);
    
    if (needsFix.length > 0) {
      console.log(`发现 ${needsFix.length} 个包需要修复`);
      
      // 发送通知（示例）
      const notification = {
        timestamp: new Date().toISOString(),
        packages: needsFix.map(r => ({
          name: r.packageName,
          version: r.packageVersion,
          integrity: r.overallIntegrity,
          missingFiles: r.missingFiles
        }))
      };
      
      fs.writeFileSync(
        path.join('./reports', `alert-${timestamp}.json`),
        JSON.stringify(notification, null, 2)
      );
    }
    
    console.log(`[${new Date().toISOString()}] 检查完成，报告: ${reportFile}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 检查失败:`, error.message);
  }
}

scheduledCheck();
```

#### 3. 自定义验证规则
创建 `custom-validator.js`：

```javascript
const { PackageValidator } = require('./dist/validators');

class CustomPackageValidator extends PackageValidator {
  getStandardRules() {
    const standardRules = super.getStandardRules();
    
    // 添加自定义规则
    const customRules = [
      {
        name: 'has_changelog',
        description: 'Check if CHANGELOG file exists',
        check: async (fileInfo) => {
          const changelogPatterns = ['CHANGELOG.md', 'CHANGELOG', 'CHANGELOG.txt'];
          for (const pattern of changelogPatterns) {
            const changelogPath = path.join(fileInfo.path, pattern);
            if (await this.fileExists(changelogPath)) {
              return true;
            }
          }
          return false;
        },
        weight: 2
      },
      {
        name: 'has_security_policy',
        description: 'Check if SECURITY.md file exists',
        check: async (fileInfo) => {
          const securityPath = path.join(fileInfo.path, 'SECURITY.md');
          return await this.fileExists(securityPath);
        },
        weight: 3
      }
    ];
    
    return [...standardRules, ...customRules];
  }
}

// 使用自定义验证器
const validator = new CustomPackageValidator();
const report = await validator.validatePackage('offline-packages/async-validator@4.2.5');
```

### 监控和日志

#### 查看监控统计
```bash
node dist/cli/cli.js stats
```

输出示例：
```
MONITORING STATISTICS
==================================================
📊 Event Statistics:
  Total events: 15
  Errors: 0
  Warnings: 2
  
📈 Performance Metrics:
  Packages processed: 3
  Packages succeeded: 3
  Packages failed: 0
  Average integrity score: 92%
  Total duration: 12345ms
```

#### 启用详细日志
```bash
# 命令行参数
node dist/cli/cli.js check offline-packages/async-validator@4.2.5 --verbose

# 或修改配置
{
  "logLevel": "debug"
}
```

#### 日志文件
默认日志输出到控制台，可通过配置输出到文件：
```javascript
const { Logger } = require('./dist/utils/logger');

const logger = new Logger({
  enableConsole: true,
  enableFile: true,
  logFilePath: './dependency-fix.log',
  logLevel: 'debug'
});
```

### 故障排除指南

#### 问题：下载超时
```
错误：TimeoutError: Timeout while fetching package info
```
解决方案：
1. 增加超时时间
2. 检查网络连接
3. 使用内网镜像

```json
{
  "timeoutMs": 120000,
  "registryUrl": "http://internal-registry.company.com"
}
```

#### 问题：完整性验证失败
```
错误：IntegrityError: Hash mismatch for file dist/index.js
```
解决方案：
1. 禁用完整性验证（仅用于测试）
2. 清除缓存重新下载
3. 手动验证文件哈希

```json
{
  "verifyIntegrity": false
}
```

#### 问题：内存不足
```
错误：JavaScript heap out of memory
```
解决方案：
1. 减少并发下载数
2. 增加 Node.js 内存限制
3. 分批处理

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
node dist/cli/cli.js fix-all offline-packages --max-concurrent-downloads 2
```

#### 问题：备份失败
```
错误：FileSystemError: Failed to create backup
```
解决方案：
1. 检查磁盘空间
2. 检查文件权限
3. 禁用备份功能

```json
{
  "enableBackup": false
}
```

### 最佳实践

1. **定期检查**
   ```bash
   # 每周检查一次
   0 2 * * 1 node /path/to/dependency-fix check-all /path/to/offline-packages
   ```

2. **修复前备份**
   ```bash
   # 确保备份功能开启
   node dist/cli/cli.js fix --backup
   ```

3. **使用白名单**
   ```json
   {
     "whitelist": ["async-validator", "lodash", "axios"]
   }
   ```

4. **监控和告警**
   - 设置完整性阈值告警（< 80%）
   - 记录修复历史
   - 定期生成统计报告

5. **与现有工具集成**
   - 集成到 CI/CD 流水线
   - 与包管理工具结合
   - 生成合规性报告

### 支持与反馈

如遇问题，请提供：
1. 错误日志
2. 配置文件
3. 包目录结构
4. 网络环境信息

通过以上方法，可以有效解决 async-validator 等依赖包不完整的问题，确保内网开发环境的稳定性。