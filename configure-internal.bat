@echo off
chcp 65001 >nul
echo ========================================
echo   内网 NPM 仓库配置工具
echo ========================================
echo.

echo [提示] 此工具将帮助您配置 publish-to-internal.js 脚本
echo.

REM 运行配置向导
npm run configure-internal

echo.
echo ========================================
pause
