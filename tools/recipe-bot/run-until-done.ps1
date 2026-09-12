# run-until-done.ps1 — läuft in Durchgängen weiter, bis JEDES Land 100 Rezepte hat.
# Start:  .\start.bat     (oder  .\run-until-done.ps1)
# Läuft auch über Nacht weiter: nach jedem Durchgang wird geprüft, was noch fehlt,
# und nach einer Pause neu gestartet. Rezepte ohne Bild werden automatisch ergänzt.
param([int]$PauseSeconds = 120)

Set-Location -Path $PSScriptRoot

# Schutz: nicht zwei Bots gleichzeitig laufen lassen
$running = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -like '*bot.mjs*' -and $_.CommandLine -notlike '*--progress*' }
if ($running) {
  Write-Host ""
  Write-Host "Es laeuft schon ein Rezept-Bot (PID $($running.ProcessId)) — es wird nichts doppelt gestartet." -ForegroundColor Yellow
  Write-Host "Beenden mit:  Stop-Process -Name node   (danach dieses Skript erneut starten)"
  exit 1
}

$botArgs = @('--inflight=12', '--wave-ms=8000', '--batch=4', '--blocks=3', '--max-tokens=16384', '--reasoning=off')
$pass = 0

while ($true) {
  $pass++
  $stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
  $log = "logs\until-done-$stamp.log"
  $logErr = "logs\until-done-$stamp.err"
  Write-Host ""
  Write-Host "==== Durchgang $pass  |  $(Get-Date -Format 'HH:mm')  |  Log: $log ====" -ForegroundColor Cyan

  Start-Process -FilePath 'node' -ArgumentList (@('bot.mjs') + $botArgs) -WorkingDirectory $PSScriptRoot `
    -RedirectStandardOutput $log -RedirectStandardError $logErr -NoNewWindow -Wait

  # Fortschritt auswerten
  $state = & node bot.mjs --progress 2>$null | Out-String
  $m = [regex]::Match($state, 'Fertige Länder:\s+(\d+) von (\d+)')
  $doneCount = if ($m.Success) { [int]$m.Groups[1].Value } else { 0 }
  $allCount = if ($m.Success) { [int]$m.Groups[2].Value } else { 0 }
  Write-Host $state
  Write-Host "Durchgang $pass beendet: $doneCount von $allCount Ländern fertig."

  if ($allCount -gt 0 -and $doneCount -ge $allCount) {
    Write-Host ""
    Write-Host "ALLE $allCount LÄNDER FERTIG — $(Get-Date -Format 'dd.MM.yyyy HH:mm')" -ForegroundColor Green
    break
  }

  Write-Host "Weiter in $PauseSeconds Sekunden (Strg+C beendet die Schleife)." -ForegroundColor Yellow
  Start-Sleep -Seconds $PauseSeconds
}
