@echo off
setlocal EnableDelayedExpansion
title FreeLattice Server
echo.
echo   ========================================================
echo     FreeLattice  -  Starting Local Server...
echo   ========================================================
echo.

:: Set CORS for Ollama
set "OLLAMA_ORIGINS=*"

:: Get script directory (handles spaces in paths)
set "SCRIPT_DIR=%~dp0"
if "!SCRIPT_DIR:~-1!"=="\" set "SCRIPT_DIR=!SCRIPT_DIR:~0,-1!"

:: Try Python server first (has Ollama proxy)
set "PYTHON_CMD="
where python >nul 2>nul && set "PYTHON_CMD=python"
where python3 >nul 2>nul && set "PYTHON_CMD=python3"
where py >nul 2>nul && set "PYTHON_CMD=py -3"

if defined PYTHON_CMD (
    if exist "!SCRIPT_DIR!\server.py" (
        echo   Found Python - starting server with Ollama proxy...
        echo.
        start "" http://localhost:3000
        !PYTHON_CMD! "!SCRIPT_DIR!\server.py"
        goto :end
    )
)

:: Try Node.js
where node >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    if exist "!SCRIPT_DIR!\server.js" (
        echo   Found Node.js - starting server with Ollama proxy...
        echo.
        start "" http://localhost:3000
        node "!SCRIPT_DIR!\server.js"
        goto :end
    )
)

:: Fallback: simple Python HTTP server
if defined PYTHON_CMD (
    echo   Starting simple Python HTTP server...
    echo.
    start "" http://localhost:3000
    cd /d "!SCRIPT_DIR!"
    !PYTHON_CMD! -m http.server 3000
    goto :end
)

:: Neither found
echo.
echo   Neither Node.js nor Python was found on your system.
echo.
echo   To run FreeLattice, install one of these:
echo.
echo     Option 1: Python (recommended)
echo       Download from: https://python.org
echo       During install, CHECK "Add Python to PATH"
echo.
echo     Option 2: Node.js
echo       Download from: https://nodejs.org
echo       Choose the LTS version
echo.
echo   Or just open index.html directly in your browser!
echo.

:end
pause
endlocal
