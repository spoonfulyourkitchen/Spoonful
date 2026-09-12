# run-until-done.ps1 - laeuft in Durchgaengen weiter, bis JEDES Land 100 Rezepte hat.
# Start:  .\start.bat     (oder  .\run-until-done.ps1)
# Laeuft auch ueber Nacht weiter: nach jedem Durchgang wird geprueft, was noch fehlt,
# und nach einer Pause neu gestartet. Rezepte ohne Bild werden automatisch ergaenzt.
param([int]$PauseSeconds = 120)

Set-Location -Path $PSScriptRoot

# Schutz: nicht zwei Bots gleichzeitig laufen lassen
$running = @(Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -like '*bot.mjs*' -and $_.CommandLine -notlike '*--progress*' })
if ($running.Count -gt 0) {
  Write-Host ""
  Write-Host "Es laeuft schon ein Rezept-Bot (PID $($running[0].ProcessId)) - es wird nichts doppelt gestartet." -ForegroundColor Yellow
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
  $state = (& node bot.mjs --progress 2>$null | Out-String)
  $m = [regex]::Match($state, 'Fertige L..nder:\s+(\d+) von (\d+)')
  $doneCount = 0
  $allCount = 0
  if ($m.Success) {
    $doneCount = [int]$m.Groups[1].Value
    $allCount = [int]$m.Groups[2].Value
  }
  Write-Host $state
  Write-Host "Durchgang $pass beendet: $doneCount von $allCount Laendern fertig."

  if ($allCount -gt 0 -and $doneCount -ge $allCount) {
    Write-Host ""
    Write-Host "ALLE $allCount LAENDER FERTIG - $(Get-Date -Format 'dd.MM.yyyy HH:mm')" -ForegroundColor Green
    break
  }

  Write-Host "Weiter in $PauseSeconds Sekunden (Strg+C beendet die Schleife)." -ForegroundColor Yellow
  Start-Sleep -Seconds $PauseSeconds
}
