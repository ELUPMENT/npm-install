# 🔍 E503 Uplink Down 深度解析

## 📌 什么是 E503 错误？

```
npm error code E503
npm error 503 Service Unavailable - uplink down
```

**含义：**
- **503** = HTTP 状态码，表示"服务不可用"
- **uplink down** = Verdaccio 的上游连接（uplink）断开或无法访问

---

## 🎯 为什么会出现这个问题？

### Verdaccio 的工作机制

Verdaccio 私有仓库有两种工作模式：

#### 模式 1：代理模式（有 uplink）

```
客户端 (npm install/publish)
    ↓
内网 Verdaccio
    ↓
Uplink (上游连接)
    ↓
https://registry.npmjs.org/ (外网)
```

**配置示例：**
```yaml
uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '**':
    proxy: npmjs  # ← 启用代理
```

**工作流程：**
1. 客户端请求包
2. Verdaccio 检查本地存储
3. 如果本地没有 → 通过 uplink 从上游下载
4. 缓存到本地
5. 返回给客户端

---

#### 模式 2：独立模式（无 uplink）

```
客户端 (npm install/publish)
    ↓
内网 Verdaccio
    ↓
本地存储 ✅
```

**配置示例：**
```yaml
packages:
  '**':
    # proxy: npmjs  # ← 注释掉，不启用代理
```

**工作流程：**
1. 客户端请求包
2. Verdaccio 检查本地存储
3. 如果有 → 直接返回
4. 如果没有 → 返回 404（不从上游获取）

---

### E503 出现的场景

#### 场景 1：发布包时（您的情况）⭐⭐⭐

```bash
npm publish --registry http://10.1.11.113:7000
```

**流程：**
1. ✅ npm 将包发送到内网 Verdaccio
2. ✅ Verdaccio 接收包数据
3. ❌ Verdaccio 尝试验证包的完整性
4. ❌ 由于配置了 `proxy: npmjs`，Verdaccio 尝试连接上游
5. ❌ **内网无法访问外网** → 连接超时
6. ❌ 返回 **503 Service Unavailable**

**为什么会验证？**
- Verdaccio 在存储包之前，可能会检查包是否已存在于上游
- 或者尝试验证包的元数据
- 如果 uplink 不可用，就会返回 503

---

#### 场景 2：安装包时

```bash
npm install form-data --registry http://10.1.11.113:7000
```

**流程：**
1. Verdaccio 检查本地是否有 form-data
2. 如果没有 → 尝试通过 uplink 从 npmjs.org 下载
3. **内网无法访问外网** → 连接失败
4. 返回 503

---

#### 场景 3：Checksum 不一致

```
npm error Integrity checksum failed
```

**原因：**
1. 包已经发布到内网 Verdaccio
2. npm 本地缓存中保存了包的 checksum
3. 再次安装时，npm 发现：
   - 本地缓存的 checksum ≠ 服务器返回的 checksum
4. 可能因为：
   - 包被重新发布（版本相同但内容不同）
   - 网络传输中数据损坏
   - Verdaccio 配置变化导致返回不同的元数据

---

## 🔧 解决方案

### 方案 1：修改 Verdaccio 配置（推荐）⭐⭐⭐

**在内网服务器上操作：**

#### 步骤 1：找到配置文件

通常位于：
- Linux: `/etc/verdaccio/config.yaml`
- Docker: 挂载的配置文件
- Windows: `C:\verdaccio\config.yaml`

#### 步骤 2：注释掉 proxy 行

```yaml
# verdaccio/config.yaml

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    # proxy: npmjs  # ← 注释掉这行

  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    # proxy: npmjs  # ← 注释掉这行
```

#### 步骤 3：重启 Verdaccio

```bash
# Linux
sudo systemctl restart verdaccio

# Docker
docker restart verdaccio

# Windows
# 重启 Verdaccio 服务
```

---

### 方案 2：增加 uplink 容错性

如果不能完全禁用 uplink，可以增加容错性：

```yaml
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    timeout: 60s           # 增加超时时间
    max_fails: 1000        # 增加失败容忍度
    fail_timeout: 30m      # 延长失败超时时间
    agent_options:
      keepAlive: true
      maxSockets: 40
      maxFreeSockets: 10
```

---

### 方案 3：清理 npm 缓存（解决 checksum 问题）

```bash
# 方法 1：使用工具脚本
npm run clean-cache

# 方法 2：手动清理
npm cache clean --force

# 方法 3：删除特定包的缓存
rm -rf ~/.npm/form-data
rm -rf ~/.npm/nwsapi
rm -rf ~/.npm/rollup

# 然后重新安装
npm install form-data --registry=http://10.1.11.113:7000
```

---

### 方案 4：使用 --offline 模式

```bash
npm publish --registry http://10.1.11.113:7000 --offline
```

**优点：**
- ✅ 不访问上游仓库
- ✅ 避免 E503 错误

**缺点：**
- ⚠️ 只能发布本地已有的包
- ⚠️ 无法自动解决依赖

---

## 📊 对比分析

### 配置对比

| 配置项 | 代理模式 | 独立模式 |
|--------|---------|---------|
| `proxy: npmjs` | ✅ 启用 | ❌ 禁用 |
| 可以访问外网包 | ✅ 是 | ❌ 否 |
| 需要外网连接 | ✅ 是 | ❌ 否 |
| 适合内网隔离 | ❌ 否 | ✅ 是 |
| E503 错误 | ⚠️ 可能出现 | ✅ 不会出现 |

---

### 错误对比

| 错误类型 | 原因 | 解决方案 |
|---------|------|---------|
| E503 uplink down | 无法访问上游 | 禁用 proxy 或增加容错 |
| Checksum 不一致 | 缓存与服务器不匹配 | 清理缓存后重装 |
| E403 Forbidden | 权限不足 | npm login |
| E409 Conflict | 版本已存在 | 跳过或更新版本 |

---

## 💡 最佳实践

### 内网隔离环境的配置

```yaml
# verdaccio/config.yaml (内网服务器)

storage: ./storage
plugins: ./plugins

# uplink 配置（可选，用于偶尔同步）
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    max_fails: 1000
    fail_timeout: 30m

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    # proxy: npmjs  # ← 内网环境建议禁用

  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    # proxy: npmjs  # ← 内网环境建议禁用

auth:
  htpasswd:
    file: ./htpasswd
    max_users: 1000

logs:
  type: stdout
  format: pretty
  level: http

max_body_size: 100mb
```

---

### 完整的工作流程

#### 在外网环境（准备阶段）

```bash
# 1. 启动本地 Verdaccio
npm start

# 2. 添加需要的依赖
npm run add-deps
# 输入: form-data, nwsapi, rollup 等

# 3. 同步到离线文件夹
npm run sync-to-offline

# 4. 打包
tar -czf offline-packages.tar.gz offline-packages/
```

#### 在内网环境（部署阶段）

```bash
# 1. 传输离线包到内网服务器
scp offline-packages.tar.gz user@internal-server:/tmp/

# 2. 解压到 Verdaccio 存储目录
tar -xzf /tmp/offline-packages.tar.gz -C /var/lib/verdaccio/storage/

# 3. 修改 Verdaccio 配置（禁用 proxy）
# 编辑 /etc/verdaccio/config.yaml

# 4. 重启 Verdaccio
sudo systemctl restart verdaccio

# 5. 测试
npm install form-data --registry=http://10.1.11.113:7000
```

---

## 🔍 诊断工具

### 1. 检查 Verdaccio 配置

```bash
# 查看当前配置
cat /etc/verdaccio/config.yaml | grep -A 5 "packages:"
```

### 2. 测试 uplink 连接

```bash
# 在内网服务器上
curl -I https://registry.npmjs.org/

# 如果超时或失败，说明无法访问外网
```

### 3. 检查 Verdaccio 日志

```bash
# 实时查看日志
tail -f /var/log/verdaccio/verdaccio.log

# 查找错误
grep "uplink" /var/log/verdaccio/verdaccio.log
```

### 4. 验证包完整性

```bash
# 清理缓存
npm cache clean --force

# 重新安装
npm install form-data --registry=http://10.1.11.113:7000

# 检查 checksum
npm view form-data --registry=http://10.1.11.113:7000
```

---

## ❓ 常见问题 FAQ

### Q1: 为什么要注释掉 proxy？

**A:** 
- 内网环境通常无法访问外网
- proxy 会让 Verdaccio 尝试连接上游
- 连接失败会导致 E503 错误
- 注释后，Verdaccio 只使用本地存储

---

### Q2: 注释掉 proxy 后，还能安装包吗？

**A:** 
- ✅ 可以安装**已经发布到内网**的包
- ❌ 无法安装**新的、未发布的**包
- 解决方法：先在外网下载，再传到内网发布

---

### Q3: Checksum 不一致怎么解决？

**A:** 
1. 清理 npm 缓存：`npm cache clean --force`
2. 删除 node_modules：`rm -rf node_modules`
3. 重新安装：`npm install`

---

### Q4: 可以同时保留 uplink 和避免 E503 吗？

**A:** 可以！增加容错性：
```yaml
uplinks:
  npmjs:
    max_fails: 1000
    fail_timeout: 30m
```

这样即使 uplink 失败，Verdaccio 也会继续使用本地缓存。

---

### Q5: 为什么有些包能发布，有些不能？

**A:** 
- 可能是 Verdaccio 的间歇性问题
- 或者某些包触发了 uplink 验证
- 建议统一使用 `--offline` 模式发布

---

## ✨ 总结

### E503 的根本原因

```
内网 Verdaccio 配置了 uplink (proxy)
    ↓
内网无法访问外网
    ↓
Verdaccio 尝试连接上游失败
    ↓
返回 503 Service Unavailable
```

### 解决方案优先级

1. ⭐⭐⭐ **修改配置**：注释掉 `proxy: npmjs`
2. ⭐⭐ **清理缓存**：解决 checksum 不一致
3. ⭐ **使用离线模式**：`--offline` 标志

### 关键要点

- ✅ 内网环境建议禁用 uplink proxy
- ✅ 定期清理 npm 缓存
- ✅ 使用 `--offline` 模式发布
- ✅ 保持 Verdaccio 配置一致

---

*文档版本：v1.0*  
*更新时间：2024-01-01*
