# 多版本包快速参考

## 🚀 快速命令

```bash
# 同步所有包（包括多版本）
npm run sync-to-offline

# 使用交互式管理工具
manage-multi-versions.bat

# 验证同步结果
node verify-sync.js

# 查看 minimatch 的所有版本
npm list minimatch
```

## 📁 文件结构

```
offline-packages/
├── minimatch/              # 默认版本
├── minimatch@3.1.5/        # 版本 3.1.5
├── minimatch@5.1.9/        # 版本 5.1.9
└── minimatch@10.2.5/       # 版本 10.2.5
```

## 📊 当前状态

- **总包数**: 77
- **成功同步**: 84
- **多版本包**: 13
- **minimatch 版本**: 3 个 (3.1.5, 5.1.9, 10.2.5)

## 🔍 常见问题

**Q: 为什么有多个版本？**  
A: npm 依赖扁平化机制，不同依赖需要不同版本

**Q: 如何选择需要的版本？**  
A: 运行 `npm list {package-name}` 查看依赖树

**Q: 如何清理旧版本？**  
A: 使用 `manage-multi-versions.bat` 选项 4

## 📖 详细文档

- [完整解决方案](./MINIMATCH-MULTI-VERSION-SOLUTION.md)
- [管理指南](./MULTI-VERSION-PACKAGES.md)
- [项目 README](./README.md)
