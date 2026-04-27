@echo off
chcp 65001 >nul
REM ============================================
REM GitHub Login and Remote Repository Setup Tool
REM ============================================

echo.
echo ========================================
echo   GitHub Login Configuration Tool
echo ========================================
echo.

REM Check if in Git repository
if not exist .git (
    echo [ERROR] Current directory is not a Git repository!
    pause
    exit /b 1
)

echo [Step 1] Checking current Git configuration...
echo.
git config --global user.name
git config --global user.email
echo.

set /p need_config="Do you need to modify username/email? (y/n): "
if /i "%need_config%"=="y" (
    set /p git_name="Enter GitHub username: "
    set /p git_email="Enter GitHub email: "
    
    git config --global user.name "%git_name%"
    git config --global user.email "%git_email%"
    
    echo.
    echo [DONE] User info updated
    echo   Username: %git_name%
    echo   Email: %git_email%
)

echo.
echo ========================================
echo [Step 2] Configure Remote Repository
echo ========================================
echo.

echo Please select an action:
echo   1. Add new remote repository
echo   2. Modify existing remote repository
echo   3. View current remote repositories
echo   4. Remove remote repository
echo   5. Exit
echo.

set /p choice="Select (1-5): "

if "%choice%"=="1" goto add_remote
if "%choice%"=="2" goto modify_remote
if "%choice%"=="3" goto view_remote
if "%choice%"=="4" goto remove_remote
if "%choice%"=="5" goto end
goto invalid_choice

:add_remote
echo.
echo [INFO] Add remote repository
echo.
set /p remote_name="Remote name (default: origin): "
if "%remote_name%"=="" set remote_name=origin

echo.
echo [IMPORTANT] GitHub authentication method:
echo   1. HTTPS + Personal Access Token (Recommended)
echo   2. SSH (requires SSH Key configuration)
echo.
set /p auth_type="Select authentication method (1-2): "

if "%auth_type%"=="1" (
    echo.
    echo [INFO] Enter HTTPS URL, for example:
    echo   https://github.com/username/repository.git
    echo.
    set /p remote_url="Remote repository URL: "
    
    REM Check if remote already exists
    git remote | findstr "%remote_name%" >nul
    if not errorlevel 1 (
        echo.
        echo [WARNING] Remote '%remote_name%' already exists!
        set /p overwrite="Overwrite? (y/n): "
        if /i "%overwrite%"=="y" (
            git remote remove %remote_name%
        ) else (
            echo [CANCEL] Operation cancelled
            goto end
        )
    )
    
    git remote add %remote_name% %remote_url%
    echo.
    echo [SUCCESS] Remote repository added
    echo   Name: %remote_name%
    echo   URL: %remote_url%
    
    echo.
    echo ========================================
    echo [IMPORTANT] GitHub Authentication Guide
    echo ========================================
    echo.
    echo GitHub no longer supports password authentication.
    echo You must use Personal Access Token.
    echo.
    echo [How to get Token]:
    echo   1. Visit: https://github.com/settings/tokens
    echo   2. Click "Generate new token (classic)"
    echo   3. Select scopes (at least check 'repo')
    echo   4. Generate and copy the Token
    echo.
    echo [First push command]:
    echo   git push -u %remote_name% master
    echo.
    echo When prompted for credentials:
    echo   - Username: Your GitHub username
    echo   - Password: Paste the Token you copied
    echo.
    echo [NOTE] Token will be saved automatically
    echo.
    
    set /p test_push="Test push now? (y/n): "
    if /i "%test_push%"=="y" (
        echo.
        echo [INFO] Performing first push...
        echo [NOTE] When prompted for password, paste your Personal Access Token
        echo.
        git push -u %remote_name% master
        if errorlevel 1 (
            echo.
            echo [FAILED] Push failed. Please check:
            echo   1. Is Token correct?
            echo   2. Do you have write permission?
            echo   3. Is network connection OK?
        ) else (
            echo.
            echo [SUCCESS] Push completed!
        )
    )
    
    goto end
)

if "%auth_type%"=="2" (
    echo.
    echo [INFO] Enter SSH URL, for example:
    echo   git@github.com:username/repository.git
    echo.
    set /p remote_url="Remote repository URL: "
    
    REM Check if remote already exists
    git remote | findstr "%remote_name%" >nul
    if not errorlevel 1 (
        echo.
        echo [WARNING] Remote '%remote_name%' already exists!
        set /p overwrite="Overwrite? (y/n): "
        if /i "%overwrite%"=="y" (
            git remote remove %remote_name%
        ) else (
            echo [CANCEL] Operation cancelled
            goto end
        )
    )
    
    git remote add %remote_name% %remote_url%
    echo.
    echo [SUCCESS] Remote repository added (SSH mode)
    echo   Name: %remote_name%
    echo   URL: %remote_url%
    
    echo.
    echo [INFO] Make sure SSH Key is configured:
    echo   1. Check if exists: %USERPROFILE%\.ssh\id_rsa.pub
    echo   2. If not, run: ssh-keygen -t rsa -b 4096
    echo   3. Add public key to GitHub: https://github.com/settings/keys
    echo.
    
    set /p test_ssh="Test SSH connection? (y/n): "
    if /i "%test_ssh%"=="y" (
        echo.
        ssh -T git@github.com
        if errorlevel 1 (
            echo.
            echo [FAILED] SSH connection failed. Please check SSH Key configuration
        ) else (
            echo.
            echo [SUCCESS] SSH connection successful!
        )
    )
    
    goto end
)

echo.
echo [ERROR] Invalid selection
goto end

:modify_remote
echo.
echo [Current remote repositories]:
git remote -v
echo.

set /p remote_name="Remote name to modify: "
set /p new_url="New URL: "

git remote set-url %remote_name% %new_url%
echo.
echo [SUCCESS] Remote repository updated
git remote -v
goto end

:view_remote
echo.
echo [Current remote repositories]:
git remote -v
echo.

if exist .git\config (
    echo.
    echo [Detailed configuration]:
    type .git\config | findstr /C:"[remote" /C:"url" /C:"fetch"
)
goto end

:remove_remote
echo.
echo [Current remote repositories]:
git remote -v
echo.

set /p remote_name="Remote name to remove: "
git remote remove %remote_name%
echo.
echo [SUCCESS] Remote '%remote_name%' removed
goto end

:invalid_choice
echo.
echo [ERROR] Invalid choice, please run script again

:end
echo.
echo ========================================
echo   Configuration Complete!
echo ========================================
echo.
echo [Common commands]:
echo   git push          - Push to remote repository
echo   git pull          - Pull from remote repository
echo   git fetch         - Fetch remote updates
echo   git remote -v     - View remote repositories
echo.
echo [Documentation]:
echo   Detailed guide: GITHUB-LOGIN-GUIDE.md
echo   Quick reference: GITHUB-LOGIN-QUICK-REF.md
echo.

pause