# Git 依赖文件忽略指南

## 📋 概述

本项目是 NPM 离线包管理工具，包含大量依赖文件。为避免 Git 仓库体积过大和冲突，需要正确配置 `.gitignore` 文件。

## 🎯 需要忽略的文件/目录

### 1. **核心依赖目录**（必须忽略）

| 路径 | 说明 | 原因 |
|------|------|------|
| `node_modules/` | npm 安装的依赖包 | 体积巨大（数百MB），可通过 `npm install` 重新生成 |
| `offline-packages/` | 离线同步的依赖包 | 体积巨大，可通过 `npm run sync-to-offline` 重新生成 |
| `verdaccio/storage/` | Verdaccio 私有仓库存储 | 包含所有发布的包数据，体积极大 |

### 2. **日志和临时文件**（建议忽略）

| 路径 | 说明 |
|------|------|
| `sync-log.json` | 同步日志，包含本地路径信息 |
| `npm-debug.log*` | npm 调试日志 |
| `*.tmp`, `*.temp` | 临时文件 |

### 3. **IDE 配置**（个人配置，不应提交）

| 路径 | 说明 |
|------|------|
| `.vscode/` | VS Code 工作区配置 |
| `.idea/` | JetBrains IDE 配置 |

### 4. **操作系统文件**（自动生成的垃圾文件）

| 路径 | 说明 |
|------|------|
| `.DS_Store` | macOS 文件夹配置 |
| `Thumbs.db` | Windows 缩略图缓存 |
| `Desktop.ini` | Windows 文件夹配置 |

## 🚀 快速开始

### 首次配置（如果之前已提交过依赖文件）

```bash
# 方法一：使用自动化脚本（推荐）
cleanup-git-dependencies.bat

# 方法二：手动执行命令
git rm -r --cached node_modules/
git rm -r --cached offline-packages/
git rm -r --cached verdaccio/storage/
git rm --cached sync-log.json

# 提交 .gitignore 文件
git add .gitignore
git commit -m "chore: 添加 .gitignore 并清理依赖文件"
```

### 新项目初始化

```bash
# 1. 确保 .gitignore 已存在
# 2. 初始化 Git 仓库
git init

# 3. 添加所有文件（会自动忽略 .gitignore 中的内容）
git add .

# 4. 提交
git commit -m "initial commit"
```

## 📊 .gitignore 配置详解

### 完整配置示例

```
# --- 依赖相关文件（核心忽略项）---
node_modules/
offline-packages/
.npm/
npm-debug.log*

# --- Verdaccio 相关 ---
verdaccio/storage/
verdaccio/logs/

# --- 临时文件和日志 ---
sync-log.json
*.tmp
*.temp

# --- IDE 和编辑器 ---
.vscode/
.idea/

# --- 操作系统文件 ---
.DS_Store
Thumbs.db
Desktop.ini

# --- 构建输出 ---
dist/
build/
*.tgz
```

## ⚠️ 常见错误和解决方案

### 错误 1：文件已被追踪，添加到 .gitignore 无效

**问题**：
```bash
# 即使添加到 .gitignore，git status 仍显示修改
git status
# Changes not staged for commit:
#   modified:   node_modules/some-package/index.js
```

**原因**：Git 已经在追踪这些文件，`.gitignore` 只对未追踪的文件生效。

**解决**：
```bash
# 从 Git 缓存中移除（不删除本地文件）
git rm -r --cached node_modules/
git rm -r --cached offline-packages/

# 或者使用自动化脚本
cleanup-git-dependencies.bat

# 然后提交
git add .gitignore
git commit -m "chore: 停止追踪依赖文件"
```

### 错误 2：误提交了 large files

**问题**：已经提交了 `node_modules/` 到远程仓库。

**解决**：
```bash
# 1. 从 Git 历史中彻底删除（谨慎操作！）
git filter-branch --force --index-filter \
  'git rm -r --cached --ignore-unmatch node_modules/' \
  --prune-empty HEAD

# 2. 强制推送到远程（会重写历史）
git push origin --force --all

# ⚠️ 警告：这会重写 Git 历史，团队成员需要重新克隆仓库
```

### 错误 3：团队协作时 .gitignore 不一致

**问题**：不同成员的 `.gitignore` 配置不同，导致冲突。

**解决**：
```bash
# 1. 统一 .gitignore 文件
# 2. 所有人都执行清理脚本
cleanup-git-dependencies.bat

# 3. 提交统一的配置
git add .gitignore
git commit -m "chore: 统一 .gitignore 配置"
git push
```

## 🔧 高级配置

### 保留特定文件

如果想忽略整个目录但保留某个文件：

```
# 忽略所有 .log 文件
*.log

# 但保留重要的日志
!important.log
```

### 忽略除特定类型外的所有文件

```
# 忽略 docs/ 下的所有内容
docs/*

# 但保留 README.md
!docs/README.md
```

### 使用全局 .gitignore

对于所有项目都适用的规则（如 IDE 配置），可以设置全局忽略：

```bash
# 创建全局 .gitignore
git config --global core.excludesfile ~/.gitignore_global

# 编辑全局文件
# 添加：
# .DS_Store
# Thumbs.db
# *.swp
```

## 📝 最佳实践

### ✅ 应该做的

1. **项目初期就配置 .gitignore**
   ```bash
   # 在第一次提交前
   git init
   # 创建 .gitignore
   # 然后再添加文件
   git add .
   ```

2. **定期检查和更新**
   ```bash
   # 查看哪些文件被忽略
   git status --ignored
   
   # 查看 .gitignore 是否生效
   git check-ignore -v node_modules/
   ```

3. **团队共享配置**
   - 将 `.gitignore` 提交到仓库
   - 在 README 中说明配置要求
   - 提供清理脚本（如 `cleanup-git-dependencies.bat`）

4. **使用 .gitignore 模板**
   ```bash
   # GitHub 提供了各种语言的模板
   # https://github.com/github/gitignore
   ```

### ❌ 不应该做的

1. **不要提交锁定文件以外的依赖**
   - ✅ 提交：`package.json`, `package-lock.json`
   - ❌ 提交：`node_modules/`, `offline-packages/`

2. **不要忽略锁定文件**（除非有特殊情况）
   ```gitignore
   # ❌ 不推荐
   package-lock.json
   
   # ✅ 推荐：保留锁定文件以确保依赖版本一致
   ```

3. **不要频繁修改 .gitignore**
   - 确定好规则后保持稳定
   - 修改时通知团队成员

## 🛠️ 实用命令

### 检查文件是否被忽略

```bash
# 检查单个文件
git check-ignore node_modules/express

# 检查目录
git check-ignore -v node_modules/

# 查看所有被忽略的文件
git status --ignored
```

### 查看 Git 追踪的大文件

```bash
# 找出最大的 10 个文件
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sed -n 's/^blob //p' | \
  sort -rnk2 | \
  head -n 10
```

### 清理 Git 缓存

```bash
# 清理所有已删除但未提交的缓存
git rm -r --cached .
git add .
git status
```

## 🔍 问题排查

### .gitignore 不生效的完整解决方案

**症状**：
- 已在 `.gitignore` 中添加了规则
- 但 `git status` 仍然显示这些文件被追踪或修改
- 文件出现在 "Changes to be committed" 或 "Changes not staged for commit" 中

**根本原因**：
`.gitignore` **只对未追踪的文件生效**。如果文件在配置 `.gitignore` 之前已经被添加到 Git 索引（通过 `git add`），那么即使后来添加到 `.gitignore`，Git 仍会继续追踪这些文件。

**解决步骤**：

#### 方法一：使用自动化脚本（推荐）

```bash
# Windows
cleanup-git-ignore.bat

# 脚本会自动：
# 1. 从 Git 索引中移除已追踪的忽略文件
# 2. 保留本地文件不被删除
# 3. 更新 .gitignore
# 4. 显示清理后的状态
```

#### 方法二：手动清理

```bash
# 1. 从 Git 缓存中移除目录（保留本地文件）
git rm -r --cached offline-packages/
git rm -r --cached node_modules/
git rm -r --cached verdaccio/storage/

# 2. 移除特定文件
git rm --cached sync-log.json
git rm --cached verify-sync.js
git rm --cached batch-download-report.json
git rm --cached publish-report.json

# 3. 移除压缩文件
git rm --cached offline-packages_*.zip

# 4. 更新 .gitignore
git add .gitignore

# 5. 提交更改
git commit -m "chore: 清理 Git 追踪的忽略文件"

# 6. 验证结果
git status
```

**验证是否成功**：
```bash
# 查看简化的状态（?? 表示未追踪，✅ 表示 .gitignore 生效）
git status --short

# 应该看到：
# ?? offline-packages/      # 未追踪（正确）
# ?? node_modules/          # 未追踪（正确）
# ?? sync-log.json          # 未追踪（正确）

# 而不是：
# M  offline-packages/...   # 被追踪且修改（错误）
# A  node_modules/...       # 新添加并被追踪（错误）
```

**注意事项**：
1. ⚠️ `git rm --cached` 只是从 Git 索引中移除，**不会删除本地文件**
2. ⚠️ 如果已经推送到远程仓库，需要强制推送：`git push --force`
3. ⚠️ 团队成员需要同步此更改，可能需要重新克隆仓库
4. ✅ 清理后，这些文件会显示为 "Untracked files"（未追踪文件）
5. ✅ 之后再修改这些文件，Git 将不再追踪

**预防措施**：
```bash
# 在新项目中，先创建 .gitignore，再初始化 Git
echo "node_modules/" > .gitignore
echo "offline-packages/" >> .gitignore
git init
git add .
git commit -m "initial commit"

# 或者在添加文件前检查
git check-ignore -v node_modules/
# 如果有输出，说明已被忽略 ✅
# 如果没有输出，说明未被忽略 ❌
```

## 📦 本项目的特殊考虑

### 为什么忽略 offline-packages/？

1. **体积巨大**：可能包含数百个包，总大小可达 GB 级别
2. **可重现**：通过 `npm run sync-to-offline` 可以随时重新生成
3. **频繁变化**：每次同步都会修改，产生大量无意义的提交

### 如何在内网环境中使用？

**方案一：使用 Git LFS（不推荐）**
```bash
# 安装 Git LFS
git lfs install

# 追踪大文件
git lfs track "offline-packages/*"

# ⚠️ 仍然会增加仓库体积，只是存储在外部
```

**方案二：分离仓库（推荐）**
```bash
# 主仓库：只包含脚本和配置
git clone https://github.com/your-repo/npm-install-scripts.git

# 离线包仓库：单独存储 offline-packages
git clone https://github.com/your-repo/npm-offline-packages.git

# 使用时同步两个仓库
```

**方案三：使用发布包（最佳）**
```bash
# 1. 搭建内网 Verdaccio
# 2. 发布所有包到内网
npm run publish-to-internal

# 3. 内网用户直接从 Verdaccio 安装
npm install --registry http://内网地址:4873

# 优点：不需要传输 offline-packages，只需维护 Verdaccio
```

## 🔗 相关资源

- [GitHub .gitignore 模板](https://github.com/github/gitignore)
- [Git 官方文档 - Ignoring files](https://git-scm.com/docs/gitignore)
- [Node.js .gitignore 模板](https://github.com/github/gitignore/blob/main/Node.gitignore)
- [本项目 README](./README.md)

## 📞 遇到问题？

如果遇到 Git 忽略相关的问题：

1. 运行诊断脚本：
   ```bash
   cleanup-git-dependencies.bat
   ```

2. 检查 `.gitignore` 语法：
   ```bash
   git check-ignore -v <文件路径>
   ```

3. 查看本文档的"常见错误"部分

4. 联系项目维护者

---

**最后更新**: 2026-04-27  
**维护者**: 项目管理团队
