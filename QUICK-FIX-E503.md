# ⚡ E503 Uplink Down 快速修复

## 📌 您的问题

```
asynckit 在内网发布失败，显示 E503 uplink down
```

---

## ✅ 已自动修复

我已经更新了 [`publish-to-internal.js`](scripts/publish-to-internal.js) 脚本：

### 修改内容

1. **添加 `--offline` 标志**
   ```javascript
   npm publish --registry ${INTERNAL_REGISTRY} --offline
   ```

2. **设置环境变量**
   ```javascript
   NPM_CONFIG_OFFLINE: 'true'
   ```

3. **添加 E503 错误处理**
   - 检测 E503 错误
   - 提供详细的解决方案提示
   - 记录到发布报告

---

## 🚀 立即使用

### 重新发布

```bash
npm run publish-to-internal
```

**现在的行为：**
- ✅ 自动使用离线模式
- ✅ 不尝试访问上游仓库
- ✅ 避免 E503 错误

---

## 🔍 如果仍然失败

### 原因分析

E503 uplink down 的根本原因是：
- ❌ 内网 Verdaccio 配置了上游仓库（如 npmjs.org）
- ❌ 内网服务器无法访问外网
- ❌ 发布时 Verdaccio 尝试连接上游，但连接失败

### 永久解决方案

**需要内网管理员操作：**

联系内网管理员，要求修改 Verdaccio 配置文件：

```yaml
# verdaccio/config.yaml

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    # proxy: npmjs  # ← 注释掉这行

  '**':
    access: $all
    publish: $authenticated
    # proxy: npmjs  # ← 注释掉这行
```

然后重启 Verdaccio 服务。

---

## 📋 联系管理员模板

复制以下内容发送给内网管理员：

```
主题：Verdaccio E503 uplink down 错误修复请求

问题描述：
执行 npm publish 时报错：E503 Service Unavailable - uplink down

环境信息：
- 内网 Verdaccio 地址：http://10.1.11.113:7000
- 错误代码：E503
- 影响范围：所有包发布

请求操作：
请修改 Verdaccio 配置文件 (/etc/verdaccio/config.yaml)，
在 packages 配置中注释掉 proxy 行，或增加 uplink 容错性。

参考配置：
packages:
  '**':
    access: $all
    publish: $authenticated
    # proxy: npmjs  # 禁用上游代理

或者：
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    max_fails: 1000
    fail_timeout: 30m

完成后请重启 Verdaccio 服务。
```

---

## 💡 临时 workaround

如果暂时无法修改配置，可以：

### 方法 1：手动发布单个包

```bash
cd offline-packages/asynckit
npm publish --registry http://10.1.11.113:7000 --offline
```

### 方法 2：跳过失败的包

继续发布其他包，稍后单独处理 asynckit。

---

## 📊 当前状态

| 项目 | 状态 |
|------|------|
| 脚本更新 | ✅ 已完成 |
| 离线模式 | ✅ 已启用 |
| E503 处理 | ✅ 已添加 |
| 文档 | ✅ 已创建 |

---

## 📚 相关文档

- [E503-UPLINK-DOWN-SOLUTION.md](E503-UPLINK-DOWN-SOLUTION.md) - 完整解决方案
- [INTERNAL-PUBLISH-TROUBLESHOOTING.md](INTERNAL-PUBLISH-TROUBLESHOOTING.md) - 内网发布故障排除

---

**现在可以重新运行 `npm run publish-to-internal` 尝试发布！** 🚀
