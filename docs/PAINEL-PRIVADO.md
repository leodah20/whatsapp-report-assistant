# Painel privado no Tailscale

A ponte usa Node sem dependências adicionais e escuta apenas em `127.0.0.1:8769`. O coletor continua na porta local original: não se copia o banco nem se inicia outra sessão de WhatsApp. Para a operação, use uma rede e um plano aprovados pela organização. Não publique via Funnel.

No computador do coletor, configure a ponte com `node scripts/serve-private-panel.mjs <hostname-ts.net> <login-exato>`, usando o nome completo do próprio dispositivo e a identidade de uma única conta autorizada. Direcione apenas Tailscale **Serve HTTPS** na porta 443 à porta local 8769. Não encaminhe a porta 8767, nem permita que outro proxy ou rede local acesse a ponte diretamente. A identidade é fornecida por Serve e não é uma senha.

O acesso remoto cobre a fila, resumo, histórico do chamado, imagens já vinculadas, contexto, atualizações e pendências. Administração do WhatsApp, histórico avulso, extração mensal, anexação de arquivos, união e arquivamento ficam fora desta primeira versão. O colaborador continua usando a demo em endereço separado.

Antes de ativar com dados reais, confirme a identidade e o escopo da rede. Teste com o celular em 5G: a conta autorizada vê a fila e consegue editar um caso de teste; outra conta e requisições sem identidade não passam; sem Tailscale o endereço não abre. O computador precisa ficar ligado, com o coletor, a ponte e o Tailscale ativos. Desabilitar o Serve HTTPS ou parar a ponte interrompe o acesso remoto sem parar o coletor.
