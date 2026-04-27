@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   多版本依赖包管理工具
echo ========================================
echo.

:menu
echo 请选择操作：
echo 1. 查看所有多版本包
echo 2. 查看特定包的版本（如 minimatch）
echo 3. 统计多版本包数量
echo 4. 清理所有带版本号后缀的文件夹
echo 5. 重新同步所有包
echo 6. 退出
echo.
set /p choice="请输入选项 (1-6): "

if "%choice%"=="1" goto list_multi
if "%choice%"=="2" goto search_package
if "%choice%"=="3" goto count_multi
if "%choice%"=="4" goto clean_versioned
if "%choice%"=="5" goto resync
if "%choice%"=="6" goto end
goto menu

:list_multi
echo.
echo === 当前项目中的多版本包 ===
echo.
node -e "const log = require('./sync-log.json'); const multi = log.results.filter(r => r.isMultiVersion); console.log('找到 ' + multi.length + ' 个多版本包:\n'); const grouped = {}; multi.forEach(r => { if (!grouped[r.name]) grouped[r.name] = []; grouped[r.name].push(r.version); }); Object.keys(grouped).forEach(name => { console.log(name + ': ' + grouped[name].join(', ')); });"
echo.
pause
goto menu

:search_package
echo.
set /p pkg_name="请输入包名: "
echo.
echo === %pkg_name% 的所有版本 ===
echo.
node -e "const log = require('./sync-log.json'); const pkgs = log.results.filter(r => r.name === '%pkg_name%'); if (pkgs.length === 0) { console.log('未找到该包'); } else { pkgs.forEach(r => { console.log('版本: ' + r.version + ' | 路径: ' + r.offlinePath + ' | 状态: ' + r.status); }); }"
echo.
pause
goto menu

:count_multi
echo.
echo === 统计信息 ===
echo.
node -e "const log = require('./sync-log.json'); console.log('总包数: ' + log.totalPackages); console.log('成功同步: ' + log.successCount); console.log('失败: ' + log.failCount); console.log('多版本包: ' + log.multiVersionPackages); console.log('最后同步时间: ' + log.lastSyncTime);"
echo.
pause
goto menu

:clean_versioned
echo.
echo 警告：此操作将删除 offline-packages 中所有带版本号后缀的文件夹！
set /p confirm="确认删除？(y/n): "
if /i not "%confirm%"=="y" goto menu

echo.
echo 正在清理...
for /d %%D in (offline-packages\*@*) do (
    echo 删除: %%D
    rmdir /s /q "%%D"
)
echo.
echo 清理完成！
echo.
pause
goto menu

:resync
echo.
echo 正在重新同步所有包...
echo.
call npm run sync-to-offline
echo.
pause
goto menu

:end
echo.
echo 感谢使用！
exit /b 0


