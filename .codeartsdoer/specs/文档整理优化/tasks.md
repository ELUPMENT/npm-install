# 文档自动归类工具 - 编码任务规划

> **当前状态**：文档归类基础功能已实现（`scripts/classify-docs.js`），已成功执行归类操作（移动133个文件）。
> 
> **规划目标**：将现有JavaScript实现重构为TypeScript模块化架构，增强安全性、可维护性和扩展性。

---

## 1. TypeScript项目重构

- [ ] 初始化TypeScript项目配置
  - 创建 `tsconfig.json` 配置文件，启用严格模式和ES2020特性
  - 配置编译输出目录为 `dist/`
  - 设置源码目录为 `src/`
  - 启用装饰器、sourceMap和声明文件生成

- [ ] 定义核心数据模型（`src/models/`）
  - 创建 `DocumentMeta.ts`：文档元信息接口（filePath、fileName、title、size、createdTime、modifiedTime、encoding、relativePath）
  - 创建 `ClassificationRule.ts`：分类规则接口（name、category、targetDir、priority、filenameKeywords、pathPatterns、titleKeywords）
  - 创建 `ClassificationResult.ts`：分类结果接口（document、category、targetDir、matchedRule、targetPath）
  - 创建 `MoveResult.ts`：移动结果接口（sourcePath、targetPath、status、reason、backedUp）
  - 创建 `Config.ts`：完整配置接口（rules、excludePatterns、unclassifiedDir、indexFileName）

- [ ] 实现Result模式（`src/models/Result.ts`）
  - 定义Success<T>和Failure接口
  - 实现success()、failure()工具函数
  - 实现isSuccess()、isFailure()类型守卫函数
  - 定义ErrorCode枚举类型

---

## 2. 基础层组件实现

- [ ] 实现配置管理器（`src/infrastructure/ConfigManager.ts`）
  - 实现 `loadConfig(configPath?: string)` 方法，支持YAML配置文件加载
  - 实现 `validateConfig(config: unknown)` 方法，验证配置格式和内容
  - 实现 `getDefaultConfig()` 方法，提供默认分类规则
  - 添加配置安全验证（检查正则表达式、路径遍历攻击）

- [ ] 实现文件系统封装（`src/infrastructure/FileSystem.ts`）
  - 封装 `ensureDir()`、`move()`、`readFile()`、`writeFile()`、`stat()` 等方法
  - 所有方法返回Promise和Result类型
  - 添加路径安全验证（防止路径遍历攻击）
  - 实现跨平台路径处理

- [ ] 实现Git辅助工具（`src/infrastructure/GitHelper.ts`）
  - 实现 `isTracked(filePath: string)` 方法，检查文件是否被Git追踪
  - 实现 `getStatus(filePath: string)` 方法，获取文件Git状态
  - 仅提供只读操作，不执行提交或推送

- [ ] 实现日志管理器（`src/infrastructure/Logger.ts`）
  - 集成winston日志库
  - 支持多级别日志（error、warn、info、debug）
  - 支持文件和控制台双输出
  - 日志格式包含时间戳、级别、上下文信息

---

## 3. 业务层服务实现

- [ ] 实现文档扫描服务（`src/services/DocumentScanner.ts`）
  - 实现 `scan(rootPath: string, excludePatterns: string[])` 方法
  - 使用fast-glob进行高性能文件扫描
  - 实现 `extractMeta(filePath: string)` 方法，提取文档元信息
  - 读取文件前100行内容提取一级标题
  - 处理编码异常（支持UTF-8和GBK）

- [ ] 实现分类规则引擎（`src/services/ClassificationEngine.ts`）
  - 实现 `initialize(rules: ClassificationRule[])` 方法，初始化并按优先级排序规则
  - 实现 `classify(document: DocumentMeta)` 方法，执行单文档分类决策
  - 实现 `classifyBatch(documents: DocumentMeta[])` 方法，批量分类
  - 支持文件名关键词、路径模式、标题关键词三种匹配方式
  - 未匹配文档归类到"未分类"目录

- [ ] 实现文件移动服务（`src/services/FileMover.ts`）
  - 实现 `moveFiles(results: ClassificationResult[], options: MoveOptions)` 方法
  - 实现安全备份功能（创建 `_classify_backup_{timestamp}/` 目录）
  - 实现文件名冲突检测和策略处理（skip、overwrite）
  - 保护索引文件（不覆盖已有README.md）
  - 批量移动时按目标目录分组优化性能

- [ ] 实现索引生成服务（`src/services/IndexGenerator.ts`）
  - 实现 `updateIndexes(results: ClassificationResult[], rootPath: string)` 方法
  - 实现 `generateIndexContent(categoryDir: string, documents: DocumentMeta[])` 方法
  - 索引内容包含分类名称、文档数量、文档列表（相对路径链接）
  - 文档列表按文件名自然排序
  - 支持增量更新（保留手动添加的自定义内容）

- [ ] 实现报告生成服务（`src/services/ReportGenerator.ts`）
  - 实现 `generate(data: ReportData)` 方法
  - 报告包含：统计信息、各分类数量、归类详情、错误和警告
  - 错误分级标注（ERROR、WARN、INFO）
  - 输出Markdown格式报告

---

## 4. 应用层控制器实现

- [ ] 实现主控制器（`src/controllers/MainController.ts`）
  - 实现 `execute(options: ExecuteOptions)` 方法，协调完整归类流程
  - 流程编排：配置加载 → 文档扫描 → 分类匹配 → 文件移动 → 索引更新 → 报告生成
  - 统一错误处理和日志记录
  - 支持执行选项（safeMode、conflictStrategy、updateIndex、verbose等）

- [ ] 实现CLI命令行界面（`src/cli.ts`）
  - 使用Commander.js定义命令和参数
  - 命令：`classify <rootPath>` 执行文档归类
  - 参数：`--config` 配置文件路径、`--safe` 安全模式、`--verbose` 详细日志
  - 命令：`preview <rootPath>` 预览归类结果（不执行移动）
  - 命令：`init` 生成默认配置文件模板

- [ ] 创建入口文件（`src/index.ts`）
  - 导出所有公共接口和服务
  - 支持作为模块被外部调用

---

## 5. 工具函数实现

- [ ] 实现路径处理工具（`src/utils/pathUtils.ts`）
  - 实现 `isPathSafe(targetPath: string, rootPath: string)` 验证路径安全性
  - 实现 `sanitizePath(inputPath: string)` 清理路径危险字符
  - 实现 `normalizePath(filePath: string)` 跨平台路径标准化

- [ ] 实现字符串处理工具（`src/utils/stringUtils.ts`）
  - 实现关键词匹配函数（忽略大小写）
  - 实现文件名提取函数
  - 实现标题清理函数

- [ ] 实现编码处理工具（`src/utils/encodingUtils.ts`）
  - 使用jschardet检测文件编码
  - 支持UTF-8、GBK等常见编码
  - 提供编码转换函数

---

## 6. 单元测试实现

- [ ] 配置测试环境（Vitest）
  - 安装vitest及相关类型定义
  - 配置测试脚本和覆盖率报告
  - 设置测试环境变量

- [ ] 编写业务层单元测试
  - `DocumentScanner.test.ts`：测试文档扫描和元信息提取
  - `ClassificationEngine.test.ts`：测试规则匹配逻辑（关键词、路径、标题）
  - `FileMover.test.ts`：测试文件移动、冲突处理、备份功能
  - `IndexGenerator.test.ts`：测试索引内容生成和格式

- [ ] 编写基础层单元测试
  - `ConfigManager.test.ts`：测试配置加载、验证、安全检查
  - `FileSystem.test.ts`：测试文件操作和路径验证
  - `GitHelper.test.ts`：测试Git状态查询

- [ ] 编写集成测试
  - 测试完整归类流程（从扫描到报告生成）
  - 测试各种异常场景处理
  - 测试跨平台兼容性

---

## 7. 性能优化实现

- [ ] 实现并发控制
  - 使用Promise.allSettled控制并发数量（限制为10）
  - 实现batchProcess批量处理函数
  - 文件扫描使用异步流式处理

- [ ] 实现性能监控
  - 记录各阶段执行耗时
  - 统计文件扫描、分类、移动的时间分布
  - 性能报告包含在归类报告中

- [ ] 性能基准测试
  - 1000个文档扫描时间 < 10秒
  - 单文档分类决策 < 100毫秒
  - 100个文件移动 < 5秒

---

## 8. 文档和配置完善

- [ ] 创建使用文档（`README.md`）
  - 工具介绍和功能说明
  - 安装和配置指南
  - 命令行使用示例
  - 配置文件格式说明
  - 常见问题和解决方案

- [ ] 优化默认配置文件（`config/default-rules.yaml`）
  - 扩展分类规则覆盖范围
  - 添加更多关键词和路径模式
  - 优化排除规则列表

- [ ] 创建配置模板
  - 提供多种场景的配置模板（前端项目、后端项目、文档站点）
  - 配置模板包含详细注释说明

---

## 9. 迁移和兼容处理

- [ ] 数据迁移工具
  - 保留现有归类结果兼容性
  - 支持从旧配置格式迁移到新格式
  - 提供回滚功能（从备份恢复）

- [ ] 兼容性测试
  - Windows、Linux、macOS跨平台测试
  - UTF-8编码文件名和内容测试
  - 特殊字符文件名处理测试

---

## 10. 验收和部署

- [ ] 功能验收测试
  - 验证所有需求规格文档中的业务规则已实现
  - 验证所有异常场景已正确处理
  - 验证报告格式和内容符合规范

- [ ] 代码质量检查
  - 运行ESLint代码检查，确保无警告
  - 运行TypeScript编译，确保无类型错误
  - 运行单元测试，确保覆盖率 > 80%

- [ ] NPM包发布准备
  - 配置package.json的bin字段（CLI命令）
  - 配置package.json的exports字段（模块导出）
  - 添加发布前检查脚本（prepublishOnly）

- [ ] 部署和使用验证
  - 在实际项目中测试归类功能
  - 验证CLI命令正常工作
  - 验证模块导入和使用正常

---

## 任务依赖关系

```
1. TypeScript项目重构
   ↓
2. 基础层组件实现（依赖：模型定义）
   ↓
3. 业务层服务实现（依赖：基础层）
   ↓
4. 应用层控制器实现（依赖：业务层）
   ↓
5. 工具函数实现（可与2-4并行）
   ↓
6. 单元测试实现（依赖：所有组件）
   ↓
7. 性能优化实现（依赖：功能实现）
   ↓
8. 文档和配置完善（可与其他任务并行）
   ↓
9. 迁移和兼容处理（依赖：新功能实现）
   ↓
10. 验收和部署（依赖：所有任务完成）
```

---

## 预估工作量

| 任务组 | 预估工时 | 优先级 |
|-------|---------|--------|
| 1. TypeScript项目重构 | 4小时 | 高 |
| 2. 基础层组件实现 | 8小时 | 高 |
| 3. 业务层服务实现 | 12小时 | 高 |
| 4. 应用层控制器实现 | 6小时 | 高 |
| 5. 工具函数实现 | 4小时 | 中 |
| 6. 单元测试实现 | 10小时 | 中 |
| 7. 性能优化实现 | 6小时 | 中 |
| 8. 文档和配置完善 | 4小时 | 低 |
| 9. 迁移和兼容处理 | 4小时 | 中 |
| 10. 验收和部署 | 4小时 | 高 |

**总计预估：62小时（约8个工作日）**
