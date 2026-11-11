# Runs in the signed-in user's session; never performs QR linking or logout.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime.ps1')
. (Join-Path $PSScriptRoot 'watchdog-policy.ps1')
$runtime = Get-CollectorRuntime
$hash = [System.Security.Cryptography.SHA256]::Create()
try { $identity = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($runtime.Root.ToLowerInvariant()))).Replace('-','') } finally { $hash.Dispose() }
$guard = New-Object System.Threading.Mutex($false,('Local\ReportAssistant-' + $identity))
$locked = $false
try {
    try { $locked = $guard.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { return }
    New-Item -ItemType Directory -Path $runtime.Data -Force | Out-Null
    $statusFile = Join-Path $runtime.Data 'status.json'
    $pulseFile = Join-Path $runtime.Data 'watchdog.json'
    $phase = ''; $phaseSince = [DateTime]::UtcNow; $problemSince = $null
    $healthySince = $null; $nextRestart = [DateTime]::MinValue; $nextModel = [DateTime]::MinValue; $attempts = 0
    $status = $null; $heartbeatAge = 0
    while ($true) {
        $now = [DateTime]::UtcNow
        try {
            if ($now -ge $nextModel) {
                $nextModel = $now.AddMinutes(3)
                try { Start-LocalModel $runtime } catch {}
            }
            $owned = @(Get-OwnedCollector $runtime)
            $running = $owned.Count -gt 0
            $portOccupied = (-not $running) -and [bool](Get-NetTCPConnection -State Listen -LocalPort $runtime.Port -ErrorAction SilentlyContinue)
            try {
                $status = Get-Content -Raw -LiteralPath $statusFile | ConvertFrom-Json
                $heartbeatAge = ($now - (Get-Item -LiteralPath $statusFile).LastWriteTimeUtc).TotalSeconds
            } catch { $heartbeatAge += 20 }
            if ($status.state -ne $phase) { $phase = $status.state; $phaseSince = $now }
            $transportAge = if ($status.lastTransportCheck) { ($now - ([DateTimeOffset]$status.lastTransportCheck).UtcDateTime).TotalSeconds } else { [double]::PositiveInfinity }
            $decision = Get-CollectorDecision -Running $running -Status $status -HeartbeatAge $heartbeatAge -TransportAge $transportAge -PhaseAge (($now - $phaseSince).TotalSeconds)
            if ($portOccupied) { $decision = 'other-process' }
            if ($decision -in @('recover','start')) {
                $healthySince = $null
                if (-not $problemSince) { $problemSince = $now }
                $ready = $decision -eq 'start' -or ($now - $problemSince).TotalSeconds -ge 60
                if ($ready -and $now -ge $nextRestart) {
                    $attempts++
                    $nextRestart = $now.AddSeconds([Math]::Min(900,60*[Math]::Pow(2,[Math]::Min(4,$attempts-1))))
                    if ($decision -eq 'recover') { Stop-OwnedProcesses $owned }
                    $started = Start-OwnedCollector $runtime
                    if ($started) { $status = $null; $heartbeatAge = 0; $phase = ''; $phaseSince = $now; $problemSince = $null }
                }
            } else {
                $problemSince = $null
                if (-not $healthySince) { $healthySince = $now }
                if (($now - $healthySince).TotalMinutes -ge 5) { $attempts = 0; $nextRestart = [DateTime]::MinValue }
            }
            @{at=$now.ToString('o');decision=$decision;attempts=$attempts;nextAttemptAt=if($attempts){$nextRestart.ToString('o')}else{$null}} | ConvertTo-Json -Compress | Set-Content -LiteralPath $pulseFile -Encoding UTF8
        } catch {
            @{at=$now.ToString('o');decision='check-failed';attempts=$attempts} | ConvertTo-Json -Compress | Set-Content -LiteralPath $pulseFile -Encoding UTF8 -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 20
    }
} finally {
    if ($locked) { $guard.ReleaseMutex() }
    $guard.Dispose()
}
