# 📋 快速参考卡片

## 🚀 快速启动（3 步）

```bash
# 1. 启动 Verdaccio
npm start
# 或双击 start.bat

# 2. 添加依赖（新窗口）
npm run add-package

# 3. 同步到离线文件夹
npm run sync-to-offline
```

## 📦 添加依赖包

### 方式一：交互式（推荐）
```bash
npm run add-package
```
按提示输入：
- 包名：lodash
- 版本：4.17.21
- 生成文档？y
- 同步离线包？y

### 方式二：命令行
```bash
npm install lodash@4.17.21 --registry=http://localhost:4873
npm run sync-to-offline
npm run generate-docs
```

## 🔄 内网发布流程

### 外网操作
```bash
# 1. 同步离线包
npm run sync-to-offline

# 2. 复制到内网
# 复制 offline-packages/ 和 scripts/publish-internal-standalone.js
```

### 内网操作
```bash
# 1. 修改内网地址
# 编辑 publish-internal-standalone.js 第 16 行

# 2. 登录到内网
npm login --registry http://your-internal-registry:4873

# 3. 发布
node scripts/publish-internal-standalone.js
# 或双击 publish-internal.bat
```

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动 Verdaccio |
| `npm run add-package` | 添加依赖 |
| `npm run sync-to-offline` | 同步离线包 |
| `npm run generate-docs` | 生成文档 |
| `npm run check-setup` | 检查配置 |

## 📍 重要目录

- `verdaccio/` - Verdaccio 配置
- `scripts/` - 自动化脚本
- `packages/` - 包信息
- `docs/` - 依赖文档
- `offline-packages/` - 离线包
- `storage/` - Verdaccio 数据（自动生成）

## 🔗 文档导航

- [`QUICKSTART.md`](QUICKSTART.md) - 新手必读
- [`README.md`](README.md) - 完整说明
- [`INTERNAL-PUBLISH-GUIDE.md`](INTERNAL-PUBLISH-GUIDE.md) - 内网发布详解
- [`OVERVIEW.md`](OVERVIEW.md) - 项目总览
- [`PROJECT-SUMMARY.md`](PROJECT-SUMMARY.md) - 项目总结

## ⚠️ 注意事项

1. **首次使用**：需要创建用户
   ```bash
   npm adduser --registry http://localhost:4873
   ```

2. **内网地址**：发布前必须修改
   ```javascript
   // scripts/publish-internal-standalone.js 第 16 行
   const INTERNAL_REGISTRY = 'http://your-internal-npm-registry:4873';
   ```

3. **版本管理**：建议指定具体版本号，避免使用 latest

4. **定期备份**：备份 `storage/` 和 `offline-packages/`

## 💡 小贴士

- ✅ 使用 `start.bat` 快速启动
- ✅ 添加包时选择生成交档和同步离线包
- ✅ 定期运行 `npm run check-setup` 检查配置
- ✅ 查看 `docs/README.md` 了解已安装的依赖
- ✅ 内网发布前确保已登录

---

*保存此文件以便快速查阅！*
