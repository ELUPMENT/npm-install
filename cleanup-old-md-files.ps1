# 清理根目录重复的 Markdown 文件
# 将已迁移到 docs/ 的旧 .md 文件移动到备份目录

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  清理根目录重复的 Markdown 文件" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "说明：" -ForegroundColor White
Write-Host "  - 将删除已迁移到 docs/ 目录的旧 .md 文件" -ForegroundColor Gray
Write-Host "  - README.md 和 文档整理完成报告.md 将被保留" -ForegroundColor Gray
Write-Host "  - 删除的文件会先移动到 _old_docs_backup/ 备份目录" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "是否继续？(y/n)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "操作已取消" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "正在创建备份目录..." -ForegroundColor Yellow

# 创建备份目录
$backupDir = "_old_docs_backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "✓ 创建备份目录: $backupDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "正在移动文件到备份目录..." -ForegroundColor Yellow
Write-Host ""

# 定义要移动的文件列表
$filesToMove = @(
    "BATCH-DOWNLOAD-GUIDE.md",
    "BUGFIX-FS-MISSING.md",
    "BUGFIX-SUMMARY.md",
    "CHANGELOG.md",
    "CHEATSHEET.md",
    "DEMO-AUTOMATIC-DEPS.md",
    "DEPENDENCY-MANAGEMENT.md",
    "E503-ROOT-CAUSE-ANALYSIS.md",
    "E503-UPLINK-DOWN-SOLUTION.md",
    "ERESOLVE-SOLUTION.md",
    "FIX-COMPLETION-SUMMARY.md",
    "GIT-CONFIGURATION-SUMMARY.md",
    "GIT-IGNORE-GUIDE.md",
    "GIT-IGNORE-QUICK-FIX.md",
    "GIT-QUICK-START.md",
    "GITHUB-LOGIN-GUIDE.md",
    "GITHUB-LOGIN-QUICK-REF.md",
    "IMPORTANT-UPDATE.md",
    "INSTALL-MODES-COMPARISON.md",
    "INTERNAL-PUBLISH-GUIDE.md",
    "INTERNAL-PUBLISH-QUICK-REF.md",
    "INTERNAL-PUBLISH-SAFETY-GUIDE.md",
    "INTERNAL-PUBLISH-TROUBLESHOOTING.md",
    "MINIMATCH-MULTI-VERSION-SOLUTION.md",
    "MULTI-VERSION-PACKAGES.md",
    "MULTI-VERSION-QUICK-REF.md",
    "OVERVIEW.md",
    "PROJECT-SUMMARY.md",
    "QUICK-BATCH-DOWNLOAD.md",
    "QUICK-FIX-E503.md",
    "QUICK-FIX-SCOPED-PACKAGES.md",
    "QUICK-FIX-SYNC-ISSUE.md",
    "QUICK-REFERENCE-FIXES.md",
    "QUICKSTART-RISK-FIXED.md",
    "QUICKSTART.md",
    "RISK-FIX-SUMMARY.md",
    "SCOPED-PACKAGES-FIX.md",
    "SOLUTION-SUMMARY.md",
    "TROUBLESHOOTING-SYNC-ISSUES.md",
    "VERDACCIO-SERVICE-GUIDE.md",
    "WINDOWS-COMPATIBILITY.md",
    "WORKFLOW-DIAGRAM.md"
)

# 移动文件
$movedCount = 0
$skippedCount = 0

foreach ($file in $filesToMove) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "$backupDir\$file" -Force
        Write-Host "  ✓ 已移动: $file" -ForegroundColor Yellow
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
Write-Host "  - 保留文件: README.md, 文档整理完成报告.md" -ForegroundColor White
Write-Host ""
Write-Host "提示:" -ForegroundColor Cyan
Write-Host "  - 原文件已备份到 $backupDir/ 目录" -ForegroundColor Gray
Write-Host "  - 新文档位于 docs/ 目录" -ForegroundColor Gray
Write-Host "  - 确认无误后，可以手动删除 $backupDir/ 目录" -ForegroundColor Gray
Write-Host "  - 双击 '查看文档.bat' 快速浏览新文档结构" -ForegroundColor Gray
Write-Host ""
