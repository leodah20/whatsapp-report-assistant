# Lifecycle scoped to this installation's exact app path and browser profile.
function Get-CollectorRuntime {
    $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
    if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js nao encontrado.' }
    Push-Location -LiteralPath $projectRoot
    try {
        $cfg = & $nodePath --input-type=module -e "import{CONFIG as c}from'./src/config.mjs';console.log(JSON.stringify({data:c.dataDir,port:c.port,session:c.sessionId,ai:c.ollamaURL}))" | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or -not $cfg) { throw 'Configuracao local invalida.' }
    } finally { Pop-Location }
    [pscustomobject]@{
        Node = $nodePath; Root = $projectRoot; App = Join-Path $projectRoot 'src\app.mjs'
        LegacyApp = Join-Path $projectRoot 'app.mjs'
        Profile = Join-Path $cfg.data ('session\session-' + $cfg.session)
        Data = $cfg.data; Port = [int]$cfg.port; Ai = $cfg.ai
    }
}

function Get-OwnedCollector($runtime) {
    $appArgs = @([regex]::Escape($runtime.App),[regex]::Escape($runtime.LegacyApp)) -join '|'
    $appPattern = '(?:^|\s)(?:"(?:' + $appArgs + ')"|(?:' + $appArgs + '))(?:\s|$)'
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
        $_.ExecutablePath -eq $runtime.Node -and $_.CommandLine -match $appPattern
    }
}

function Get-OwnedBrowser($runtime) {
    $profileArg = [regex]::Escape($runtime.Profile)
    $profilePattern = '(?:^|\s)(?:"--user-data-dir=' + $profileArg + '"|--user-data-dir="' + $profileArg + '"|--user-data-dir=' + $profileArg + ')(?:\s|$)'
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe' OR Name='chromium.exe'" | Where-Object {
        $_.CommandLine -match $profilePattern -and $_.CommandLine -notlike '*--type=*'
    }
}

function Stop-OwnedProcesses($processes) {
    foreach ($owned in $processes) {
        $current = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $owned.ProcessId) -ErrorAction SilentlyContinue
        if ($current -and $current.CreationDate -eq $owned.CreationDate -and $current.CommandLine -eq $owned.CommandLine) {
            Stop-Process -Id $owned.ProcessId -ErrorAction Stop
            Wait-Process -Id $owned.ProcessId -Timeout 8 -ErrorAction SilentlyContinue
        }
    }
}

function Start-LocalModel($runtime) {
    try { Invoke-RestMethod ($runtime.Ai + '/api/version') -TimeoutSec 2 | Out-Null; return } catch {}
    $portable = Join-Path $runtime.Root 'local-ai\start-ai.ps1'
    $ollama = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $portable) {
        Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $portable + '"') -WindowStyle Hidden
    } elseif ($ollama) {
        Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden
    }
}

function Start-OwnedCollector($runtime,[string]$confirmAnswer) {
    if (Get-NetTCPConnection -State Listen -LocalPort $runtime.Port -ErrorAction SilentlyContinue) { return }
    if (Get-OwnedCollector $runtime) { return }
    Stop-OwnedProcesses @(Get-OwnedBrowser $runtime)
    $collectorArgs = @(('"' + $runtime.App + '"'),'--retry-authorized-link','--enable-recovery')
    if ($confirmAnswer) { $collectorArgs += ('--confirm-answer=' + $confirmAnswer) }
    Start-Process -FilePath $runtime.Node -ArgumentList $collectorArgs -WorkingDirectory $runtime.Root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime.Root 'service-output.log') -RedirectStandardError (Join-Path $runtime.Root 'service-error.log') -PassThru
}
