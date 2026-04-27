# 依赖管理完整指南

## 📌 问题说明

之前的实现存在一个问题：当您安装某个包（如 `react`）时，只会下载该包本身，而不会自动下载它的依赖包。这导致在实际使用时缺少必要的子依赖。

### 示例问题

```bash
# 旧的方式
npm run add-package
# 输入: react@18.2.0
# 结果: 只下载了 react，但没有下载它依赖的 loose-envify、js-tokens 等
```

## ✅ 解决方案

现在提供了两个新的脚本来解决这个问题：

### 方案一：自动安装所有依赖（推荐）

使用 `add-deps` 命令，会自动解析并安装指定包的所有依赖：

```bash
npm run add-deps
```

**工作流程：**
1. 输入包名和版本
2. 自动查询 npm registry 获取完整的依赖树
3. 显示所有需要安装的包列表
4. 确认后批量安装所有包（包括主包和所有子依赖）
5. 保存所有包的信息到 `packages/` 目录
6. 可选：生成所有包的文档
7. 可选：同步所有包到离线文件夹

**示例：**

```bash
npm run add-deps
# 输入: react@18.2.0
# 系统会分析出 react 依赖: loose-envify, js-tokens 等
# 然后一起安装所有这些包
```

### 方案二：先分析再决定

使用 `analyze-deps` 命令，可以先查看依赖结构再选择是否安装：

```bash
npm run analyze-deps
```

**功能：**
- 显示包的详细信息（描述、许可证、作者）
- 列出所有直接依赖
- 列出所有开发依赖
- 列出所有对等依赖
- 列出所有可选依赖
- 生成分析报告（JSON 格式）
- 可选择一键安装所有依赖

## 📋 命令对比

| 命令 | 用途 | 适用场景 |
|------|------|----------|
| `npm run add-package` | 仅安装指定的单个包 | 确定只需要一个包，不需要其依赖 |
| `npm run add-deps` | 安装包及其所有依赖 | **推荐使用** - 确保完整性 |
| `npm run analyze-deps` | 分析包的依赖结构 | 想了解包的依赖情况再做决定 |

## 🚀 使用示例

### 示例 1：安装 React（包含所有依赖）

```bash
npm run add-deps
```

按提示操作：
```
请输入包名: react
请输入版本号 (留空使用最新版本): 18.2.0

正在分析 react@18.2.0...
✓ 找到 react@18.2.0
  - 直接依赖: 1 个
  - 开发依赖: 0 个
  - 对等依赖: 0 个

=== 依赖树解析完成 ===
总共需要安装 2 个包:
  1. react@18.2.0 (层级: 0)
  2. loose-envify@1.4.0 (层级: 1)

是否继续安装所有这些包? (y/n): y

开始安装 2 个包...
[1/2] 安装 react@18.2.0...
✓ react@18.2.0 安装成功
[2/2] 安装 loose-envify@1.4.0...
✓ loose-envify@1.4.0 安装成功

=== 安装完成 ===
成功: 2 个
失败: 0 个
```

### 示例 2：安装 Express（包含所有依赖）

```bash
npm run add-deps
```

输入：
```
包名: express
版本: 4.18.2
```

系统会发现 express 有几十个依赖（body-parser、cookie、debug 等），并全部安装。

### 示例 3：分析 Vue 的依赖

```bash
npm run analyze-deps
```

输入：
```
包名: vue
版本: 3.3.4
```

系统会显示：
- 直接依赖：@vue/compiler-dom, @vue/runtime-dom 等
- 对等依赖：typescript 等
- 生成详细报告文件

## 📊 依赖层级说明

脚本会递归解析依赖树，最多解析 3 层：

```
主包 (L0)
└─ 直接依赖 (L1)
   └─ 二级依赖 (L2)
      └─ 三级依赖 (L3)
```

**例如安装 React：**
```
react@18.2.0 (L0 - 主包)
└─ loose-envify@1.4.0 (L1 - react 的依赖)
   └─ js-tokens@4.0.0 (L2 - loose-envify 的依赖)
```

## 🔍 技术实现

### add-package-with-deps.js 核心功能

1. **依赖查询**：通过 `npm view` 命令从 npm registry 获取包的完整依赖信息
2. **递归解析**：自动遍历依赖树（最多 3 层）
3. **去重处理**：避免重复安装相同的包
4. **批量安装**：一次性安装所有依赖包
5. **信息保存**：记录每个包的元数据
6. **文档生成**：为所有包生成使用文档
7. **离线同步**：支持同步到离线文件夹

### analyze-deps.js 核心功能

1. **深度分析**：获取包的所有类型依赖
2. **可视化展示**：清晰显示依赖关系
3. **统计报告**：生成 JSON 格式的分析报告
4. **按需安装**：可选择只安装部分依赖

## 💡 最佳实践

### 1. 优先使用 add-deps

```bash
# ✅ 推荐 - 自动处理所有依赖
npm run add-deps

# ❌ 不推荐 - 可能缺少依赖
npm run add-package
```

### 2. 复杂包先分析

对于依赖较多的包（如 webpack、babel 等），建议先分析：

```bash
npm run analyze-deps
# 查看依赖结构后再决定是否安装
```

### 3. 定期清理和更新

```bash
# 查看已安装的包
cat docs/README.md

# 检查配置
npm run check-setup
```

### 4. 内网发布前验证

在同步到离线文件夹前，确保所有依赖都已正确安装：

```bash
# 使用 add-deps 安装
npm run add-deps

# 同步到离线文件夹
npm run sync-to-offline

# 生成文档
npm run generate-docs
```

## 📝 常见问题

### Q1: 为什么有些包安装失败？

**原因**：
- 网络连接问题
- 包不存在或版本错误
- Verdaccio 服务未启动

**解决**：
```bash
# 检查 Verdaccio 是否运行
# 访问 http://localhost:4873

# 重新安装失败的包
npm install package-name --registry=http://localhost:4873
```

### Q2: 依赖树有多深？

大多数包的依赖树在 2-3 层。脚本默认解析 3 层，足以覆盖绝大多数情况。

### Q3: 如何知道哪些是传递依赖？

查看 `packages/` 目录下的 JSON 文件：
```json
{
  "name": "loose-envify",
  "isTransitive": true,  // true 表示是传递依赖
  "depth": 1             // 依赖层级
}
```

### Q4: 能否只安装直接依赖？

可以，使用 `analyze-deps` 查看后选择性安装：

```bash
npm run analyze-deps
# 然后手动安装需要的包
```

### Q5: 如何处理循环依赖？

脚本内置了循环依赖检测，会自动跳过已访问的包，避免无限循环。

## 🎯 总结

**新的依赖管理工作流程：**

1. ✅ **外网环境**：
   ```bash
   npm run add-deps          # 安装包及所有依赖
   npm run sync-to-offline   # 同步到离线文件夹
   npm run generate-docs     # 生成文档
   ```

2. ✅ **复制到内网**：
   - 复制 `offline-packages/` 目录

3. ✅ **内网环境**：
   ```bash
   node scripts/publish-internal-standalone.js
   ```

**优势：**
- ✅ 自动解析所有依赖
- ✅ 避免缺少子依赖
- ✅ 完整的依赖清单
- ✅ 可靠的离线部署
- ✅ 详细的文档记录

---

*最后更新：2024-01-01*
