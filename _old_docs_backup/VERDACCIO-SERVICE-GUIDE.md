# ⚡ Verdaccio 服务管理快速指南

## 📌 常见问题

### ECONNREFUSED 错误

```
npm error code ECONNREFUSED
npm error FetchError: request to http://localhost:4873/xxx failed
```

**原因：** Verdaccio 服务未运行

**解决：** 启动服务（见下方）

---

## 🚀 启动 Verdaccio 服务

### 方式 1：使用增强启动脚本（推荐）⭐⭐⭐

```bash
双击: start.bat
```

**功能：**
- ✅ 自动检查 Node.js
- ✅ 检测服务是否已运行
- ✅ 提供重启选项
- ✅ 后台启动服务
- ✅ 验证启动成功

---

### 方式 2：命令行启动

```bash
npm start
```

**注意：**
- ⚠️ 会占用当前终端窗口
- ⚠️ 关闭窗口会导致服务停止
- ✅ 适合调试和查看日志

---

## 🔍 检查服务状态

### 方法 1：使用检查脚本

```bash
npm run check-verdaccio
```

**输出示例：**
```
=== Verdaccio 服务状态检查 ===

✅ Verdaccio 服务正在运行

监听信息:
  TCP    [::1]:4873             [::]:0                 LISTENING       27112

进程 ID: 27112

服务地址: http://localhost:4873

💡 提示:
  - 现在可以正常使用 npm 命令
  - 使用 npm run add-deps 添加依赖
```

---

### 方法 2：手动检查

```bash
# Windows PowerShell
netstat -ano | findstr "4873"

# 如果有输出，说明服务在运行
# 如果没有输出，说明服务未运行
```

---

### 方法 3：浏览器访问

打开浏览器访问：
```
http://localhost:4873
```

如果能看到 Verdaccio 界面，说明服务正常。

---

## 🛑 停止服务

### 方式 1：通过任务管理器

1. 按 `Ctrl+Shift+Esc` 打开任务管理器
2. 找到 `node.exe` 进程
3. 右键 → 结束任务

---

### 方式 2：命令行停止

```bash
# 找到 PID
netstat -ano | findstr "4873"

# 假设 PID 是 27112
taskkill /F /PID 27112
```

---

## 💡 最佳实践

### 1. 使用前检查服务状态

```bash
# 每次使用前先检查
npm run check-verdaccio

# 如果显示未运行，先启动
start.bat
```

---

### 2. 保持服务运行

- ✅ 启动后不要关闭终端窗口
- ✅ 使用 `start.bat` 后台运行
- ✅ 定期检查服务状态

---

### 3. 遇到问题时

**症状：** `ECONNREFUSED` 错误

**解决步骤：**
```bash
# 1. 检查服务状态
npm run check-verdaccio

# 2. 如果未运行，启动服务
start.bat

# 3. 等待 5 秒后重试
npm run add-deps
```

---

## 📊 常见错误及解决方案

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `ECONNREFUSED` | 服务未运行 | `start.bat` 启动服务 |
| `EADDRINUSE` | 端口被占用 | 检查是否有多个实例运行 |
| `ETIMEDOUT` | 网络问题 | 检查防火墙设置 |
| `404 Not Found` | 包不存在 | 确认包名和版本正确 |

---

## 🔧 故障排除

### 问题 1：服务启动失败

**症状：**
```
error --- address already in use :::4873
```

**原因：** 端口已被占用

**解决：**
```bash
# 1. 找到占用端口的进程
netstat -ano | findstr "4873"

# 2. 结束该进程
taskkill /F /PID <PID>

# 3. 重新启动
start.bat
```

---

### 问题 2：服务启动后立即停止

**症状：** 启动后几秒就退出

**可能原因：**
- 配置文件错误
- 权限问题
- 端口冲突

**解决：**
```bash
# 查看详细日志
npm start

# 检查配置文件
cat verdaccio/config.yaml
```

---

### 问题 3：无法安装包

**症状：**
```
npm error code ECONNREFUSED
```

**解决：**
```bash
# 1. 检查服务状态
npm run check-verdaccio

# 2. 如果未运行，启动服务
start.bat

# 3. 等待服务完全启动（约 5 秒）
timeout /t 5

# 4. 重试安装
npm install <package> --registry=http://localhost:4873
```

---

## 📝 工作流程建议

### 标准工作流程

```bash
# 1. 启动 Verdaccio（每天第一次使用时）
start.bat

# 2. 验证服务运行
npm run check-verdaccio

# 3. 添加依赖
npm run add-deps

# 4. 同步到离线文件夹
npm run sync-to-offline

# 5. 生成文档
npm run generate-docs

# 6. （可选）清理重复文件
npm run clean-duplicates
```

---

### 快速检查清单

在使用前确认：
- [ ] Verdaccio 服务正在运行
- [ ] 可以访问 http://localhost:4873
- [ ] node_modules 目录存在
- [ ] packages 目录存在

---

## ✨ 总结

### 关键命令

| 命令 | 用途 |
|------|------|
| `start.bat` | 启动服务（推荐） |
| `npm start` | 启动服务（前台） |
| `npm run check-verdaccio` | 检查服务状态 |
| `netstat -ano \| findstr "4873"` | 手动检查端口 |

### 重要提示

- ⚠️ **始终确保 Verdaccio 正在运行**
- ⚠️ **遇到 ECONNREFUSED 先检查服务状态**
- ⚠️ **使用 start.bat 后台运行更方便**

---

**记住：Verdaccio 服务是所有操作的前提！** 🎯

---

*文档版本：v1.0*  
*更新时间：2024-01-01*
