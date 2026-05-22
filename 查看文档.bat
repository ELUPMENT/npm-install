@echo off
chcp 65001 >nul
echo ========================================
echo   NPM 私有仓库管理系统 - 文档快速访问
echo ========================================
echo.
echo 请选择要查看的文档分类：
echo.
echo [1] 总索引 - 所有文档导航
echo [2] 快速开始 - 新手入门
echo [3] 核心功能 - 系统功能详解
echo [4] 内网发布 - 内网部署指南
echo [5] Git配置 - 版本控制配置
echo [6] 问题修复 - 常见问题解决
echo [7] 故障排查 - 故障诊断排除
echo [8] 技术文档 - 技术细节记录
echo [0] 退出
echo.
set /p choice=请输入选项 (0-8): 

if "%choice%"=="1" start "" "docs\README.md"
if "%choice%"=="2" start "" "docs\01-快速开始\README.md"
if "%choice%"=="3" start "" "docs\02-核心功能\README.md"
if "%choice%"=="4" start "" "docs\03-内网发布\README.md"
if "%choice%"=="5" start "" "docs\04-Git配置\README.md"
if "%choice%"=="6" start "" "docs\05-问题修复\README.md"
if "%choice%"=="7" start "" "docs\06-故障排查\README.md"
if "%choice%"=="8" start "" "docs\07-技术文档\README.md"
if "%choice%"=="0" exit

echo.
echo 文档已在默认浏览器中打开！
echo.
pause
