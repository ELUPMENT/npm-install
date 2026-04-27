const fs = require('fs-extra');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const DOCS_DIR = path.join(__dirname, '..', 'docs');

// 生成所有依赖包的汇总文档
async function generateDocs() {
  try {
    console.log('\n=== 生成依赖文档 ===\n');
    
    // 确保文档目录存在
    await fs.ensureDir(DOCS_DIR);
    
    // 读取所有包信息
    const packageFiles = await fs.readdir(PACKAGES_DIR);
    
    if (packageFiles.length === 0) {
      console.log('没有已安装的包');
      return;
    }
    
    const allPackages = [];
    
    for (const file of packageFiles) {
      if (!file.endsWith('.json')) continue;
      
      const packageInfoPath = path.join(PACKAGES_DIR, file);
      const packageInfo = await fs.readJson(packageInfoPath);
      allPackages.push(packageInfo);
    }
    
    // 生成汇总文档
    const summaryDoc = `# NPM 私有仓库依赖清单

## 概述

- **总包数**: ${allPackages.length}
- **最后更新**: ${new Date().toLocaleString('zh-CN')}
- **仓库地址**: http://localhost:4873

## 依赖列表

| 包名 | 版本 | 安装时间 | 文档链接 |
|------|------|----------|----------|
${allPackages.map(pkg => {
  // Windows 兼容的文件名处理
  const safeFileName = pkg.name.replace(/\//g, '_').replace(/@/g, 'at_');
  const docLink = `${safeFileName}.md`;
  return `| ${pkg.name} | ${pkg.version} | ${new Date(pkg.installedAt).toLocaleString('zh-CN')} | [查看](${docLink}) |`;
}).join('\n')}

## 使用说明

### 1. 启动 Verdaccio 服务

\`\`\`bash
npm start
\`\`\`

### 2. 配置 npm registry

\`\`\`bash
npm config set registry http://localhost:4873
\`\`\`

### 3. 添加新依赖

\`\`\`bash
npm run add-package
\`\`\`

### 4. 同步到离线文件夹

\`\`\`bash
npm run sync-to-offline
\`\`\`

### 5. 发布到内网

将 \`offline-packages\` 文件夹复制到内网，然后执行:

\`\`\`bash
node publish-to-internal.js
\`\`\`

## 注意事项

1. 所有依赖都通过 Verdaccio 管理
2. 定期同步依赖到离线文件夹
3. 内网部署时使用离线包进行安装

---

*文档自动生成于 ${new Date().toLocaleString('zh-CN')}*
`;
    
    const summaryPath = path.join(DOCS_DIR, 'README.md');
    await fs.writeFile(summaryPath, summaryDoc, 'utf8');
    console.log(`✓ 汇总文档已保存到: ${summaryPath}`);
    
    // 为每个包生成单独文档（如果不存在）
    let newDocsCount = 0;
    for (const pkg of allPackages) {
      // Windows 兼容的文件名处理
      const safeFileName = pkg.name.replace(/\//g, '_').replace(/@/g, 'at_');
      const docPath = path.join(DOCS_DIR, `${safeFileName}.md`);
      
      if (!(await fs.pathExists(docPath))) {
        const docContent = `# ${pkg.name} 依赖文档

## 基本信息

- **包名**: ${pkg.name}
- **版本**: ${pkg.version}
- **安装时间**: ${new Date(pkg.installedAt).toLocaleString('zh-CN')}
- **仓库地址**: ${pkg.registry || 'http://localhost:4873'}

## 安装命令

\`\`\`bash
npm install ${pkg.name}@${pkg.version} --registry=http://localhost:4873
\`\`\`

## 使用说明

请参考官方文档: https://www.npmjs.com/package/${pkg.name}

## 注意事项

1. 该依赖已通过 Verdaccio 私有仓库管理
2. 内网使用时，请确保配置了正确的 registry 地址
3. 建议在内网环境中使用离线包进行安装

---

*文档生成时间: ${new Date().toLocaleString('zh-CN')}*
`;
        
        await fs.writeFile(docPath, docContent, 'utf8');
        newDocsCount++;
      }
    }
    
    if (newDocsCount > 0) {
      console.log(`✓ 新生成 ${newDocsCount} 个包文档`);
    } else {
      console.log('✓ 所有包文档已是最新');
    }
    
    console.log('\n✓ 文档生成完成!');
    
  } catch (error) {
    console.error('✗ 生成文档失败:', error.message);
  }
}

generateDocs();
