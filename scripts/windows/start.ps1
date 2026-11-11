param([switch]$Background)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime.ps1')
$runtime = Get-CollectorRuntime
$watchdog = Join-Path $PSScriptRoot 'watchdog.ps1'
Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $watchdog + '"') -WorkingDirectory $runtime.Root -WindowStyle Hidden
if (-not $Background) { Start-Process ("http://127.0.0.1:" + $runtime.Port + "/chamados") }
