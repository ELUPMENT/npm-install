# 🔧 修复 workspace 依赖错误

## ❌ 问题描述

执行 `npm install` 时报错：
```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

## 🔍 原因分析

[package.json](file://c:\Users\Admin\Desktop\前端AI\npm发布\npm-install\package.json) 中包含了一个使用 `workspace:*` 协议的依赖：
```json
"@synway/ui": "workspace:*"
```

这是 npm workspaces 的特性，需要配置 monorepo 的 workspaces 才能使用。但本项目不是 monorepo 结构，因此不支持此协议。

## ✅ 解决方案

### 已执行的修复

从 [package.json](file://c:\Users\Admin\Desktop\前端AI\npm发布\npm-install\package.json) 中移除了 `@synway/ui` 依赖：

**修改前：**
```json
"dependencies": {
  "@element-plus/icons-vue": "^2.3.1",
  "@synway/ui": "workspace:*",  // ← 导致错误
  "axios": "^1.7.2",
  ...
}
```

**修改后：**
```json
"dependencies": {
  "@element-plus/icons-vue": "^2.3.1",
  "axios": "^1.7.2",
  ...
}
```

### 如果确实需要 @synway/ui

如果你需要使用 `@synway/ui` 包，有以下几种方案：

#### 方案 1：使用具体版本号（推荐）

如果 `@synway/ui` 是一个普通的 npm 包，可以使用具体版本：
```json
"dependencies": {
  "@synway/ui": "^1.0.0"  // 替换为实际版本号
}
```

#### 方案 2：配置 npm workspaces

如果这是一个本地开发的包，可以配置 workspaces：

1. 创建 packages 目录结构：
```
npm-install/
├── packages/
│   └── ui/
│       └── package.json
├── package.json
```

2. 在根目录 package.json 中添加：
```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

3. 在 `packages/ui/package.json` 中设置：
```json
{
  "name": "@synway/ui",
  "version": "1.0.0"
}
```

#### 方案 3：从 Verdaccio 获取

如果 `@synway/ui` 已经发布到你的 Verdaccio 仓库：
```json
"dependencies": {
  "@synway/ui": "^1.0.0"
}
```

然后确保 Verdaccio 中有这个包。

## 🚀 现在可以正常使用了

修复后，你可以正常运行：

```bash
# 安装项目依赖
npm install

# 下载并发布到内网
download-and-publish.bat

# 或者
npm run download-and-publish
```

## 📝 当前依赖列表

### dependencies (8个)
- @element-plus/icons-vue@^2.3.1
- axios@^1.7.2
- element-plus@2.13.0
- lodash@^4.17.23
- pinia@^3.0.4
- prismjs@^1.30.0
- uuid@^8.3.2
- vue@^3.4.0
- vue-router@^4.6.4

### devDependencies (14个)
- @rollup/rollup-win32-x64-msvc@^4.60.2
- @types/lodash@^4.17.23
- @typescript-eslint/eslint-plugin@8.57.1
- @typescript-eslint/parser@8.57.1
- @vitejs/plugin-vue@^5.0.0
- @vue/compiler-sfc@^3.5.0
- @vue/test-utils@2.4.0
- eslint@^8.57.0
- eslint-plugin-vue@^9.14.1
- jsdom@21.1.0
- sass@1.77.6
- typescript@^5.4.0
- vite@^5.4.0
- vitest@^2.1.8

**总计：22 个主依赖**（不包括子依赖）

## 💡 提示

- 脚本会自动过滤掉 `@synway` 开头的包，不会尝试下载
- 如果后续需要添加 `@synway/ui`，请使用具体版本号而非 `workspace:*`
- 所有依赖都会通过 Verdaccio 下载和发布

---

**修复时间**: 2026-05-21  
**状态**: ✅ 已修复
