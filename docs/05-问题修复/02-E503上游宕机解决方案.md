# 🔧 E503 Uplink Down 错误完整解决方案

## 📌 错误信息

```
npm error code E503
npm error 503 Service Unavailable - uplink down
```

**受影响的包：** asynckit（以及其他所有包）

---

## 🔍 问题根源

### 什么是 Uplink？

Verdaccio 私有仓库可以配置**上游仓库（uplink）**，例如：
- npmjs.org（官方 NPM 仓库）
- 其他私有仓库

当 Verdaccio 本地没有某个包时，会尝试从上游仓库获取。

### E503 错误原因

```
E503 = Service Unavailable (服务不可用)
uplink down = 上游连接断开
```

**可能的原因：**

1. ❌ **内网服务器无法访问外网**
   - 防火墙阻止
   - 网络隔离
   - 代理配置错误

2. ❌ **Verdaccio 配置问题**
   - uplink URL 错误
   - 超时设置太短
   - 最大失败次数限制

3. ❌ **上游仓库本身不可用**
   - npmjs.org 暂时宕机
   - 网络连接问题

4. ❌ **DNS 解析失败**
   - 内网 DNS 无法解析外部域名

---

## ✅ 解决方案

### 方案 1：修改 Verdaccio 配置（推荐）⭐⭐⭐

**需要内网管理员操作**

#### 步骤 1：找到 Verdaccio 配置文件

通常位于：
- Linux: `/etc/verdaccio/config.yaml`
- Windows: `C:\verdaccio\config.yaml`
- Docker: 挂载的配置文件

#### 步骤 2：修改 uplink 配置

**选项 A：增加容错性（如果偶尔需要访问外网）**

```yaml
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    max_fails: 1000        # 增加失败容忍度
    fail_timeout: 30m      # 延长失败超时时间
    timeout: 60s           # 增加超时时间
    agent_options:
      keepAlive: true
      maxSockets: 40
      maxFreeSockets: 10
```

**选项 B：完全禁用上游代理（内网完全隔离）**

```yaml
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    max_fails: 1000
    fail_timeout: 30m

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    # proxy: npmjs  # ← 注释掉这行，不从上游获取

  '**':
    access: $all
    publish: $authenticated
    # proxy: npmjs  # ← 注释掉这行，不从上游获取
```

**选项 C：使用国内镜像作为上游**

```yaml
uplinks:
  taobao:
    url: https://registry.npmmirror.com/
    max_fails: 1000
    fail_timeout: 30m

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    proxy: taobao

  '**':
    access: $all
    publish: $authenticated
    proxy: taobao
```

#### 步骤 3：重启 Verdaccio 服务

```bash
# Linux
sudo systemctl restart verdaccio

# Docker
docker restart verdaccio

# Windows
# 重启 Verdaccio 服务或进程
```

---

### 方案 2：使用离线模式发布（临时方案）⭐⭐

我已经更新了发布脚本，自动使用 `--offline` 模式：

```bash
npm run publish-to-internal
```

**现在的行为：**
- ✅ 自动添加 `--offline` 标志
- ✅ 不尝试访问上游仓库
- ✅ 只发布本地已有的包

**局限性：**
- ⚠️ 只能发布已经下载到本地的包
- ⚠️ 无法发布新包（需要从外网下载）

---

### 方案 3：手动发布单个包

如果自动发布失败，可以尝试手动发布：

```bash
# 进入包的目录
cd offline-packages/asynckit

# 使用离线模式发布
npm publish --registry http://10.1.11.113:7000 --offline

# 或者设置环境变量
set NPM_CONFIG_OFFLINE=true
npm publish --registry http://10.1.11.113:7000
```

---

### 方案 4：检查网络连接

**测试内网服务器是否可以访问外网：**

```bash
# 在内网服务器上执行
curl https://registry.npmjs.org/

# 或使用 PowerShell
Invoke-WebRequest https://registry.npmjs.org/
```

**如果无法访问：**

1. 检查防火墙规则
2. 检查代理设置
3. 联系网络管理员

---

### 方案 5：预下载所有依赖

如果内网完全隔离，建议在外网环境中预下载所有依赖：

```bash
# 1. 在有外网的环境中
npm run add-deps
# 输入需要的包名

npm run sync-to-offline

# 2. 将 offline-packages 文件夹复制到内网

# 3. 在内网中发布
npm run publish-to-internal
```

---

## 🛠️ 诊断工具

### 1. 检查 Verdaccio 配置

```bash
# 查看当前配置
cat /etc/verdaccio/config.yaml

# 或
docker exec verdaccio cat /verdaccio/conf/config.yaml
```

### 2. 测试上游连接

```bash
# 测试 npmjs.org
curl -I https://registry.npmjs.org/

# 应该返回 HTTP 200
```

### 3. 检查 Verdaccio 日志

```bash
# 查看实时日志
tail -f /var/log/verdaccio/verdaccio.log

# 或 Docker
docker logs -f verdaccio
```

**查找类似这样的错误：**
```
warn --- uplink 'npmjs' is down, some packages might not be available
error --- uplink 'npmjs' responded with 503
```

---

## 📋 完整的工作流程（内网隔离环境）

### 在外网环境（有网络）

```bash
# 1. 启动本地 Verdaccio
npm start

# 2. 添加需要的依赖
npm run add-deps
# 输入: asynckit, rollup, 等

# 3. 同步到离线文件夹
npm run sync-to-offline

# 4. 打包离线文件夹
tar -czf offline-packages.tar.gz offline-packages/
```

### 在内网环境（无网络）

```bash
# 1. 传输离线包到内网服务器
scp offline-packages.tar.gz user@internal-server:/tmp/

# 2. 解压
tar -xzf /tmp/offline-packages.tar.gz

# 3. 配置内网 Verdaccio（禁用 uplink）
# 编辑 config.yaml，注释掉 proxy 行

# 4. 重启 Verdaccio
sudo systemctl restart verdaccio

# 5. 发布到内网
npm run publish-to-internal
```

---

## 💡 常见问题 FAQ

### Q1: 为什么会有 uplink down 错误？

**A:** 因为内网 Verdaccio 配置了上游仓库（如 npmjs.org），但内网服务器无法访问外网。

---

### Q2: --offline 模式有什么限制？

**A:** 
- ✅ 可以发布已下载的包
- ❌ 无法发布新包（需要先从外网下载）
- ❌ 无法自动解决依赖

---

### Q3: 如何永久解决这个问题？

**A:** 
1. **最佳方案：** 修改 Verdaccio 配置，禁用或调整 uplink
2. **替代方案：** 建立内网镜像仓库，定期同步外网包

---

### Q4: 只有 asynckit 报错吗？

**A:** 不是！所有包都会遇到同样的问题。asynckit 只是第一个被尝试发布的包。

---

### Q5: 可以使用国内镜像吗？

**A:** 可以！如果内网可以访问国内网络，建议使用淘宝镜像：

```yaml
uplinks:
  taobao:
    url: https://registry.npmmirror.com/
```

---

## 📞 联系内网管理员时需要提供的信息

```
问题：Verdaccio 发布包时报 E503 uplink down 错误

环境：
- 内网地址：http://10.1.11.113:7000
- 受影响的操作：npm publish
- 错误代码：E503
- 错误信息：Service Unavailable - uplink down

请求：
1. 检查 Verdaccio 配置文件中的 uplink 设置
2. 确认内网服务器是否可以访问 https://registry.npmjs.org/
3. 如果不能访问，请修改配置禁用 upstream proxy
4. 或者增加 uplink 的容错性（max_fails, fail_timeout）

参考配置：
packages:
  '**':
    access: $all
    publish: $authenticated
    # proxy: npmjs  # 注释掉这行
```

---

## ✨ 总结

| 方案 | 难度 | 效果 | 适用场景 |
|------|------|------|---------|
| 修改 Verdaccio 配置 | 中 | ⭐⭐⭐⭐⭐ | 长期解决方案 |
| 使用 --offline 模式 | 低 | ⭐⭐⭐ | 临时应急 |
| 手动发布 | 低 | ⭐⭐ | 少量包 |
| 预下载依赖 | 中 | ⭐⭐⭐⭐ | 内网隔离环境 |

**推荐操作顺序：**
1. ✅ 立即：使用更新后的脚本（已添加 --offline）
2. ✅ 短期：联系管理员修改 Verdaccio 配置
3. ✅ 长期：建立完善的内网镜像机制

---

*文档版本：v1.0*  
*更新时间：2024-01-01*
