# run.ps1 — startet den Recipe-Bot im Hintergrund, mit Logdatei.
# Aufruf:  .\run.ps1                      (Standard: --max-countries=10)
#          .\run.ps1 --countries=Italy    (eigene Argumente möglich)
param([Parameter(ValueFromRemainingArguments = $true)] $BotArgs)

Set-Location -Path $PSScriptRoot
New-Item -ItemType Directory -Force -Path logs | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$out = "logs\run-$stamp.log"
$err = "logs\run-$stamp.err"

if (-not $BotArgs -or $BotArgs.Count -eq 0) { $BotArgs = @('--max-countries=10', '--wave-ms=90000', '--parallel=3') }

Start-Process -FilePath 'node' -ArgumentList (@('bot.mjs') + $BotArgs) `
  -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow

Write-Host "Bot läuft im Hintergrund (Argumente: $($BotArgs -join ' '))"
Write-Host "Log:      $out"
Write-Host "Status:   node bot.mjs --verify"
Write-Host "Beenden:  Stop-Process -Name node    (Fortschritt steht in state.json)"
