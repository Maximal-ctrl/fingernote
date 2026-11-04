@echo off
setlocal
title Fingernote
cd /d "%~dp0"
echo.
echo   Fingernote wird gestartet ...
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist "dist\index.html" goto nodist

node serve.mjs
if errorlevel 1 goto fail
goto end

:nonode
echo   Node.js wurde nicht gefunden.
echo   Bitte Node.js installieren, Version 22 LTS: https://nodejs.org
echo   Danach dieses Fenster schliessen und start.bat erneut doppelklicken.
goto end

:nodist
echo   Der Ordner dist fehlt.
echo   Bitte das ZIP zuerst vollstaendig entpacken: Rechtsklick auf das ZIP, dann Alle extrahieren.
echo   Danach start.bat im entpackten Ordner doppelklicken.
goto end

:fail
echo.
echo   Da ist etwas schiefgegangen. Die Meldung oben zeigt den Grund.

:end
echo.
pause
