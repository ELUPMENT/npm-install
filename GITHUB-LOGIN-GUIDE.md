# GitHub 登录和远程仓库配置指南

## 📋 概述

本指南帮助你配置 GitHub 登录、设置远程仓库，并解决常见的认证问题。

---

## 🔐 GitHub 认证方式

GitHub 自 2021 年 8 月 13 日起**不再支持密码认证**，必须使用以下两种方式之一：

### 方式一：Personal Access Token（推荐）✅

#### 1. 生成 Personal Access Token

**步骤：**

1. 访问 GitHub Token 设置页面：
   ```
   https://github.com/settings/tokens
   ```

2. 点击 **"Generate new token (classic)"**

3. 填写信息：
   - **Note**: 给 Token 起个名字（如 "npm-install-project"）
   - **Expiration**: 选择过期时间（建议 90 天或更长）
   - **Scopes**: 勾选所需权限
     - ✅ `repo` (完整仓库访问权限)
     - ✅ `workflow` (如果需要操作 GitHub Actions)
     - ✅ `read:org` (如果需要访问组织)

4. 点击 **"Generate token"**

5. **重要**：复制生成的 Token（只会显示一次！）
   ```
   ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

#### 2. 配置 Git 使用 Token

**方法 A：交互式配置（推荐）**

```bash
# 运行自动化脚本
setup-github-login.bat
```

脚本会引导你：
- 配置用户名和邮箱
- 添加远程仓库
- 首次推送时输入 Token

**方法 B：手动配置**

```bash
# 1. 配置凭证存储（避免每次输入）
git config --global credential.helper store

# 2. 添加远程仓库
git remote add origin https://github.com/username/repository.git

# 3. 首次推送（会提示输入用户名和密码）
git push -u origin master

# 输入：
# Username: 你的 GitHub 用户名
# Password: 粘贴刚才生成的 Token
```

**方法 C：直接在 URL 中包含 Token（不推荐，不安全）**

```bash
# ⚠️ 警告：Token 会以明文存储在 .git/config 中
git remote add origin https://USERNAME:TOKEN@github.com/username/repository.git
```

---

### 方式二：SSH Key（高级用户）🔑

#### 1. 生成 SSH Key

```bash
# 检查是否已有 SSH Key
ls ~/.ssh/id_rsa.pub

# 如果不存在，生成新的 SSH Key
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 按提示操作：
# - 文件位置：直接回车（使用默认位置）
# - 密码短语：可选（建议设置）
```

#### 2. 将公钥添加到 GitHub

```bash
# 复制公钥内容
type %USERPROFILE%\.ssh\id_rsa.pub

# 或者使用 clip 命令复制到剪贴板
clip < %USERPROFILE%\.ssh\id_rsa.pub
```

**添加到 GitHub：**

1. 访问：https://github.com/settings/keys
2. 点击 **"New SSH key"**
3. 填写：
   - **Title**: 描述性名称（如 "Windows Laptop"）
   - **Key**: 粘贴公钥内容
4. 点击 **"Add SSH key"**

#### 3. 测试 SSH 连接

```bash
ssh -T git@github.com

# 成功输出：
# Hi username! You've successfully authenticated, but GitHub does not provide shell access.
```

#### 4. 使用 SSH 地址添加远程仓库

```bash
# 添加远程仓库（使用 SSH 地址）
git remote add origin git@github.com:username/repository.git

# 推送
git push -u origin master
```

---

## 🚀 快速开始

### 场景一：新建项目并推送到 GitHub

```bash
# 1. 初始化 Git 仓库
git init

# 2. 创建 .gitignore（如果还没有）
echo "node_modules/" > .gitignore
echo "offline-packages/" >> .gitignore

# 3. 添加所有文件
git add .

# 4. 提交
git commit -m "initial commit"

# 5. 在 GitHub 上创建新仓库
#    访问：https://github.com/new
#    记录仓库地址，例如：https://github.com/username/my-project.git

# 6. 添加远程仓库
git remote add origin https://github.com/username/my-project.git

# 7. 推送（首次会要求输入 Token）
git push -u origin master
```

### 场景二：已有本地项目，添加远程仓库

```bash
# 1. 检查当前远程仓库
git remote -v

# 2. 如果有旧的远程仓库，先删除
git remote remove origin

# 3. 添加新的远程仓库
git remote add origin https://github.com/username/repository.git

# 4. 推送
git push -u origin master
```

### 场景三：克隆现有仓库

```bash
# HTTPS 方式
git clone https://github.com/username/repository.git

# SSH 方式
git clone git@github.com:username/repository.git

# 进入目录
cd repository

# 后续操作无需再次输入认证信息
git pull
git push
```

---

## ⚙️ 使用自动化脚本

本项目提供了自动化配置脚本：

### setup-github-login.bat

**功能：**
- ✅ 检查和配置 Git 用户信息
- ✅ 添加/修改/删除远程仓库
- ✅ 支持 HTTPS 和 SSH 两种认证方式
- ✅ 自动保存凭证（HTTPS 模式）
- ✅ 测试连接和推送

**使用方法：**

```bash
# Windows 命令行
setup-github-login.bat

# 或者直接双击运行
```

**操作流程：**

1. 检查当前 Git 配置
2. （可选）修改用户名和邮箱
3. 选择操作：
   - 添加新的远程仓库
   - 修改现有远程仓库
   - 查看当前远程仓库
   - 删除远程仓库
4. 选择认证方式（HTTPS 或 SSH）
5. 输入远程仓库 URL
6. （可选）测试推送

---

## 🔧 常见问题和解决方案

### 问题 1：每次推送都要输入用户名和密码

**原因**：未配置凭证存储

**解决**：

```bash
# Windows - 使用凭证管理器
git config --global credential.helper wincred

# 或者使用 store（明文存储，安全性较低）
git config --global credential.helper store

# macOS
git config --global credential.helper osxkeychain

# Linux
git config --global credential.helper cache
```

### 问题 2：认证失败 - "Support for password authentication was removed"

**错误信息**：
```
remote: Support for password authentication was removed on August 13, 2021.
remote: Please see https://docs.github.com/en/get-started/getting-started-with-git/about-remote-repositories#cloning-with-https-urls for information on currently recommended modes of authentication.
fatal: Authentication failed
```

**原因**：使用了 GitHub 密码而不是 Personal Access Token

**解决**：

```bash
# 1. 生成 Personal Access Token（见上文）

# 2. 清除旧凭证
git credential-manager-core erase

# 或使用 Windows 凭据管理器：
# - 打开"控制面板" > "凭据管理器"
# - 找到 "git:https://github.com"
# - 删除该条目

# 3. 重新推送，使用 Token 作为密码
git push
```

### 问题 3：Permission denied (publickey)

**错误信息**：
```
git@github.com: Permission denied (publickey).
fatal: Could not read from remote repository.
```

**原因**：SSH Key 未配置或配置错误

**解决**：

```bash
# 1. 检查 SSH Key 是否存在
ls ~/.ssh/id_rsa.pub

# 2. 如果不存在，生成新的 SSH Key
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 3. 启动 ssh-agent
eval "$(ssh-agent -s)"

# 4. 添加 SSH Key 到 agent
ssh-add ~/.ssh/id_rsa

# 5. 将公钥添加到 GitHub（见上文）

# 6. 测试连接
ssh -T git@github.com
```

### 问题 4：远程仓库已存在

**错误信息**：
```
fatal: remote origin already exists.
```

**解决**：

```bash
# 方法一：修改现有远程仓库
git remote set-url origin https://github.com/username/new-repository.git

# 方法二：删除后重新添加
git remote remove origin
git remote add origin https://github.com/username/repository.git

# 方法三：使用不同的名称
git remote add upstream https://github.com/username/repository.git
```

### 问题 5：推送被拒绝 - 非快进合并

**错误信息**：
```
! [rejected]        master -> master (non-fast-forward)
error: failed to push some refs to 'https://github.com/username/repository.git'
```

**原因**：远程仓库有本地没有的提交

**解决**：

```bash
# 方法一：先拉取再推送（推荐）
git pull origin master
git push origin master

# 方法二：强制推送（⚠️ 危险，会覆盖远程历史）
git push --force origin master
```

### 问题 6：大文件推送失败

**错误信息**：
```
remote: error: File xxx is 100 MB; this exceeds GitHub's file size limit of 100 MB
```

**解决**：

```bash
# 1. 确保 .gitignore 已正确配置
#    参考：GIT-IGNORE-GUIDE.md

# 2. 从 Git 历史中移除大文件
git rm --cached large-file.zip
git commit -m "remove large file"

# 3. 如果已经推送到远程，需要重写历史（谨慎操作）
git filter-branch --force --index-filter \
  'git rm -r --cached --ignore-unmatch large-file.zip' \
  --prune-empty HEAD

# 4. 强制推送
git push --force
```

---

## 📊 最佳实践

### ✅ 应该做的

1. **使用 Personal Access Token 而非密码**
   - 更安全
   - 可以设置权限范围
   - 可以随时撤销

2. **配置凭证存储**
   ```bash
   git config --global credential.helper wincred
   ```

3. **定期更新 Token**
   - 设置提醒
   - 旧 Token 过期前生成新 Token

4. **限制 Token 权限**
   - 只授予必要的权限
   - 为不同项目使用不同的 Token

5. **使用 .gitignore**
   - 避免提交敏感信息
   - 避免提交大文件
   - 参考：`.gitignore` 文件

### ❌ 不应该做的

1. **不要在代码中硬编码 Token**
   ```javascript
   // ❌ 错误
   const token = "ghp_xxxxxxxxxxxx";
   
   // ✅ 正确
   const token = process.env.GITHUB_TOKEN;
   ```

2. **不要分享 Token**
   - Token 等同于密码
   - 泄露后立即撤销

3. **不要使用过长的 Token 有效期**
   - 建议 30-90 天
   - 定期轮换

4. **不要提交 `.env` 文件**
   ```gitignore
   # .gitignore
   .env
   *.pem
   ```

---

## 🔍 诊断命令

```bash
# 查看当前用户配置
git config --global user.name
git config --global user.email

# 查看远程仓库
git remote -v

# 查看凭证配置
git config --global credential.helper

# 测试 GitHub 连接（SSH）
ssh -T git@github.com

# 查看当前分支
git branch

# 查看提交历史
git log --oneline

# 检查文件是否被忽略
git check-ignore -v node_modules/
```

---

## 📦 内网环境特殊考虑

如果你的项目需要在内网隔离环境中使用：

### 方案一：使用 GitHub Enterprise

```bash
# 配置企业版 GitHub
git config --global url."https://github.company.com/".insteadOf "https://github.com/"

# 添加远程仓库
git remote add origin https://github.company.com/username/repository.git
```

### 方案二：镜像仓库

```bash
# 1. 在外网克隆仓库
git clone https://github.com/username/repository.git

# 2. 打包
tar -czf repository.tar.gz repository/

# 3. 传输到内网

# 4. 在内网解压并添加内网远程仓库
tar -xzf repository.tar.gz
cd repository
git remote set-url origin http://内网-git-server/username/repository.git
git push -u origin master
```

### 方案三：使用本项目的离线包管理

参考：[README.md](./README.md) 中的离线包管理方案

---

## 🔗 相关资源

- [GitHub 官方文档 - 认证](https://docs.github.com/en/authentication)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub SSH Keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Git 凭证存储](https://git-scm.com/docs/gitcredentials)
- [本项目 Git Ignore 指南](./GIT-IGNORE-GUIDE.md)
- [本项目快速修复指南](./GIT-IGNORE-QUICK-FIX.md)

---

## 📞 遇到问题？

如果遇到 GitHub 登录或认证相关的问题：

1. 运行诊断脚本：
   ```bash
   setup-github-login.bat
   ```

2. 检查本文档的"常见问题"部分

3. 查看 GitHub 官方文档

4. 联系项目维护者

---

**最后更新**: 2026-04-27  
**维护者**: 项目管理团队