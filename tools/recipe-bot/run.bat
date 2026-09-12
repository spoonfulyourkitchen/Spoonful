@echo off
rem Startet den Recipe-Bot im Hintergrund (siehe run.ps1).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
