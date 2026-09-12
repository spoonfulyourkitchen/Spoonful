@echo off
rem Läuft in Durchgängen weiter, bis alle Länder 100 Rezepte haben (über Nacht laufen lassen).
cd /d "%~dp0"
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-until-done.ps1" %*
pause
