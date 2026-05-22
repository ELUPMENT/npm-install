# ⚡ 批量下载快速指南

## 🎯 三步完成批量下载

### 步骤 1：配置依赖

编辑 `package.json`，在 `dependencies` 中添加需要的包：

```json
{
  "dependencies": {
    "verdaccio": "^5.0.0",
    "fs-extra": "^11.0.0",
    "axios": "^1.6.0",
    
    "// 添加您的依赖": "",
    "lodash": "^4.17.21",
    "express": "^4.18.2",
    "react": "^18.2.0"
  }
}
```

---

### 步骤 2：启动服务

```bash
npm start
# 或双击 start.bat
```

---

### 步骤 3：执行下载

```bash
npm run batch-download
```

**自动完成：**
- ✅ 下载所有依赖
- ✅ 保存到 packages/
- ✅ 同步到 offline-packages/
- ✅ 生成文档到 docs/
- ✅ 生成报告

---

## 📊 生成的文件

```
packages/           ← 包信息 JSON
offline-packages/   ← 完整包文件
docs/              ← Markdown 文档
batch-download-report.json  ← 下载报告
```

---

## 💡 常用场景

### 前端项目

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "antd": "^5.0.0",
    "axios": "^1.6.0"
  }
}
```

---

### Node.js 项目

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  }
}
```

---

### TypeScript 项目

```json
{
  "dependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.0"
  }
}
```

---

## 🔧 常见问题

### Q: 如何排除某些包？

修改 `scripts/batch-download.js` 第 30 行：

```javascript
const excludePackages = ['verdaccio', 'fs-extra', 'axios', 'your-package'];
```

---

### Q: 下载失败怎么办？

查看报告：
```bash
cat batch-download-report.json
```

单独下载失败的包：
```bash
npm run add-package
```

---

### Q: 可以重复运行吗？

✅ 可以！脚本会覆盖旧文件。

---

## 📚 详细文档

[BATCH-DOWNLOAD-GUIDE.md](BATCH-DOWNLOAD-GUIDE.md) - 完整使用指南

---

**批量下载让依赖管理更高效！** 🚀
