@echo off
setlocal
title Fingernote
cd /d "%~dp0"
echo.
echo   Fingernote wird gestartet ...
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist "dist\index.html" goto serve
if not exist "package.json" goto nozip

echo   Erster Start: Fingernote wird eingerichtet. Das dauert 1 bis 2 Minuten ...
echo.
if exist "node_modules" goto build
call npm install --no-audit --no-fund
if errorlevel 1 goto fail
:build
call npm run build:app
if errorlevel 1 goto fail

:serve
node serve.mjs
if errorlevel 1 goto fail
goto end

:nonode
echo   Node.js wurde nicht gefunden.
echo   Bitte Node.js installieren, Version 22 LTS: https://nodejs.org
echo   Danach dieses Fenster schliessen und start.bat erneut doppelklicken.
goto end

:nozip
echo   Dateien fehlen. Bitte das ZIP zuerst vollstaendig entpacken: Rechtsklick auf das ZIP, dann Alle extrahieren.
echo   Danach start.bat im entpackten Ordner doppelklicken.
goto end

:fail
echo.
echo   Da ist etwas schiefgegangen. Die Meldung oben zeigt den Grund.

:end
echo.
pause
