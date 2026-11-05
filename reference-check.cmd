@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 20 oder neuer wird benoetigt: https://nodejs.org/
  pause
  exit /b 1
)
echo.
echo 2D Reference Check v29 RC1 - kein npm/Three.js erforderlich.
echo Bitte ein altes start.cmd-Fenster beenden, falls Port 8792 belegt ist.
echo.
node server.mjs --open --reference
if errorlevel 1 pause
