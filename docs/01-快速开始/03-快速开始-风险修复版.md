# 🚀 快速开始 - 风险修正版

## ⚡ 5分钟快速上手

### 1️⃣ 添加依赖到 package.json

```json
{
  "dependencies": {
    "element-plus": "2.13.0",
    "vue": "^3.4.0",
    "lodash": "^4.17.21"
  }
}
```

### 2️⃣ 启动 Verdaccio（外网环境）

```bash
npm start
```

等待看到：`verdaccio/5.x.x` 和 `http://localhost:4873`

### 3️⃣ 批量下载（自动下载完整依赖链）

```bash
npm run batch-download
```

**这会做什么：**
- ✅ 读取 package.json 中的依赖
- ✅ 使用 `npm install` 自动解析所有子依赖
- ✅ 递归扫描 node_modules 获取完整依赖树
- ✅ 保存元数据到 `packages/` 目录
- ✅ 同步到 `offline-packages/` 目录

**输出示例：**
```
========== [1/3] 处理主依赖: element-plus@2.13.0 ==========
✓ element-plus 及其 52 个子依赖安装完成

=== 下载完成 ===
所有包（含子依赖）总计: 65 个
```

### 4️⃣ 发布到内网（自动跳过已存在的包）

```bash
# 将 offline-packages/ 复制到内网服务器后执行
npm run publish-to-internal
```

**这会做什么：**
- ✅ 发布前检查每个包是否已存在
- ✅ 如存在则跳过，不影响内网源
- ✅ 只发布新的包版本
- ✅ 生成详细报告

**输出示例：**
```
=== 发布完成 ===
总计: 100 个包
成功发布: 30 个
跳过(已存在): 68 个  ← 安全跳过 ✅
失败: 2 个
```

### 5️⃣ 内网使用

```bash
# 配置 registry
npm config set registry http://10.1.11.113:7000

# 安装包（自动复用缓存）
npm install element-plus
```

**效果：**
- ✅ Verdaccio 直接从 storage 返回
- ✅ 无需重新下载
- ✅ 速度极快

---

## 🎯 核心优势

### ✅ 安全性
- **发布前检查**：HTTP HEAD 请求验证包是否存在
- **双重保障**：E409 错误捕获作为备用
- **零风险**：已存在的包不会被覆盖

### ✅ 完整性
- **完整依赖链**：npm install 自动解析所有层级
- **智能去重**：共享依赖只处理一次
- **详细记录**：保存每个包的元数据

### ✅ 高效性
- **缓存复用**：Verdaccio 优先使用本地存储
- **增量更新**：只发布新包，跳过已有包
- **全员共享**：一次发布，所有机器可用

---

## 📋 常用命令速查

```bash
# 启动 Verdaccio
npm start

# 批量下载（含完整依赖链）
npm run batch-download

# 同步到离线文件夹
npm run sync-to-offline

# 发布到内网（自动跳过已存在）
npm run publish-to-internal

# 运行测试
npm run test-safety

# 查看报告
cat publish-report.json
cat batch-download-report.json
```

---

## 🔍 验证改进效果

### 测试1：验证发布安全性

```bash
# 第一次发布
npm run publish-to-internal
# 结果：所有包都成功发布

# 第二次发布（不修改任何内容）
npm run publish-to-internal
# 结果：所有包都被跳过 ✅
# 证明：已存在的包不会受到影响
```

### 测试2：验证依赖链完整性

```bash
npm run batch-download

# 查看生成的报告
cat batch-download-report.json

# 应该看到类似：
{
  "totalMainPackages": 3,
  "totalAllPackages": 65,  ← 包含所有子依赖
  "results": [
    {
      "mainPackage": { "name": "element-plus", "version": "2.13.0" },
      "totalDependencies": 52  ← 完整的依赖链
    }
  ]
}
```

### 测试3：验证缓存复用

```bash
# 配置内网 registry
npm config set registry http://10.1.11.113:7000

# 首次安装（从 storage 获取）
time npm install element-plus
# real    0m2.5s  ← 很快

# 清除本地缓存
npm cache clean --force

# 再次安装（仍然从 storage 获取）
time npm install element-plus
# real    0m2.3s  ← 同样快 ✅
# 证明：Verdaccio 缓存生效
```

---

## ❓ 常见问题

### Q: 如何确认包没有被覆盖？
**A:** 查看 `publish-report.json` 中的 `skippedCount`，这些包被安全跳过。

### Q: 为什么有些包下载失败？
**A:** 检查 `batch-download-report.json` 中的错误信息，常见原因：
- Verdaccio 未启动
- 网络连接问题
- 包不存在于上游仓库

### Q: 如何添加新依赖？
**A:** 
1. 添加到 `package.json` 的 `dependencies`
2. 运行 `npm run batch-download`
3. 运行 `npm run sync-to-offline`
4. 运行 `npm run publish-to-internal`

### Q: 内网已有依赖会被重新下载吗？
**A:** 不会！Verdaccio 会直接从 storage 返回，无需重新下载。

---

## 📚 深入学习

- [详细指南](./INTERNAL-PUBLISH-SAFETY-GUIDE.md) - 完整的工作原理
- [快速参考](./INTERNAL-PUBLISH-QUICK-REF.md) - 常用命令和故障排查
- [工作流程图](./WORKFLOW-DIAGRAM.md) - 可视化流程图
- [风险修正总结](./RISK-FIX-SUMMARY.md) - 本次更新的详细说明

---

## 🎓 关键理解

> **三个核心概念：**
> 
> 1. **发布前检查** = 零风险
> 2. **完整依赖链** = 完整性
> 3. **缓存复用** = 高效性

记住这三点，你就掌握了这个系统的精髓！

---

*最后更新：2026-05-18*