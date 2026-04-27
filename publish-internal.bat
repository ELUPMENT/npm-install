@echo off
chcp 65001 >nul
echo ========================================
echo   内网 npm 包发布工具
echo ========================================
echo.

REM 检查是否安装了 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [信息] Node.js 版本:
node -v
echo.

REM 检查离线包目录
if not exist "offline-packages" (
    echo [错误] 未找到 offline-packages 目录
    echo 请确保此脚本与 offline-packages 目录在同一位置
    pause
    exit /b 1
)

REM 检查发布脚本
if not exist "scripts\publish-internal-standalone.js" (
    echo [错误] 未找到发布脚本
    echo 请确保 scripts\publish-internal-standalone.js 文件存在
    pause
    exit /b 1
)

echo [提示] 在继续之前，请确认：
echo   1. 已修改 scripts\publish-internal-standalone.js 中的内网地址
echo   2. 已登录到内网 npm 仓库
echo.

set /p confirm="是否继续？(y/n): "
if /i not "%confirm%"=="y" (
    echo 已取消操作
    pause
    exit /b 0
)

echo.
echo [信息] 开始发布...
echo.

call node scripts\publish-internal-standalone.js

echo.
echo ========================================
echo   发布完成
echo ========================================
echo.

if exist "publish-report.json" (
    echo [信息] 发布报告已生成: publish-report.json
    echo.
    type publish-report.json
)

pause
