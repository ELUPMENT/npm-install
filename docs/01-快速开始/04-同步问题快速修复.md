# ⚡ 快速修复：包同步问题

## 📌 您的问题

```
⚠ @types/node 在 node_modules 中不存在，跳过
⚠ @types/estree 在 node_modules 中不存在，跳过
```

并且 `@types/node` 出现了**两次**。

---

## ✅ 3 步快速解决

### 步骤 1：清理重复文件

```bash
npm run clean-duplicates
```

这会删除旧格式的文件（如 `@types_node.json`），只保留新格式（`at_types_node.json`）。

---

### 步骤 2：诊断包状态

```bash
npm run diagnose
```

查看哪些包实际已安装，哪些缺失。

---

### 步骤 3：重新同步

```bash
npm run sync-to-offline
```

现在应该能正确同步所有包了。

---

## 🔍 如果还有问题

### 情况 A：包确实没有安装

**症状：** 诊断显示"未安装"

**解决：**
```bash
# 方法 1：单独安装
npm install @types/node --registry=http://localhost:4873

# 方法 2：使用自动依赖安装（推荐）
npm run add-deps
# 输入您最初想要的主包名
```

---

### 情况 B：Verdaccio 没有缓存包

**症状：** 安装失败，提示找不到包

**解决：**
```bash
# 重启 Verdaccio
# Ctrl+C 停止当前服务
npm start

# 然后重新安装
npm install @types/node --registry=http://localhost:4873
```

---

## 📊 验证修复

```bash
# 1. 检查 packages 目录（应该没有重复）
ls packages/

# 2. 检查 node_modules
ls node_modules/@types/

# 3. 再次同步
npm run sync-to-offline

# 4. 检查结果
ls offline-packages/
# 应该看到 at_types_node/ 等文件夹
```

---

## 💡 预防建议

1. ✅ 始终使用 `npm run add-deps` 安装依赖
2. ✅ 定期运行 `npm run clean-duplicates`
3. ✅ 不要手动修改 `packages/` 目录

---

## 📚 详细文档

- [TROUBLESHOOTING-SYNC-ISSUES.md](TROUBLESHOOTING-SYNC-ISSUES.md) - 完整故障排除指南
- [SCOPED-PACKAGES-FIX.md](SCOPED-PACKAGES-FIX.md) - Scoped packages 支持说明

---

**按照这 3 步操作，问题应该能解决！** 🎉
