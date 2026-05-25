# **1. 实现模型**

## **1.1 上下文视图**

async-validator依赖修复组件是npm-install私有仓库管理系统中的核心修复模块。该系统基于Verdaccio构建，用于管理内部npm依赖包的完整性和可用性。组件的上下文关系如下：

```
外部系统层：
├── npm公共仓库 (npmjs.org) - 依赖包原始下载源
├── Verdaccio私有仓库 - 本地包存储和分发
├── 开发人员 - 依赖包使用者
└── 系统管理员 - 维护人员

组件核心层：
├── 依赖完整性检测模块
├── 依赖包修复模块
├── 修复验证模块
└── 报告生成模块

内部依赖层：
├── fs-extra (文件系统操作)
├── axios (HTTP客户端)
├── js-yaml (配置解析)
└── lodash (工具函数)
```

系统运行环境：Node.js 16+，Windows/Linux/macOS跨平台支持，Vue 3前端界面可选。

## **1.2 服务/组件总体架构**

采用分层架构设计，分为四个核心模块，支持插件化扩展：

```
架构分层：
┌─────────────────────────────────────────────────────────────┐
│                   用户界面层 (UI Layer)                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           修复状态监控 / 报告查看界面                    │  │
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   应用服务层 (Application Layer)            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │完整性检测│ │依赖包修复│ │修复验证 │ │报告生成  │        │
│  │ 服务    │ │ 服务    │ │ 服务    │ │ 服务    │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────────┤
│                   业务逻辑层 (Business Layer)                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           依赖修复业务流程编排器                         │  │
│  │           • 检测 → 下载 → 修复 → 验证 → 报告            │  │
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   数据访问层 (Data Access Layer)            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │文件系统 │ │HTTP请求 │ │本地存储 │ │日志记录 │        │
│  │ 操作    │ │ 客户端  │ │ 管理    │ │ 系统    │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────────┤
│                   基础设施层 (Infrastructure Layer)          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           Node.js运行时 / Verdaccio私有仓库             │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**核心组件职责划分**：
1. **依赖完整性检测模块**：负责检查async-validator包的文件完整性、依赖关系完整性和元数据一致性
2. **依赖包修复模块**：负责从npm公共仓库下载完整包、替换损坏文件、更新本地存储
3. **修复验证模块**：负责验证修复后的包可用性、API兼容性和功能完整性
4. **报告生成模块**：负责生成修复过程报告、问题统计和审计日志

## **1.3 实现设计文档**

### **技术栈选择**
- **运行时环境**：Node.js 16+ (提供文件系统操作、网络请求、进程管理能力)
- **核心依赖**：
  - `fs-extra`：增强型文件系统操作，支持Promise API
  - `axios`：HTTP客户端，支持请求重试和超时控制
  - `js-yaml`：解析Verdaccio配置文件
  - `lodash`：工具函数库，提供数据处理能力
  - `uuid`：生成唯一操作ID
- **测试框架**：使用现有`vitest`，支持单元测试和集成测试
- **日志系统**：内置`winston`或使用`console`增强，支持结构化日志输出

### **模块设计原则**
1. **单一职责原则**：每个模块只负责一个明确的功能
2. **开闭原则**：模块支持扩展，但不修改已有功能
3. **依赖倒置原则**：高层模块不依赖低层模块，都依赖抽象接口
4. **接口隔离原则**：客户端不应该依赖它不需要的接口
5. **最小权限原则**：模块只拥有完成其职责所需的最小权限

### **目录结构设计**
```
scripts/
├── repair/
│   ├── index.js                    # 修复模块主入口
│   ├── dependency-checker.js       # 依赖完整性检测
│   ├── package-repairer.js         # 依赖包修复器
│   ├── repair-validator.js         # 修复验证器
│   ├── report-generator.js         # 报告生成器
│   ├── error-handler.js            # 错误处理器
│   └── logger.js                   # 日志记录器
├── utils/
│   ├── file-utils.js               # 文件操作工具
│   ├── http-utils.js               # HTTP请求工具
│   ├── config-utils.js             # 配置管理工具
│   └── hash-utils.js               # 哈希计算工具
└── config/
    ├── repair-config.js            # 修复配置
    └── constants.js                # 常量定义
```

### **性能设计考虑**
1. **并发处理**：支持并行检测多个包的完整性，但串行执行修复操作避免竞争
2. **缓存机制**：缓存npm元数据请求结果，减少网络调用
3. **增量修复**：只下载缺失的文件，而不是整个包重新下载
4. **内存优化**：流式处理大文件，避免内存溢出
5. **超时控制**：所有网络操作设置合理超时，防止阻塞

# **2. 接口设计**

## **2.1 总体设计**

采用模块化接口设计，对外提供统一的修复服务接口，对内实现细粒度的功能接口：

### **外部接口（CLI/API）**
```javascript
// 命令行接口
class DependencyRepairCLI {
  // 检查指定包的完整性
  async checkIntegrity(packageName: string, version?: string): Promise<IntegrityReport>
  
  // 修复指定包
  async repairPackage(packageName: string, options?: RepairOptions): Promise<RepairResult>
  
  // 批量检查完整性
  async batchCheck(packages: PackageInfo[]): Promise<BatchReport>
  
  // 生成修复报告
  async generateReport(reportId: string, format: 'json' | 'markdown' | 'html'): Promise<string>
}

// REST API接口（可选扩展）
class DependencyRepairAPI {
  // HTTP端点设计
  POST /api/v1/repair/check    // 触发完整性检查
  POST /api/v1/repair/repair   // 触发修复操作
  GET  /api/v1/repair/report   // 获取修复报告
  GET  /api/v1/repair/status   // 查询修复状态
}
```

### **内部接口设计**
采用面向接口编程，定义清晰的契约：

```typescript
// 依赖完整性检测接口
interface IDependencyChecker {
  checkPackage(packageName: string, version: string): Promise<PackageIntegrityStatus>
  checkFiles(packagePath: string): Promise<FileIntegrityReport>
  checkDependencies(packagePath: string): Promise<DependencyIntegrityReport>
}

// 依赖包修复接口
interface IPackageRepairer {
  repair(packageInfo: PackageInfo): Promise<RepairResult>
  downloadFromNpm(packageName: string, version: string): Promise<DownloadResult>
  replaceFiles(sourcePath: string, targetPath: string): Promise<void>
  rollbackIfFailed(operationId: string): Promise<void>
}

// 修复验证接口
interface IRepairValidator {
  validateRepair(packagePath: string): Promise<ValidationResult>
  testPackageFunctionality(packagePath: string): Promise<TestResult>
  verifyApiCompatibility(packagePath: string, originalPath: string): Promise<CompatibilityResult>
}

// 报告生成接口
interface IReportGenerator {
  generateIntegrityReport(checkResults: IntegrityCheckResult[]): Promise<Report>
  generateRepairReport(repairResults: RepairResult[]): Promise<Report>
  generateSummaryReport(): Promise<Report>
}
```

## **2.2 接口清单**

### **核心功能接口**

**1. 依赖完整性检测接口**
```typescript
// 完整性检查服务
interface IntegrityCheckService {
  // 检查单个包的完整性
  checkPackageIntegrity(
    packageName: string, 
    version?: string
  ): Promise<PackageIntegrityResult>
  
  // 批量检查包完整性
  checkMultiplePackages(
    packages: Array<{name: string, version?: string}>
  ): Promise<BatchIntegrityResult>
  
  // 获取包的完整性历史
  getIntegrityHistory(
    packageName: string, 
    days?: number
  ): Promise<IntegrityHistory[]>
}
```

**2. 依赖包修复接口**
```typescript
// 包修复服务
interface PackageRepairService {
  // 修复单个包
  repairPackage(
    packageName: string,
    options?: {
      force?: boolean;           // 强制重新下载
      skipValidation?: boolean;  // 跳过验证
      backup?: boolean;         // 备份原始文件
    }
  ): Promise<RepairOperation>
  
  // 批量修复包
  repairMultiplePackages(
    packages: Array<{name: string, version?: string}>
  ): Promise<BatchRepairResult>
  
  // 获取修复状态
  getRepairStatus(operationId: string): Promise<RepairStatus>
  
  // 取消修复操作
  cancelRepair(operationId: string): Promise<void>
}
```

**3. 修复验证接口**
```typescript
// 修复验证服务
interface RepairValidationService {
  // 验证修复后的包
  validateRepairedPackage(
    packagePath: string,
    originalPath?: string
  ): Promise<ValidationResult>
  
  // 运行包的测试套件
  runPackageTests(
    packagePath: string,
    testCommand?: string
  ): Promise<TestResult>
  
  // 验证API兼容性
  verifyApiCompatibility(
    repairedPath: string,
    originalPath: string
  ): Promise<CompatibilityReport>
}
```

**4. 报告生成接口**
```typescript
// 报告服务
interface ReportService {
  // 生成完整性报告
  generateIntegrityReport(
    checkId: string,
    format: ReportFormat
  ): Promise<ReportOutput>
  
  // 生成修复报告
  generateRepairReport(
    operationId: string,
    format: ReportFormat
  ): Promise<ReportOutput>
  
  // 生成系统健康报告
  generateHealthReport(): Promise<HealthReport>
}
```

### **工具接口**

**5. 文件系统操作接口**
```typescript
interface FileSystemService {
  // 检查文件完整性
  verifyFileIntegrity(
    filePath: string,
    expectedHash?: string
  ): Promise<FileIntegrity>
  
  // 安全复制文件
  copyFileSafely(
    source: string,
    target: string,
    options?: CopyOptions
  ): Promise<void>
  
  // 计算目录哈希
  calculateDirectoryHash(
    dirPath: string,
    algorithm?: string
  ): Promise<string>
}
```

**6. HTTP客户端接口**
```typescript
interface HttpClientService {
  // 下载文件
  downloadFile(
    url: string,
    destination: string,
    options?: DownloadOptions
  ): Promise<DownloadResult>
  
  // 获取npm包元数据
  getNpmPackageInfo(
    packageName: string,
    version?: string
  ): Promise<NpmPackageInfo>
  
  // 获取包tarball
  getPackageTarball(
    packageName: string,
    version: string
  ): Promise<Stream>
}
```

### **配置接口**

**7. 配置管理接口**
```typescript
interface ConfigService {
  // 获取修复配置
  getRepairConfig(): RepairConfig
  
  // 更新配置
  updateConfig(
    config: Partial<RepairConfig>
  ): Promise<void>
  
  // 验证配置有效性
  validateConfig(config: RepairConfig): ValidationResult
}

// 修复配置类型
interface RepairConfig {
  // 网络配置
  network: {
    timeout: number;          // 请求超时(ms)
    retryCount: number;       // 重试次数
    retryDelay: number;       // 重试延迟(ms)
    maxConcurrent: number;    // 最大并发数
  };
  
  // 文件配置
  files: {
    maxFileSize: number;      // 最大文件大小(bytes)
    backupEnabled: boolean;   // 是否启用备份
    tempDir: string;         // 临时目录路径
  };
  
  // 验证配置
  validation: {
    enableTests: boolean;     // 是否运行测试
    testTimeout: number;      // 测试超时时间
    hashAlgorithm: string;    // 哈希算法
  };
  
  // 日志配置
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    filePath: string;        // 日志文件路径
    maxSize: number;         // 最大文件大小
    maxFiles: number;        // 最大文件数
  };
}
```

# **3. 实现设计文档**

## **3.1 依赖完整性检测算法**

### **3.1.1 文件完整性检测算法**
```typescript
// 算法：文件完整性检测
function checkFileIntegrity(packagePath: string): FileIntegrityReport {
  // 步骤1：获取package.json文件
  const packageJson = readPackageJson(packagePath);
  
  // 步骤2：构建期望文件列表
  const expectedFiles = [
    'package.json',
    'README.md',
    'LICENSE',
    'index.js',
    ...packageJson.main ? [packageJson.main] : [],
    ...packageJson.files || [],
    ...getDefaultExpectedFiles(packageJson.type)
  ];
  
  // 步骤3：检查文件存在性
  const missingFiles = [];
  const existingFiles = [];
  
  for (const file of expectedFiles) {
    const fullPath = path.join(packagePath, file);
    if (fs.existsSync(fullPath)) {
      // 检查文件内容完整性
      const fileStats = fs.statSync(fullPath);
      if (fileStats.size === 0) {
        missingFiles.push({ file, reason: 'file_empty' });
      } else {
        existingFiles.push({ file, size: fileStats.size });
      }
    } else {
      missingFiles.push({ file, reason: 'not_found' });
    }
  }
  
  // 步骤4：计算完整性评分
  const integrityScore = calculateIntegrityScore(
    existingFiles.length,
    expectedFiles.length,
    missingFiles
  );
  
  return {
    packagePath,
    expectedFiles: expectedFiles.length,
    existingFiles: existingFiles.length,
    missingFiles,
    integrityScore,
    status: getIntegrityStatus(integrityScore)
  };
}

// 完整性评分计算函数
function calculateIntegrityScore(existing: number, expected: number, missing: any[]): number {
  const baseScore = (existing / expected) * 100;
  
  // 根据缺失文件重要性调整分数
  let penalty = 0;
  for (const missingFile of missingFiles) {
    if (isCriticalFile(missingFile.file)) {
      penalty += 30; // 关键文件缺失重罚
    } else if (isImportantFile(missingFile.file)) {
      penalty += 15; // 重要文件缺失中等惩罚
    } else {
      penalty += 5;  // 普通文件缺失轻罚
    }
  }
  
  return Math.max(0, baseScore - penalty);
}
```

### **3.1.2 依赖关系检测算法**
```typescript
// 算法：依赖关系完整性检测
function checkDependencyIntegrity(packagePath: string): DependencyIntegrityReport {
  const packageJson = readPackageJson(packagePath);
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies
  };
  
  const nodeModulesPath = path.join(packagePath, 'node_modules');
  const missingDeps = [];
  const availableDeps = [];
  
  // 检查每个依赖
  for (const [depName, depVersion] of Object.entries(dependencies)) {
    const depPath = path.join(nodeModulesPath, depName);
    
    if (fs.existsSync(depPath)) {
      // 检查版本匹配
      const installedVersion = getInstalledVersion(depPath);
      if (satisfiesVersion(installedVersion, depVersion)) {
        availableDeps.push({ name: depName, version: installedVersion });
      } else {
        missingDeps.push({
          name: depName,
          expected: depVersion,
          actual: installedVersion,
          reason: 'version_mismatch'
        });
      }
    } else {
      missingDeps.push({
        name: depName,
        expected: depVersion,
        actual: null,
        reason: 'not_installed'
      });
    }
  }
  
  // 检查嵌套依赖
  const nestedDeps = checkNestedDependencies(packagePath);
  
  return {
    totalDependencies: Object.keys(dependencies).length,
    availableDependencies: availableDeps.length,
    missingDependencies: missingDeps.length,
    missingDeps,
    nestedDepsStatus: nestedDeps.status,
    dependencyScore: calculateDependencyScore(availableDeps.length, missingDeps.length)
  };
}
```

### **3.1.3 哈希校验算法**
```typescript
// 算法：文件哈希校验
async function verifyFileHash(filePath: string, expectedHash?: string): Promise<HashVerification> {
  const algorithm = 'sha256';
  const hash = crypto.createHash(algorithm);
  
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    
    stream.on('end', () => {
      const actualHash = hash.digest('hex');
      const match = expectedHash ? actualHash === expectedHash : null;
      
      resolve({
        filePath,
        algorithm,
        hash: actualHash,
        expectedHash,
        match,
        verifiedAt: new Date().toISOString()
      });
    });
    
    stream.on('error', reject);
  });
}

// 批量哈希校验
async function verifyPackageHashes(packagePath: string): Promise<PackageHashReport> {
  const files = getAllFiles(packagePath);
  const hashResults = [];
  
  // 限制并发数量，避免内存溢出
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(file => verifyFileHash(file))
    );
    hashResults.push(...batchResults);
  }
  
  // 计算整体哈希（基于所有文件哈希的哈希）
  const overallHash = calculateOverallHash(hashResults);
  
  return {
    packagePath,
    totalFiles: files.length,
    verifiedFiles: hashResults.length,
    hashResults,
    overallHash,
    verificationTime: new Date().toISOString()
  };
}
```

## **3.2 自动修复流程算法**

### **3.2.1 主修复流程算法**
```typescript
// 算法：自动修复主流程
async function repairPackage(packageName: string, version: string): Promise<RepairResult> {
  const operationId = generateOperationId();
  const startTime = Date.now();
  
  try {
    logger.info(`[${operationId}] 开始修复包: ${packageName}@${version}`);
    
    // 步骤1：完整性检查
    const integrityReport = await checkPackageIntegrity(packageName, version);
    logger.info(`[${operationId}] 完整性检查完成`, integrityReport);
    
    // 步骤2：如果包完整，直接返回
    if (integrityReport.status === 'complete') {
      logger.info(`[${operationId}] 包已完整，无需修复`);
      return {
        operationId,
        packageName,
        version,
        status: 'skipped',
        reason: 'package_already_complete',
        duration: Date.now() - startTime
      };
    }
    
    // 步骤3：备份原始包（如果存在）
    const backupPath = await backupOriginalPackage(packageName, version, operationId);
    
    // 步骤4：从npm下载完整包
    const downloadedPath = await downloadFromNpm(packageName, version, operationId);
    
    // 步骤5：替换损坏文件
    await replacePackageFiles(packageName, version, downloadedPath, operationId);
    
    // 步骤6：验证修复结果
    const validationResult = await validateRepairedPackage(packageName, version, operationId);
    
    // 步骤7：如果验证失败，执行回滚
    if (!validationResult.success) {
      logger.warn(`[${operationId}] 修复验证失败，执行回滚`);
      await rollbackPackage(packageName, version, backupPath, operationId);
      
      return {
        operationId,
        packageName,
        version,
        status: 'failed',
        reason: 'validation_failed',
        error: validationResult.error,
        duration: Date.now() - startTime
      };
    }
    
    // 步骤8：清理备份
    await cleanupBackup(backupPath, operationId);
    
    // 步骤9：生成修复报告
    const report = await generateRepairReport(operationId);
    
    logger.info(`[${operationId}] 修复完成，耗时: ${Date.now() - startTime}ms`);
    
    return {
      operationId,
      packageName,
      version,
      status: 'success',
      validationResult,
      report,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error(`[${operationId}] 修复过程发生错误`, error);
    
    // 尝试回滚
    try {
      await attemptRollback(operationId);
    } catch (rollbackError) {
      logger.error(`[${operationId}] 回滚失败`, rollbackError);
    }
    
    return {
      operationId,
      packageName,
      version,
      status: 'failed',
      reason: 'unexpected_error',
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}
```

### **3.2.2 智能下载算法**
```typescript
// 算法：智能包下载
async function downloadPackageIntelligently(packageName: string, version: string): Promise<DownloadResult> {
  const strategies = [
    // 策略1：尝试从官方npm仓库下载
    async () => downloadFromOfficialNpm(packageName, version),
    
    // 策略2：如果官方下载失败，尝试从镜像源下载
    async () => downloadFromMirror(packageName, version),
    
    // 策略3：如果镜像也失败，尝试从缓存获取
    async () => downloadFromCache(packageName, version),
    
    // 策略4：最后尝试使用备用版本
    async () => downloadAlternativeVersion(packageName, version)
  ];
  
  let lastError;
  
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      logger.info(`下载策略成功: ${strategy.name}`);
      return result;
    } catch (error) {
      logger.warn(`下载策略失败: ${strategy.name}`, error);
      lastError = error;
      
      // 如果不是最后一个策略，继续尝试下一个
      if (strategy !== strategies[strategies.length - 1]) {
        await sleep(1000); // 等待1秒再重试
      }
    }
  }
  
  throw new Error(`所有下载策略都失败: ${lastError?.message}`);
}
```

### **3.2.3 增量修复算法**
```typescript
// 算法：增量文件修复
async function repairIncrementally(
  originalPath: string,
  expectedFiles: FileInfo[],
  sourcePath: string
): Promise<RepairOperation> {
  const operation = {
    repairedFiles: 0,
    skippedFiles: 0,
    failedFiles: 0,
    details: []
  };
  
  // 对缺失文件按重要性排序
  const sortedFiles = expectedFiles.sort((a, b) => {
    const priorityA = getFilePriority(a.path);
    const priorityB = getFilePriority(b.path);
    return priorityB - priorityA; // 高优先级优先
  });
  
  for (const fileInfo of sortedFiles) {
    const targetFile = path.join(originalPath, fileInfo.path);
    const sourceFile = path.join(sourcePath, fileInfo.path);
    
    try {
      // 检查目标文件是否存在且完整
      const targetExists = await fileExists(targetFile);
      const sourceExists = await fileExists(sourceFile);
      
      if (!targetExists && sourceExists) {
        // 文件缺失，从源复制
        await copyFileSafely(sourceFile, targetFile);
        operation.repairedFiles++;
        operation.details.push({
          file: fileInfo.path,
          action: 'added',
          success: true
        });
        logger.info(`已添加缺失文件: ${fileInfo.path}`);
        
      } else if (targetExists && sourceExists) {
        // 文件存在，检查是否需要更新
        const targetHash = await calculateFileHash(targetFile);
        const sourceHash = await calculateFileHash(sourceFile);
        
        if (targetHash !== sourceHash) {
          // 文件内容不同，更新文件
          await backupFile(targetFile);
          await copyFileSafely(sourceFile, targetFile);
          operation.repairedFiles++;
          operation.details.push({
            file: fileInfo.path,
            action: 'updated',
            success: true
          });
          logger.info(`已更新文件: ${fileInfo.path}`);
        } else {
          // 文件相同，跳过
          operation.skippedFiles++;
          operation.details.push({
            file: fileInfo.path,
            action: 'skipped',
            success: true
          });
        }
        
      } else if (targetExists && !sourceExists) {
        // 目标文件存在但源文件不存在，记录但不删除
        operation.details.push({
          file: fileInfo.path,
          action: 'orphaned',
          success: true,
          note: '文件存在于目标但源中不存在'
        });
        logger.warn(`孤儿文件: ${fileInfo.path}`);
        
      } else {
        // 源文件也不存在，无法修复
        operation.failedFiles++;
        operation.details.push({
          file: fileInfo.path,
          action: 'failed',
          success: false,
          error: '源文件不存在'
        });
        logger.error(`无法修复文件: ${fileInfo.path}，源文件不存在`);
      }
      
    } catch (error) {
      operation.failedFiles++;
      operation.details.push({
        file: fileInfo.path,
        action: 'failed',
        success: false,
        error: error.message
      });
      logger.error(`修复文件失败: ${fileInfo.path}`, error);
    }
  }
  
  return operation;
}

// 文件优先级计算
function getFilePriority(filePath: string): number {
  const priorities = {
    'package.json': 100,      // 最高优先级
    'index.js': 90,
    'index.d.ts': 85,
    'README.md': 30,
    'LICENSE': 25,
    'CHANGELOG.md': 20,
    '.npmignore': 15
  };
  
  const fileName = path.basename(filePath);
  if (priorities[fileName]) {
    return priorities[fileName];
  }
  
  // 根据文件扩展名判断优先级
  const ext = path.extname(filePath);
  const extPriority = {
    '.js': 80,
    '.ts': 75,
    '.json': 70,
    '.md': 20,
    '.txt': 10
  };
  
  return extPriority[ext] || 5;
}
```

## **3.3 修复验证算法**

### **3.3.1 API兼容性验证算法**
```typescript
// 算法：API兼容性验证
async function verifyApiCompatibility(
  originalPath: string,
  repairedPath: string
): Promise<CompatibilityReport> {
  const report = {
    totalApis: 0,
    compatibleApis: 0,
    incompatibleApis: 0,
    missingApis: 0,
    details: []
  };
  
  try {
    // 步骤1：提取原始包的API
    const originalApis = await extractPackageApis(originalPath);
    
    // 步骤2：提取修复后包的API
    const repairedApis = await extractPackageApis(repairedPath);
    
    report.totalApis = originalApis.length;
    
    // 步骤3：比较API
    for (const originalApi of originalApis) {
      const repairedApi = repairedApis.find(api => api.name === originalApi.name);
      
      if (repairedApi) {
        // 检查API兼容性
        const isCompatible = checkApiCompatibility(originalApi, repairedApi);
        
        if (isCompatible) {
          report.compatibleApis++;
          report.details.push({
            api: originalApi.name,
            status: 'compatible',
            originalType: originalApi.type,
            repairedType: repairedApi.type
          });
        } else {
          report.incompatibleApis++;
          report.details.push({
            api: originalApi.name,
            status: 'incompatible',
            originalType: originalApi.type,
            repairedType: repairedApi.type,
            differences: findApiDifferences(originalApi, repairedApi)
          });
        }
      } else {
        report.missingApis++;
        report.details.push({
          api: originalApi.name,
          status: 'missing',
          originalType: originalApi.type
        });
      }
    }
    
    // 步骤4：计算兼容性分数
    report.compatibilityScore = calculateCompatibilityScore(
      report.compatibleApis,
      report.totalApis
    );
    
    // 步骤5：确定整体兼容性状态
    report.overallStatus = determineCompatibilityStatus(report.compatibilityScore);
    
  } catch (error) {
    report.error = error.message;
    report.overallStatus = 'verification_failed';
  }
  
  return report;
}

// API提取函数
async function extractPackageApis(packagePath: string): Promise<PackageApi[]> {
  const apis = [];
  const packageJson = await readPackageJson(packagePath);
  
  // 从package.json中提取导出信息
  if (packageJson.exports) {
    apis.push(...extractExportsFromPackageJson(packageJson.exports));
  }
  
  // 从主入口文件提取API
  const mainFile = packageJson.main || 'index.js';
  const mainFilePath = path.join(packagePath, mainFile);
  
  if (await fileExists(mainFilePath)) {
    const mainApis = await extractApisFromFile(mainFilePath);
    apis.push(...mainApis);
  }
  
  // 从类型定义文件提取API（如果有）
  const typeFile = packageJson.types || packageJson.typings || 'index.d.ts';
  const typeFilePath = path.join(packagePath, typeFile);
  
  if (await fileExists(typeFilePath)) {
    const typeApis = await extractApisFromTypeFile(typeFilePath);
    apis.push(...typeApis);
  }
  
  return deduplicateApis(apis);
}
```

### **3.3.2 功能测试验证算法**
```typescript
// 算法：功能测试验证
async function testPackageFunctionality(
  packagePath: string,
  testConfig: TestConfig = {}
): Promise<TestResult> {
  const defaultConfig = {
    timeout: 30000, // 30秒超时
    testFiles: ['test', 'tests', '__tests__'],
    testPattern: /\.(test|spec)\.(js|ts)$/,
    testCommand: 'npm test'
  };
  
  const config = { ...defaultConfig, ...testConfig };
  const result = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    details: [],
    duration: 0
  };
  
  const startTime = Date.now();
  
  try {
    // 步骤1：查找测试文件
    const testFiles = await findTestFiles(packagePath, config);
    
    if (testFiles.length === 0) {
      // 如果没有测试文件，运行包的基本功能测试
      result.skipped = 1;
      result.total = 1;
      result.details.push({
        test: 'basic_functionality',
        status: 'skipped',
        reason: 'no_test_files_found'
      });
      logger.warn('未找到测试文件，跳过功能测试');
    } else {
      result.total = testFiles.length;
      
      // 步骤2：运行测试
      for (const testFile of testFiles) {
        try {
          const testResult = await runSingleTest(testFile, config);
          
          if (testResult.passed) {
            result.passed++;
            result.details.push({
              test: path.basename(testFile),
              status: 'passed',
              duration: testResult.duration
            });
          } else {
            result.failed++;
            result.details.push({
              test: path.basename(testFile),
              status: 'failed',
              error: testResult.error,
              duration: testResult.duration
            });
          }
        } catch (error) {
          result.failed++;
          result.details.push({
            test: path.basename(testFile),
            status: 'error',
            error: error.message
          });
        }
      }
    }
    
    // 步骤3：运行包的基本导入测试
    const importTest = await testPackageImport(packagePath);
    result.total++;
    
    if (importTest.success) {
      result.passed++;
      result.details.push({
        test: 'package_import',
        status: 'passed',
        duration: importTest.duration
      });
    } else {
      result.failed++;
      result.details.push({
        test: 'package_import',
        status: 'failed',
        error: importTest.error
      });
    }
    
  } catch (error) {
    result.details.push({
      test: 'test_execution',
      status: 'error',
      error: error.message
    });
  }
  
  result.duration = Date.now() - startTime;
  result.success = result.failed === 0;
  
  return result;
}

// 测试包导入
async function testPackageImport(packagePath: string): Promise<ImportTestResult> {
  const startTime = Date.now();
  
  try {
    // 临时修改NODE_PATH以包含包路径
    const originalNodePath = process.env.NODE_PATH;
    process.env.NODE_PATH = `${packagePath}${path.delimiter}${originalNodePath || ''}`;
    
    // 尝试导入包
    const packageJson = require(path.join(packagePath, 'package.json'));
    const mainFile = packageJson.main || 'index.js';
    
    // 使用子进程测试导入，避免影响主进程
    const importTest = await testImportInChildProcess(packagePath, mainFile);
    
    // 恢复原始NODE_PATH
    process.env.NODE_PATH = originalNodePath;
    
    return {
      success: importTest.success,
      duration: Date.now() - startTime,
      error: importTest.error
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}
```

# **4. 数据模型**

## **4.1 设计目标**

数据模型设计遵循以下目标：

1. **完整性**：完整记录依赖包的检查、修复、验证全生命周期数据
2. **可追溯性**：每个操作都有唯一ID，支持操作链追溯
3. **可审计性**：所有关键操作都记录详细日志，满足审计需求
4. **性能优化**：数据结构支持快速查询和统计分析
5. **扩展性**：模型设计支持未来功能扩展，不破坏现有结构
6. **兼容性**：与现有npm-install系统数据结构兼容

## **4.2 模型实现**

### **核心数据模型**

```typescript
// 包完整性状态模型
interface PackageIntegrityStatus {
  // 基础信息
  packageName: string;
  version: string;
  packagePath: string;
  
  // 完整性状态
  status: 'complete' | 'partial' | 'corrupted' | 'missing' | 'unknown';
  integrityScore: number; // 0-100分
  
  // 文件检查结果
  fileIntegrity: {
    totalFiles: number;
    existingFiles: number;
    missingFiles: number;
    corruptedFiles: number;
    fileDetails: FileIntegrityDetail[];
  };
  
  // 依赖检查结果
  dependencyIntegrity: {
    totalDependencies: number;
    availableDependencies: number;
    missingDependencies: number;
    versionMismatches: number;
    dependencyDetails: DependencyDetail[];
  };
  
  // 元数据检查结果
  metadataIntegrity: {
    packageJsonValid: boolean;
    hasReadme: boolean;
    hasLicense: boolean;
    hasTests: boolean;
    hasTypes: boolean;
  };
  
  // 时间信息
  checkedAt: string; // ISO时间戳
  checkDuration: number; // 毫秒
}

// 文件完整性详情
interface FileIntegrityDetail {
  filePath: string;
  status: 'exists' | 'missing' | 'corrupted' | 'empty';
  expectedSize?: number;
  actualSize?: number;
  expectedHash?: string;
  actualHash?: string;
  priority: 'critical' | 'important' | 'normal' | 'optional';
}

// 依赖详情
interface DependencyDetail {
  name: string;
  expectedVersion: string;
  actualVersion?: string;
  status: 'available' | 'missing' | 'version_mismatch';
  path?: string;
  isPeerDependency: boolean;
  isDevDependency: boolean;
}
```

### **修复操作模型**

```typescript
// 修复操作记录模型
interface RepairOperation {
  // 操作标识
  operationId: string;
  packageName: string;
  version: string;
  
  // 操作状态
  status: 'pending' | 'downloading' | 'repairing' | 'validating' | 'completed' | 'failed' | 'rolled_back';
  
  // 进度信息
  progress: {
    currentStep: string;
    percentage: number;
    estimatedRemaining?: number; // 毫秒
  };
  
  // 修复详情
  repairDetails: {
    originalPath: string;
    backupPath?: string;
    downloadedPath?: string;
    repairMethod: 'full_download' | 'incremental' | 'file_replacement';
    filesRepaired: number;
    filesSkipped: number;
    filesFailed: number;
    repairLogs: RepairLogEntry[];
  };
  
  // 验证结果
  validationResult?: ValidationResult;
  
  // 时间信息
  startedAt: string;
  completedAt?: string;
  duration?: number;
  
  // 错误信息
  error?: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
}

// 修复日志条目
interface RepairLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  step: string;
}
```

### **验证结果模型**

```typescript
// 验证结果模型
interface ValidationResult {
  // 基本信息
  validationId: string;
  packageName: string;
  version: string;
  
  // 整体验证状态
  overallStatus: 'passed' | 'failed' | 'partial' | 'skipped';
  validationScore: number; // 0-100分
  
  // 各维度验证结果
  dimensions: {
    fileIntegrity: {
      status: 'passed' | 'failed';
      score: number;
      details: FileValidationDetail[];
    };
    
    dependencyIntegrity: {
      status: 'passed' | 'failed';
      score: number;
      details: DependencyValidationDetail[];
    };
    
    apiCompatibility: {
      status: 'passed' | 'failed' | 'not_applicable';
      score: number;
      details: ApiCompatibilityDetail[];
    };
    
    functionality: {
      status: 'passed' | 'failed' | 'skipped';
      score: number;
      details: FunctionalityTestDetail[];
    };
  };
  
  // 建议
  recommendations: ValidationRecommendation[];
  
  // 时间信息
  validatedAt: string;
  validationDuration: number;
}

// 文件验证详情
interface FileValidationDetail {
  filePath: string;
  checkType: 'existence' | 'size' | 'hash' | 'permissions';
  expectedValue?: any;
  actualValue?: any;
  status: 'passed' | 'failed' | 'warning';
  message: string;
}

// API兼容性详情
interface ApiCompatibilityDetail {
  apiName: string;
  apiType: 'function' | 'class' | 'object' | 'type' | 'variable';
  compatibility: 'compatible' | 'incompatible' | 'missing';
  changes?: ApiChange[];
  severity: 'high' | 'medium' | 'low';
}

// 功能测试详情
interface FunctionalityTestDetail {
  testName: string;
  testType: 'unit' | 'integration' | 'import' | 'basic';
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  error?: string;
  output?: string;
}
```

### **报告模型**

```typescript
// 完整性报告模型
interface IntegrityReport {
  // 报告元数据
  reportId: string;
  generatedAt: string;
  scope: {
    packages: PackageInfo[];
    startTime: string;
    endTime: string;
  };
  
  // 检查摘要
  summary: {
    totalPackages: number;
    completePackages: number;
    partialPackages: number;
    corruptedPackages: number;
    missingPackages: number;
    overallIntegrityScore: number;
  };
  
  // 详细结果
  packages: PackageIntegrityStatus[];
  
  // 问题分类
  issues: {
    bySeverity: {
      critical: IssueDetail[];
      high: IssueDetail[];
      medium: IssueDetail[];
      low: IssueDetail[];
    };
    byType: {
      fileMissing: IssueDetail[];
      fileCorrupted: IssueDetail[];
      dependencyMissing: IssueDetail[];
      versionMismatch: IssueDetail[];
      metadataIssue: IssueDetail[];
    };
  };
  
  // 修复建议
  recommendations: RepairRecommendation[];
  
  // 统计信息
  statistics: {
    checkDuration: number;
    averageIntegrityScore: number;
    mostCommonIssue: string;
    packagesNeedingRepair: number;
  };
}

// 修复报告模型
interface RepairReport {
  // 报告元数据
  reportId: string;
  operationId: string;
  generatedAt: string;
  
  // 修复摘要
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    skippedOperations: number;
    overallSuccessRate: number;
    totalDuration: number;
  };
  
  // 操作详情
  operations: RepairOperation[];
  
  // 资源使用
  resourceUsage: {
    diskSpaceUsed: number;
    networkTraffic: number;
    peakMemoryUsage: number;
    cpuTime: number;
  };
  
  // 影响分析
  impactAnalysis: {
    packagesRepaired: string[];
    packagesStillProblematic: string[];
    estimatedRiskReduction: number; // 0-100%
    businessImpact: 'high' | 'medium' | 'low';
  };
  
  // 后续步骤
  nextSteps: NextStep[];
}

// 问题详情
interface IssueDetail {
  packageName: string;
  version: string;
  issueType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedFiles?: string[];
  affectedDependencies?: string[];
  suggestedFix: string;
}
```

### **配置模型**

```typescript
// 修复配置模型
interface RepairConfig {
  // 网络配置
  network: {
    npmRegistry: string;
    timeout: number; // 毫秒
    maxRetries: number;
    retryDelay: number; // 毫秒
    concurrentDownloads: number;
    rateLimit: {
      enabled: boolean;
      requestsPerMinute: number;
    };
  };
  
  // 文件配置
  files: {
    tempDirectory: string;
    backupDirectory: string;
    maxBackupAge: number; // 天
    maxFileSize: number; // 字节
    hashAlgorithm: 'md5' | 'sha1' | 'sha256' | 'sha512';
  };
  
  // 检查配置
  checks: {
    enableFileCheck: boolean;
    enableDependencyCheck: boolean;
    enableHashVerification: boolean;
    enableMetadataCheck: boolean;
    criticalFiles: string[];
    optionalFiles: string[];
    fileSizeThreshold: number; // 字节
  };
  
  // 修复配置
  repair: {
    autoRepair: boolean;
    repairMethod: 'full' | 'incremental' | 'smart';
    enableBackup: boolean;
    enableRollback: boolean;
    maxRepairAttempts: number;
    validationRequired: boolean;
  };
  
  // 验证配置
  validation: {
    enableApiCheck: boolean;
    enableFunctionalityTest: boolean;
    testTimeout: number; // 毫秒
    compatibilityThreshold: number; // 0-100%
    failOnCriticalIssues: boolean;
  };
  
  // 报告配置
  reporting: {
    enableReports: boolean;
    reportFormats: ('json' | 'markdown' | 'html' | 'pdf')[];
    reportDirectory: string;
    retentionDays: number;
    enableEmailAlerts: boolean;
    alertThresholds: {
      integrityScore: number;
      failedOperations: number;
      criticalIssues: number;
    };
  };
  
  // 日志配置
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    directory: string;
    maxFileSize: number; // 字节
    maxFiles: number;
    enableConsole: boolean;
    enableFile: boolean;
    format: 'json' | 'text';
  };
  
  // 性能配置
  performance: {
    maxConcurrentChecks: number;
    maxConcurrentRepairs: number;
    cacheEnabled: boolean;
    cacheTTL: number; // 毫秒
    memoryLimit: number; // MB
  };
}
```

### **性能指标模型**

```typescript
// 性能指标模型
interface PerformanceMetrics {
  // 时间指标
  timings: {
    checkDuration: number;
    repairDuration: number;
    validationDuration: number;
    totalDuration: number;
    averagePerPackage: number;
  };
  
  // 资源指标
  resources: {
    memoryUsage: {
      peak: number; // MB
      average: number; // MB
      final: number; // MB
    };
    cpuUsage: {
      peak: number; // %
      average: number; // %
    };
    diskUsage: {
      before: number; // MB
      after: number; // MB
      delta: number; // MB
    };
    networkUsage: {
      downloaded: number; // MB
      uploaded: number; // MB
    };
  };
  
  // 效率指标
  efficiency: {
    packagesPerMinute: number;
    successRate: number; // 0-100%
    cacheHitRate: number; // 0-100%
    compressionRatio: number; // 下载文件压缩比
  };
  
  // 质量指标
  quality: {
    integrityImprovement: number; // 0-100%
    falsePositiveRate: number; // 0-100%
    falseNegativeRate: number; // 0-100%
    validationAccuracy: number; // 0-100%
  };
  
  // 系统指标
  system: {
    concurrentOperations: number;
    queueLength: number;
    errorRate: number; // 0-100%
    retryRate: number; // 0-100%
  };
}
```

### **审计日志模型**

```typescript
// 审计日志模型
interface AuditLog {
  // 日志标识
  logId: string;
  timestamp: string;
  
  // 操作信息
  operation: {
    type: 'check' | 'repair' | 'validation' | 'report' | 'config';
    id?: string;
    name: string;
    description: string;
  };
  
  // 用户/系统上下文
  context: {
    userId?: string;
    userAgent?: string;
    ipAddress?: string;
    systemId: string;
    environment: 'development' | 'staging' | 'production';
  };
  
  // 操作详情
  details: {
    packageName?: string;
    version?: string;
    operationId?: string;
    parameters?: any;
    result?: any;
    error?: any;
  };
  
  // 安全信息
  security: {
    authenticationMethod?: string;
    authorizationLevel: 'user' | 'admin' | 'system';
    signature?: string;
  };
  
  // 性能数据
  performance?: {
    duration: number;
    resourceUsage: {
      memory: number;
      cpu: number;
      disk: number;
    };
  };
  
  // 合规信息
  compliance: {
    dataRetention: boolean;
    privacyProtected: boolean;
    auditRequired: boolean;
  };
}
```

### **错误处理模型**

```typescript
// 错误类型定义
enum RepairErrorCode {
  // 网络错误
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  
  // 文件系统错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DISK_FULL = 'DISK_FULL',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  
  // 包相关错误
  PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  PACKAGE_CORRUPTED = 'PACKAGE_CORRUPTED',
  
  // 验证错误
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  API_INCOMPATIBLE = 'API_INCOMPATIBLE',
  FUNCTIONALITY_BROKEN = 'FUNCTIONALITY_BROKEN',
  
  // 配置错误
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',
  
  // 系统错误
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  PROCESS_TIMEOUT = 'PROCESS_TIMEOUT',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR'
}

// 错误详情模型
interface RepairError {
  // 错误标识
  errorId: string;
  code: RepairErrorCode;
  message: string;
  
  // 上下文信息
  context: {
    packageName?: string;
    version?: string;
    operationId?: string;
    step: string;
    timestamp: string;
  };
  
  // 技术详情
  technicalDetails: {
    stackTrace?: string;
    innerError?: any;
    httpStatusCode?: number;
    systemErrorCode?: string;
  };
  
  // 解决方案
  solution: {
    automatic: string[];
    manual: string[];
    reference?: string;
  };
  
  // 影响评估
  impact: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    userAffected: boolean;
    systemAffected: boolean;
    dataLossRisk: boolean;
  };
  
  // 恢复信息
  recovery: {
    automaticRecovery: boolean;
    recoverySteps: string[];
    estimatedRecoveryTime?: number; // 毫秒
  };
}
```

### **状态模型**

```typescript
// 系统状态模型
interface SystemStatus {
  // 系统信息
  systemId: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  
  // 运行状态
  status: 'running' | 'paused' | 'stopped' | 'error';
  uptime: number; // 秒
  lastCheck: string;
  
  // 组件状态
  components: {
    dependencyChecker: ComponentStatus;
    packageRepairer: ComponentStatus;
    repairValidator: ComponentStatus;
    reportGenerator: ComponentStatus;
    httpClient: ComponentStatus;
    fileSystem: ComponentStatus;
  };
  
  // 性能状态
  performance: {
    activeOperations: number;
    queuedOperations: number;
    completedOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    memoryUsage: number; // MB
    cpuUsage: number; // %
    diskUsage: number; // MB
  };
  
  // 配置状态
  configuration: {
    currentConfig: RepairConfig;
    configValid: boolean;
    lastConfigUpdate: string;
  };
  
  // 资源状态
  resources: {
    diskSpace: {
      total: number; // MB
      used: number; // MB
      free: number; // MB
      usagePercentage: number;
    };
    memory: {
      total: number; // MB
      used: number; // MB
      free: number; // MB
      usagePercentage: number;
    };
    network: {
      connections: number;
      bandwidthUsed: number; // MB
      bandwidthAvailable: number; // Mbps
    };
  };
  
  // 统计信息
  statistics: {
    totalPackagesChecked: number;
    totalPackagesRepaired: number;
    totalValidationPassed: number;
    totalValidationFailed: number;
    overallIntegrityScore: number;
    successRate: number; // 0-100%
  };
}

// 组件状态模型
interface ComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastHeartbeat: string;
  metrics: {
    requests: number;
    errors: number;
    latency: number; // 毫秒
    throughput: number; // 操作/秒
  };
  issues?: ComponentIssue[];
}
```

以上数据模型完整覆盖了async-validator依赖修复组件的所有数据需求，支持系统的检查、修复、验证、报告和监控功能。模型设计考虑了类型安全性、扩展性和性能优化，与现有npm-install系统架构完美集成。