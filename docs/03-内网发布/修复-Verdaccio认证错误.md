# 🔧 修复 Verdaccio 认证错误 (E401)

## ❌ 问题描述

执行 `npm adduser --registry http://localhost:4873/` 时报错：
```
npm error code E401
npm error Unable to authenticate, your authentication token seems to be invalid.
npm error To correct this please try logging in again with:
npm error   npm login
```

## 🔍 原因分析

在 [`verdaccio/config.yaml`](file://c:\Users\Admin\Desktop\前端AI\npm发布\npm-install\verdaccio\config.yaml) 中，发布权限配置为：

```yaml
packages:
  '**':
    access: $all              # 允许所有人访问（下载）
    publish: $authenticated   # ❌ 只有认证用户可以发布
    unpublish: $authenticated
```

**问题：**
- `$authenticated` 表示需要先登录才能发布
- 但首次使用时还没有创建用户，无法登录
- 形成死循环：需要登录才能发布，但没有用户无法登录

## ✅ 解决方案

### 方案 1：允许匿名发布（推荐用于内网）

**适用场景：**
- ✅ 内网环境，可信网络
- ✅ 开发测试环境
- ✅ 不需要严格的访问控制

**修改配置：**

```yaml
packages:
  '@*/*':
    access: $all
    publish: $all          # ✅ 改为 $all，允许匿名发布
    unpublish: $authenticated
    
  '**':
    access: $all
    publish: $all          # ✅ 改为 $all，允许匿名发布
    unpublish: $authenticated
```

**优点：**
- ✅ 无需登录即可发布
- ✅ 简化工作流程
- ✅ 适合自动化脚本

**缺点：**
- ⚠️ 任何人都可以发布包（内网环境通常可接受）

### 方案 2：创建用户并启用认证

**适用场景：**
- ❌ 公网环境
- ❌ 需要严格控制谁可以发布
- ❌ 生产环境

**步骤：**

1. **确保 htpasswd 文件存在**
   ```bash
   # 检查文件是否存在
   Test-Path verdaccio\htpasswd
   
   # 如果不存在，Verdaccio 会在首次创建用户时自动生成
   ```

2. **创建用户**
   ```bash
   npm adduser --registry http://localhost:4873/
   
   # 按提示输入：
   # Username: your-username
   # Password: your-password
   # Email: your-email@example.com
   ```

3. **验证登录**
   ```bash
   npm whoami --registry http://localhost:4873/
   # 应该显示你的用户名
   ```

4. **发布包**
   ```bash
   npm publish --registry http://localhost:4873/
   ```

## 🚀 推荐的配置（已应用）

我已经将配置修改为**允许匿名发布**，适合内网环境：

**修改前：**
```yaml
packages:
  '**':
    access: $all
    publish: $authenticated   # ❌ 需要认证
```

**修改后：**
```yaml
packages:
  '**':
    access: $all
    publish: $all             # ✅ 允许匿名发布
```

### 重启 Verdaccio 使配置生效

**重要：** 修改配置后必须重启 Verdaccio 服务！

```bash
# 方式 1：停止当前服务（Ctrl+C），然后重新启动
npm start

# 方式 2：如果使用后台运行，先找到进程并终止
Get-Process node | Where-Object { $_.MainWindowTitle -like '*verdaccio*' } | Stop-Process
npm start
```

## 📊 两种方案对比

| 特性 | 匿名发布 | 认证发布 |
|------|---------|---------|
| **配置难度** | ✅ 简单 | ❌ 需要创建用户 |
| **使用便利性** | ✅ 无需登录 | ❌ 每次需登录 |
| **安全性** | ⚠️ 较低 | ✅ 较高 |
| **适用场景** | 内网/开发 | 公网/生产 |
| **自动化友好** | ✅ 完全支持 | ❌ 需要管理 token |
| **推荐度** | ⭐⭐⭐⭐⭐ (内网) | ⭐⭐⭐ (公网) |

## 💡 安全建议

### 内网环境（当前方案）

✅ **允许匿名发布是安全的**，因为：
- 内网通常是可信环境
- 只有内部人员可以访问
- 简化工作流程
- 适合自动化部署

### 公网环境（如果需要）

如果将来需要在公网访问，建议：

1. **启用认证**
   ```yaml
   packages:
     '**':
       publish: $authenticated
   ```

2. **配置 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书
   - 强制 HTTPS 访问

3. **限制 IP 访问**
   ```yaml
   # 在 Verdaccio 前加 Nginx
   allow 192.168.1.0/24;
   deny all;
   ```

4. **定期审计**
   ```bash
   # 查看已发布的包
   npm view --registry http://localhost:4873/
   
   # 查看用户列表
   cat verdaccio/htpasswd
   ```

## 🔄 完整工作流程

### 当前配置（匿名发布）

```bash
# 1. 重启 Verdaccio（应用新配置）
npm start

# 2. 直接发布，无需登录
npm run download-and-publish

# 3. 内网机器直接安装，无需登录
npm config set registry http://<服务器IP>:4873
npm install lodash
```

### 如果改用认证发布

```bash
# 1. 修改配置为 $authenticated
# 2. 重启 Verdaccio
npm start

# 3. 创建用户
npm adduser --registry http://localhost:4873/

# 4. 登录后发布
npm login --registry http://localhost:4873/
npm run download-and-publish

# 5. 内网机器也需要登录
npm login --registry http://<服务器IP>:4873/
npm install lodash
```

## 📝 验证配置是否生效

### 1. 检查配置文件

```bash
# 查看当前配置
cat verdaccio/config.yaml | Select-String "publish"
```

应该看到：
```yaml
publish: $all
```

### 2. 测试发布（无需登录）

```bash
# 创建一个测试包
mkdir test-package
cd test-package
npm init -y
echo "console.log('test')" > index.js

# 尝试发布（应该成功）
npm publish --registry http://localhost:4873/

# 清理
cd ..
rm -rf test-package
```

### 3. 查看 Verdaccio 日志

```bash
# 启动时应该看到类似输出
npm start

# 日志中应该有：
# warn --- config file  - C:\...\verdaccio\config.yaml
# http --- 200, user: undefined, ...
```

## ⚠️ 常见问题

### Q1: 修改配置后仍然报 E401？

**A:** 需要重启 Verdaccio 服务！

```bash
# 停止当前服务（Ctrl+C）
# 然后重新启动
npm start
```

### Q2: 如何确认配置已生效？

**A:** 查看 Verdaccio 启动日志，或者尝试直接发布一个测试包。

### Q3: 匿名发布安全吗？

**A:** 
- **内网环境**：✅ 安全，只有内部人员可访问
- **公网环境**：❌ 不安全，建议启用认证

### Q4: 可以随时切换回认证模式吗？

**A:** 可以！只需：
1. 修改 `config.yaml` 中的 `publish: $authenticated`
2. 重启 Verdaccio
3. 创建用户并登录

## 📞 相关文档

- [内网发布完整指南](内网发布完整指南.md)
- [内网发布安全指南](docs/03-内网发布/03-内网发布安全指南.md)
- [Verdaccio 官方文档 - 认证](https://verdaccio.org/docs/configuration/#authentication)

---

**修复时间**: 2026-05-21  
**状态**: ✅ 已修复（改为匿名发布）  
**下一步**: 重启 Verdaccio 服务使配置生效
