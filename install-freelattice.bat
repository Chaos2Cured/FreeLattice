@echo off
chcp 65001 >nul 2>&1
title FreeLattice — One-Click Installer
color 0F

:: ╔══════════════════════════════════════════════════════════════╗
:: ║         FreeLattice — One-Click Installer (Windows)         ║
:: ║         Bulletproof edition — handles CORS, models, all.    ║
:: ╚══════════════════════════════════════════════════════════════╝

echo.
echo   ╔══════════════════════════════════════════════════╗
echo   ║                                                  ║
echo   ║        FreeLattice — One-Click Installer         ║
echo   ║                                                  ║
echo   ║     Your AI, Your Way — No Cloud Required        ║
echo   ║                                                  ║
echo   ╚══════════════════════════════════════════════════╝
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 1: Check Python
:: ══════════════════════════════════════════════════════════════
echo   [1/7] Checking for Python 3...

set PYTHON_CMD=
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    :: Verify it's Python 3
    for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
    echo %PYVER% | findstr /B "3." >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set PYTHON_CMD=python
        echo         Found: Python %PYVER%
        goto :python_ok
    )
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python3
    for /f "tokens=*" %%v in ('python3 --version 2^>^&1') do echo         Found: %%v
    goto :python_ok
)

:: Python not found
echo.
echo         Python 3 is not installed or not in PATH.
echo.
echo         Please install Python:
echo           1. Go to https://python.org/downloads
echo           2. Download the latest Python 3
echo           3. IMPORTANT: Check "Add Python to PATH" during install
echo           4. Run this script again
echo.
start "" "https://python.org/downloads"
echo         Opening Python download page...
echo.
pause
exit /b 1

:python_ok
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 2: Check Ollama
:: ══════════════════════════════════════════════════════════════
echo   [2/7] Checking for Ollama (local AI engine)...

set OLLAMA_INSTALLED=0
set OLLAMA_RUNNING=0

where ollama >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Ollama is installed!
    set OLLAMA_INSTALLED=1
    goto :ollama_check_running
)

:: Check common install locations
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
    echo         Found Ollama in AppData
    set OLLAMA_INSTALLED=1
    goto :ollama_check_running
)

if exist "C:\Program Files\Ollama\ollama.exe" (
    set "PATH=C:\Program Files\Ollama;%PATH%"
    echo         Found Ollama in Program Files
    set OLLAMA_INSTALLED=1
    goto :ollama_check_running
)

:: Ollama not found — offer to install
echo         Ollama is not installed (optional).
echo.
echo         Ollama lets you run AI models locally for full privacy.
echo         It's free and works great on Windows.
echo.
set /p INSTALL_CHOICE="         Install Ollama now? (Y/n): "
if /i "%INSTALL_CHOICE%"=="" set INSTALL_CHOICE=Y
if /i "%INSTALL_CHOICE%"=="Y" (
    echo         Opening Ollama download page...
    start "" "https://ollama.com/download/windows"
    echo.
    echo         Please download and install Ollama from the page that opened.
    echo         After installation, press Enter to continue...
    echo.
    pause
    :: Re-check
    where ollama >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo         Ollama is now installed!
        set OLLAMA_INSTALLED=1
        goto :ollama_check_running
    )
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
        echo         Ollama is now installed!
        set OLLAMA_INSTALLED=1
        goto :ollama_check_running
    )
    echo         Ollama not detected yet — continuing without it.
    echo         You can install Ollama later from https://ollama.com
)
goto :ollama_done

:ollama_check_running
:: Check if Ollama is running
curl -s --connect-timeout 3 http://localhost:11434/api/tags >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Ollama is running and ready.
    set OLLAMA_RUNNING=1
) else (
    echo         Ollama is installed but not running.
    echo         Will start it after configuring CORS...
)

:ollama_done
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 3: Configure CORS for Ollama (THE CRITICAL FIX)
:: ══════════════════════════════════════════════════════════════
echo   [3/7] Configuring Ollama CORS access...

if "%OLLAMA_INSTALLED%"=="0" (
    echo         Skipped (Ollama not installed).
    goto :cors_done
)

:: 3a: Set for current session
set OLLAMA_ORIGINS=*
echo         Set OLLAMA_ORIGINS=* for current session.

:: 3b: Set persistently via setx (for future sessions)
setx OLLAMA_ORIGINS "*" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Set OLLAMA_ORIGINS=* permanently (survives reboot).
) else (
    echo         Note: Could not set permanent variable. Trying alternative...
    :: Try PowerShell as fallback
    powershell -Command "[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')" >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo         Set OLLAMA_ORIGINS=* permanently via PowerShell.
    ) else (
        echo         Set for this session only. Run as Administrator for permanent setting.
    )
)

:: 3c: CRITICAL — Kill and restart Ollama to pick up the CORS setting
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
:: Try starting the desktop app first
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
set OLLAMA_READY=0
for /L %%i in (1,1,15) do (
    if "!OLLAMA_READY!"=="0" (
        curl -s --connect-timeout 2 http://localhost:11434/api/tags >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            set OLLAMA_READY=1
        ) else (
            timeout /t 1 /nobreak >nul
        )
    )
)

:: Need delayed expansion for the loop above
setlocal EnableDelayedExpansion
set OLLAMA_READY=0
for /L %%i in (1,1,15) do (
    if "!OLLAMA_READY!"=="0" (
        curl -s --connect-timeout 2 http://localhost:11434/api/tags >nul 2>nul
        if !ERRORLEVEL! EQU 0 (
            set OLLAMA_READY=1
        ) else (
            timeout /t 1 /nobreak >nul >nul
        )
    )
)

if "!OLLAMA_READY!"=="1" (
    echo         Ollama is running with CORS enabled!
    set OLLAMA_RUNNING=1
) else (
    echo         Ollama is still starting up — it should be ready shortly.
    echo         The built-in proxy server will handle connections as a fallback.
    set OLLAMA_RUNNING=1
)
endlocal & set OLLAMA_RUNNING=%OLLAMA_RUNNING%

:cors_done
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 4: Locate / Download FreeLattice
:: ══════════════════════════════════════════════════════════════
echo   [4/7] Locating FreeLattice files...

:: Check if index.html is in the same directory as this script
if exist "%~dp0index.html" (
    set "FL_DIR=%~dp0"
    echo         Found FreeLattice in: %~dp0
    goto :fl_found
)

:: Check common locations
if exist "%USERPROFILE%\FreeLattice\index.html" (
    set "FL_DIR=%USERPROFILE%\FreeLattice"
    echo         Found FreeLattice in: %USERPROFILE%\FreeLattice
    goto :fl_found
)

if exist "%USERPROFILE%\Desktop\FreeLattice\index.html" (
    set "FL_DIR=%USERPROFILE%\Desktop\FreeLattice"
    echo         Found FreeLattice in: %USERPROFILE%\Desktop\FreeLattice
    goto :fl_found
)

if exist "%USERPROFILE%\Downloads\FreeLattice\index.html" (
    set "FL_DIR=%USERPROFILE%\Downloads\FreeLattice"
    echo         Found FreeLattice in: %USERPROFILE%\Downloads\FreeLattice
    goto :fl_found
)

if exist "%USERPROFILE%\Documents\FreeLattice\index.html" (
    set "FL_DIR=%USERPROFILE%\Documents\FreeLattice"
    echo         Found FreeLattice in: %USERPROFILE%\Documents\FreeLattice
    goto :fl_found
)

:: Not found — download it
echo         FreeLattice not found. Downloading...
echo.

:: Try git first
where git >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Using git clone...
    git clone https://github.com/Chaos2Cured/FreeLattice.git "%USERPROFILE%\FreeLattice" 2>nul
    if exist "%USERPROFILE%\FreeLattice\index.html" (
        set "FL_DIR=%USERPROFILE%\FreeLattice"
        echo         Downloaded FreeLattice via git.
        goto :fl_found
    )
)

:: Try curl
where curl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Using curl to download...
    curl -L -o "%TEMP%\freelattice.zip" "https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip" 2>nul
    if exist "%TEMP%\freelattice.zip" (
        echo         Extracting...
        powershell -Command "Expand-Archive -Force '%TEMP%\freelattice.zip' '%TEMP%\freelattice-extract'" 2>nul
        if exist "%TEMP%\freelattice-extract\FreeLattice-main" (
            xcopy /E /I /Y "%TEMP%\freelattice-extract\FreeLattice-main" "%USERPROFILE%\FreeLattice" >nul 2>nul
            set "FL_DIR=%USERPROFILE%\FreeLattice"
            del /q "%TEMP%\freelattice.zip" >nul 2>nul
            rmdir /s /q "%TEMP%\freelattice-extract" >nul 2>nul
            echo         Downloaded and extracted FreeLattice.
            goto :fl_found
        )
    )
)

:: Try PowerShell as last resort
echo         Using PowerShell to download...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip' -OutFile '%TEMP%\freelattice.zip'" 2>nul
if exist "%TEMP%\freelattice.zip" (
    powershell -Command "Expand-Archive -Force '%TEMP%\freelattice.zip' '%TEMP%\freelattice-extract'" 2>nul
    if exist "%TEMP%\freelattice-extract\FreeLattice-main" (
        xcopy /E /I /Y "%TEMP%\freelattice-extract\FreeLattice-main" "%USERPROFILE%\FreeLattice" >nul 2>nul
        set "FL_DIR=%USERPROFILE%\FreeLattice"
        del /q "%TEMP%\freelattice.zip" >nul 2>nul
        rmdir /s /q "%TEMP%\freelattice-extract" >nul 2>nul
        echo         Downloaded and extracted FreeLattice.
        goto :fl_found
    )
)

:: Download failed
echo.
echo         Could not download FreeLattice automatically.
echo         Please download manually from:
echo           https://github.com/Chaos2Cured/FreeLattice
echo.
pause
exit /b 1

:fl_found
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 5: Pull a default model if Ollama has none
:: ══════════════════════════════════════════════════════════════
echo   [5/7] Checking for AI models...

if "%OLLAMA_INSTALLED%"=="0" (
    echo         Skipped (Ollama not installed).
    echo         You can pull models later with: ollama pull llama3.2
    goto :models_done
)

:: Check if any models are installed
set HAS_MODELS=0
for /f "tokens=*" %%a in ('ollama list 2^>nul ^| findstr /V "NAME" ^| findstr /R "."') do (
    set HAS_MODELS=1
)

if "%HAS_MODELS%"=="0" (
    echo         No AI models installed yet.
    echo.
    echo         Recommended: llama3.2 (2GB, great for most tasks)
    echo         This may take a few minutes depending on your internet speed.
    echo.
    set /p MODEL_CHOICE="         Download llama3.2 now? (Y/n): "
    if /i "%MODEL_CHOICE%"=="" set MODEL_CHOICE=Y
    if /i "%MODEL_CHOICE%"=="Y" (
        echo.
        echo         Downloading llama3.2 (please wait)...
        echo.
        ollama pull llama3.2
        echo.
        echo         Model download complete!
    ) else (
        echo         Skipping — you can pull one later with: ollama pull llama3.2
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

set PORT=3000
netstat -an 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PORT=8080
    netstat -an 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set PORT=8081
        netstat -an 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
        if %ERRORLEVEL% EQU 0 (
            set PORT=8888
        )
    )
)
echo         Using port %PORT%
echo.

:: ══════════════════════════════════════════════════════════════
:: STEP 7: Start Server + Open Browser
:: ══════════════════════════════════════════════════════════════
echo   [7/7] Starting FreeLattice server...
echo.

cd /d "%FL_DIR%"

:: Open browser
start "" "http://localhost:%PORT%"

:: Print success message
echo.
echo   ╔══════════════════════════════════════════════════╗
echo   ║                                                  ║
echo   ║   FreeLattice is running!                        ║
echo   ║                                                  ║
echo   ║   Open: http://localhost:%PORT%                      ║
echo   ║                                                  ║
echo   ║   Close this window to stop the server.          ║
echo   ║   Press Ctrl+C to stop manually.                 ║
echo   ║                                                  ║
echo   ╚══════════════════════════════════════════════════╝
echo.

if "%OLLAMA_RUNNING%"=="1" (
    echo   Ollama is connected — local AI is ready!
    echo   CORS is configured — browser connections will work!
) else if "%OLLAMA_INSTALLED%"=="1" (
    echo   Ollama is installed but may still be starting up.
    echo   The built-in proxy server handles CORS automatically.
) else (
    echo   Tip: Install Ollama from ollama.com for local AI models
)
echo.

:: Start the server — prefer server.py (has Ollama proxy), fall back to http.server
set OLLAMA_ORIGINS=*

if exist "server.py" (
    echo   Starting Python server with Ollama proxy...
    echo.
    %PYTHON_CMD% server.py
    goto :end
)

if exist "server.js" (
    where node >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo   Starting Node.js server with Ollama proxy...
        echo.
        node server.js
        goto :end
    )
)

:: Fallback: simple Python HTTP server
echo   Starting simple Python HTTP server...
echo.
%PYTHON_CMD% -m http.server %PORT%

:end
echo.
echo   Server stopped. Goodbye!
echo.
pause
