@echo off
chcp 65001 >nul

echo ========================================
echo   Git 配置验证工具
echo ========================================
echo.

:: 检查 .gitignore 是否存在
echo [1/4] 检查 .gitignore 文件...
if exist .gitignore (
    echo   ✓ .gitignore 文件存在
    echo.
    echo   主要忽略规则：
    findstr /C:"node_modules/" .gitignore
    findstr /C:"offline-packages/" .gitignore
    findstr /C:"verdaccio/storage/" .gitignore
) else (
    echo   ✗ .gitignore 文件不存在
    echo   请运行：创建 .gitignore 文件
)

echo.

:: 检查清理脚本是否存在
echo [2/4] 检查清理脚本...
if exist cleanup-git-dependencies.bat (
    echo   ✓ 清理脚本存在
) else (
    echo   ✗ 清理脚本不存在
)

echo.

:: 检查文档是否存在
echo [3/4] 检查文档...
set doc_count=0
if exist GIT-IGNORE-GUIDE.md (
    echo   ✓ GIT-IGNORE-GUIDE.md 存在
    set /a doc_count+=1
)
if exist GIT-QUICK-START.md (
    echo   ✓ GIT-QUICK-START.md 存在
    set /a doc_count+=1
)
if exist GIT-CONFIGURATION-SUMMARY.md (
    echo   ✓ GIT-CONFIGURATION-SUMMARY.md 存在
    set /a doc_count+=1
)
echo   共找到 %doc_count%/3 个文档

echo.

:: 检查 Git 状态
echo [4/4] 检查 Git 状态...
if exist .git (
    echo   ✓ 当前目录是 Git 仓库
    echo.
    
    :: 检查是否有大文件被追踪
    echo   检查是否仍有依赖文件被追踪...
    git ls-files node_modules/ >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ⚠ 警告：node_modules/ 仍被 Git 追踪
        echo   建议运行：cleanup-git-dependencies.bat
    ) else (
        echo   ✓ node_modules/ 未被追踪
    )
    
    git ls-files offline-packages/ >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ⚠ 警告：offline-packages/ 仍被 Git 追踪
        echo   建议运行：cleanup-git-dependencies.bat
    ) else (
        echo   ✓ offline-packages/ 未被追踪
    )
) else (
    echo   ⊘ 当前目录不是 Git 仓库
    echo   如需初始化：git init
)

echo.
echo ========================================
echo   验证完成
echo ========================================
echo.
echo 下一步：
echo 1. 如果看到警告，运行：cleanup-git-dependencies.bat
echo 2. 查看详细文档：GIT-IGNORE-GUIDE.md
echo 3. 提交配置：git add .gitignore ^&^& git commit -m "chore: 添加 Git 忽略配置"
echo.

pause
