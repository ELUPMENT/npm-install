@echo off
chcp 65001 >nul
echo ========================================
echo   Verdaccio 匿名访问修复工具
echo ========================================
echo.

echo [步骤 1] 停止所有 Node.js 进程...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✓ Node.js 进程已停止
) else (
    echo ⚠ 没有运行中的 Node.js 进程
)
timeout /t 2 /nobreak >nul

echo.
echo [步骤 2] 验证配置文件...
findstr /C:"access: $all" verdaccio\config.yaml >nul
if %errorlevel% equ 0 (
    echo ✓ 配置文件中包含 access: $all
) else (
    echo ✗ 配置文件可能有问题
    pause
    exit /b 1
)

findstr /C:"publish: $all" verdaccio\config.yaml >nul
if %errorlevel% equ 0 (
    echo ✓ 配置文件中包含 publish: $all
) else (
    echo ✗ 配置文件可能有问题
    pause
    exit /b 1
)

echo.
echo [步骤 3] 启动 Verdaccio...
echo 💡 提示: 请在新窗口中查看 Verdaccio 日志
start "Verdaccio" cmd /k "npm start"

echo.
echo [步骤 4] 等待服务启动...
timeout /t 8 /nobreak >nul

echo.
echo [步骤 5] 测试连接...
curl -s http://localhost:4873/-/verdaccio/data/packages >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ API 连接成功
) else (
    echo ⚠ API 连接失败，可能需要更多启动时间
)

echo.
echo ========================================
echo   ✅ 修复完成！
echo ========================================
echo.
echo 📌 下一步操作:
echo   1. 使用浏览器无痕模式访问: http://localhost:4873
echo   2. 或使用 Chrome: Ctrl+Shift+N 打开无痕窗口
echo   3. 或使用 Edge: Ctrl+Shift+N 打开 InPrivate 窗口
echo.
echo 💡 提示:
echo   - Web 界面可能仍显示登录按钮，但不影响使用
echo   - 只要不点击登录，就可以匿名浏览和下载包
echo   - npm 命令也可以直接使用，无需登录
echo.
pause
