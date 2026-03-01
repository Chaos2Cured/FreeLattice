@echo off
title FreeLattice Server
echo.
echo   =============================================
echo     FreeLattice — Starting Local Server...
echo   =============================================
echo.

:: Try Node.js first
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   Found Node.js — starting server...
    echo.
    start "" http://localhost:3000
    node "%~dp0server.js"
    goto :end
)

:: Fall back to Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   Found Python — starting server...
    echo.
    start "" http://localhost:3000
    python "%~dp0server.py"
    goto :end
)

:: Try python3 (some installations use this)
where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   Found Python 3 — starting server...
    echo.
    start "" http://localhost:3000
    python3 "%~dp0server.py"
    goto :end
)

:: Neither found
echo.
echo   !! Neither Node.js nor Python was found on your system.
echo.
echo   To run FreeLattice as a local server, install one of these:
echo.
echo     Option 1: Node.js (recommended)
echo       Download from: https://nodejs.org
echo       Choose the LTS version, install, then run this script again.
echo.
echo     Option 2: Python
echo       Download from: https://python.org
echo       During install, CHECK "Add Python to PATH", then run this script again.
echo.
echo   Or just open index.html directly in your browser — it works without a server!
echo.

:end
pause
