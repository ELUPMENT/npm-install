# 编码任务规划：npm publish files字段glob模式匹配修复

## 1. 基础设施工具层实现

### 1.1 核心类型定义
- [ ] 在 `src/types/index.ts` 中新增 files 字段修复相关的 TypeScript 类型定义：
  - `DiagnosticReport`：诊断报告（packageName、packageVersion、packageDir、hasFilesField、originalFilesField、globPatterns、localDirectoryStructure、packFileList、missingFiles、rootCause、timestamp）
  - `GlobPatternInfo`：glob 模式信息（pattern、hasTrailingSlash、expandedPaths、expectedPaths、isFullyMatched、missingPaths）
  - `DirectoryEntry`：目录条目（relativePath、isDirectory、size）
  - `MissingFileEntry`：缺失文件条目（relativePath、directory、isEntryPoint）
  - `RootCauseAnalysis`：根因分析（problemType、description、affectedPatterns、confidence）
  - `FixResult`：修正结果（success、packageName、packageVersion、originalFilesField、fixedFilesField、backupPath、validationResult、rollbackPerformed、operationId、timestamp）
  - `FilesFixOptions`：修正选项（dryRun、createBackup、preserveNonGlobEntries、skipValidation）
  - `ValidationReport`：验证报告（packageName、packageVersion、overallStatus、checks、packResult、missingEntryFiles、actualPackageSize、expectedPackageSize、sizeDeviationRatio、timestamp）
  - `ValidationCheck`：单项校验（checkName、status、message、details）
  - `PackResult`：npm pack 执行结果（fileCount、fileList、packageSize、executionTime）
  - `GenericSolutionReport`：通用方案报告（scanDir、totalScanned、problematicPackages、fixCommands、timestamp）
  - `ProblematicPackage`：问题包信息（packageName、packageVersion、packageDir、globPatterns、suggestedFix）
  - `AuditLogEntry`：审计日志条目（operationId、packageName、packageVersion、operationType、operationStatus、originalFilesField、newFilesField、validationResult、errorMessage、timestamp）
  - `PackageJsonContent`：package.json 内容模型（name、version、files、main、module、types、bin 及其他字段）
  - `ExpansionVerification`：glob 展开验证结果（isConsistent、localMatches、expandedMatches、missingInExpansion、extraInExpansion）
  - 枚举类型：`ValidationStatus`、`FixOperationStatus`、`ProblemType`、`AuditOperationType`、`AuditOperationStatus`
- [ ] 验收标准：所有类型无 `any`，通过 TypeScript 编译，核心数据模型支持 JSON 序列化

### 1.2 FileScanner 文件系统扫描器
- [ ] 新建 `src/infra/file-scanner.ts`，实现文件系统扫描能力：
  - `scanDirectory(packageDir: string): Promise<DirectoryEntry[]>`：扫描包目录结构，返回所有文件和目录的相对路径、类型和大小
  - `scanTopLevelDirs(packageDir: string): Promise<string[]>`：仅扫描顶层目录名称（用于 glob 前缀匹配）
  - `getLocalDistDirs(packageDir: string, prefix: string): Promise<string[]>`：获取所有以指定前缀开头的本地目录（如 `dist-` 前缀匹配 dist-node、dist-types、dist-web）
  - `countFiles(packageDir: string): Promise<number>`：统计目录下文件总数
  - `calculateDirectorySize(packageDir: string): Promise<number>`：计算目录总大小（KB）
- [ ] 复用现有 `src/utils/file-utils.ts` 中的 `FileUtils.listFiles`、`FileUtils.directoryExists` 等方法
- [ ] 验收标准：能正确扫描 `offline-packages/async-validator@4.2.5/` 的目录结构，返回 dist-node、dist-types、dist-web 三个目录

### 1.3 GlobExpander glob 展开引擎
- [ ] 新建 `src/infra/glob-expander.ts`，实现 glob 模式展开核心算法：
  - `expand(pattern: string, packageDir: string): Promise<string[]>`：将 glob 模式在本地文件系统上展开为显式路径列表
  - `identifyGlobPatterns(filesField: string[]): GlobPatternInfo[]`：识别 files 字段中包含 glob 通配符（`*`、`**`、`?`、`[`、`{`）的条目
  - `extractGlobPrefix(pattern: string): string`：提取 glob 模式的前缀（如 `dist-*/` → `dist-`）
  - `expandGlobToExplicitDirs(globPattern: string, packageDir: string, localDirs: string[]): string[]`：将 glob 模式展开为本地实际存在的显式目录列表，保留尾部斜杠语义
  - `verifyExpansion(pattern: string, expandedPaths: string[], packageDir: string): Promise<ExpansionVerification>`：验证展开结果与本地文件系统的一致性
- [ ] 关键算法实现：`dist-*/` → 扫描本地顶层目录 → 筛选以 `dist-` 开头的目录 → 返回 `["dist-node/", "dist-types/", "dist-web/"]`
- [ ] 验收标准：输入 `dist-*/` 和 `async-validator@4.2.5` 目录，输出 `["dist-node/", "dist-types/", "dist-web/"]`；输入不含通配符的 `bin/`，返回 `["bin/"]`

### 1.4 NpmPackRunner npm pack 执行器
- [ ] 新建 `src/infra/npm-pack-runner.ts`，实现 npm pack 命令执行与输出解析：
  - `dryRun(packageDir: string, timeout?: number): Promise<PackResult>`：执行 `npm pack --dry-run` 并解析输出，返回文件列表、文件数量、包大小
  - `pack(packageDir: string, outputDir: string): Promise<string>`：执行实际 npm pack 生成 tgz 文件
  - `parsePackOutput(output: string): PackResult`：解析 npm pack --dry-run 的标准输出，提取 `Tarball Contents` 部分的文件路径、`package size` 和文件数量
  - 超时控制：默认 30 秒超时，超时后抛出 `TimeoutError`
- [ ] 使用 `child_process.exec` 执行 npm pack 命令，设置工作目录为 packageDir
- [ ] 验收标准：对修正后的 async-validator@4.2.5 执行 dryRun，返回包含 dist-types/ 和 dist-web/ 文件的 PackResult

### 1.5 PackageJsonManager 配置文件管理器
- [ ] 新建 `src/infra/package-json-manager.ts`，实现 package.json 读写、备份和回滚：
  - `read(packageDir: string): Promise<PackageJsonContent>`：读取并解析 package.json
  - `write(packageDir: string, content: PackageJsonContent): Promise<void>`：写入 package.json（格式化输出，缩进 2 空格）
  - `createBackup(packageDir: string): Promise<string>`：创建 `package.json.bak` 备份文件，返回备份路径
  - `rollback(packageDir: string): Promise<boolean>`：从 `package.json.bak` 恢复原始配置
  - `hasBackup(packageDir: string): Promise<boolean>`：检查备份文件是否存在
  - `updateFilesField(packageDir: string, newFilesField: string[]): Promise<void>`：仅更新 files 字段，保留其他所有字段不变
- [ ] 复用 `FileUtils.readJsonFile`、`FileUtils.writeJsonFile`、`FileUtils.copyFile` 等方法
- [ ] 验收标准：备份 async-validator@4.2.5 的 package.json 为 .bak，修改 files 字段后回滚能恢复原始内容

### 1.6 AuditLogger 审计日志
- [ ] 新建 `src/infra/audit-logger.ts`，实现修复操作的完整审计日志记录：
  - `logStart(entry): void`：记录操作开始
  - `logComplete(operationId: string, result?): void`：记录操作完成
  - `logFailure(operationId: string, error: string): void`：记录操作失败
  - `queryHistory(packageName: string, packageVersion: string): AuditLogEntry[]`：查询操作历史
  - 日志持久化到项目根目录 `files-fix-audit.json`
- [ ] 操作 ID 生成：使用 `Date.now() + 随机数` 生成唯一标识符
- [ ] 验收标准：修正操作后能通过 queryHistory 查询到完整的操作记录（包含原始 files 和修正后 files）

## 2. 核心服务层实现

### 2.1 DiagnosticModule 诊断模块
- [ ] 新建 `src/files-filter/diagnostic-module.ts`，实现 files 字段 glob 匹配问题的诊断能力：
  - `diagnose(packageDir: string): Promise<DiagnosticReport>`：对单个包执行完整诊断流程
  - `diagnoseAll(offlinePackagesDir: string): Promise<DiagnosticReport[]>`：批量诊断所有包
  - 诊断流程：
    1. 读取 package.json，检查 files 字段是否存在
    2. 解析 files 字段，使用 GlobExpander.identifyGlobPatterns 识别 glob 模式
    3. 对每个 glob 模式，使用 GlobExpander.expand 展开并与本地文件系统对比
    4. 使用 NpmPackRunner.dryRun 获取实际发布文件列表
    5. 对比本地文件与发布文件，计算 MissingFileEntry 清单
    6. 定位根因，生成 RootCauseAnalysis（problemType 为 `files_glob_mismatch`）
    7. 生成 DiagnosticReport
- [ ] 异常处理：package.json 无 files 字段时 problemType 为 `no_files_field`；npm pack 执行失败时为 `npm_pack_error`
- [ ] 验收标准：对 async-validator@4.2.5 执行诊断，返回 hasFilesField=true、globPatterns 包含 `dist-*/`、missingFiles 包含 dist-types/ 和 dist-web/ 下的文件

### 2.2 FilesFieldFixer 修正模块
- [ ] 新建 `src/files-filter/files-field-fixer.ts`，实现 files 字段的修正能力：
  - `fix(packageDir: string, options?: Partial<FilesFixOptions>): Promise<FixResult>`：修正单个包的 files 字段
  - `fixAll(offlinePackagesDir: string, options?: Partial<FilesFixOptions>): Promise<FixResult[]>`：批量修正所有问题包
  - `rollback(packageDir: string): Promise<boolean>`：回滚修正操作
  - 修正流程：
    1. 读取并解析 package.json
    2. 若 createBackup=true，调用 PackageJsonManager.createBackup 创建备份
    3. 使用 GlobExpander.identifyGlobPatterns 识别 glob 模式
    4. 对每个 glob 模式，使用 GlobExpander.expandGlobToExplicitDirs 展开为显式目录
    5. 保留非 glob 条目不变（如 `bin/`）
    6. 调用 PackageJsonManager.updateFilesField 写入修正后的 files 字段
    7. 若 skipValidation=false，触发 PublishValidator.validate 验证
    8. 验证失败则回滚到备份
    9. 使用 AuditLogger 记录操作
    10. 返回 FixResult
  - dryRun 模式：仅输出修正建议，不实际修改文件
- [ ] 验收标准：对 async-validator@4.2.5 执行修正，files 字段从 `["dist-*/", "bin/"]` 变为 `["dist-node/", "dist-types/", "dist-web/", "bin/"]`；验证失败时自动回滚

### 2.3 PublishValidator 验证模块
- [ ] 新建 `src/files-filter/publish-validator.ts`，实现 npm publish 发布完整性验证能力：
  - `validate(packageDir: string): Promise<ValidationReport>`：验证单个包的发布完整性
  - `validateAll(offlinePackagesDir: string): Promise<ValidationReport[]>`：批量验证所有包
  - 验证检查项实现：
    1. `checkDistDirsCompleteness`：所有 dist-* 目录是否包含在 tarball 中
    2. `checkEntryFilesExistence`：main/module/types 入口文件是否存在
    3. `checkFileCountConsistency`：发布文件数量是否与预期一致（偏差不超过 20%）
    4. `checkPackageSizeReasonable`：发布包大小是否在合理范围（偏差不超过 30%）
    5. `checkNoUnexpectedExclusions`：无非预期的关键文件排除
  - 验证流程：
    1. 使用 NpmPackRunner.dryRun 获取 tarball 文件列表
    2. 依次执行 5 项检查，生成 ValidationCheck 数组
    3. 汇总结果：所有检查通过 → overallStatus=`passed`，任一失败 → `failed`
    4. 生成 ValidationReport
- [ ] 验收标准：修正后的 async-validator@4.2.5 执行验证，overallStatus=`passed`，5 项检查全部通过；修正前执行验证，overallStatus=`failed`

### 2.4 GenericSolutionGenerator 通用方案生成模块
- [ ] 新建 `src/files-filter/generic-solution-generator.ts`，实现批量扫描和通用修复方案输出：
  - `scanAndGenerateSolution(offlinePackagesDir: string): Promise<GenericSolutionReport>`：扫描所有离线包并生成修复方案
  - 扫描流程：
    1. 遍历 offline-packages/ 目录下所有子目录
    2. 对每个子目录检查 package.json 是否存在（不存在则跳过并记录警告）
    3. 使用 GlobExpander.identifyGlobPatterns 解析 files 字段中的 glob 模式
    4. 对有 glob 模式的包，使用 FilesFieldFixer 生成修正建议（dryRun 模式）
    5. 汇总所有 ProblematicPackage，生成批量修复命令列表
    6. 生成 GenericSolutionReport
- [ ] 验收标准：扫描 offline-packages/ 目录，识别 async-validator@4.2.5 存在 glob 问题，生成包含修复建议的 GenericSolutionReport

## 3. API 与 CLI 集成层实现

### 3.1 FilesFilterFixer 主入口类
- [ ] 新建 `src/files-filter/files-filter-fixer.ts`，实现程序化 API 主入口：
  - `diagnose(packageDir: string): Promise<DiagnosticReport>`：诊断单个包
  - `diagnoseAll(offlinePackagesDir: string): Promise<DiagnosticReport[]>`：诊断所有包
  - `fix(packageDir: string, options?: Partial<FilesFixOptions>): Promise<FixResult>`：修正单个包
  - `fixAll(offlinePackagesDir: string, options?: Partial<FilesFixOptions>): Promise<FixResult[]>`：修正所有问题包
  - `validate(packageDir: string): Promise<ValidationReport>`：验证单个包
  - `validateAll(offlinePackagesDir: string): Promise<ValidationReport[]>`：验证所有包
  - `scanAndGenerateSolution(offlinePackagesDir: string): Promise<GenericSolutionReport>`：扫描并生成通用方案
  - `rollback(packageDir: string): Promise<boolean>`：回滚修正操作
- [ ] 组合 DiagnosticModule、FilesFieldFixer、PublishValidator、GenericSolutionGenerator 四个核心模块
- [ ] 验收标准：通过 FilesFilterFixer 类可完整调用诊断→修正→验证流程

### 3.2 CLI 命令行接口
- [ ] 新建 `src/files-filter/cli.ts`，实现 CLI 命令注册和参数解析：
  - `npm run fix-files [--package <dir>] [--all] [--dry-run] [--no-backup] [--skip-validation]`：修正 files 字段
  - `npm run diagnose-files [--package <dir>] [--all]`：诊断 files 字段问题
  - `npm run validate-publish [--package <dir>] [--all]`：验证发布完整性
  - `npm run scan-files-issues [--dir <offline-packages>]`：扫描所有包的 files 字段问题
- [ ] 使用 `commander` 库（项目已有依赖）注册子命令
- [ ] 在 `package.json` 的 scripts 中注册上述 4 个 npm script 命令
- [ ] 输出格式化：使用彩色输出区分成功（绿色）、警告（黄色）、失败（红色）信息
- [ ] 验收标准：执行 `npm run diagnose-files -- --package offline-packages/async-validator@4.2.5` 能输出诊断报告

### 3.3 模块导出与注册
- [ ] 新建 `src/files-filter/index.ts`，导出 FilesFilterFixer 主入口类及所有核心类型
- [ ] 在 `src/index.ts` 中注册 files-filter 模块，使其可通过项目主入口访问
- [ ] 验收标准：`import { FilesFilterFixer } from './files-filter'` 可正常导入

## 4. 修复报告生成

### 4.1 报告生成器
- [ ] 在 `src/reporters/report-generator.ts` 中新增 files 修复报告生成方法（或新建 `src/files-filter/report-generator.ts`）：
  - `generateDiagnosticReport(report: DiagnosticReport): string`：生成可读的诊断报告文本
  - `generateFixReport(results: FixResult[]): string`：生成修正结果报告
  - `generateValidationReport(report: ValidationReport): string`：生成验证报告
  - `generateGenericSolutionReport(report: GenericSolutionReport): string`：生成通用方案报告
  - `saveFixReportToFile(report: FilesFixReport, filePath: string): Promise<void>`：将修复报告保存为 `files-fix-report.json`
- [ ] 报告内容包含：包名称/版本、原始 files 字段、修正后 files 字段、验证结果、操作时间
- [ ] 验收标准：生成的报告清晰展示 async-validator@4.2.5 的 files 字段变更和验证结果

## 5. 验证与测试

### 5.1 单元测试
- [ ] 编写 `src/files-filter/__tests__/glob-expander.test.ts`：
  - 测试 identifyGlobPatterns 识别含通配符的 files 条目
  - 测试 extractGlobPrefix 提取 glob 前缀（`dist-*/` → `dist-`）
  - 测试 expandGlobToExplicitDirs 将 `dist-*/` 展开为 `["dist-node/", "dist-types/", "dist-web/"]`
  - 测试不含通配符的条目原样返回
  - 测试空目录处理（本地不存在匹配目录时不添加到结果）
- [ ] 编写 `src/files-filter/__tests__/package-json-manager.test.ts`：
  - 测试读取、写入、备份、回滚 package.json 的完整流程
  - 测试 updateFilesField 仅修改 files 字段
- [ ] 编写 `src/files-filter/__tests__/diagnostic-module.test.ts`：
  - 测试对含 glob 模式的包进行诊断
  - 测试对无 files 字段的包进行诊断
- [ ] 编写 `src/files-filter/__tests__/files-field-fixer.test.ts`：
  - 测试修正流程（glob → 显式目录列表）
  - 测试 dryRun 模式不实际修改文件
  - 测试修正后验证失败时自动回滚
  - 测试保留非 glob 条目（如 `bin/`）
- [ ] 编写 `src/files-filter/__tests__/publish-validator.test.ts`：
  - 测试 5 项验证检查的通过和失败条件
  - 测试入口文件缺失检测
  - 测试包大小偏差计算
- [ ] 验收标准：所有测试通过，覆盖率 ≥ 80%

### 5.2 集成验证（async-validator@4.2.5 端到端）
- [ ] 对 `offline-packages/async-validator@4.2.5` 执行完整修复流程验证：
  1. 执行 `diagnose-files` 命令，确认诊断报告正确识别 `dist-*/` 的 glob 匹配问题
  2. 执行 `fix-files` 命令（带 `--dry-run`），确认修正建议为 `["dist-node/", "dist-types/", "dist-web/", "bin/"]`
  3. 执行 `fix-files` 命令（实际修改），确认 package.json 的 files 字段已更新
  4. 确认 `package.json.bak` 备份文件已创建
  5. 执行 `validate-publish` 命令，确认验证结果为 passed
  6. 执行 `npm pack --dry-run`，确认 tarball 包含 dist-types/ 和 dist-web/ 的文件
  7. 测试回滚：执行 rollback，确认 files 字段恢复为原始 `["dist-*/", "bin/"]`
- [ ] 验收标准：修复后 npm pack 输出包含所有 dist-* 目录文件，文件数量从 4 个增加到预期数量

### 5.3 批量扫描验证
- [ ] 执行 `scan-files-issues` 命令扫描 `offline-packages/` 目录
- [ ] 确认识别出 async-validator@4.2.5 为问题包
- [ ] 确认其他无 glob 问题的包被正确排除
- [ ] 确认生成的 GenericSolutionReport 包含批量修复命令
- [ ] 验收标准：扫描结果准确识别所有使用 glob 通配符的 files 字段

### 5.4 兼容性验证
- [ ] 确认修正后的 package.json 与 npm 6.x+ 兼容
- [ ] 确认修正不改变包的版本号（version 字段不变）
- [ ] 确认修正不改变 main、module、types 等入口字段
- [ ] 确认修正后的发布包运行时行为与原包一致
- [ ] 验收标准：修正前后包的 version、main、module、types 字段完全一致
