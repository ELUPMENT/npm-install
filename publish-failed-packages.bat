@echo off
chcp 65001 >nul
echo ========================================
echo   批量发布失败的包
echo ========================================
echo.

set OFFLINE_DIR=%~dp0offline-packages
set REGISTRY=http://localhost:4873

echo 正在发布以下包...
echo 1. @vue/compiler-core@3.5.34
echo 2. @vue/compiler-dom@3.5.34
echo 3. @vue/compiler-ssr@3.5.34
echo 4. @vue/server-renderer@3.5.34
echo 5. @vue/shared@3.5.34
echo 6. tinypool@0.3.0
echo.

cd /d "%OFFLINE_DIR%\at_vue_compiler-core@3.5.34"
echo [1/6] 发布 @vue/compiler-core@3.5.34...
npm publish --registry=%REGISTRY% --offline --ignore-scripts
if %errorlevel% equ 0 (echo ✓ 成功) else (echo ✗ 失败)
echo.

cd /d "%OFFLINE_DIR%\at_vue_compiler-dom@3.5.34"
echo [2/6] 发布 @vue/compiler-dom@3.5.34...
npm publish --registry=%REGISTRY% --offline --ignore-scripts
if %errorlevel% equ 0 (echo ✓ 成功) else (echo ✗ 失败)
echo.

cd /d "%OFFLINE_DIR%\at_vue_compiler-ssr@3.5.34"
echo [3/6] 发布 @vue/compiler-ssr@3.5.34...
npm publish --registry=%REGISTRY% --offline --ignore-scripts
if %errorlevel% equ 0 (echo ✓ 成功) else (echo ✗ 失败)
echo.

cd /d "%OFFLINE_DIR%\at_vue_server-renderer@3.5.34"
echo [4/6] 发布 @vue/server-renderer@3.5.34...
npm publish --registry=%REGISTRY% --offline --ignore-scripts
if %errorlevel% equ 0 (echo ✓ 成功) else (echo ✗ 失败)
echo.

cd /d "%OFFLINE_DIR%\at_vue_shared@3.5.34"
echo [5/6] 发布 @vue/shared@3.5.34...
npm publish --registry=%REGISTRY% --offline --ignore-scripts
if %errorlevel% equ 0 (echo ✓ 成功) else (echo ✗ 失败)
echo.

cd /d "%OFFLINE_DIR%\tinypool@0.3.0"
echo [6/6] 发布 tinypool@0.3.0...
npm publish --registry=%REGISTRY% --offline --ignore-scripts
if %errorlevel% equ 0 (echo ✓ 成功) else (echo ✗ 失败)
echo.

echo ========================================
echo   批量发布完成
echo ========================================
pause
