param([ValidatePattern('^R-[A-F0-9]{8}$')][string]$ConfirmAnswer)
$waRoot = $PSScriptRoot
$waApp = Join-Path $waRoot 'app.mjs'
$waProfile = Join-Path $waRoot 'data\session'
$waService = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($waApp) }
foreach ($waProcess in $waService) { Stop-Process -Id $waProcess.ProcessId -ErrorAction Stop }
$waChromeList = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($waProfile) -and $_.CommandLine -notlike '*--type=*' }
foreach ($waChrome in $waChromeList) { Stop-Process -Id $waChrome.ProcessId -ErrorAction SilentlyContinue }
$waArguments = @(('"' + $waApp + '"'),'--retry-authorized-link','--enable-recovery')
if ($ConfirmAnswer) { $waArguments += ('--confirm-answer=' + $ConfirmAnswer) }
$waNode = Get-Command node.exe -ErrorAction Stop
$waStarted = Start-Process -FilePath $waNode.Source -ArgumentList $waArguments -WorkingDirectory $waRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $waRoot 'service-output.log') -RedirectStandardError (Join-Path $waRoot 'service-error.log') -PassThru
$waStarted | Select-Object Id | ConvertTo-Json
