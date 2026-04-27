仓库的@echo off
REM ============================================
REM Git Ignore 清理工具
REM 用于从 Git 追踪中移除 .gitignore 指定的文件
REM ============================================

echo.
echo ========================================
echo   Git Ignore 清理工具
echo ========================================
echo.

REM 检查是否在 Git 仓库中
if not exist .git (
    echo [错误] 当前目录不是 Git 仓库！
    pause
    exit /b 1
)

echo [提示] 以下操作将从 Git 追踪中移除文件，但不会删除本地文件
echo.
echo 将要清理的路径：
echo   - offline-packages/
echo   - node_modules/
echo   - verdaccio/storage/
echo   - *.zip (离线包压缩文件)
echo   - sync-log.json
echo   - verify-sync.js
echo   - batch-download-report.json
echo   - publish-report.json
echo.

set /p confirm="确认执行清理操作？(y/n): "
if /i not "%confirm%"=="y" (
    echo [取消] 操作已取消
    pause
    exit /b 0
)

echo.
echo [开始] 清理 Git 追踪的文件...
echo.

REM 清理 offline-packages 目录
if exist offline-packages (
    echo [1/8] 清理 offline-packages/ ...
    git rm -r --cached offline-packages/ >nul 2>&1
    if errorlevel 1 (
        echo       - offline-packages/ 未被追踪或已清理
    ) else (
        echo       - 成功清理 offline-packages/
    )
)

REM 清理 node_modules 目录
if exist node_modules (
    echo [2/8] 清理 node_modules/ ...
    git rm -r --cached node_modules/ >nul 2>&1
    if errorlevel 1 (
        echo       - node_modules/ 未被追踪或已清理
    ) else (
        echo       - 成功清理 node_modules/
    )
)

REM 清理 verdaccio/storage 目录
if exist verdaccio\storage (
    echo [3/8] 清理 verdaccio/storage/ ...
    git rm -r --cached verdaccio/storage/ >nul 2>&1
    if errorlevel 1 (
        echo       - verdaccio/storage/ 未被追踪或已清理
    ) else (
        echo       - 成功清理 verdaccio/storage/
    )
)

REM 清理 zip 文件
echo [4/8] 清理离线包压缩文件...
for %%f in (offline-packages_*.zip) do (
    if exist "%%f" (
        git rm --cached "%%f" >nul 2>&1
        if not errorlevel 1 (
            echo       - 已清理: %%f
        )
    )
)

REM 清理特定文件
echo [5/8] 清理 sync-log.json ...
if exist sync-log.json (
    git rm --cached sync-log.json >nul 2>&1
    if not errorlevel 1 (
        echo       - 成功清理 sync-log.json
    )
)

echo [6/8] 清理 verify-sync.js ...
if exist verify-sync.js (
    git rm --cached verify-sync.js >nul 2>&1
    if not errorlevel 1 (
        echo       - 成功清理 verify-sync.js
    )
)

echo [7/8] 清理报告文件 ...
if exist batch-download-report.json (
    git rm --cached batch-download-report.json >nul 2>&1
    if not errorlevel 1 (
        echo       - 已清理: batch-download-report.json
    )
)
if exist publish-report.json (
    git rm --cached publish-report.json >nul 2>&1
    if not errorlevel 1 (
        echo       - 已清理: publish-report.json
    )
)

echo [8/8] 更新 .gitignore ...
if exist .gitignore (
    git add .gitignore >nul 2>&1
    echo       - .gitignore 已更新
)

echo.
echo ========================================
echo   清理完成！
echo ========================================
echo.
echo [提示] 请查看以下状态：
git status --short
echo.
echo [下一步] 建议执行以下操作：
echo   1. 检查 git status 确认清理结果
echo   2. 提交更改: git commit -m "chore: 清理 Git 追踪的忽略文件"
echo   3. 验证 .gitignore 是否生效
echo.

pause
