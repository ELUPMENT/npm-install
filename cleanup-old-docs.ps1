# 清理根目录已迁移的 Markdown 文件
# 此脚本会将根目录下已复制到 docs/ 的 .md 文件移动到 _old_docs/ 备份目录

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  清理根目录已迁移的 Markdown 文件" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 定义需要移动的文件列表
$filesToMove = @(
    "README.md",
    "QUICKSTART.md",
    "QUICKSTART-RISK-FIXED.md",
    "CHEATSHEET.md",
    "OVERVIEW.md",
    "BATCH-DOWNLOAD-GUIDE.md",
    "QUICK-BATCH-DOWNLOAD.md",
    "DEPENDENCY-MANAGEMENT.md",
    "DEMO-AUTOMATIC-DEPS.md",
    "INSTALL-MODES-COMPARISON.md",
    "WORKFLOW-DIAGRAM.md",
    "INTERNAL-PUBLISH-GUIDE.md",
    "INTERNAL-PUBLISH-QUICK-REF.md",
    "INTERNAL-PUBLISH-SAFETY-GUIDE.md",
    "INTERNAL-PUBLISH-TROUBLESHOOTING.md",
    "VERDACCIO-SERVICE-GUIDE.md",
    "GIT-CONFIGURATION-SUMMARY.md",
    "GIT-IGNORE-GUIDE.md",
    "GIT-IGNORE-QUICK-FIX.md",
    "GIT-QUICK-START.md",
    "GITHUB-LOGIN-GUIDE.md",
    "GITHUB-LOGIN-QUICK-REF.md",
    "BUGFIX-FS-MISSING.md",
    "BUGFIX-SUMMARY.md",
    "ERESOLVE-SOLUTION.md",
    "FIX-COMPLETION-SUMMARY.md",
    "IMPORTANT-UPDATE.md",
    "MINIMATCH-MULTI-VERSION-SOLUTION.md",
    "MULTI-VERSION-PACKAGES.md",
    "MULTI-VERSION-QUICK-REF.md",
    "QUICK-FIX-SCOPED-PACKAGES.md",
    "RISK-FIX-SUMMARY.md",
    "SCOPED-PACKAGES-FIX.md",
    "SOLUTION-SUMMARY.md",
    "E503-ROOT-CAUSE-ANALYSIS.md",
    "E503-UPLINK-DOWN-SOLUTION.md",
    "QUICK-FIX-E503.md",
    "QUICK-FIX-SYNC-ISSUE.md",
    "QUICK-REFERENCE-FIXES.md",
    "TROUBLESHOOTING-SYNC-ISSUES.md",
    "CHANGELOG.md",
    "PROJECT-SUMMARY.md",
    "WINDOWS-COMPATIBILITY.md"
)

# 创建备份目录
$backupDir = "_old_docs_backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "✓ 创建备份目录: $backupDir" -ForegroundColor Green
}

# 移动文件
$movedCount = 0
$skippedCount = 0

foreach ($file in $filesToMove) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "$backupDir\$file" -Force
        Write-Host "  ✓ 移动: $file" -ForegroundColor Yellow
        $movedCount++
    } else {
        $skippedCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  清理完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "统计信息:" -ForegroundColor White
Write-Host "  - 已移动文件数: $movedCount" -ForegroundColor White
Write-Host "  - 跳过文件数: $skippedCount" -ForegroundColor White
Write-Host "  - 备份目录: $backupDir/" -ForegroundColor White
Write-Host ""
Write-Host "提示:" -ForegroundColor Cyan
Write-Host "  - 原文件已备份到 $backupDir/ 目录" -ForegroundColor Gray
Write-Host "  - 新文档位于 docs/ 目录" -ForegroundColor Gray
Write-Host "  - 确认无误后，可以手动删除 $backupDir/ 目录" -ForegroundColor Gray
Write-Host ""
