# 内网发布完整指南

本指南详细说明如何将外网下载的 npm 依赖包发布到内网 npm 仓库。

## 整体流程

```
外网环境（有网络）          内网环境（无网络）
┌─────────────────┐       ┌─────────────────┐
│ 1. 启动 Verdaccio │       │                 │
│ 2. 下载依赖包     │──────▶│ 4. 复制离线包    │
│ 3. 同步离线包     │ 复制   │ 5. 发布到内网    │
└─────────────────┘       └─────────────────┘
```

## 第一部分：外网环境操作

### 步骤 1：启动 Verdaccio 服务

```bash
# 安装依赖（首次使用）
npm install

# 启动服务
npm start
```

服务将在 `http://localhost:4873` 运行。

### 步骤 2：创建用户（首次使用）

打开新的命令行窗口：

```bash
npm adduser --registry http://localhost:4873
```

按提示输入：
- Username: 您的用户名
- Password: 您的密码
- Email: 您的邮箱

### 步骤 3：添加需要的依赖包

#### 方式一：使用交互式脚本（推荐）

```bash
npm run add-package
```

按提示输入：
- 包名（例如：lodash、express、react 等）
- 版本号（可选，建议指定具体版本）

系统会询问：
- 是否生成文档？选择 `y`
- 是否同步到离线文件夹？选择 `y`

#### 方式二：直接使用 npm 命令

```bash
# 示例：安装 lodash
npm install lodash@4.17.21 --registry=http://localhost:4873

# 示例：安装 express
npm install express@4.18.2 --registry=http://localhost:4873

# 同步到离线文件夹
npm run sync-to-offline

# 生成文档
npm run generate-docs
```

### 步骤 4：验证离线包

查看 `offline-packages/` 目录，确认所有依赖包都已同步。

每个包应该包含完整的文件结构（与 node_modules 中相同）。

### 步骤 5：准备复制到内网

需要复制以下内容到内网：

```
offline-packages/          # 离线包目录
scripts/publish-internal-standalone.js  # 内网发布脚本
```

**推荐方式**：将整个 `npm-install` 项目打包压缩，复制到内网。

## 第二部分：内网环境操作

### 前置条件

在内网环境中，您需要：
1. 已部署的内网 npm 仓库（推荐使用 Verdaccio）
2. Node.js 和 npm 已安装

### 步骤 1：解压文件

将外网复制的文件解压到内网环境，例如：

```
c:\inner-net\npm-publish\
├── offline-packages/
└── publish-internal-standalone.js
```

### 步骤 2：修改内网地址

编辑 `publish-internal-standalone.js` 文件，找到第 16 行：

```javascript
const INTERNAL_REGISTRY = 'http://your-internal-npm-registry:4873';
```

修改为您的内网 npm 仓库地址，例如：

```javascript
const INTERNAL_REGISTRY = 'http://192.168.1.100:4873';
```

### 步骤 3：登录到内网 npm 仓库

```bash
# 如果没有账号，先创建账号
npm adduser --registry http://192.168.1.100:4873

# 如果已有账号，直接登录
npm login --registry http://192.168.1.100:4873
```

### 步骤 4：执行发布脚本

```bash
node publish-internal-standalone.js
```

脚本会自动：
1. 检查是否已登录
2. 遍历 `offline-packages/` 目录中的所有包
3. 逐个发布到内网 npm 仓库
4. 生成发布报告 `publish-report.json`

### 步骤 5：验证发布结果

#### 方式一：查看发布报告

打开 `publish-report.json`，查看成功和失败的包列表。

#### 方式二：测试安装包

```bash
# 设置内网 registry
npm config set registry http://192.168.1.100:4873

# 测试安装包
npm install lodash
npm install express
```

#### 方式三：访问内网仓库

在浏览器中访问内网 npm 仓库，查看已发布的包列表。

## 常见问题

### Q1: 发布时提示 "401 Unauthorized"

**原因**：未登录或登录过期

**解决**：
```bash
npm login --registry http://192.168.1.100:4873
```

### Q2: 部分包发布失败

**原因**：可能是包结构不完整或版本冲突

**解决**：
1. 查看 `publish-report.json` 中的错误信息
2. 在外网重新下载该包并同步
3. 重新复制到内网并发布

### Q3: 如何更新某个包的版本？

**外网操作**：
```bash
npm install package-name@new-version --registry=http://localhost:4873
npm run sync-to-offline
```

然后重新复制 `offline-packages/package-name` 到内网并发布。

### Q4: 如何批量更新所有包？

**外网操作**：
```bash
# 重新安装所有已记录的包
# 查看 packages/ 目录下的 JSON 文件获取包列表

# 或者手动逐个更新
npm install package1@version --registry=http://localhost:4873
npm install package2@version --registry=http://localhost:4873

npm run sync-to-offline
```

### Q5: 内网无法访问外网 npm 仓库

这是正常情况，本方案就是为了解决这个问题而设计的。

确保：
1. 外网已将依赖同步到 `offline-packages/`
2. 内网只从 `offline-packages/` 发布，不依赖外网

## 最佳实践

### 1. 版本管理

- 始终指定具体的版本号，避免使用 `latest`
- 在 `packages/` 目录中维护包清单
- 定期备份 `storage/` 目录

### 2. 文档维护

- 每次添加包后生成文档
- 定期更新 `docs/README.md` 汇总文档
- 将文档复制到内网供参考

### 3. 定期同步

- 建议每周或每月同步一次依赖
- 记录同步日志（自动生成 `sync-log.json`）
- 保留历史版本以备回滚

### 4. 安全考虑

- 定期更新用户密码
- 限制 Verdaccio 的访问权限
- 审查每个要发布的包

## 自动化脚本说明

### 外网脚本

| 脚本 | 用途 | 命令 |
|------|------|------|
| `add-package.js` | 添加新依赖 | `npm run add-package` |
| `sync-to-offline.js` | 同步到离线包 | `npm run sync-to-offline` |
| `generate-docs.js` | 生成文档 | `npm run generate-docs` |

### 内网脚本

| 脚本 | 用途 | 命令 |
|------|------|------|
| `publish-internal-standalone.js` | 发布到内网 | `node publish-internal-standalone.js` |

## 总结

整个流程的核心步骤：

**外网**：
1. ✅ 启动 Verdaccio
2. ✅ 下载依赖
3. ✅ 同步离线包
4. ✅ 复制到内网

**内网**：
1. ✅ 修改配置
2. ✅ 登录仓库
3. ✅ 执行发布
4. ✅ 验证结果

按照本指南操作，您可以轻松地将外网的 npm 依赖包管理并发布到内网环境中。
