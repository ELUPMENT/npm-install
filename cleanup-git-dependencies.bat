@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Git 依赖文件清理工具（简化版）
echo ========================================
echo.

:: 检查 .git 目录是否存在
if not exist .git (
    echo 错误：当前目录不是 Git 仓库
    pause
    exit /b 1
)

:: 删除锁文件（如果存在）
if exist .git\index.lock (
    echo 检测到 Git 锁文件，尝试删除...
    del /F /Q .git\index.lock 2>nul
    if exist .git\index.lock (
        echo 警告：无法删除锁文件，可能有其他 Git 进程在运行
        echo 请关闭所有 Git 相关程序后重试
        pause
        exit /b 1
    )
    echo ✓ 锁文件已删除
    echo.
)

echo 即将执行以下操作：
echo 1. 从 Git 追踪中移除 node_modules/
echo 2. 从 Git 追踪中移除 offline-packages/
echo 3. 从 Git 追踪中移除 verdaccio/storage/
echo 4. 从 Git 追踪中移除 sync-log.json
echo.
echo 注意：这不会删除本地文件，只会停止 Git 追踪
echo.

set /p confirm="确认执行？(y/n): "
if /i not "%confirm%"=="y" (
    echo 操作已取消
    exit /b 0
)

echo.
echo === 开始清理 ===
echo.

:: 清理 node_modules
echo [1/4] 清理 node_modules...
if exist node_modules (
    git rm -r --cached node_modules/ 2>nul
    if %errorlevel% equ 0 (
        echo   ✓ node_modules 已清理
    ) else (
        echo   ⊘ node_modules 未被追踪或不存在
    )
) else (
    echo   ⊘ node_modules 目录不存在
)

:: 清理 offline-packages
echo [2/4] 清理 offline-packages...
if exist offline-packages (
    git rm -r --cached offline-packages/ 2>nul
    if %errorlevel% equ 0 (
        echo   ✓ offline-packages 已清理
    ) else (
        echo   ⊘ offline-packages 未被追踪或不存在
    )
) else (
    echo   ⊘ offline-packages 目录不存在
)

:: 清理 verdaccio/storage
echo [3/4] 清理 verdaccio/storage...
if exist verdaccio\storage (
    git rm -r --cached verdaccio/storage/ 2>nul
    if %errorlevel% equ 0 (
        echo   ✓ verdaccio/storage 已清理
    ) else (
        echo   ⊘ verdaccio/storage 未被追踪或不存在
    )
) else (
    echo   ⊘ verdaccio/storage 目录不存在
)

:: 清理 sync-log.json
echo [4/4] 清理 sync-log.json...
if exist sync-log.json (
    git rm --cached sync-log.json 2>nul
    if %errorlevel% equ 0 (
        echo   ✓ sync-log.json 已清理
    ) else (
        echo   ⊘ sync-log.json 未被追踪或不存在
    )
) else (
    echo   ⊘ sync-log.json 文件不存在
)

echo.
echo === 清理完成 ===
echo.
echo 下一步操作：
echo 1. 查看变更：git status
echo 2. 提交 .gitignore：git add .gitignore
echo 3. 提交清理：git commit -m "chore: 忽略依赖相关文件"
echo.

pause
