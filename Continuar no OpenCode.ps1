# Optional coding fallback. Does not start/stop/change the WhatsApp assistant.
# This opens a remote coding model: never authorize private archive/MCP access.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$openCodeCommand = Get-Command opencode -ErrorAction Stop
$freeModel = 'opencode/deepseek-v4.1-flash-free'
$availableModels = & $openCodeCommand.Source models opencode
if ($LASTEXITCODE -ne 0 -or $availableModels -notcontains $freeModel) {
    throw 'O modelo Free esperado não está disponível. Confira /models e não aceite fallback pago.'
}
Write-Host 'Alternativa temporária ao Codex, nesta mesma pasta e origin.'
Write-Host 'Confirme que o provedor ainda identifica o modelo como Free. Sem autorização para ler dados privados/MCP.'
& $openCodeCommand.Source $PSScriptRoot --model $freeModel
