@echo off
chcp 65001 >nul
echo ========================================
echo   Verdaccio 私有 NPM 仓库启动脚本
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [信息] Node.js 版本:
node --version
echo.

REM 检查 Verdaccio 是否已在运行
echo [检查] 检查 Verdaccio 服务状态...
netstat -ano | findstr ":4873" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [警告] Verdaccio 服务似乎已在运行
    echo.
    choice /C YN /M "是否重启服务"
    if errorlevel 2 goto :skip_restart
    if errorlevel 1 goto :restart
) else (
    echo [信息] Verdaccio 服务未运行，正在启动...
)

:restart
echo.
echo [启动] 正在启动 Verdaccio...
echo [提示] 服务将在 http://localhost:4873 运行
echo [提示] 按 Ctrl+C 可停止服务
echo.
echo ========================================
echo   服务启动中...
echo ========================================
echo.

start "Verdaccio Server" cmd /k "npm start"

REM 等待服务启动
timeout /t 5 /nobreak >nul

echo.
echo [验证] 检查服务是否成功启动...
netstat -ano | findstr ":4873" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [成功] Verdaccio 服务已成功启动！
    echo [地址] http://localhost:4873
    echo.
    echo [提示] 现在可以在新窗口中使用以下命令：
    echo   npm run add-deps          - 添加依赖包
    echo   npm run sync-to-offline   - 同步到离线文件夹
    echo   npm run generate-docs     - 生成文档
    echo.
) else (
    echo [错误] 服务启动失败，请检查日志
)

:skip_restart
echo.
echo ========================================
pause
