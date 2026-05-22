# 多版本依赖包管理指南

## 问题背景

在 npm 项目中，同一个包可能存在多个不同的版本。例如 `minimatch` 在你的项目中就有 4 个不同版本：
- `minimatch@3.1.5` - 被 eslint、file-entry-cache 等依赖
- `minimatch@5.1.9` - 被 glob@8.1.0 依赖
- `minimatch@7.4.6` - 被 @verdaccio/utils 依赖
- `minimatch@10.2.5` - 被 @typescript-eslint/typescript-estree 依赖

## 为什么会有多个版本？

npm 采用**依赖扁平化**策略：
1. 如果不同依赖要求的版本兼容，npm 会提升到顶层 `node_modules/`
2. 如果版本冲突，npm 会在子依赖的 `node_modules/` 中安装特定版本
3. 这导致同一包名在不同路径下存在多个版本

## 增强版同步脚本

项目已升级 `scripts/sync-to-offline.js`，现在支持自动检测和同步所有版本。

### 使用方法

```bash
# 同步所有依赖（包括多版本）
npm run sync-to-offline
```

### 输出示例

```
正在同步: minimatch...
  发现 3 个版本:
  ✓ minimatch@3.1.5 同步成功
  ✓ minimatch@5.1.9 同步成功
  ✓ minimatch@10.2.5 同步成功
```

### 离线文件夹结构

同步后，`offline-packages` 目录会包含：

```
offline-packages/
├── minimatch/              # 默认版本（通常是最高版本）
├── minimatch@3.1.5/        # 版本 3.1.5
├── minimatch@5.1.9/        # 版本 5.1.9
├── minimatch@10.2.5/       # 版本 10.2.5
├── iconv-lite/             # 单版本包，无后缀
├── iconv-lite@0.4.24/      # 多版本包的第一个版本
├── iconv-lite@0.6.3/       # 多版本包的第二个版本
└── ...
```

## 查看同步结果

### 1. 查看同步日志

```bash
# Windows PowerShell
Get-Content sync-log.json | ConvertFrom-Json | Select-Object -ExpandProperty results | Where-Object { $_.name -eq "minimatch" }

# 或使用 Node.js
node -e "const log = require('./sync-log.json'); console.log(log.results.filter(r => r.name === 'minimatch'))"
```

### 2. 统计多版本包数量

```bash
node -e "const log = require('./sync-log.json'); const multi = log.results.filter(r => r.isMultiVersion); console.log(`多版本包数量: ${multi.length}`); console.log(multi.map(r => `${r.name}@${r.version}`).join('\n'))"
```

## 当前项目中的多版本包

根据最新同步日志，项目中有 **13 个多版本包**：

| 包名 | 版本数量 | 具体版本 |
|------|---------|---------|
| minimatch | 3 | 3.1.5, 5.1.9, 10.2.5 |
| iconv-lite | 2 | 0.4.24, 0.6.3 |
| rollup | 2 | 2.80.0, 4.60.2 |
| tr46 | 2 | 0.0.3, 3.0.0 |
| universalify | 2 | 0.2.0, 2.0.1 |
| vite | 2 | 3.2.11, 5.4.21 |
| webidl-conversions | 2 | 3.0.1, 7.0.0 |
| whatwg-url | 2 | 5.0.0, 11.0.0 |
| ... | ... | ... |

## 内网部署建议

### 方案一：全量同步（推荐用于开发环境）

```bash
npm run sync-to-offline
# 将整个 offline-packages 文件夹复制到内网
```

**优点**：
- 确保所有依赖都可用
- 无需手动选择版本

**缺点**：
- 占用更多磁盘空间
- 传输时间较长

### 方案二：按需同步（推荐用于生产环境）

1. 分析实际使用的版本：
```bash
npm list minimatch
```

2. 只复制需要的版本到内网：
```bash
# 示例：只复制 minimatch@10.2.5
xcopy offline-packages\minimatch@10.2.5 \\内网服务器\packages\ /E /I
```

### 方案三：使用 Verdaccio 缓存

在内网搭建 Verdaccio，将所有版本发布到私有仓库：

```bash
# 批量发布所有版本
for dir in offline-packages/minimatch*; do
  cd "$dir"
  npm publish --registry http://内网Verdaccio地址:4873
done
```

## 常见问题

### Q1: 为什么有些包在 node_modules 中不存在？

**A**: 这些包可能是：
- Scoped packages（如 `@types/node`）未正确安装
- 开发依赖未被包含
- 包名包含特殊字符导致路径问题

**解决**：检查 `package.json` 中的 dependencies，确保包已正确安装。

### Q2: 如何清理旧版本的包？

**A**: 
```bash
# 删除所有带版本号后缀的文件夹
Remove-Item offline-packages\*@* -Recurse -Force

# 重新同步
npm run sync-to-offline
```

### Q3: 多版本会影响内网使用吗？

**A**: 不会。npm 会根据 `package.json` 中的版本要求自动选择合适的版本。多个版本共存可以提供更好的兼容性。

## 技术实现细节

增强版同步脚本的核心逻辑：

1. **递归扫描**：遍历整个 `node_modules` 树，深度限制为 10 层
2. **版本提取**：读取每个找到的包的 `package.json` 获取版本号
3. **去重处理**：使用 Map 存储 version -> path 映射，避免重复
4. **智能命名**：
   - 单版本：`{packageName}/`
   - 多版本：`{packageName}@{version}/`
5. **日志记录**：在 `sync-log.json` 中标记 `isMultiVersion: true`

## 最佳实践

1. ✅ **定期同步**：每次 `npm install` 后执行 `npm run sync-to-offline`
2. ✅ **检查日志**：查看 `sync-log.json` 确认同步状态
3. ✅ **版本锁定**：在 `package.json` 中使用精确版本号（而非 `^` 或 `~`）
4. ✅ **文档更新**：记录项目中关键依赖的版本要求
5. ⚠️ **空间管理**：定期清理不再使用的旧版本包

## 相关脚本

- `scripts/sync-to-offline.js` - 增强版同步脚本（支持多版本）
- `scripts/add-package.js` - 添加单个包及其依赖
- `scripts/batch-download.js` - 批量下载所有依赖
- `scripts/clean-duplicates.js` - 清理重复的包文件

## 参考资料

- [npm 依赖解析算法](https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json)
- [Verdaccio 私有仓库搭建](./VERDACCIO-SERVICE-GUIDE.md)
- [离线包管理规范](./DEPENDENCY-MANAGEMENT.md)
