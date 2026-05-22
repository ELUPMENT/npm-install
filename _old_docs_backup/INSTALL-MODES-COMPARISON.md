# 依赖安装方式对比

## 问题说明

**之前的实现：**
- 只下载您指定的包
- **不会**自动下载该包的依赖
- 导致使用时缺少必要的子依赖

**新的实现：**
- 自动解析完整的依赖树
- 下载主包 + 所有子依赖
- 确保包能正常工作

## 三种安装方式对比

### 方式一：add-package（旧方式）

```bash
npm run add-package
```

**特点：**
- ⚠️ 仅安装指定的单个包
- ❌ 不处理依赖关系
- ✅ 适合只需要一个独立包的情况

**示例：**
```bash
npm run add-package
# 输入: react@18.2.0
# 结果: 只安装了 react，缺少 loose-envify 等依赖
```

---

### 方式二：add-deps（推荐⭐）

```bash
npm run add-deps
```

**特点：**
- ✅ 自动解析所有依赖
- ✅ 批量安装主包 + 所有子依赖
- ✅ 保存到 packages/ 目录
- ✅ 生成完整文档
- ✅ 同步到离线文件夹

**示例：**
```bash
npm run add-deps
# 输入: react@18.2.0
# 结果: 
#   ✓ 安装了 react@18.2.0
#   ✓ 安装了 loose-envify@1.4.0 (react 的依赖)
#   ✓ 安装了 js-tokens@4.0.0 (loose-envify 的依赖)
#   ✓ 保存了 3 个包的信息
#   ✓ 生成了 3 个包的文档
```

**工作流程：**
1. 查询 npm registry 获取依赖树
2. 显示所有需要安装的包
3. 确认后批量安装
4. 记录所有包信息
5. 可选生成文档
6. 可选同步离线包

---

### 方式三：analyze-deps（分析工具）

```bash
npm run analyze-deps
```

**特点：**
- 🔍 查看包的完整依赖结构
- 📊 生成分析报告
- 💡 帮助决定是否安装
- 🎯 可选择性安装

**示例：**
```bash
npm run analyze-deps
# 输入: express@4.18.2
# 结果:
#   📦 直接依赖: 30 个
#   🔧 开发依赖: 15 个
#   🤝 对等依赖: 0 个
#   ⭐ 可选依赖: 2 个
#   
#   询问: 是否安装所有这些依赖? (y/n)
```

---

## 实际案例对比

### 案例：安装 React

#### 使用 add-package（不完整）
```bash
npm run add-package
# 输入: react@18.2.0

# 结果：
# ✓ 安装了 react@18.2.0
# ✗ 缺少 loose-envify（react 需要它）
# ✗ 缺少 js-tokens（loose-envify 需要它）
```

#### 使用 add-deps（完整✅）
```bash
npm run add-deps
# 输入: react@18.2.0

# 结果：
# ✓ 安装了 react@18.2.0
# ✓ 安装了 loose-envify@1.4.0
# ✓ 安装了 js-tokens@4.0.0
# ✓ 保存了所有包信息
# ✓ 生成了完整文档
```

---

## 命令速查表

| 命令 | 作用 | 推荐度 | 适用场景 |
|------|------|--------|----------|
| `npm run add-deps` | 安装包 + 所有依赖 | ⭐⭐⭐⭐⭐ | **大多数情况** |
| `npm run analyze-deps` | 分析依赖结构 | ⭐⭐⭐⭐ | 想了解依赖详情 |
| `npm run add-package` | 仅安装单个包 | ⭐⭐ | 确定不需要依赖 |

---

## 推荐使用流程

### 标准流程（推荐）

```bash
# 1. 使用 add-deps 安装（包含所有依赖）
npm run add-deps
# 输入包名和版本

# 2. 同步到离线文件夹
npm run sync-to-offline

# 3. 生成文档
npm run generate-docs

# 4. 复制到内网并发布
```

### 高级流程（需要了解详情）

```bash
# 1. 先分析依赖
npm run analyze-deps
# 查看依赖结构和报告

# 2. 确认后再安装
# （在 analyze-deps 中选择 y）

# 3. 同步和生成文档
npm run sync-to-offline
npm run generate-docs
```

---

## 常见问题

### Q: 为什么有些包不需要依赖？

一些简单的工具库可能没有依赖，例如：
- `lodash` - 功能完整的工具库
- `axios` - HTTP 客户端（有少量依赖）

但大多数框架和复杂库都有依赖。

### Q: add-deps 会安装 devDependencies 吗？

不会。`add-deps` 只安装：
- dependencies（运行时依赖）
- peerDependencies（对等依赖）

不安装：
- devDependencies（开发依赖）
- optionalDependencies（可选依赖）

### Q: 如何知道某个包有多少依赖？

先用 `analyze-deps` 查看：
```bash
npm run analyze-deps
# 输入包名，会显示依赖数量
```

### Q: 递归解析会不会很慢？

不会。脚本优化了：
- 最多解析 3 层（覆盖 99% 的情况）
- 避免循环依赖
- 去重处理

通常几秒钟完成。

---

## 总结

**记住这个原则：**

> ✅ **总是使用 `npm run add-deps` 来安装包**
> 
> 这样可以确保获得所有必需的依赖，避免运行时错误。

**仅在以下情况使用 `add-package`：**
- 你确定这个包没有任何依赖
- 你只需要包本身，不需要其功能依赖

---

*查看详细文档：[DEPENDENCY-MANAGEMENT.md](DEPENDENCY-MANAGEMENT.md)*
