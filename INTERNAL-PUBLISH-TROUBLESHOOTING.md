# 🔧 内网发布故障排除指南

## 📌 常见问题

执行 `npm run publish-to-internal` 时可能遇到的错误及解决方案。

---

## ❌ 错误 1: ECONNREFUSED (连接被拒绝)

### 症状
```
npm error code ECONNREFUSED
npm error FetchError: request to http://xxx:4873/xxx failed
```

### 原因
- 内网 NPM 仓库服务未运行
- 网络不通或防火墙阻止
- 地址配置错误

### 解决方案

#### 步骤 1: 检查内网仓库是否可访问

```bash
# Windows PowerShell
Test-NetConnection -ComputerName <内网IP> -Port 4873

# 或使用 curl
curl http://<内网IP>:4873
```

#### 步骤 2: 验证配置的内网地址

```bash
# 查看当前配置
npm run configure-internal
```

#### 步骤 3: 联系内网管理员

确认：
- ✅ 内网 NPM 仓库正在运行
- ✅ 防火墙允许访问
- ✅ 地址和端口正确

---

## ❌ 错误 2: E403 (权限不足)

### 症状
```
npm error code E403
npm error 403 Forbidden
```

### 原因
- 未登录到内网仓库
- 登录凭证过期
- 没有发布权限

### 解决方案

#### 步骤 1: 登录到内网仓库

```bash
npm login --registry http://<内网IP>:4873
```

按提示输入：
- Username: 您的用户名
- Password: 您的密码
- Email: 您的邮箱

#### 步骤 2: 验证登录状态

```bash
npm whoami --registry http://<内网IP>:4873
```

应该显示您的用户名。

#### 步骤 3: 重新发布

```bash
npm run publish-to-internal
```

---

## ❌ 错误 3: E404 (未找到)

### 症状
```
npm error code E404
npm error 404 Not Found
```

### 原因
- 内网仓库地址配置错误
- 仓库不存在
- URL 路径错误

### 解决方案

#### 步骤 1: 检查配置

```bash
npm run configure-internal
```

确认地址格式正确，例如：
- ✅ `http://192.168.1.100:4873`
- ✅ `http://npm.internal.company.com:4873`
- ❌ `http://your-internal-npm-registry:4873` (占位符)

#### 步骤 2: 测试地址

```bash
# 浏览器访问
http://<内网IP>:4873

# 或命令行
curl http://<内网IP>:4873
```

应该能看到 Verdaccio 界面或返回 JSON。

---

## ❌ 错误 4: E409 (版本冲突)

### 症状
```
npm error code E409
npm error Conflict - package@version already exists
```

### 原因
- 该包的此版本已存在于内网仓库
- 这是**正常现象**，不是错误

### 解决方案

**无需处理！** 脚本会自动跳过已存在的版本：

```
⚠ package@version 已存在，跳过发布
```

这被视为**成功**，不会计入失败数量。

---

## ❌ 错误 5: 缺少 package.json

### 症状
```
✗ package-name 发布失败: 缺少 package.json 文件
```

### 原因
- 离线包目录结构不正确
- 同步时出错

### 解决方案

#### 步骤 1: 检查离线包目录

```bash
ls offline-packages/<package-name>/
# 应该看到 package.json
```

#### 步骤 2: 重新同步

```bash
npm run sync-to-offline
```

#### 步骤 3: 验证目录结构

正确的结构应该是：
```
offline-packages/
├── lodash/
│   ├── package.json
│   ├── index.js
│   └── ...
├── at_types_node/
│   ├── package.json
│   ├── index.d.ts
│   └── ...
```

---

## ❌ 错误 6: 配置地址仍是占位符

### 症状
```
目标仓库: http://your-internal-npm-registry:4873
```

### 原因
- 忘记修改内网仓库地址
- 使用了默认的占位符

### 解决方案

#### 使用配置向导（推荐）

```bash
npm run configure-internal
```

按提示输入实际的内网地址。

#### 或手动修改

编辑 [`scripts/publish-to-internal.js`](scripts/publish-to-internal.js) 第 6 行：

```javascript
// 修改前
const INTERNAL_REGISTRY = 'http://your-internal-npm-registry:4873';

// 修改后
const INTERNAL_REGISTRY = 'http://192.168.1.100:4873'; // 替换为实际地址
```

---

## 🔍 诊断工具

### 1. 检查内网连接

创建测试脚本：

```bash
# 测试内网仓库是否可访问
curl http://<内网IP>:4873/-/ping

# 应该返回: {}
```

### 2. 验证登录状态

```bash
npm whoami --registry http://<内网IP>:4873
```

### 3. 检查离线包

```bash
npm run diagnose
```

---

## 📋 完整的工作流程

### 标准发布流程

```bash
# 1. 配置内网地址（首次使用时）
npm run configure-internal

# 2. 确保有离线包
npm run sync-to-offline

# 3. 登录到内网仓库（首次或凭证过期时）
npm login --registry http://<内网IP>:4873

# 4. 验证登录
npm whoami --registry http://<内网IP>:4873

# 5. 发布到内网
npm run publish-to-internal

# 6. 查看发布报告
cat publish-report.json
```

---

## 💡 常见问题 FAQ

### Q1: 如何知道内网仓库的地址？

**A:** 询问您的内网管理员或 DevOps 团队。常见格式：
- `http://192.168.x.x:4873`
- `http://npm.internal.company.com:4873`
- `http://registry.company.local:4873`

---

### Q2: E409 错误需要处理吗？

**A:** **不需要！** E409 表示版本已存在，脚本会自动跳过并计为成功。这是正常现象。

---

### Q3: 如何批量更新多个包的版本？

**A:** 
1. 在本地更新版本号
2. 重新同步到离线文件夹
3. 重新发布

```bash
npm run sync-to-offline
npm run publish-to-internal
```

---

### Q4: 发布失败后需要重新发布所有包吗？

**A:** **不需要！** 脚本会：
- ✅ 跳过已存在的版本（E409）
- ✅ 继续发布其他包
- ✅ 生成详细报告

只需修复失败的包，然后重新运行即可。

---

### Q5: 如何在不同的内网环境使用？

**A:** 每次切换环境时：

```bash
npm run configure-internal
# 输入新的内网地址
```

---

## 🛠️ 快速修复清单

遇到问题时，按以下顺序检查：

- [ ] 内网地址配置正确（不是占位符）
- [ ] 内网仓库可访问（网络通畅）
- [ ] 已登录到内网仓库
- [ ] 离线包目录结构正确
- [ ] 有足够的发布权限
- [ ] 防火墙允许访问

---

## 📞 获取帮助

如果以上方法都无法解决：

1. **查看详细日志**
   ```bash
   npm run publish-to-internal 2>&1 | tee publish-log.txt
   ```

2. **检查发布报告**
   ```bash
   cat publish-report.json
   ```

3. **联系内网管理员**
   - 提供错误信息
   - 提供内网地址
   - 提供登录用户名

---

## ✨ 总结

| 错误码 | 含义 | 解决方案 |
|--------|------|---------|
| ECONNREFUSED | 连接被拒绝 | 检查网络和地址 |
| E403 | 权限不足 | 重新登录 |
| E404 | 未找到 | 检查地址配置 |
| E409 | 版本冲突 | 自动跳过，无需处理 |

**记住：**
1. ✅ 先配置内网地址
2. ✅ 再登录到仓库
3. ✅ 最后执行发布

---

*文档版本：v1.0*  
*更新时间：2024-01-01*
