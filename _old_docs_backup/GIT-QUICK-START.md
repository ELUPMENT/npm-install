# Git 配置快速指南

## 🚀 快速开始

### 1. 首次使用（如果之前已提交过依赖文件）

```bash
# 运行清理脚本
cleanup-git-dependencies.bat

# 然后提交更改
git add .gitignore
git commit -m "chore: 添加 .gitignore 并清理依赖文件"
```

### 2. 新项目初始化

```bash
# .gitignore 已自动创建，直接初始化即可
git init
git add .
git commit -m "initial commit"
```

## 📋 已忽略的文件/目录

### 核心依赖
- ✅ `node_modules/` - npm 安装的依赖包
- ✅ `offline-packages/` - 离线同步的依赖包
- ✅ `verdaccio/storage/` - Verdaccio 私有仓库数据

### 日志和临时文件
- ✅ `sync-log.json` - 同步日志
- ✅ `npm-debug.log*` - npm 调试日志
- ✅ `*.tmp`, `*.temp` - 临时文件

### IDE 配置
- ✅ `.vscode/` - VS Code 配置
- ✅ `.idea/` - JetBrains IDE 配置

### 系统文件
- ✅ `.DS_Store` - macOS
- ✅ `Thumbs.db` - Windows
- ✅ `Desktop.ini` - Windows

## 🔧 常用命令

```bash
# 查看哪些文件被忽略
git status --ignored

# 检查特定文件是否被忽略
git check-ignore -v node_modules/

# 查看当前状态
git status
```

## ⚠️ 注意事项

1. **锁定文件仍会被追踪**
   - `package.json` ✅ 应该提交
   - `package-lock.json` ✅ 应该提交（确保依赖版本一致）

2. **清理后需要重新添加的文件**
   - `.gitignore` - 必须提交
   - `README.md` - 项目文档
   - `scripts/` - 所有脚本
   - `packages/*.json` - 包元数据

3. **如果误提交了大文件**
   ```bash
   # 使用清理脚本
   cleanup-git-dependencies.bat
   
   # 或手动执行
   git rm -r --cached node_modules/
   git rm -r --cached offline-packages/
   ```

## 📖 详细文档

查看 [GIT-IGNORE-GUIDE.md](./GIT-IGNORE-GUIDE.md) 获取完整指南。

## 🆘 遇到问题？

运行清理脚本会自动处理常见问题：
```bash
cleanup-git-dependencies.bat
```
