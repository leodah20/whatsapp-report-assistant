# Painel privado no Tailscale

A ponte usa Node sem dependências adicionais e escuta apenas em loopback. A porta local padrão é 8769; se estiver em uso, indique outra no terceiro argumento e aponte Serve para ela. O coletor continua na porta local original: não se copia o banco nem se inicia outra sessão de WhatsApp. Para a operação, use uma rede e um plano aprovados pela organização. Não publique via Funnel.

No computador do coletor, configure a ponte com `node scripts/serve-private-panel.mjs <hostname-ts.net> <login-exato>`, usando o nome completo do próprio dispositivo e a identidade da conta administradora. Direcione apenas Tailscale **Serve HTTPS** à porta local 8769. Se a porta HTTPS for diferente da padrão, inclua-a no primeiro argumento e no endereço do navegador, por exemplo `host.exemplo.ts.net:8443`. Não encaminhe a porta 8767, nem permita que outro proxy ou rede local acesse a ponte diretamente. A identidade é fornecida por Serve e não é uma senha. O host da ponte é uma fronteira de confiança: somente processos locais confiáveis podem acessar seu loopback.

## Perfis

| Perfil | Pode fazer |
| --- | --- |
| Administrador | Todas as ferramentas remotas, inclusive gestão de acessos, união e arquivamento, mídia, Histórico sem chamado e fechamento. O login inicial não pode ser alterado no painel. |
| Somente leitura | Ver a fila, o contexto do chamado, as pendências e o histórico de atualizações no painel. |
| Pode editar chamados | Tudo da leitura, mais atualizar cadastro, contexto e etapa, registrar notas e abrir ou concluir pendências. |

O servidor verifica o perfil a cada requisição. Colaboradores não recebem o arquivo bruto do WhatsApp, e-mails brutos, mídia, exportações ou ferramentas administrativas. Os textos operacionais do próprio chamado são compartilhados. Sem necessidade de reiniciar, **Configuração → Usuários e permissões** permite cadastrar, alterar ou revogar pelo login exato no Tailscale. A lista é persistida em `.remote-panel-access.local.json`, fora do Git, e não contém senhas. Alterações nos chamados preservam o histórico de eventos existente, mas não há identificação individual do editor na linha do tempo nesta versão. O vínculo/QR, grupo, pausa, mensagens automáticas e importação do WhatsApp continuam locais.

## Celular

Abra **Chamados** no endereço privado, com a conta autorizada conectada ao Tailscale. No Android, use **Instalar Runavolt** quando aparecer ou o menu do navegador **Adicionar à tela inicial**. No iPhone, use **Compartilhar → Adicionar à Tela de Início** no Safari. A interface instala pelo navegador, não por APK ou loja. Não há modo offline nem armazenamento offline de chamados pelo app.

O cadastro no painel não convida o colaborador para a rede. Antes de compartilhar dados reais, confirme a autorização organizacional e restrinja a política da rede ao colaborador e à porta HTTPS da Central; não compartilhe o acesso geral ao computador ou a rede inteira. Confirme a resolução do nome privado no celular. Teste em Wi-Fi/5G com as contas reais usando um caso autorizado de teste. O computador precisa ficar ligado, com o coletor, a ponte e o Tailscale ativos. Desabilitar o Serve HTTPS ou parar a ponte interrompe o acesso remoto sem parar o coletor.
