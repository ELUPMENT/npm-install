const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('fast-glob');

class DocumentClassifier {
  constructor(rootPath, configPath) {
    this.rootPath = path.resolve(rootPath);
    this.configPath = configPath;
    this.config = null;
    this.errors = [];
    this.moveResults = [];
    this.scanStats = { total: 0, success: 0, skipped: 0, failed: 0 };
    this.categoryCounts = {};
    this.startTime = Date.now();
  }

  async execute() {
    console.log('开始文档分类整理...\n');
    
    try {
      await this.loadConfig();
      const documents = await this.scanDocuments();
      const classificationResults = this.classifyDocuments(documents);
      await this.moveFiles(classificationResults);
      await this.updateIndexes(classificationResults);
      const report = this.generateReport();
      
      const reportPath = path.join(this.rootPath, 'docs', '文档归类报告.md');
      await fs.ensureDir(path.dirname(reportPath));
      await fs.writeFile(reportPath, report, 'utf-8');
      
      console.log('\n✅ 文档归类完成！');
      console.log(`📊 报告已生成: ${reportPath}\n`);
      
      return report;
    } catch (error) {
      this.errors.push({ level: 'ERROR', message: error.message, timestamp: new Date() });
      console.error('❌ 执行失败:', error.message);
      throw error;
    }
  }

  async loadConfig() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      this.config = yaml.load(configContent);
      console.log(`✓ 已加载分类规则配置: ${this.config.rules.length} 条规则`);
    } catch (error) {
      this.config = this.getDefaultConfig();
      console.log('⚠ 使用默认分类规则配置');
    }
  }

  getDefaultConfig() {
    return {
      rules: [
        {
          name: '快速开始',
          category: '快速开始',
          targetDir: 'docs/01-快速开始',
          priority: 1,
          filenameKeywords: ['快速', 'QUICKSTART', 'README'],
          titleKeywords: ['快速开始', '快速入门']
        },
        {
          name: '内网发布',
          category: '内网发布',
          targetDir: 'docs/03-内网发布',
          priority: 2,
          filenameKeywords: ['内网', '发布', 'Verdaccio', 'INTERNAL']
        },
        {
          name: 'Git配置',
          category: 'Git配置',
          targetDir: 'docs/04-Git配置',
          priority: 3,
          filenameKeywords: ['Git', 'GitHub', '.gitignore']
        },
        {
          name: '问题修复',
          category: '问题修复',
          targetDir: 'docs/05-问题修复',
          priority: 4,
          filenameKeywords: ['修复', 'Bug', 'FIX', 'BUGFIX']
        },
        {
          name: '故障排查',
          category: '故障排查',
          targetDir: 'docs/06-故障排查',
          priority: 5,
          filenameKeywords: ['故障', '排查', 'TROUBLESHOOTING', 'E503', 'ERESOLVE']
        },
        {
          name: '技术文档',
          category: '技术文档',
          targetDir: 'docs/07-技术文档',
          priority: 6,
          filenameKeywords: ['CHANGELOG', 'PROJECT-SUMMARY', 'Windows']
        }
      ],
      excludePatterns: ['node_modules/**', '.git/**', '_old_docs_backup/**', '.codeartsdoer/**'],
      unclassifiedDir: 'docs/未分类',
      indexFileName: 'README.md'
    };
  }

  async scanDocuments() {
    console.log('\n📂 扫描项目目录中的Markdown文档...');
    
    const patterns = ['**/*.md', '**/*.markdown'];
    const excludePatterns = this.config.excludePatterns || [];
    
    const files = await glob(patterns, {
      cwd: this.rootPath,
      ignore: excludePatterns,
      absolute: true,
      onlyFiles: true
    });
    
    const documents = [];
    
    for (const filePath of files) {
      try {
        const document = await this.extractMeta(filePath);
        if (document) {
          documents.push(document);
          this.scanStats.success++;
        }
      } catch (error) {
        this.scanStats.failed++;
        this.errors.push({
          level: 'WARN',
          message: `扫描文件失败: ${filePath} - ${error.message}`,
          filePath,
          timestamp: new Date()
        });
      }
    }
    
    this.scanStats.total = files.length;
    console.log(`✓ 已扫描 ${files.length} 个文档，成功识别 ${documents.length} 个`);
    
    return documents;
  }

  async extractMeta(filePath) {
    const stat = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const relativePath = path.relative(this.rootPath, filePath);
    
    let title = fileName.replace(/\.md$|\.markdown$/i, '');
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 100);
      for (const line of lines) {
        const match = line.match(/^#\s+(.+)$/);
        if (match) {
          title = match[1].trim();
          break;
        }
      }
    } catch (error) {
      // 忽略编码错误，使用文件名作为标题
    }
    
    return {
      filePath,
      fileName,
      title,
      size: stat.size,
      createdTime: stat.birthtime.toISOString(),
      modifiedTime: stat.mtime.toISOString(),
      relativePath
    };
  }

  classifyDocuments(documents) {
    console.log('\n🔍 执行文档分类匹配...');
    
    const rules = this.config.rules.sort((a, b) => a.priority - b.priority);
    const results = [];
    
    for (const doc of documents) {
      let matched = false;
      let matchedRule = null;
      let category = '未分类';
      let targetDir = this.config.unclassifiedDir || 'docs/未分类';
      
      for (const rule of rules) {
        if (this.matchRule(doc, rule)) {
          matched = true;
          matchedRule = rule.name;
          category = rule.category;
          targetDir = rule.targetDir;
          break;
        }
      }
      
      const targetPath = path.join(this.rootPath, targetDir, doc.fileName);
      
      results.push({
        document: doc,
        category,
        targetDir,
        matchedRule,
        targetPath
      });
      
      if (matched) {
        this.categoryCounts[category] = (this.categoryCounts[category] || 0) + 1;
      } else {
        this.categoryCounts['未分类'] = (this.categoryCounts['未分类'] || 0) + 1;
      }
    }
    
    console.log(`✓ 分类完成: ${results.length} 个文档`);
    
    return results;
  }

  matchRule(document, rule) {
    const fileNameLower = document.fileName.toLowerCase();
    const titleLower = document.title.toLowerCase();
    const pathLower = document.relativePath.toLowerCase();
    
    if (rule.filenameKeywords) {
      for (const keyword of rule.filenameKeywords) {
        if (fileNameLower.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }
    
    if (rule.pathPatterns) {
      for (const pattern of rule.pathPatterns) {
        const normalizedPattern = pattern.replace(/\*\*/g, '').replace(/\//g, path.sep);
        if (pathLower.includes(normalizedPattern.toLowerCase())) {
          return true;
        }
      }
    }
    
    if (rule.titleKeywords && document.title !== document.fileName) {
      for (const keyword of rule.titleKeywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }
    
    return false;
  }

  async moveFiles(classificationResults) {
    console.log('\n📦 执行文件移动操作...');
    
    const movedFiles = new Set();
    
    for (const result of classificationResults) {
      const { document, targetPath, category } = result;
      
      if (document.filePath === targetPath) {
        this.scanStats.skipped++;
        continue;
      }
      
      if (movedFiles.has(targetPath)) {
        this.errors.push({
          level: 'WARN',
          message: `目标文件已被占用，跳过: ${targetPath}`,
          filePath: document.filePath,
          timestamp: new Date()
        });
        this.scanStats.skipped++;
        continue;
      }
      
      try {
        await fs.ensureDir(path.dirname(targetPath));
        
        const targetExists = await fs.pathExists(targetPath);
        if (targetExists) {
          this.errors.push({
            level: 'WARN',
            message: `目标文件已存在，跳过: ${targetPath}`,
            filePath: document.filePath,
            timestamp: new Date()
          });
          this.scanStats.skipped++;
          continue;
        }
        
        await fs.move(document.filePath, targetPath, { overwrite: false });
        movedFiles.add(targetPath);
        
        this.moveResults.push({
          sourcePath: document.filePath,
          targetPath,
          status: 'success',
          category
        });
        
      } catch (error) {
        this.errors.push({
          level: 'ERROR',
          message: `移动文件失败: ${error.message}`,
          filePath: document.filePath,
          timestamp: new Date()
        });
        this.moveResults.push({
          sourcePath: document.filePath,
          targetPath,
          status: 'failed',
          reason: error.message,
          category
        });
        this.scanStats.failed++;
      }
    }
    
    console.log(`✓ 已移动 ${this.moveResults.filter(r => r.status === 'success').length} 个文件`);
  }

  async updateIndexes(classificationResults) {
    console.log('\n📝 更新分类目录索引文件...');
    
    const categoryGroups = {};
    
    for (const result of classificationResults) {
      const { category, targetDir, document } = result;
      
      if (!categoryGroups[category]) {
        categoryGroups[category] = {
          targetDir,
          documents: []
        };
      }
      
      categoryGroups[category].documents.push({
        ...document,
        finalPath: result.targetPath
      });
    }
    
    for (const [category, { targetDir, documents }] of Object.entries(categoryGroups)) {
      const categoryPath = path.join(this.rootPath, targetDir);
      const indexPath = path.join(categoryPath, this.config.indexFileName || 'README.md');
      
      try {
        await fs.ensureDir(categoryPath);
        
        const sortedDocs = documents.sort((a, b) => 
          a.fileName.localeCompare(b.fileName, 'zh-CN')
        );
        
        let indexContent = `# ${category}\n\n`;
        indexContent += `本目录包含 ${sortedDocs.length} 个文档\n\n`;
        indexContent += `## 文档列表\n\n`;
        
        for (const doc of sortedDocs) {
          const relativeLink = `./${doc.fileName}`;
          indexContent += `- [${doc.title}](${relativeLink})\n`;
        }
        
        indexContent += `\n---\n`;
        indexContent += `\n最后更新: ${new Date().toLocaleString('zh-CN')}\n`;
        
        await fs.writeFile(indexPath, indexContent, 'utf-8');
        
      } catch (error) {
        this.errors.push({
          level: 'ERROR',
          message: `更新索引失败: ${indexPath} - ${error.message}`,
          timestamp: new Date()
        });
      }
    }
    
    console.log(`✓ 已更新 ${Object.keys(categoryGroups).length} 个分类索引`);
  }

  generateReport() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    
    let report = `# 文档归类报告\n\n`;
    report += `执行时间: ${new Date().toLocaleString('zh-CN')}\n`;
    report += `执行耗时: ${duration} 秒\n\n`;
    
    report += `---\n\n`;
    report += `## 统计信息\n\n`;
    report += `- **扫描文档总数**: ${this.scanStats.total}\n`;
    report += `- **成功处理数量**: ${this.scanStats.success}\n`;
    report += `- **跳过数量**: ${this.scanStats.skipped}\n`;
    report += `- **失败数量**: ${this.scanStats.failed}\n`;
    report += `- **移动文件数量**: ${this.moveResults.filter(r => r.status === 'success').length}\n\n`;
    
    report += `### 各分类数量\n\n`;
    for (const [category, count] of Object.entries(this.categoryCounts).sort((a, b) => b[1] - a[1])) {
      report += `- **${category}**: ${count} 个文档\n`;
    }
    report += `\n`;
    
    report += `---\n\n`;
    report += `## 归类详情\n\n`;
    
    const successfulMoves = this.moveResults.filter(r => r.status === 'success');
    if (successfulMoves.length > 0) {
      report += `### 成功移动的文件 (${successfulMoves.length})\n\n`;
      for (const move of successfulMoves) {
        const source = path.relative(this.rootPath, move.sourcePath);
        const target = path.relative(this.rootPath, move.targetPath);
        report += `- \`${source}\` → \`${target}\` [${move.category}]\n`;
      }
      report += `\n`;
    }
    
    const skippedMoves = this.moveResults.filter(r => r.status === 'skipped');
    if (skippedMoves.length > 0) {
      report += `### 跳过的文件 (${skippedMoves.length})\n\n`;
      for (const move of skippedMoves) {
        const source = path.relative(this.rootPath, move.sourcePath);
        report += `- \`${source}\` - ${move.reason}\n`;
      }
      report += `\n`;
    }
    
    const failedMoves = this.moveResults.filter(r => r.status === 'failed');
    if (failedMoves.length > 0) {
      report += `### 失败的文件 (${failedMoves.length})\n\n`;
      for (const move of failedMoves) {
        const source = path.relative(this.rootPath, move.sourcePath);
        report += `- \`${source}\` - ${move.reason}\n`;
      }
      report += `\n`;
    }
    
    if (this.errors.length > 0) {
      report += `---\n\n`;
      report += `## 错误和警告\n\n`;
      
      const errors = this.errors.filter(e => e.level === 'ERROR');
      const warnings = this.errors.filter(e => e.level === 'WARN');
      
      if (errors.length > 0) {
        report += `### 错误 (${errors.length})\n\n`;
        for (const error of errors) {
          report += `- **${error.timestamp.toLocaleTimeString('zh-CN')}**: ${error.message}\n`;
          if (error.filePath) {
            report += `  - 文件: \`${path.relative(this.rootPath, error.filePath)}\`\n`;
          }
        }
        report += `\n`;
      }
      
      if (warnings.length > 0) {
        report += `### 警告 (${warnings.length})\n\n`;
        for (const warning of warnings) {
          report += `- **${warning.timestamp.toLocaleTimeString('zh-CN')}**: ${warning.message}\n`;
          if (warning.filePath) {
            report += `  - 文件: \`${path.relative(this.rootPath, warning.filePath)}\`\n`;
          }
        }
        report += `\n`;
      }
    }
    
    report += `---\n\n`;
    report += `*报告生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;
    
    return report;
  }
}

async function main() {
  const rootPath = process.cwd();
  const configPath = path.join(rootPath, 'scripts', 'classify-rules.yaml');
  
  const classifier = new DocumentClassifier(rootPath, configPath);
  await classifier.execute();
}

main().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
