# GitHub 登录快速参考

## ⚡ 3 分钟快速配置

### 第 1 步：生成 Personal Access Token

1. 访问：https://github.com/settings/tokens
2. 点击 **"Generate new token (classic)"**
3. 勾选权限：✅ `repo`
4. 点击 **"Generate token"**
5. **复制 Token**（格式：`ghp_xxxxxxxxxxxx`）

### 第 2 步：运行配置脚本

```bash
setup-github-login.bat
```

按提示操作：
- 输入 GitHub 用户名和邮箱
- 选择 "添加新的远程仓库"
- 选择 "HTTPS + Personal Access Token"
- 输入仓库地址：`https://github.com/username/repository.git`

### 第 3 步：首次推送

```bash
git push -u origin master
```

当提示输入密码时，**粘贴 Token**（不是 GitHub 密码）

---

## 📋 常用命令速查

| 操作 | 命令 |
|------|------|
| 查看远程仓库 | `git remote -v` |
| 添加远程仓库 | `git remote add origin URL` |
| 修改远程仓库 | `git remote set-url origin NEW_URL` |
| 删除远程仓库 | `git remote remove origin` |
| 推送到远程 | `git push origin master` |
| 从远程拉取 | `git pull origin master` |
| 配置凭证存储 | `git config --global credential.helper wincred` |
| 查看用户配置 | `git config user.name` / `git config user.email` |

---

## 🔑 认证方式对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Personal Access Token** | ✅ 简单易用<br>✅ 可设置权限<br>✅ 可随时撤销 | ⚠️ 需要定期更新 | 大多数用户 |
| **SSH Key** | ✅ 无需每次输入密码<br>✅ 长期有效 | ⚠️ 配置较复杂 | 高级用户 |

---

## ⚠️ 常见错误

### 错误 1：密码认证已移除

```
remote: Support for password authentication was removed
```

**解决**：使用 Personal Access Token 代替密码

### 错误 2：权限被拒绝

```
Permission denied (publickey)
```

**解决**：配置 SSH Key 或使用 HTTPS + Token

### 错误 3：远程仓库已存在

```
fatal: remote origin already exists
```

**解决**：
```bash
git remote set-url origin NEW_URL
```

---

## 🔍 快速诊断

```bash
# 检查配置
git config user.name
git config user.email
git remote -v

# 测试连接（SSH）
ssh -T git@github.com

# 检查文件是否被忽略
git check-ignore -v node_modules/
```

---

## 📖 详细文档

- 完整指南：[GITHUB-LOGIN-GUIDE.md](./GITHUB-LOGIN-GUIDE.md)
- Git Ignore 指南：[GIT-IGNORE-GUIDE.md](./GIT-IGNORE-GUIDE.md)
- 快速修复：[GIT-IGNORE-QUICK-FIX.md](./GIT-IGNORE-QUICK-FIX.md)

---

**提示**：Token 只会显示一次，请妥善保存！