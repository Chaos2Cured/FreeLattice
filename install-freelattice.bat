@echo off
chcp 65001 >nul 2>&1
title FreeLattice — One-Click Installer
color 0F

:: ╔══════════════════════════════════════════════════════════════╗
:: ║         FreeLattice — One-Click Installer (Windows)         ║
:: ║         The lattice speaks to those who listen.             ║
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

:: ── Step 1: Check Python ─────────────────────────────────────
echo   [1/5] Checking for Python...

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYVER=%%v
    echo         Found: %PYVER%
    set PYTHON_CMD=python
    goto :python_ok
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%v in ('python3 --version 2^>^&1') do set PYVER=%%v
    echo         Found: %PYVER%
    set PYTHON_CMD=python3
    goto :python_ok
)

:: Python not found
echo.
echo         Python is not installed or not in PATH.
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

:: ── Step 2: Check Ollama ─────────────────────────────────────
echo   [2/5] Checking for Ollama (local AI engine)...

where ollama >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Ollama is installed!
    set OLLAMA_FOUND=1

    :: Check if Ollama is running
    curl -s --connect-timeout 2 http://localhost:11434/api/tags >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo         Ollama is running and ready.
        set OLLAMA_RUNNING=1
    ) else (
        echo         Ollama is installed but not running.
        echo         Starting Ollama...
        start "" /b ollama serve >nul 2>nul
        timeout /t 3 /nobreak >nul
        echo         Ollama should be starting up.
        set OLLAMA_RUNNING=1
    )
) else (
    echo         Ollama is not installed (optional).
    echo         Ollama lets you run AI models locally for full privacy.
    echo         Download from: https://ollama.ai
    echo.
    echo         FreeLattice also works with cloud AI providers.
    echo         You can install Ollama later if you want local AI.
    set OLLAMA_FOUND=0
    set OLLAMA_RUNNING=0
)
echo.

:: ── Step 3: Configure CORS ───────────────────────────────────
echo   [3/5] Configuring Ollama CORS access...

if "%OLLAMA_FOUND%"=="1" (
    :: Set for current session
    set OLLAMA_ORIGINS=*

    :: Set persistently via setx
    setx OLLAMA_ORIGINS "*" >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo         OLLAMA_ORIGINS=* set permanently.
        echo         Browser can now communicate with Ollama.
    ) else (
        echo         Set OLLAMA_ORIGINS=* for this session.
        echo         Note: You may need to run as Administrator for permanent setting.
    )
) else (
    echo         Skipped (Ollama not installed).
)
echo.

:: ── Step 4: Locate / Download FreeLattice ────────────────────
echo   [4/5] Locating FreeLattice files...

:: Check if index.html is in the same directory as this script
if exist "%~dp0index.html" (
    set FL_DIR=%~dp0
    echo         Found FreeLattice in: %FL_DIR%
    goto :fl_found
)

:: Check common locations
if exist "%USERPROFILE%\FreeLattice\index.html" (
    set FL_DIR=%USERPROFILE%\FreeLattice
    echo         Found FreeLattice in: %FL_DIR%
    goto :fl_found
)

if exist "%USERPROFILE%\Desktop\FreeLattice\index.html" (
    set FL_DIR=%USERPROFILE%\Desktop\FreeLattice
    echo         Found FreeLattice in: %FL_DIR%
    goto :fl_found
)

if exist "%USERPROFILE%\Downloads\FreeLattice\index.html" (
    set FL_DIR=%USERPROFILE%\Downloads\FreeLattice
    echo         Found FreeLattice in: %FL_DIR%
    goto :fl_found
)

:: Not found — download it
echo         FreeLattice not found. Downloading...
echo.

:: Try git first
where git >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Using git clone...
    git clone https://github.com/Chaos2Cured/FreeLattice.git "%USERPROFILE%\FreeLattice"
    if %ERRORLEVEL% EQU 0 (
        set FL_DIR=%USERPROFILE%\FreeLattice
        echo         Downloaded FreeLattice via git.
        goto :fl_found
    )
)

:: Try curl
where curl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo         Using curl to download...
    curl -L -o "%TEMP%\freelattice.zip" "https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip"
    if exist "%TEMP%\freelattice.zip" (
        echo         Extracting...
        powershell -Command "Expand-Archive -Force '%TEMP%\freelattice.zip' '%TEMP%\freelattice-extract'"
        if exist "%TEMP%\freelattice-extract\FreeLattice-main" (
            xcopy /E /I /Y "%TEMP%\freelattice-extract\FreeLattice-main" "%USERPROFILE%\FreeLattice" >nul
            set FL_DIR=%USERPROFILE%\FreeLattice
            del /q "%TEMP%\freelattice.zip" >nul 2>nul
            rmdir /s /q "%TEMP%\freelattice-extract" >nul 2>nul
            echo         Downloaded and extracted FreeLattice.
            goto :fl_found
        )
    )
)

:: Try PowerShell as last resort
echo         Using PowerShell to download...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip' -OutFile '%TEMP%\freelattice.zip'"
if exist "%TEMP%\freelattice.zip" (
    powershell -Command "Expand-Archive -Force '%TEMP%\freelattice.zip' '%TEMP%\freelattice-extract'"
    if exist "%TEMP%\freelattice-extract\FreeLattice-main" (
        xcopy /E /I /Y "%TEMP%\freelattice-extract\FreeLattice-main" "%USERPROFILE%\FreeLattice" >nul
        set FL_DIR=%USERPROFILE%\FreeLattice
        del /q "%TEMP%\freelattice.zip" >nul 2>nul
        rmdir /s /q "%TEMP%\freelattice-extract" >nul 2>nul
        echo         Downloaded and extracted FreeLattice.
        goto :fl_found
    )
)

:: Download failed
echo.
echo         Could not download FreeLattice automatically.
echo         Please download manually:
echo           https://github.com/Chaos2Cured/FreeLattice
echo.
pause
exit /b 1

:fl_found
echo.

:: ── Step 5: Start Server ─────────────────────────────────────
echo   [5/5] Starting FreeLattice server...
echo.

cd /d "%FL_DIR%"

:: Determine port — try 3000 first (matches server.py), then 8080, then find one
set PORT=3000
netstat -an 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PORT=8080
    netstat -an 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set PORT=8081
    )
)

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
) else (
    echo   Tip: Install Ollama from ollama.ai for local AI models
)
echo.

:: Start the server — prefer server.py/server.js, fall back to http.server
if exist "server.js" (
    where node >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set PORT=3000
        node server.js
        goto :end
    )
)

if exist "server.py" (
    set PORT=%PORT%
    %PYTHON_CMD% server.py
    goto :end
)

:: Fallback: simple Python HTTP server
%PYTHON_CMD% -m http.server %PORT%

:end
echo.
echo   Server stopped. Goodbye!
echo.
pause
