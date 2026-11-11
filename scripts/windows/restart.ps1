param([ValidatePattern('^R-[A-F0-9]{8}$')][string]$ConfirmAnswer)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime.ps1')
$runtime = Get-CollectorRuntime
Stop-OwnedProcesses @(Get-OwnedCollector $runtime)
Start-OwnedCollector $runtime $ConfirmAnswer | Select-Object Id | ConvertTo-Json
