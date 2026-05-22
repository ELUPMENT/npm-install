@echo off
chcp 65001 >nul
echo ========================================
echo   清理根目录重复的 Markdown 文件
echo ========================================
echo.
echo 说明：
echo - 将删除已迁移到 docs/ 目录的旧 .md 文件
echo - README.md 和 文档整理完成报告.md 将被保留
echo - 删除的文件会先移动到 _old_docs_backup/ 备份目录
echo.
pause

echo.
echo 正在创建备份目录...
if not exist "_old_docs_backup" mkdir _old_docs_backup

echo.
echo 正在移动文件到备份目录...
echo.

set count=0

:: 定义要移动的文件列表
for %%f in (
    "BATCH-DOWNLOAD-GUIDE.md"
    "BUGFIX-FS-MISSING.md"
    "BUGFIX-SUMMARY.md"
    "CHANGELOG.md"
    "CHEATSHEET.md"
    "DEMO-AUTOMATIC-DEPS.md"
    "DEPENDENCY-MANAGEMENT.md"
    "E503-ROOT-CAUSE-ANALYSIS.md"
    "E503-UPLINK-DOWN-SOLUTION.md"
    "ERESOLVE-SOLUTION.md"
    "FIX-COMPLETION-SUMMARY.md"
    "GIT-CONFIGURATION-SUMMARY.md"
    "GIT-IGNORE-GUIDE.md"
    "GIT-IGNORE-QUICK-FIX.md"
    "GIT-QUICK-START.md"
    "GITHUB-LOGIN-GUIDE.md"
    "GITHUB-LOGIN-QUICK-REF.md"
    "IMPORTANT-UPDATE.md"
    "INSTALL-MODES-COMPARISON.md"
    "INTERNAL-PUBLISH-GUIDE.md"
    "INTERNAL-PUBLISH-QUICK-REF.md"
    "INTERNAL-PUBLISH-SAFETY-GUIDE.md"
    "INTERNAL-PUBLISH-TROUBLESHOOTING.md"
    "MINIMATCH-MULTI-VERSION-SOLUTION.md"
    "MULTI-VERSION-PACKAGES.md"
    "MULTI-VERSION-QUICK-REF.md"
    "OVERVIEW.md"
    "PROJECT-SUMMARY.md"
    "QUICK-BATCH-DOWNLOAD.md"
    "QUICK-FIX-E503.md"
    "QUICK-FIX-SCOPED-PACKAGES.md"
    "QUICK-FIX-SYNC-ISSUE.md"
    "QUICK-REFERENCE-FIXES.md"
    "QUICKSTART-RISK-FIXED.md"
    "QUICKSTART.md"
    "RISK-FIX-SUMMARY.md"
    "SCOPED-PACKAGES-FIX.md"
    "SOLUTION-SUMMARY.md"
    "TROUBLESHOOTING-SYNC-ISSUES.md"
    "VERDACCIO-SERVICE-GUIDE.md"
    "WINDOWS-COMPATIBILITY.md"
    "WORKFLOW-DIAGRAM.md"
) do (
    if exist %%f (
        move %%f "_old_docs_backup\" >nul
        echo   ✓ 已移动: %%~nxf
        set /a count+=1
    )
)

echo.
echo ========================================
echo   清理完成！
echo ========================================
echo.
echo 统计信息：
echo   - 已移动文件数: %count%
echo   - 备份目录: _old_docs_backup/
echo   - 保留文件: README.md, 文档整理完成报告.md
echo.
echo 提示：
echo   - 原文件已备份到 _old_docs_backup/ 目录
echo   - 新文档位于 docs/ 目录
echo   - 确认无误后，可以手动删除 _old_docs_backup/ 目录
echo   - 双击 "查看文档.bat" 快速浏览新文档结构
echo.
pause
