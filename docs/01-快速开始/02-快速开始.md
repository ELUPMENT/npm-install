# 快速开始指南

## 第一步：安装 Node.js（如果未安装）

从 [Node.js 官网](https://nodejs.org/) 下载并安装 LTS 版本。

## 第二步：启动 Verdaccio 服务

### 方式一：使用批处理脚本（推荐）

双击运行 `start.bat`

### 方式二：使用命令行

```bash
npm install
npm start
```

服务将在 `http://localhost:4873` 启动。

## 第三步：创建用户（首次使用）

打开新的命令行窗口，执行：

```bash
npm adduser --registry http://localhost:4873
```

按提示设置用户名、密码和邮箱。

## 第四步：添加依赖包

### 方式一：使用交互式脚本

```bash
npm run add-package
```

### 方式二：直接使用 npm

```bash
npm install lodash@4.17.21 --registry=http://localhost:4873
```

## 第五步：同步到离线文件夹

```bash
npm run sync-to-offline
```

离线包将保存到 `offline-packages/` 目录。

## 第六步：生成文档

```bash
npm run generate-docs
```

查看文档：
- 汇总文档：`docs/README.md`
- 单独文档：`docs/[package-name].md`

## 内网发布流程

### 1. 准备离线包

在外网环境中执行：

```bash
npm run sync-to-offline
```

### 2. 复制到内网

将整个 `offline-packages/` 文件夹复制到内网环境。

### 3. 修改内网地址

编辑 `scripts/publish-to-internal.js`，修改：

```javascript
const INTERNAL_REGISTRY = 'http://your-internal-npm-registry:4873';
```

改为您的内网 npm 仓库地址。

### 4. 发布到内网

在内网环境中执行：

```bash
npm run publish-to-internal
```

## 常见问题

### Q: 如何查看已安装的包？

A: 查看 `packages/` 目录下的 JSON 文件，或查看 `docs/README.md` 汇总文档。

### Q: 如何更新包的版本？

A: 直接运行 `npm install package-name@new-version --registry=http://localhost:4873`，然后重新同步和生成文档。

### Q: Verdaccio 数据存储在哪里？

A: 存储在 `storage/` 目录中，建议定期备份。

### Q: 如何重置所有数据？

A: 删除 `storage/`、`htpasswd` 文件，然后重新启动 Verdaccio。

## 下一步

- 阅读 [README.md](README.md) 了解更多功能
- 配置 `verdaccio/config.yaml` 自定义仓库行为
- 查看 Verdaccio 官方文档：https://verdaccio.org/
