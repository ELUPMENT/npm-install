# 📦 批量依赖下载方案

## 🎯 方案说明

这是一个高效的批量依赖下载方案，适合需要一次性下载多个依赖的场景。

**工作流程：**
1. ✅ 在 `package.json` 的 `dependencies` 中声明需要的包
2. ✅ 运行 `npm run batch-download` 批量下载
3. ✅ 自动同步到 `offline-packages` 目录
4. ✅ 生成完整的文档和报告

---

## 🚀 快速开始

### 步骤 1：配置依赖

编辑 [`package.json`](package.json)，在 `dependencies` 中添加需要的包：

```json
{
  "name": "npm-install",
  "version": "1.0.0",
  "dependencies": {
    "verdaccio": "^5.0.0",
    "fs-extra": "^11.0.0",
    "axios": "^1.6.0",
    
    "// 添加您需要下载的依赖": "",
    "lodash": "^4.17.21",
    "express": "^4.18.2",
    "react": "^18.2.0",
    "vue": "^3.3.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

**注意：**
- ✅ 保留项目必需的依赖（verdaccio、fs-extra、axios）
- ✅ 添加需要下载的第三方依赖
- ✅ 可以使用版本号范围（^、~、>= 等）

---

### 步骤 2：启动 Verdaccio

```bash
npm start
# 或双击 start.bat
```

确保 Verdaccio 服务正在运行（http://localhost:4873）

---

### 步骤 3：执行批量下载

```bash
npm run batch-download
```

**脚本会自动：**
1. 📖 读取 package.json 中的依赖
2. ⬇️ 逐个下载所有依赖
3. 💾 保存包信息到 `packages/` 目录
4. 📂 同步到 `offline-packages/` 目录
5. 📝 生成文档到 `docs/` 目录
6. 📊 生成下载报告

---

## 📊 输出示例

```
=== 批量依赖下载工具 ===

📖 读取 package.json 中的依赖...

找到 6 个依赖:

  - lodash@^4.17.21
  - express@^4.18.2
  - react@^18.2.0
  - vue@^3.3.0
  - @types/node@^20.10.0
  - typescript@^5.3.0

是否继续下载这 6 个依赖? (y/n): y

开始批量下载...

[1/6] 处理 lodash@^4.17.21...
[lodash@4.17.21] 开始下载...
✓ lodash@4.17.21 下载成功
✓ lodash 信息已保存

[2/6] 处理 express@^4.18.2...
[express@4.18.2] 开始下载...
✓ express@4.18.2 下载成功
✓ express 信息已保存

...

=== 下载完成 ===
总计: 6 个包
成功: 6 个
失败: 0 个


=== 同步到离线文件夹 ===

✓ lodash 已同步到离线文件夹
✓ express 已同步到离线文件夹
...

✓ 已同步 6 个包到离线文件夹

=== 生成文档 ===

✓ lodash 文档已生成
✓ express 文档已生成
...

✓ 已生成 6 个包的文档

📊 下载报告已保存到: batch-download-report.json

=== 批量下载完成 ===
```

---

## 📁 生成的文件

### 1. packages/ 目录

保存每个包的元数据：

```
packages/
├── lodash.json
├── express.json
├── react.json
├── vue.json
├── at_types_node.json
└── typescript.json
```

**内容示例（lodash.json）：**
```json
{
  "name": "lodash",
  "version": "4.17.21",
  "description": "Lodash modular utilities.",
  "license": "MIT",
  "author": "John-David Dalton <john.david.dalton@gmail.com>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/lodash/lodash.git"
  },
  "homepage": "https://lodash.com/",
  "installedAt": "2024-01-01T10:00:00.000Z",
  "source": "batch-download"
}
```

---

### 2. offline-packages/ 目录

完整的包文件，可用于内网发布：

```
offline-packages/
├── lodash/
│   ├── package.json
│   ├── lodash.js
│   └── ...
├── express/
│   ├── package.json
│   ├── index.js
│   └── ...
└── ...
```

---

### 3. docs/ 目录

每个包的详细文档：

```
docs/
├── lodash.md
├── express.md
├── react.md
└── ...
```

**文档内容示例：**
```markdown
# lodash

## 基本信息

- **版本**: 4.17.21
- **描述**: Lodash modular utilities.
- **许可证**: MIT
- **作者**: John-David Dalton
- **安装时间**: 2024-01-01 10:00:00
- **来源**: 批量下载

## 主页

[lodash.com](https://lodash.com/)

## 仓库

[github.com/lodash/lodash](https://github.com/lodash/lodash)

## 使用说明

```bash
npm install lodash@4.17.21 --registry=http://localhost:4873
```
```

---

### 4. batch-download-report.json

完整的下载报告：

```json
{
  "timestamp": "2024-01-01T10:00:00.000Z",
  "totalPackages": 6,
  "successCount": 6,
  "failCount": 0,
  "syncedCount": 6,
  "results": [
    {
      "name": "lodash",
      "version": "4.17.21",
      "success": true
    },
    ...
  ]
}
```

---

## 💡 使用场景

### 场景 1：新项目初始化

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "jsonwebtoken": "^9.0.0"
  }
}
```

```bash
npm run batch-download
```

---

### 场景 2：前端项目依赖

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.0.0",
    "axios": "^1.6.0",
    "antd": "^5.0.0",
    "@types/react": "^18.0.0"
  }
}
```

```bash
npm run batch-download
```

---

### 场景 3：TypeScript 项目

```json
{
  "dependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.0",
    "ts-node": "^10.9.0",
    "eslint": "^8.0.0"
  }
}
```

```bash
npm run batch-download
```

---

## 🔧 高级用法

### 排除某些包

脚本会自动排除项目必需的包：
- `verdaccio`
- `fs-extra`
- `axios`

如果需要排除其他包，修改 [`scripts/batch-download.js`](scripts/batch-download.js) 第 30 行：

```javascript
const excludePackages = ['verdaccio', 'fs-extra', 'axios', 'your-package'];
```

---

### 自定义 Registry

修改脚本中的 registry 地址（第 57 行）：

```javascript
const installCmd = `npm install ${name}@${cleanVersion} --registry=http://localhost:4873 --no-save`;
```

改为您的私有仓库地址。

---

### 批量更新依赖

1. 更新 `package.json` 中的版本号
2. 运行 `npm run batch-download`
3. 脚本会自动下载新版本

---

## 🆚 方案对比

| 特性 | add-package | add-deps | batch-download |
|------|------------|----------|----------------|
| 交互方式 | 逐个输入 | 单个主包 | 配置文件 |
| 依赖解析 | ❌ | ✅ | ❌ |
| 批量处理 | ❌ | ❌ | ✅ |
| 适合场景 | 少量包 | 完整依赖树 | 大量包 |
| 自动化程度 | 低 | 高 | 中 |

**推荐使用：**
- 📌 少量包 → `npm run add-package`
- 📌 完整项目依赖 → `npm run add-deps`
- 📌 批量初始化 → `npm run batch-download` ⭐

---

## ⚠️ 注意事项

### 1. Verdaccio 必须运行

```bash
# 检查服务状态
npm run check-verdaccio

# 如果未运行，先启动
npm start
```

---

### 2. 版本号格式

支持所有 npm 版本格式：
- ✅ `^4.17.21` （兼容版本）
- ✅ `~4.17.0` （近似版本）
- ✅ `4.17.21` （精确版本）
- ✅ `>=4.0.0` （最小版本）

脚本会自动清理前缀，下载实际版本。

---

### 3. Scoped Packages

完全支持 scoped packages：
- ✅ `@types/node`
- ✅ `@babel/core`
- ✅ `@vue/compiler-sfc`

---

### 4. 失败处理

如果某个包下载失败：
- ✅ 继续下载其他包
- ✅ 记录失败原因
- ✅ 生成报告供后续处理

---

## 🛠️ 故障排除

### 问题 1：下载速度慢

**原因：** Verdaccio 需要从上游下载

**解决：**
1. 确保网络连接正常
2. 或使用国内镜像作为 uplink
3. 或预下载到本地

---

### 问题 2：某些包下载失败

**可能原因：**
- 包不存在于上游仓库
- 网络超时
- 权限问题

**解决：**
```bash
# 查看失败报告
cat batch-download-report.json

# 单独下载失败的包
npm run add-package
```

---

### 问题 3：Checksum 不一致

**解决：**
```bash
# 清理缓存
npm run clean-cache

# 重新下载
npm run batch-download
```

---

## 📋 完整工作流程

### 标准流程

```bash
# 1. 编辑 package.json，添加依赖
# 2. 启动 Verdaccio
npm start

# 3. 批量下载
npm run batch-download

# 4. 验证结果
ls offline-packages/
ls docs/

# 5. 查看报告
cat batch-download-report.json

# 6. （可选）发布到内网
npm run publish-to-internal
```

---

### 内网部署流程

```bash
# 在外网环境
npm run batch-download
tar -czf offline-packages.tar.gz offline-packages/

# 传输到内网
scp offline-packages.tar.gz user@internal-server:/tmp/

# 在内网环境
tar -xzf /tmp/offline-packages.tar.gz
# 复制到 Verdaccio 存储目录
# 重启 Verdaccio
```

---

## ✨ 总结

### 优势

- ✅ **高效**：一次性下载多个包
- ✅ **自动化**：自动同步、生成文档
- ✅ **可追溯**：完整的下载报告
- ✅ **灵活**：支持所有版本格式
- ✅ **可靠**：失败不影响其他包

### 适用场景

- 🎯 新项目初始化
- 🎯 批量更新依赖
- 🎯 内网环境准备
- 🎯 离线包库建设

---

**批量下载方案让您的依赖管理更高效！** 🚀

---

*文档版本：v1.0*  
*更新时间：2024-01-01*
