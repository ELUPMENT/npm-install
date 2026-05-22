
# 更新日志

## v1.3.0 - 2024-01-01

### ✨ 新功能：批量依赖下载

#### 功能说明

新增批量依赖下载方案，适合需要一次性下载多个依赖的场景。

**工作流程：**
1. ✅ 在 `package.json` 的 `dependencies` 中声明需要的包
2. ✅ 运行 `npm run batch-download` 批量下载
3. ✅ 自动同步到 `offline-packages` 目录
4. ✅ 生成完整的文档和报告

#### 使用示例

**步骤 1：配置依赖**

编辑 `package.json`：

```json
{
  "dependencies": {
    "verdaccio": "^5.0.0",
    "fs-extra": "^11.0.0",
    "axios": "^1.6.0",
    
    "// 添加您的依赖": "",
    "lodash": "^4.17.21",
    "express": "^4.18.2",
    "react": "^18.2.0",
    "@types/node": "^20.10.0"
  }
}
```

**步骤 2：执行批量下载**

```bash
npm run batch-download
```

**自动完成：**
- 📖 读取 package.json 中的依赖
- ⬇️ 批量下载所有包
- 💾 保存包信息到 `packages/`
- 📂 同步到 `offline-packages/`
- 📝 生成文档到 `docs/`
- 📊 生成下载报告

#### 新增文件

| 文件 | 用途 |
|------|------|
| `scripts/batch-download.js` | 批量下载脚本 |
| `BATCH-DOWNLOAD-GUIDE.md` | 完整使用指南 ⭐⭐⭐ |
| `QUICK-BATCH-DOWNLOAD.md` | 快速参考指南 |

#### 优势对比

| 特性 | add-package | add-deps | batch-download |
|------|------------|----------|----------------|
| 交互方式 | 逐个输入 | 单个主包 | 配置文件 |
| 依赖解析 | ❌ | ✅ | ❌ |
| 批量处理 | ❌ | ❌ | ✅ |
| 适合场景 | 少量包 | 完整依赖树 | 大量包 |

---

## v1.2.2 - 2024-01-01

### 🐛 紧急修复：fs is not defined 错误

#### 问题描述

运行 `npm run add-deps` 时报错：

```
ReferenceError: fs is not defined
    at ensureDirectories (scripts/add-package-with-deps.js:16:3)
```

#### 原因

在之前的 Windows 兼容性修复中，不小心删除了 `fs-extra` 模块的导入语句。

#### 修复

在 [`scripts/add-package-with-deps.js`](scripts/add-package-with-deps.js) 文件开头添加：

```javascript
const fs = require('fs-extra');
```

#### 影响范围

- ❌ `npm run add-deps` - 无法运行（已修复）
- ✅ 其他脚本不受影响

---

## v1.2.1 - 2024-01-01

### 🐛 Bug 修复：Scoped Packages 支持

#### 问题描述

**用户反馈：**
> "为什么离线包 `@types/node` 这个包没有同步到离线包当中？"

**发现的问题：**
- Scoped packages（如 `@types/node`、`@babel/core`）的文件名处理不完善
- 文件名以 `@` 开头在某些文件系统上可能有问题
- 同步时路径转换不一致

#### 解决方案

创建统一的安全文件名处理机制：

```
// Windows 兼容的文件名处理
const safeFileName = packageName
  .replace(/\//g, '_')   // 替换 / 为 _
  .replace(/@/g, 'at_'); // 替换 @ 为 at_
```

**转换示例：**
- `@types/node` → `at_types_node`
- `@babel/core` → `at_babel_core`
- `lodash` → `lodash`

#### 修复的文件

| 文件 | 修复内容 | 状态 |
|------|---------|------|
| `scripts/add-package.js` | 文件名处理 | ✅ |
| `scripts/add-package-with-deps.js` | 保存信息、同步、文档生成 | ✅ |
| `scripts/sync-to-offline.js` | 同步路径处理 | ✅ |
| `scripts/analyze-deps.js` | 报告文件名 | ✅ |
| `scripts/generate-docs.js` | 文档文件名和链接 | ✅ |

#### 效果对比

**修复前：**
```
packages/@types_node.json  ← 可能有问题
offline-packages/ (空)     ← 同步失败
```

**修复后：**
```
packages/at_types_node.json      ← 安全文件名
offline-packages/at_types_node/  ← 成功同步
docs/at_types_node.md            ← 文档生成
```

---

## v1.2.0 - 2024-01-01

### 🐛 Bug 修复：Windows 兼容性和错误处理

#### 问题描述

```
# 旧版本行为
npm run add-package
# 输入: react@18.2.0
# 结果: 只安装了 react
# 问题: 缺少 loose-envify、js-tokens 等 react 必需的依赖
```

#### 解决方案

新增两个强大的脚本来解决这个问题：

##### 1. `add-deps` - 自动安装所有依赖（推荐）

```
npm run add-deps
```

**功能特点：**
- ✅ 自动查询 npm registry 获取完整依赖树
- ✅ 递归解析所有子依赖（最多 3 层）
- ✅ 批量安装主包 + 所有子依赖
- ✅ 去重处理，避免重复安装
- ✅ 保存所有包的信息到 `packages/`
- ✅ 为所有包生成文档
- ✅ 支持同步到离线文件夹

**示例：**
```
npm run add-deps
# 输入: react@18.2.0
# 
# 系统会：
# 1. 分析出 react 依赖了 loose-envify
# 2. 分析出 loose-envify 依赖了 js-tokens
# 3. 一起安装这 3 个包
# 4. 保存 3 个包的信息
# 5. 生成 3 个包的文档
```

##### 2. `analyze-deps` - 分析依赖结构

```
npm run analyze-deps
```

**功能特点：**
- 🔍 显示包的详细信息（描述、许可证、作者）
- 📊 列出所有类型的依赖（dependencies、devDependencies、peerDependencies）
- 📈 统计依赖数量
- 💾 生成 JSON 格式的分析报告
- 💡 可选择一键安装所有依赖

**示例：**
```
npm run analyze-deps
# 输入: express@4.18.2
#
# 输出：
# 📦 直接依赖: 30 个
# 🔧 开发依赖: 15 个
# 🤝 对等依赖: 0 个
# ⭐ 可选依赖: 2 个
#
# 询问: 是否安装所有这些依赖? (y/n)
```

### 📝 新增文档

1. **[DEPENDENCY-MANAGEMENT.md](DEPENDENCY-MANAGEMENT.md)**
   - 依赖管理完整指南
   - 详细解释问题和解决方案
   - 使用示例和最佳实践

2. **[INSTALL-MODES-COMPARISON.md](INSTALL-MODES-COMPARISON.md)**
   - 三种安装方式对比
   - 实际案例演示
   - 快速参考表

3. **[CHANGELOG.md](CHANGELOG.md)**
   - 本文档

### 🛠️ 技术改进

#### 新增脚本

- `scripts/add-package-with-deps.js` - 自动安装所有依赖
- `scripts/analyze-deps.js` - 分析依赖结构

#### 新增目录

- `reports/` - 存储分析报告

#### 更新文件

- `package.json` - 添加新命令
- `README.md` - 更新使用说明
- 所有文档都添加了新功能说明

### 📋 新增命令

| 命令 | 说明 | 用途 |
|------|------|------|
| `npm run add-deps` | 安装包及所有依赖 | **推荐使用** - 确保完整性 |
| `npm run analyze-deps` | 分析包的依赖结构 | 了解依赖详情后再决定 |

### 🔄 迁移指南

如果您之前使用了 `add-package`，建议现在改用 `add-deps`：

**旧方式：**
```
npm run add-package
# 输入: lodash@4.17.21
```

**新方式（推荐）：**
```
npm run add-deps
# 输入: lodash@4.17.21
# 会自动安装 lodash 及其所有依赖
```

### ✨ 使用建议

#### 标准工作流程

```
# 1. 使用 add-deps 安装（包含所有依赖）
npm run add-deps

# 2. 同步到离线文件夹
npm run sync-to-offline

# 3. 生成文档
npm run generate-docs

# 4. 复制到内网并发布
```

#### 高级工作流程

```
# 1. 先分析依赖（了解详情）
npm run analyze-deps

# 2. 确认后再安装（在分析脚本中选择 y）
# 或者运行 add-deps

# 3. 后续步骤同上
```

### 🎯 解决的问题

1. ✅ **依赖缺失问题** - 自动安装所有子依赖
2. ✅ **依赖不完整** - 递归解析依赖树
3. ✅ **手动管理困难** - 自动化处理
4. ✅ **依赖关系不明** - 提供分析工具

### 📊 影响范围

- **向后兼容**: ✅ 完全兼容
  - 旧的 `add-package` 仍然可用
  - 新的 `add-deps` 作为更好的选择

- **现有项目**: ⚠️ 建议检查
  - 如果之前使用 `add-package` 安装的包有依赖，建议重新用 `add-deps` 安装

- **文档**: ✅ 全部更新
  - 所有文档都添加了新功能说明
  - 提供了详细的迁移指南

### 🚀 下一步计划

可能的未来改进：
- [ ] 自动检测已安装包的依赖完整性
- [ ] 提供一键修复缺失依赖的功能
- [ ] 支持指定依赖层级深度
- [ ] 添加依赖冲突检测和解决

---

## v1.0.0 - 初始版本

### 功能
- ✅ Verdaccio 私有仓库搭建
- ✅ 依赖包管理
- ✅ 离线包同步
- ✅ 文档自动生成
- ✅ 内网发布工具

---

*查看完整文档：[README.md](README.md)*  
*依赖管理指南：[DEPENDENCY-MANAGEMENT.md](DEPENDENCY-MANAGEMENT.md)*
