# NPM Dependency Fixer

一个用于检测和修复不完整 NPM 依赖包的工具，特别针对内网环境中的 async-validator 等包不完整问题。

## 问题背景

在内网环境中使用 pnpm 下载依赖时，某些包（如 async-validator）可能只下载了编译后的文件，缺少源代码、测试文件和构建配置文件。这导致：
- 无法进行源码调试
- 无法进行自定义修改
- 无法运行测试验证功能
- 影响开发和维护

## 功能特性

### 1. 依赖完整性检测
- 自动扫描依赖包目录结构
- 验证 package.json 配置
- 检查关键文件是否存在
- 与 npm 官方仓库对比
- 生成完整性评分报告

### 2. 自动修复功能
- 从 npm 官方仓库重新下载缺失文件
- 保留本地修改选项
- 自动创建备份
- 支持批量修复
- 修复后验证完整性

### 3. 报告生成
- 支持多种格式：JSON、Markdown、HTML、Text
- 详细的问题分析
- 修复建议和操作记录
- 性能统计和监控

### 4. 监控和错误处理
- 实时操作监控
- 详细的错误日志
- 性能指标收集
- 操作历史记录

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译 TypeScript

```bash
npm run build
```

### 基本使用

1. **检查单个包完整性**

```bash
# 使用编译后的 CLI
node dist/cli/cli.js check offline-packages/async-validator@4.2.5

# 或者使用 ts-node（开发模式）
npm run dev -- check offline-packages/async-validator@4.2.5
```

2. **检查所有包**

```bash
node dist/cli/cli.js check-all offline-packages
```

3. **修复单个包**

```bash
node dist/cli/cli.js fix offline-packages/async-validator@4.2.5
```

4. **修复所有包**

```bash
node dist/cli/cli.js fix-all offline-packages
```

5. **验证包 API**

```bash
node dist/cli/cli.js validate-api offline-packages/async-validator@4.2.5
```

### 命令行选项

```
Usage: dependency-fix [options] [command]

NPM dependency integrity checker and fixer

Options:
  -V, --version              output the version number
  -c, --config <path>        Path to config file
  -v, --verbose              Enable verbose logging
  -q, --quiet                Suppress all output except errors
  -h, --help                 display help for command

Commands:
  check <package-dir>        Check integrity of a package directory
  check-all <packages-dir>   Check integrity of all packages in a directory
  fix <package-dir>          Fix integrity issues in a package directory
  fix-all <packages-dir>     Fix integrity issues in all packages in a directory
  validate-api <package-dir> Validate package API and exports
  generate-config            Generate a default configuration file
  stats                      Show monitoring statistics
  clear-stats                Clear monitoring statistics
  help [command]             display help for command
```

## 配置说明

默认配置文件：`.dependency-fix.json`

```json
{
  "registryUrl": "https://registry.npmjs.org",
  "timeoutMs": 30000,
  "maxRetries": 3,
  "backupPath": ".backup",
  "cachePath": ".cache",
  "logLevel": "info",
  "enableCache": true,
  "enableBackup": true,
  "verifyIntegrity": true,
  "maxConcurrentDownloads": 5,
  "blacklist": [],
  "whitelist": []
}
```

### 配置说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `registryUrl` | npm 注册表 URL | `https://registry.npmjs.org` |
| `timeoutMs` | 网络请求超时时间 | `30000` (30秒) |
| `maxRetries` | 最大重试次数 | `3` |
| `backupPath` | 备份目录 | `.backup` |
| `cachePath` | 缓存目录 | `.cache` |
| `logLevel` | 日志级别 | `info` |
| `enableCache` | 启用缓存 | `true` |
| `enableBackup` | 启用备份 | `true` |
| `verifyIntegrity` | 验证完整性 | `true` |
| `maxConcurrentDownloads` | 最大并发下载数 | `5` |
| `blacklist` | 黑名单包名 | `[]` |
| `whitelist` | 白名单包名 | `[]` |

## API 使用

### 基本示例

```typescript
import { createDependencyFixAPI } from './src/api';

const api = createDependencyFixAPI({
  registryUrl: 'https://registry.npmjs.org',
  logLevel: 'info'
});

// 检查包完整性
const report = await api.checkPackage('offline-packages/async-validator@4.2.5');
console.log(`Integrity: ${report.overallIntegrity}%`);

// 修复包
const result = await api.fixPackage('offline-packages/async-validator@4.2.5', {
  backupOriginal: true,
  forceReinstall: false
});

if (result.success) {
  console.log(`Fix completed. New integrity: ${result.newIntegrityScore}%`);
} else {
  console.error('Fix failed:', result.errors);
}

// 批量检查
const reports = await api.checkAllPackages('offline-packages');
const summary = await api.generateReport(reports, {
  format: 'html',
  outputDir: './reports'
});
```

### 核心模块

#### 1. PackageValidator
```typescript
import { PackageValidator } from './src/validators';

const validator = new PackageValidator();
const report = await validator.validatePackage(packageDir);
```

#### 2. PackageFixer
```typescript
import { PackageFixer } from './src/fixers';
import { ConfigManager } from './src/config';

const configManager = new ConfigManager();
const fixer = new PackageFixer(configManager);
const result = await fixer.fixPackage(packageDir, options);
```

#### 3. ReportGenerator
```typescript
import { ReportGenerator } from './src/reporters';

const reporter = new ReportGenerator();
const report = reporter.generateReport(data, {
  format: 'markdown',
  includeDetails: true,
  outputDir: './reports'
});
```

#### 4. DependencyMonitor
```typescript
import { DependencyMonitor } from './src/monitoring';

const monitor = new DependencyMonitor();
monitor.startMonitoring();
// ... 执行操作 ...
const stats = monitor.stopMonitoring();
```

## 解决 async-validator 问题示例

### 问题分析
async-validator 包在内网环境中可能只包含：
- `dist-node/` - 编译后的 Node.js 代码
- `dist-types/` - TypeScript 类型定义
- `dist-web/` - 编译后的 Web 代码

但缺少：
- `src/` - 源代码目录
- `test/` - 测试文件
- `tsconfig.json` - TypeScript 配置
- 构建配置文件

### 解决方案

1. **检查当前状态**
```bash
node dist/cli/cli.js check offline-packages/async-validator@4.2.5
```

2. **生成详细报告**
```bash
node dist/cli/cli.js check offline-packages/async-validator@4.2.5 -o html -r report.html
```

3. **修复包**
```bash
# 基本修复（创建备份）
node dist/cli/cli.js fix offline-packages/async-validator@4.2.5

# 强制重新安装（即使完整性高）
node dist/cli/cli.js fix offline-packages/async-validator@4.2.5 --force

# 模拟运行（不实际修改）
node dist/cli/cli.js fix offline-packages/async-validator@4.2.5 --dry-run
```

4. **验证修复结果**
```bash
node dist/cli/cli.js validate-api offline-packages/async-validator@4.2.5
```

### 批量处理

```bash
# 检查所有包
node dist/cli/cli.js check-all offline-packages -o markdown -r all-packages-report.md

# 修复所有不完整的包
node dist/cli/cli.js fix-all offline-packages --force

# 只修复特定包（使用白名单）
echo '["async-validator", "lodash", "axios"]' > whitelist.json
# 修改配置中的 whitelist 字段
node dist/cli/cli.js fix-all offline-packages --config whitelist.json
```

## 架构设计

### 模块结构
```
src/
├── config/          # 配置管理
├── errors/          # 错误处理
├── utils/           # 工具函数
├── validators/      # 验证器
├── fixers/          # 修复器
├── reporters/       # 报告生成器
├── monitoring/      # 监控系统
├── cli/            # 命令行接口
└── api/            # 程序接口
```

### 核心流程
1. **检测阶段**
   - 扫描包目录结构
   - 验证文件完整性
   - 与 npm 仓库对比
   - 生成完整性报告

2. **修复阶段**
   - 创建备份（可选）
   - 从 npm 下载缺失文件
   - 合并到本地目录
   - 验证修复结果

3. **报告阶段**
   - 生成详细报告
   - 提供修复建议
   - 记录操作历史

## 故障排除

### 常见问题

1. **网络连接问题**
   ```
   错误：NetworkError: Failed to fetch package info
   解决方案：检查网络连接，或使用内网镜像 registry
   ```

2. **权限问题**
   ```
   错误：FileSystemError: Permission denied
   解决方案：确保有文件读写权限，或使用管理员权限运行
   ```

3. **包版本不匹配**
   ```
   警告：Version mismatch: local=4.2.4, npm=4.2.5
   解决方案：更新本地包版本，或指定正确版本
   ```

4. **完整性验证失败**
   ```
   错误：IntegrityError: Hash mismatch
   解决方案：启用缓存重试，或手动验证文件完整性
   ```

### 调试模式

```bash
# 启用详细日志
node dist/cli/cli.js check offline-packages/async-validator@4.2.5 --verbose

# 查看监控统计
node dist/cli/cli.js stats

# 清除统计
node dist/cli/cli.js clear-stats
```

## 开发指南

### 环境要求
- Node.js >= 16.0.0
- TypeScript >= 5.2.0
- npm 或 yarn

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（使用 ts-node）
npm run dev -- check <package-dir>

# 编译
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
```

### 添加新验证规则

在 `src/validators/package-validator.ts` 中添加：

```typescript
{
  name: 'custom_rule',
  description: 'Custom validation rule',
  check: async (fileInfo) => {
    // 实现验证逻辑
    return true; // 或 false
  },
  weight: 5
}
```

### 扩展修复功能

在 `src/fixers/package-fixer.ts` 中添加新的修复策略：

```typescript
async function customFixStrategy(
  packageDir: string,
  packageName: string,
  version: string
): Promise<string[]> {
  // 实现自定义修复逻辑
  return ['Custom fix applied'];
}
```

## 性能优化

### 缓存策略
- 使用本地缓存避免重复下载
- 增量更新只下载缺失文件
- 并行下载限制并发数

### 资源管理
- 流式处理大文件
- 内存使用监控
- 自动清理临时文件

### 网络优化
- 连接池复用
- 超时和重试机制
- 压缩传输

## 许可证

MIT

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 支持

如有问题或建议，请提交 Issue 或联系维护者。