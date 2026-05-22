@echo off
chcp 65001 >nul
echo ========================================
echo   NPM 依赖下载和内网发布
echo ========================================
echo.
echo 此脚本将执行以下操作：
echo   1. 从 package.json 读取依赖列表
echo   2. 下载所有依赖（包括完整依赖链）
echo   3. 同步到离线包目录
echo   4. 发布到本地 Verdaccio 仓库
echo   5. 生成内网使用指南
echo.
echo 目标仓库: http://localhost:4873
echo.

:: 检查 Verdaccio 是否运行
echo 正在检查 Verdaccio 服务状态...
curl -s http://localhost:4873 >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠ Verdaccio 服务未运行！
    echo.
    echo 请先启动 Verdaccio:
    echo   npm start
    echo.
    echo 或者在新窗口运行 start.bat
    echo.
    pause
    exit /b 1
)

echo ✓ Verdaccio 服务正常运行
echo.

pause

echo.
echo 开始执行下载和发布流程...
echo.

npm run download-and-publish

echo.
echo ========================================
echo   完成！
echo ========================================
echo.
echo 查看生成的文档:
echo   - 内网使用指南.md
echo.
echo 在内网机器上配置:
echo   npm config set registry http://localhost:4873
echo.
pause
