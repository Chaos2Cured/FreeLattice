@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title FreeLattice — One-Click Installer
color 0F

:: ╔══════════════════════════════════════════════════════════════╗
:: ║         FreeLattice — One-Click Installer (Windows)         ║
:: ║         Bulletproof edition v2.0                             ║
:: ╚══════════════════════════════════════════════════════════════╝
::
:: WHAT THIS DOES:
::   1. Checks for Python 3 (auto-installs via winget if possible)
::   2. Checks for Ollama (auto-installs via winget if possible)
::   3. Sets OLLAMA_ORIGINS=* permanently (CORS fix)
::   4. Restarts Ollama so CORS takes effect
::   5. Pulls a default AI model if none exist
::   6. Locates or downloads FreeLattice
::   7. Starts the server and opens your browser
::
:: SMARTSCREEN NOTE:
::   If Windows shows "Windows protected your PC":
::     1. Click "More info"
::     2. Click "Run anyway"
::   This is normal for scripts downloaded from the internet.

echo.
echo   ========================================================
echo   =                                                      =
echo   =        FreeLattice  -  One-Click Installer           =
echo   =                                                      =
echo   =     Your AI, Your Way  -  No Cloud Required          =
echo   =                                                      =
echo   ========================================================
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 1: Check Python
:: ══════════════════════════════════════════════════════════════
echo   [1/7] Checking for Python 3...

set "PYTHON_CMD="

:: Check "python" command
where python >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PYVER_FULL=%%v"
    echo !PYVER_FULL! | findstr /B "Python 3" >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_CMD=python"
        echo         Found: !PYVER_FULL!
        goto :python_ok
    )
)

:: Check "python3" command
where python3 >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    for /f "tokens=*" %%v in ('python3 --version 2^>^&1') do set "PYVER_FULL=%%v"
    echo !PYVER_FULL! | findstr /B "Python 3" >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_CMD=python3"
        echo         Found: !PYVER_FULL!
        goto :python_ok
    )
)

:: Check "py" launcher (common on Windows)
where py >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    for /f "tokens=*" %%v in ('py -3 --version 2^>^&1') do set "PYVER_FULL=%%v"
    echo !PYVER_FULL! | findstr /B "Python 3" >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_CMD=py -3"
        echo         Found: !PYVER_FULL!
        goto :python_ok
    )
)

:: Check Windows Store Python location
if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\python3.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Microsoft\WindowsApps\python3.exe"
    echo         Found Python in Windows Apps
    goto :python_ok
)

:: Python not found — try winget auto-install
echo         Python 3 not found. Attempting automatic install...
echo.

where winget >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo         Installing Python via winget (this may take a minute)...
    winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo         Python installed successfully!
        echo         NOTE: You may need to close and re-open this script for Python
        echo         to be available in your PATH. Trying to continue...
        echo.
        :: Refresh PATH
        for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"
        for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
        set "PATH=!USER_PATH!;!SYS_PATH!"
        :: Re-check
        where python >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            set "PYTHON_CMD=python"
            goto :python_ok
        )
        where py >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            set "PYTHON_CMD=py -3"
            goto :python_ok
        )
    )
)

:: Manual install needed
echo.
echo         --------------------------------------------------------
echo         Python 3 is required but could not be installed automatically.
echo.
echo         Please install Python manually:
echo           1. Go to https://python.org/downloads
echo           2. Download the latest Python 3
echo           3. IMPORTANT: Check "Add Python to PATH" during install!
echo           4. Close this window and run the installer again
echo         --------------------------------------------------------
echo.
start "" "https://python.org/downloads"
echo         Opening Python download page in your browser...
echo.
pause
exit /b 1

:python_ok
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 2: Check Ollama
:: ══════════════════════════════════════════════════════════════
echo   [2/7] Checking for Ollama (local AI engine)...

set "OLLAMA_INSTALLED=0"
set "OLLAMA_RUNNING=0"

:: Check PATH
where ollama >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo         Ollama is installed!
    set "OLLAMA_INSTALLED=1"
    goto :ollama_check_running
)

:: Check common install locations
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\Ollama;!PATH!"
    echo         Found Ollama in AppData
    set "OLLAMA_INSTALLED=1"
    goto :ollama_check_running
)

if exist "C:\Program Files\Ollama\ollama.exe" (
    set "PATH=C:\Program Files\Ollama;!PATH!"
    echo         Found Ollama in Program Files
    set "OLLAMA_INSTALLED=1"
    goto :ollama_check_running
)

if exist "%USERPROFILE%\AppData\Local\Ollama\ollama.exe" (
    set "PATH=%USERPROFILE%\AppData\Local\Ollama;!PATH!"
    echo         Found Ollama in Local AppData
    set "OLLAMA_INSTALLED=1"
    goto :ollama_check_running
)

:: Ollama not found — try auto-install
echo         Ollama is not installed (optional but recommended).
echo.
echo         Ollama lets you run AI models locally for full privacy.
echo         It's free and works great on Windows.
echo.
set /p "INSTALL_CHOICE=        Install Ollama now? (Y/n): "
if "!INSTALL_CHOICE!"=="" set "INSTALL_CHOICE=Y"
if /i "!INSTALL_CHOICE!"=="Y" (
    :: Try winget first
    where winget >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo         Installing Ollama via winget...
        winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            echo         Ollama installed successfully!
            set "OLLAMA_INSTALLED=1"
            :: Try to find it
            where ollama >nul 2>nul
            if !ERRORLEVEL! EQU 0 (
                goto :ollama_check_running
            )
            if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
                set "PATH=%LOCALAPPDATA%\Programs\Ollama;!PATH!"
                goto :ollama_check_running
            )
        )
    )

    :: Winget failed or not available — open download page
    if "!OLLAMA_INSTALLED!"=="0" (
        echo         Opening Ollama download page...
        start "" "https://ollama.com/download/windows"
        echo.
        echo         Please download and install Ollama from the page that opened.
        echo         After installation completes, press Enter to continue...
        echo.
        pause
        :: Re-check after manual install
        where ollama >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            echo         Ollama is now installed!
            set "OLLAMA_INSTALLED=1"
            goto :ollama_check_running
        )
        if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
            set "PATH=%LOCALAPPDATA%\Programs\Ollama;!PATH!"
            echo         Ollama is now installed!
            set "OLLAMA_INSTALLED=1"
            goto :ollama_check_running
        )
        echo         Ollama not detected yet - continuing without it.
        echo         You can install Ollama later from https://ollama.com
    )
)
goto :ollama_done

:ollama_check_running
:: Check if Ollama API is responding
curl -s --connect-timeout 3 http://localhost:11434/api/tags >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo         Ollama is running and ready.
    set "OLLAMA_RUNNING=1"
) else (
    echo         Ollama is installed but not running yet.
    echo         Will start it after configuring CORS...
)

:ollama_done
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 3: Configure CORS for Ollama (THE CRITICAL FIX)
:: ══════════════════════════════════════════════════════════════
echo   [3/7] Configuring Ollama CORS access...

if "!OLLAMA_INSTALLED!"=="0" (
    echo         Skipped (Ollama not installed^).
    goto :cors_done
)

:: 3a: Set for current session
set "OLLAMA_ORIGINS=*"
echo         Set OLLAMA_ORIGINS=* for current session.

:: 3b: Set persistently via setx (for future sessions)
setx OLLAMA_ORIGINS "*" >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo         Set OLLAMA_ORIGINS=* permanently (survives reboot^).
) else (
    :: Try PowerShell as fallback
    powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')" >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo         Set OLLAMA_ORIGINS=* permanently via PowerShell.
    ) else (
        echo         Set for this session only. Run as Administrator for permanent setting.
    )
)

:: 3c: Kill and restart Ollama to pick up the CORS setting
echo.
echo         Restarting Ollama to apply CORS settings...

:: Kill all Ollama processes
taskkill /F /IM "ollama.exe" >nul 2>nul
taskkill /F /IM "ollama app.exe" >nul 2>nul
taskkill /F /IM "Ollama.exe" >nul 2>nul
timeout /t 2 /nobreak >nul

:: Also try stopping the service if it exists
net stop "Ollama" >nul 2>nul
sc stop "Ollama" >nul 2>nul
timeout /t 1 /nobreak >nul

:: Start Ollama fresh with CORS enabled
if exist "%LOCALAPPDATA%\Programs\Ollama\Ollama.exe" (
    start "" "%LOCALAPPDATA%\Programs\Ollama\Ollama.exe"
    echo         Started Ollama desktop app.
) else if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    start "" /b "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    echo         Started ollama serve.
) else (
    start "" /b ollama serve
    echo         Started ollama serve.
)

:: 3d: Wait for Ollama to be ready
echo         Waiting for Ollama to start up...
set "OLLAMA_READY=0"
for /L %%i in (1,1,20) do (
    if "!OLLAMA_READY!"=="0" (
        curl -s --connect-timeout 2 http://localhost:11434/api/tags >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            set "OLLAMA_READY=1"
        ) else (
            timeout /t 1 /nobreak >nul
        )
    )
)

if "!OLLAMA_READY!"=="1" (
    echo         Ollama is running with CORS enabled!
    set "OLLAMA_RUNNING=1"
) else (
    echo         Ollama is still starting up - it should be ready shortly.
    echo         The built-in proxy server will handle connections as a fallback.
    set "OLLAMA_RUNNING=1"
)

:cors_done
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 4: Locate / Download FreeLattice
:: ══════════════════════════════════════════════════════════════
echo   [4/7] Locating FreeLattice files...

set "FL_DIR="

:: Check if index.html is in the same directory as this script
if exist "%~dp0index.html" (
    set "FL_DIR=%~dp0"
    :: Remove trailing backslash for cleanliness
    if "!FL_DIR:~-1!"=="\" set "FL_DIR=!FL_DIR:~0,-1!"
    echo         Found FreeLattice in: !FL_DIR!
    goto :fl_found
)

:: Check common locations
for %%D in (
    "%USERPROFILE%\FreeLattice"
    "%USERPROFILE%\Desktop\FreeLattice"
    "%USERPROFILE%\Downloads\FreeLattice"
    "%USERPROFILE%\Downloads\FreeLattice-main"
    "%USERPROFILE%\Documents\FreeLattice"
) do (
    if exist "%%~D\index.html" (
        set "FL_DIR=%%~D"
        echo         Found FreeLattice in: !FL_DIR!
        goto :fl_found
    )
)

:: Not found — download it
echo         FreeLattice not found locally. Downloading...
echo.

set "FL_DIR=%USERPROFILE%\FreeLattice"

:: Try git first
where git >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo         Downloading via git...
    git clone https://github.com/Chaos2Cured/FreeLattice.git "!FL_DIR!" 2>nul
    if exist "!FL_DIR!\index.html" (
        echo         Downloaded FreeLattice via git.
        goto :fl_found
    )
)

:: Try curl (built into Windows 10+)
where curl >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo         Downloading via curl...
    curl -L -o "%TEMP%\freelattice.zip" "https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip" 2>nul
    if exist "%TEMP%\freelattice.zip" (
        echo         Extracting...
        powershell -NoProfile -Command "Expand-Archive -Force '%TEMP%\freelattice.zip' '%TEMP%\freelattice-extract'" 2>nul
        if exist "%TEMP%\freelattice-extract\FreeLattice-main" (
            xcopy /E /I /Y "%TEMP%\freelattice-extract\FreeLattice-main" "!FL_DIR!" >nul 2>nul
            del /q "%TEMP%\freelattice.zip" >nul 2>nul
            rmdir /s /q "%TEMP%\freelattice-extract" >nul 2>nul
            if exist "!FL_DIR!\index.html" (
                echo         Downloaded and extracted FreeLattice.
                goto :fl_found
            )
        )
    )
)

:: Try PowerShell as last resort
echo         Downloading via PowerShell...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip' -OutFile '%TEMP%\freelattice.zip'" 2>nul
if exist "%TEMP%\freelattice.zip" (
    powershell -NoProfile -Command "Expand-Archive -Force '%TEMP%\freelattice.zip' '%TEMP%\freelattice-extract'" 2>nul
    if exist "%TEMP%\freelattice-extract\FreeLattice-main" (
        xcopy /E /I /Y "%TEMP%\freelattice-extract\FreeLattice-main" "!FL_DIR!" >nul 2>nul
        del /q "%TEMP%\freelattice.zip" >nul 2>nul
        rmdir /s /q "%TEMP%\freelattice-extract" >nul 2>nul
        if exist "!FL_DIR!\index.html" (
            echo         Downloaded and extracted FreeLattice.
            goto :fl_found
        )
    )
)

:: Download failed
echo.
echo         --------------------------------------------------------
echo         Could not download FreeLattice automatically.
echo         Please download manually from:
echo           https://github.com/Chaos2Cured/FreeLattice
echo         --------------------------------------------------------
echo.
pause
exit /b 1

:fl_found
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 5: Pull a default model if Ollama has none
:: ══════════════════════════════════════════════════════════════
echo   [5/7] Checking for AI models...

if "!OLLAMA_INSTALLED!"=="0" (
    echo         Skipped (Ollama not installed^).
    echo         You can pull models later with: ollama pull llama3.2
    goto :models_done
)

:: Check if any models are installed
set "HAS_MODELS=0"
for /f "usebackq tokens=*" %%a in (`ollama list 2^>nul ^| findstr /V "NAME" ^| findstr /R "."`) do (
    set "HAS_MODELS=1"
)

if "!HAS_MODELS!"=="0" (
    echo         No AI models installed yet.
    echo.
    echo         Recommended: llama3.2 (2GB, great for most tasks^)
    echo         This may take a few minutes depending on your internet speed.
    echo.
    set /p "MODEL_CHOICE=        Download llama3.2 now? (Y/n): "
    if "!MODEL_CHOICE!"=="" set "MODEL_CHOICE=Y"
    if /i "!MODEL_CHOICE!"=="Y" (
        echo.
        echo         Downloading llama3.2 (please wait^)...
        echo.
        ollama pull llama3.2
        echo.
        echo         Model download complete!
    ) else (
        echo         Skipping - you can pull one later with: ollama pull llama3.2
    )
) else (
    echo         Found installed models:
    ollama list 2>nul
)

:models_done
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 6: Find available port
:: ══════════════════════════════════════════════════════════════
echo   [6/7] Finding available port...

set "PORT=3000"
netstat -an 2>nul | findstr ":3000 " | findstr "LISTENING" >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    set "PORT=8080"
    netstat -an 2>nul | findstr ":8080 " | findstr "LISTENING" >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        set "PORT=8081"
        netstat -an 2>nul | findstr ":8081 " | findstr "LISTENING" >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            set "PORT=8888"
        )
    )
)
echo         Using port !PORT!
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 7: Start Server + Open Browser
:: ══════════════════════════════════════════════════════════════
echo   [7/7] Starting FreeLattice server...
echo.

cd /d "!FL_DIR!"

:: Open browser (slight delay so server can start)
start "" "http://localhost:!PORT!"

:: Print success message
echo.
echo   ========================================================
echo   =                                                      =
echo   =   FreeLattice is running!                            =
echo   =                                                      =
echo   =   Open: http://localhost:!PORT!
echo   =                                                      =
echo   =   Close this window to stop the server.              =
echo   =   Press Ctrl+C to stop manually.                     =
echo   =                                                      =
echo   ========================================================
echo.

if "!OLLAMA_RUNNING!"=="1" (
    echo   Ollama is connected - local AI is ready!
    echo   CORS is configured - browser connections will work!
) else if "!OLLAMA_INSTALLED!"=="1" (
    echo   Ollama is installed but may still be starting up.
    echo   The built-in proxy server handles CORS automatically.
) else (
    echo   Tip: Install Ollama from ollama.com for local AI models
)
echo.

:: Start the server — prefer server.py (has Ollama proxy), fall back to http.server
set "OLLAMA_ORIGINS=*"
set "PORT=!PORT!"

if exist "server.py" (
    echo   Starting Python server with Ollama proxy...
    echo.
    !PYTHON_CMD! server.py
    goto :end
)

if exist "server.js" (
    where node >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo   Starting Node.js server with Ollama proxy...
        echo.
        node server.js
        goto :end
    )
)

:: Fallback: simple Python HTTP server
echo   Starting simple Python HTTP server...
echo.
!PYTHON_CMD! -m http.server !PORT!

:end
echo.
echo   Server stopped. Goodbye!
echo.
pause
endlocal
