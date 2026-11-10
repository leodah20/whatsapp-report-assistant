param([switch]$Background)
$collectorRoot = $PSScriptRoot
$collectorPort = 8767
$localConfig = Join-Path $collectorRoot '.env.local'
if (Test-Path -LiteralPath $localConfig) {
    foreach ($line in Get-Content -LiteralPath $localConfig) {
        if ($line -match '^REPORT_PORT=["'']?(\d+)["'']?$') { $collectorPort = [int]$Matches[1] }
    }
}
$collectorUrl = "http://127.0.0.1:$collectorPort/"
try { Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 | Out-Null } catch {
    $portableAI = Join-Path $collectorRoot 'local-ai\start-ai.ps1'
    $ollamaCommand = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $portableAI) {
        Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $portableAI + '"') -WindowStyle Hidden
    } elseif ($ollamaCommand) {
        Start-Process -FilePath $ollamaCommand.Source -ArgumentList 'serve' -WindowStyle Hidden
    }
}
$collectorRunning = $false
try { $collectorRunning = (Invoke-WebRequest -Uri $collectorUrl -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch {}
if (-not $collectorRunning) {
    $nodeCommand = Get-Command node.exe -ErrorAction Stop
    $collectorArgs = @(('"' + (Join-Path $collectorRoot 'app.mjs') + '"'),'--retry-authorized-link','--enable-recovery')
    Start-Process -FilePath $nodeCommand.Source -ArgumentList $collectorArgs -WorkingDirectory $collectorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $collectorRoot 'service-output.log') -RedirectStandardError (Join-Path $collectorRoot 'service-error.log')
}
if (-not $Background) { Start-Process $collectorUrl }
