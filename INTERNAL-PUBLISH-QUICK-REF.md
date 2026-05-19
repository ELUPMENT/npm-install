# 内网发布安全与依赖链管理 - 快速参考

## 🎯 核心答案

### Q1: 内网发布会影响已存在的包吗？
**❌ 不会！** 现在的实现会：
1. 发布前检查包是否存在
2. 如存在则**跳过**，不影响内网源
3. 双重保障：HTTP 检查 + E409 错误捕获

### Q2: 能否下载完整依赖链？
**✅ 能！** 使用 `npm install` 自动解析：
- 主包 → 子依赖 → 子子依赖 → ...
- 递归扫描 node_modules 获取完整依赖树
- 自动去重，避免重复处理

### Q3: 内网已有依赖能否直接使用？
**✅ 能！** Verdaccio 工作机制：
```
npm install → Verdaccio → 检查 storage → 存在则直接返回 ✅
                                      ↓ 不存在
                                 (配置proxy则从上游下载)
```

---

## 🚀 快速命令

### 外网准备
```bash
# 1. 添加依赖到 package.json
# 2. 启动 Verdaccio
npm start

# 3. 批量下载（含完整依赖链）
npm run batch-download

# 4. 同步到离线文件夹
npm run sync-to-offline
```

### 内网发布
```bash
# 1. 复制 offline-packages/ 到内网
# 2. 发布（自动跳过已存在的包）
npm run publish-to-internal

# 3. 查看报告
cat publish-report.json
```

### 内网使用
```bash
# 1. 配置 registry
npm config set registry http://10.1.11.113:7000

# 2. 安装包（自动复用缓存）
npm install element-plus
```

---

## 📊 发布报告解读

```json
{
  "totalPackages": 100,
  "successCount": 30,      // 新发布的包
  "skippedCount": 68,      // 已存在，跳过的包 ✅
  "failCount": 2           // 失败的包
}
```

**关键指标：**
- `skippedCount` 高 = 大部分包已存在，无需重复发布 ✅
- `failCount` > 0 = 需要检查错误信息

---

## 🔍 依赖链示例

```
安装 element-plus@2.13.0
│
├─ element-plus@2.13.0          (主包)
├─ @vue/runtime-dom@3.4.0       (L1)
├─ @vue/shared@3.4.0            (L1)
├─ dayjs@1.11.10                (L1)
│   └─ ...
├─ @ctrl/tinycolor@3.6.1        (L2)
└─ ... 共 50+ 个包
```

**batch-download 会自动下载所有层级的依赖！**

---

## ⚠️ 注意事项

1. ✅ **始终使用 `npm run batch-download`** 而非手动安装
2. ✅ **发布前会自动检查**，无需担心覆盖
3. ✅ **Verdaccio 自动复用缓存**，速度极快
4. ❌ **不要手动删除 storage/** 除非确定不需要
5. ✅ **定期备份** `verdaccio/storage/` 目录

---

## 🛠️ 故障排查

### 发布失败
```bash
# 查看详细错误
cat publish-report.json

# 检查内网连接
curl http://10.1.11.113:7000

# 确认已登录
npm whoami --registry http://10.1.11.113:7000
```

### 下载失败
```bash
# 清除缓存后重试
npm cache clean --force
npm run batch-download

# 检查 Verdaccio 是否运行
npm start
```

### 依赖不完整
```bash
# 重新下载特定包
npm install <package>@<version> --registry=http://localhost:4873

# 查看依赖树
npm list --depth=3
```

---

## 📚 相关文档

- [详细指南](./INTERNAL-PUBLISH-SAFETY-GUIDE.md)
- [项目总览](./README.md)
- [故障排除](./TROUBLESHOOTING-SYNC-ISSUES.md)

---

*最后更新：2026-05-18*