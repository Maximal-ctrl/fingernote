@echo off
REM Fingernote starten (Windows): installiert beim ersten Mal, baut und oeffnet http://localhost:5173
cd /d "%~dp0"
where node >nul 2>nul || (echo Bitte zuerst Node.js 22 (LTS) oder neuer installieren: https://nodejs.org & pause & exit /b 1)
if not exist node_modules call npm install
call npm start
pause
