function Get-CollectorDecision {
    param([bool]$Running,$Status,[double]$HeartbeatAge,[double]$TransportAge,[double]$PhaseAge)
    if (-not $Running) { return 'start' }
    if ($Status.paused -or $Status.requiresLink -or $Status.hasQr -or $Status.state -in @('aguardando-qr','falha-autenticacao')) { return 'manual' }
    if ($HeartbeatAge -gt 120) { return 'recover' }
    if (-not $Status.selected) { return 'idle' }
    if ($Status.state -in @('erro','desconectado','parado')) { return 'recover' }
    if ($Status.state -eq 'conectado' -and $TransportAge -gt 150) { return 'recover' }
    if ($Status.state -in @('iniciando','autenticando','verificando') -and $PhaseAge -gt 300) { return 'recover' }
    return 'ok'
}
