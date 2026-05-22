# NPM 私有仓库管理系统

基于 Verdaccio 的私有 npm 仓库管理解决方案，支持依赖包的增量下载、离线同步和内网发布。

## 📚 文档导航

**所有文档已整理到 `docs/` 目录，按功能分类并采用中文命名！**

- 📖 [**文档总索引**](./docs/README.md) - 查看所有文档分类
- 🚀 [快速开始](./docs/01-快速开始/) - 新手入门指南
- ⚙️ [核心功能](./docs/02-核心功能/) - 系统功能详解
- 🌐 [内网发布](./docs/03-内网发布/) - 内网部署指南
- 🔧 [Git 配置](./docs/04-Git配置/) - 版本控制配置
- 🐛 [问题修复](./docs/05-问题修复/) - 常见问题解决
- 🔍 [故障排查](./docs/06-故障排查/) - 故障诊断排除
- 📋 [技术文档](./docs/07-技术文档/) - 技术细节记录

> 💡 **提示**：
> - 双击 [`查看文档.bat`](查看文档.bat) 快速浏览文档
> - 详细的文档整理说明请查看 [docs/文档整理说明.md](./docs/文档整理说明.md)
> - 根目录清理报告请查看 [根目录清理完成报告.md](根目录清理完成报告.md)

---

## ⚡ Git 配置（重要）

**本项目包含大量依赖文件，已配置 `.gitignore` 自动忽略：**

- ✅ `node_modules/` - npm 依赖包
- ✅ `offline-packages/` - 离线同步的包
- ✅ `verdaccio/storage/` - Verdaccio 数据

**首次使用请运行：**
```bash
cleanup-git-dependencies.bat
```

详细指南：[Git快速开始](./docs/04-Git配置/04-Git快速开始.md) | [Git忽略指南](./docs/04-Git配置/02-Git忽略指南.md)

---

## 🎉 重要更新：自动依赖解析

**问题**：之前安装某个包时，只会下载该包本身，不会下载其依赖的子依赖。

**解决方案**：新增 `add-deps` 命令，自动解析并安装所有依赖！

```bash
# ✅ 推荐使用 - 自动安装所有依赖
npm run add-deps

# ⚠️ 旧方式 - 仅安装单个包
npm run add-package
```

详细对比请查看：
- [依赖管理完整指南](DEPENDENCY-MANAGEMENT.md)
- [安装方式对比](INSTALL-MODES-COMPARISON.md)

## 功能特性

- ✅ **私有 npm 仓库**: 基于 Verdaccio 搭建本地 npm 仓库
- ✅ **自动依赖解析**: 自动下载主包及其所有依赖（NEW!）
- ✅ **增量依赖管理**: 按需添加和下载依赖包
- ✅ **离线包同步**: 自动将依赖同步到离线文件夹
- ✅ **文档自动生成**: 为每个依赖生成详细的使用文档
- ✅ **内网发布**: 一键发布到内网 npm 仓库

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 Verdaccio 服务

```bash
npm start
```

服务将在 `http://localhost:4873` 启动。

### 3. 配置 npm registry

```bash
npm config set registry http://localhost:4873
```

### 4. 添加新依赖

#### 方式一：自动安装所有依赖（推荐⭐）

```bash
npm run add-deps
```

按提示输入：
- 包名（例如：react）
- 版本号（可选，留空使用最新版本）

系统会自动：
- 🔍 分析包的所有依赖（包括子依赖）
- 📦 批量安装所有依赖包
- 💾 保存所有包信息到 `packages/` 目录
- 📝 询问是否生成所有包的文档
- 📁 询问是否同步到离线文件夹

**示例：**
```bash
npm run add-deps
# 输入: react@18.2.0
# 结果: 安装 react + loose-envify + js-tokens 等所有依赖
```

#### 方式二：仅安装单个包（不推荐）

```bash
npm run add-package
```

这种方式只安装指定的包，不会处理其依赖。仅在确定不需要依赖时使用。

#### 方式三：批量下载多个依赖（新增⭐⭐⭐）

```bash
npm run batch-download
```

**使用步骤：**

1. 编辑 `package.json`，在 `dependencies` 中添加需要的包：

```json
{
  "dependencies": {
    "verdaccio": "^5.0.0",
    "fs-extra": "^11.0.0",
    "axios": "^1.6.0",
    
    "// 添加您需要下载的依赖": "",
    "lodash": "^4.17.21",
    "express": "^4.18.2",
    "react": "^18.2.0"
  }
}
```

2. 运行批量下载命令：

```bash
npm run batch-download
```

系统会自动：
- 📖 读取 package.json 中的所有依赖
- ⬇️ 批量下载所有包
- 💾 保存包信息到 `packages/` 目录
- 📂 同步到 `offline-packages/` 目录
- 📝 生成文档到 `docs/` 目录
- 📊 生成下载报告

**适合场景：**
- ✅ 新项目初始化
- ✅ 批量更新依赖
- ✅ 内网环境准备
- ✅ 一次性下载多个包

**详细文档：** [BATCH-DOWNLOAD-GUIDE.md](BATCH-DOWNLOAD-GUIDE.md)

---

## 常用命令

### 📦 添加依赖包

```bash
# 方式 1：自动安装所有依赖（推荐⭐⭐⭐）
npm run add-deps

# 方式 2：批量下载多个依赖（新增⭐⭐⭐）
npm run batch-download

# 方式 3：仅安装单个包
npm run add-package
```

### 🔍 分析包的依赖结构

```bash
# 查看包的完整依赖树，再决定是否安装
npm run analyze-deps
```

### ⚠️ 仅安装单个包（不推荐）

```bash
# 只安装指定的包，不处理其依赖
npm run add-package
```

### 📦 同步到离线文件夹

将 `node_modules/` 中的依赖复制到 `offline-packages/`，用于内网传输：

```bash
npm run sync-to-offline
```

**特性说明**：
- ✅ 自动检测并同步所有版本的包（如 minimatch 有 3.1.5、5.1.9、10.2.5 三个版本）
- ✅ 单版本包使用原名：`minimatch/`
- ✅ 多版本包添加版本号后缀：`minimatch@3.1.5/`、`minimatch@5.1.9/`
- ✅ 生成详细同步日志：`sync-log.json`

**查看多版本包管理工具**：
```bash
# 使用交互式管理工具
manage-multi-versions.bat

# 或查看详细文档
打开 MULTI-VERSION-PACKAGES.md
```

### 📝 生成依赖文档

```bash
npm run generate-docs
```

文档将生成在 `docs/` 目录：
- `README.md`: 所有依赖的汇总清单
- `[package-name].md`: 每个依赖的详细文档

### 🌐 发布到内网 npm 仓库

1. 首先修改 `scripts/publish-to-internal.js` 中的内网地址：

```javascript
const INTERNAL_REGISTRY = 'http://your-internal-npm-registry:4873'; // 改为内网地址
```

2. 将 `offline-packages/` 复制到内网

3. 执行发布：

```bash
npm run publish-to-internal
```

或使用独立脚本：

```bash
node scripts/publish-internal-standalone.js
```

或直接双击：

```bash
publish-internal.bat
```

## 项目结构

```
npm-install/
├── verdaccio/              # Verdaccio 配置
│   └── config.yaml        # 配置文件
├── scripts/               # 自动化脚本
│   ├── add-package.js    # 添加单个包（旧方式）
│   ├── add-package-with-deps.js  # 添加包及所有依赖（NEW!）
│   ├── analyze-deps.js   # 分析依赖结构（NEW!）
│   ├── sync-to-offline.js # 同步到离线文件夹
│   ├── generate-docs.js  # 生成文档
│   ├── publish-to-internal.js # 发布到内网
│   ├── publish-internal-standalone.js # 内网发布（独立版）
│   └── check-setup.js    # 检查配置
├── packages/             # 包信息存储
├── docs/                 # 依赖文档
├── offline-packages/     # 离线包存储
├── reports/              # 分析报告（NEW!）
├── storage/             # Verdaccio 数据存储
├── htpasswd             # 用户认证文件（自动生成）
├── package.json         # 项目配置
├── README.md           # 说明文档
├── DEPENDENCY-MANAGEMENT.md      # 依赖管理指南（NEW!）
└── INSTALL-MODES-COMPARISON.md   # 安装方式对比（NEW!）
```


## 工作流程

### 外网环境（有网络）

1. 启动 Verdaccio 服务
2. 使用 `add-package` 脚本添加需要的依赖
3. 依赖会自动缓存到本地并同步到 `offline-packages/`
4. 生成依赖文档到 `docs/` 目录
5. 将 `offline-packages/` 文件夹复制到内网

### 内网环境（无网络）

1. 在内网部署 Verdaccio 或 npm 仓库
2. 修改 `publish-to-internal.js` 中的内网地址
3. 执行 `publish-to-internal` 脚本
4. 所有离线包将发布到内网 npm 仓库

## 配置说明

### Verdaccio 配置

编辑 `verdaccio/config.yaml`：

- **uplinks**: 配置上游 npm 仓库地址
- **packages**: 配置访问权限和发布权限
- **auth**: 配置用户认证方式

### 用户管理

首次启动时会自动创建 `htpasswd` 文件，添加用户：

```bash
npm adduser --registry http://localhost:4873
```

## 注意事项

1. **首次启动**: 需要先运行 `npm start` 启动 Verdaccio 服务
2. **内网地址**: 发布前务必修改内网 npm 仓库地址
3. **定期备份**: 建议定期备份 `storage/` 和 `offline-packages/` 目录
4. **版本管理**: 建议在添加依赖时明确指定版本号

## 故障排除

### Verdaccio 启动失败

检查端口 4873 是否被占用，或修改 `config.yaml` 中的端口配置。

### 依赖下载失败

确保 Verdaccio 服务正常运行，并检查网络连接。

### 发布到内网失败

1. 检查内网 npm 仓库是否可访问
2. 确认已登录到内网仓库：`npm login --registry [内网地址]`
3. 查看 `publish-report.json` 了解详细错误信息

## License

ISC
