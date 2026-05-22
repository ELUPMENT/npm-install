# 项目总览 - NPM 私有仓库管理系统

## 🎯 项目目标

本项目的核心目标是建立一个完整的 **npm 依赖包管理解决方案**，支持：

1. ✅ **私有 npm 仓库**：基于 Verdaccio 搭建本地 npm 仓库
2. ✅ **增量依赖下载**：按需添加和下载依赖包
3. ✅ **离线包管理**：自动同步依赖到离线文件夹
4. ✅ **文档自动生成**：为每个依赖生成详细文档
5. ✅ **内网发布**：一键发布到内网 npm 仓库

## 📁 项目结构

```
npm-install/
│
├── verdaccio/                    # Verdaccio 配置目录
│   └── config.yaml              # 主配置文件
│
├── scripts/                      # 自动化脚本目录
│   ├── add-package.js           # 添加新依赖包（交互式）
│   ├── sync-to-offline.js       # 同步到离线文件夹
│   ├── generate-docs.js         # 生成依赖文档
│   ├── publish-to-internal.js   # 发布到内网（项目内使用）
│   ├── publish-internal-standalone.js  # 发布到内网（独立版本）
│   └── check-setup.js           # 检查项目配置
│
├── packages/                     # 包信息存储目录
│   └── [package-name].json      # 每个包的元数据
│
├── docs/                         # 依赖文档目录
│   ├── README.md                # 依赖清单汇总
│   └── [package-name].md        # 每个包的详细文档
│
├── offline-packages/             # 离线包存储目录
│   └── [package-name]/          # 完整的包文件
│
├── storage/                      # Verdaccio 数据存储（自动生成）
│
├── htpasswd                      # 用户认证文件（自动生成）
│
├── start.bat                     # Windows 快速启动脚本
├── publish-internal.bat          # Windows 内网发布脚本
├── package.json                  # 项目配置
├── README.md                     # 项目说明
├── QUICKSTART.md                 # 快速开始指南
├── INTERNAL-PUBLISH-GUIDE.md     # 内网发布完整指南
└── OVERVIEW.md                   # 本文档
```

## 🚀 核心功能

### 1. 启动 Verdaccio 服务

**方式一：使用批处理脚本**
```bash
双击运行: start.bat
```

**方式二：使用 npm 命令**
```bash
npm install    # 首次运行需要安装依赖
npm start      # 启动 Verdaccio
```

服务地址：`http://localhost:4873`

### 2. 添加依赖包

**方式一：交互式脚本（推荐）**
```bash
npm run add-package
```

系统会提示：
- 输入包名（如：lodash、express、react）
- 输入版本号（可选，建议指定具体版本）
- 是否生成文档？选择 `y`
- 是否同步到离线文件夹？选择 `y`

**方式二：直接使用 npm**
```bash
npm install lodash@4.17.21 --registry=http://localhost:4873
npm run sync-to-offline    # 同步到离线文件夹
npm run generate-docs      # 生成文档
```

### 3. 同步到离线文件夹

```bash
npm run sync-to-offline
```

所有依赖包会复制到 `offline-packages/` 目录，用于内网发布。

### 4. 生成依赖文档

```bash
npm run generate-docs
```

生成的文档包括：
- `docs/README.md`：所有依赖的汇总清单
- `docs/[package-name].md`：每个依赖的详细文档

### 5. 发布到内网

#### 外网操作：
1. 确保所有依赖已同步到 `offline-packages/`
2. 将整个项目或以下文件复制到内网：
   - `offline-packages/` 目录
   - `scripts/publish-internal-standalone.js`
   - `publish-internal.bat`

#### 内网操作：

**方式一：使用批处理脚本**
```bash
1. 编辑 scripts/publish-internal-standalone.js，修改内网地址
2. 双击运行: publish-internal.bat
```

**方式二：使用命令行**
```bash
1. 编辑 scripts/publish-internal-standalone.js，修改内网地址
2. npm login --registry http://your-internal-registry:4873
3. node scripts/publish-internal-standalone.js
```

## 📋 工作流程

### 典型工作流程

```
1. 外网环境（有网络）
   ↓
2. 启动 Verdaccio (npm start)
   ↓
3. 添加需要的依赖 (npm run add-package)
   ↓
4. 同步到离线文件夹 (npm run sync-to-offline)
   ↓
5. 生成文档 (npm run generate-docs)
   ↓
6. 复制 offline-packages/ 到内网
   ↓
7. 内网环境（无网络）
   ↓
8. 修改内网地址配置
   ↓
9. 登录到内网 npm 仓库
   ↓
10. 执行发布脚本 (node publish-internal-standalone.js)
   ↓
11. 验证发布结果
```

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动 Verdaccio 服务 |
| `npm run add-package` | 添加新依赖包（交互式） |
| `npm run sync-to-offline` | 同步所有依赖到离线文件夹 |
| `npm run generate-docs` | 生成依赖文档 |
| `npm run publish-to-internal` | 发布到内网（项目内使用） |
| `npm run check-setup` | 检查项目配置是否正确 |

## 📖 文档说明

| 文档 | 说明 |
|------|------|
| `README.md` | 项目完整说明文档 |
| `QUICKSTART.md` | 快速开始指南（推荐新手阅读） |
| `INTERNAL-PUBLISH-GUIDE.md` | 内网发布完整指南（详细说明） |
| `OVERVIEW.md` | 项目总览（本文档） |
| `docs/README.md` | 已安装依赖的汇总清单（自动生成） |

## ⚙️ 配置说明

### Verdaccio 配置

文件位置：`verdaccio/config.yaml`

关键配置项：
- **storage**: 数据存储路径（默认：`./storage`）
- **uplinks**: 上游 npm 仓库（默认：`https://registry.npmjs.org/`）
- **packages**: 包访问权限控制
- **auth**: 用户认证方式（默认：htpasswd）
- **server**: 服务器配置（端口、超时等）

### 内网发布配置

文件位置：`scripts/publish-internal-standalone.js`

需要修改的配置：
```javascript
const INTERNAL_REGISTRY = 'http://your-internal-npm-registry:4873';
```

将其改为您的内网 npm 仓库地址。

## 🔍 故障排查

### 问题 1：Verdaccio 启动失败

**可能原因**：
- 端口 4873 被占用
- 未安装依赖

**解决方法**：
```bash
npm install          # 安装依赖
npm start           # 重新启动
```

### 问题 2：无法下载依赖包

**可能原因**：
- Verdaccio 服务未启动
- 网络连接问题

**解决方法**：
```bash
# 确认 Verdaccio 正在运行
# 检查 http://localhost:4873 是否可访问
```

### 问题 3：内网发布失败

**可能原因**：
- 未登录到内网 npm 仓库
- 内网地址配置错误

**解决方法**：
```bash
# 登录到内网仓库
npm login --registry http://your-internal-registry:4873

# 检查地址配置
# 编辑 scripts/publish-internal-standalone.js
```

### 问题 4：检查项目配置

```bash
npm run check-setup
```

此命令会检查所有必要的文件和配置。

## 💡 最佳实践

### 1. 版本管理
- 始终指定具体的版本号（如 `lodash@4.17.21`）
- 避免使用 `latest` 标签
- 在文档中记录版本选择的原因

### 2. 定期更新
- 定期检查依赖包的安全更新
- 保持 `packages/` 目录的准确性
- 定期备份 `storage/` 和 `offline-packages/`

### 3. 文档维护
- 每次添加依赖后生成文档
- 定期更新汇总文档
- 将文档复制到内网供参考

### 4. 安全考虑
- 定期更改用户密码
- 限制 Verdaccio 的访问权限
- 审查每个要发布的包

## 📊 数据统计

项目会自动生成以下统计信息：

- **包信息**：存储在 `packages/*.json`
- **同步日志**：`sync-log.json`
- **发布报告**：`publish-report.json`
- **依赖文档**：`docs/` 目录

## 🤝 支持

如有问题，请参考：
1. `README.md` - 详细说明
2. `QUICKSTART.md` - 快速开始
3. `INTERNAL-PUBLISH-GUIDE.md` - 内网发布指南
4. Verdaccio 官方文档：https://verdaccio.org/

## 📝 许可证

ISC

---

**最后更新**: 2024-01-01  
**版本**: 1.0.0
