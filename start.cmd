@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 20 or newer is required: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "vendor\three\build\three.module.js" (
  echo [ERROR] The bundled Three.js runtime is missing from vendor\three.
  echo Unpack the complete repository-ready ZIP again.
  pause
  exit /b 1
)
node server.mjs --open
if errorlevel 1 pause
