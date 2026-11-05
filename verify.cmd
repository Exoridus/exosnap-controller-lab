@echo off
cd /d "%~dp0"
node --check app.js
if errorlevel 1 (pause & exit /b 1)
npm test
if errorlevel 1 pause
