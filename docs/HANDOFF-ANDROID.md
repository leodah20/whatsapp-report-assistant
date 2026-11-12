# Runavolt: passagem para o Android

## Objetivo confirmado

Entregar um APK Android instalável que abra a Central pelo Wi-Fi ou 4G/5G, sem exigir Tailscale no celular. Nesta fase, o PC Windows do responsável hospeda o coletor, banco e modelo local. Não comprar hardware, contratar plano pago ou migrar dados para a nuvem por conta própria. O acesso depende de o PC, os processos e a conexão permanecerem ativos; não prometer disponibilidade contínua ainda.

## O que já existe

- Central responsiva e PWA privada, com autenticação pela ponte Tailscale Serve. O administrador pode conceder/revogar os perfis de leitura e edição. As restrições são impostas no servidor, não só na interface.
- Explorador somente leitura em `/api-explorer`: estado, listagem e detalhe. Swagger/OpenAPI é opcional e não é requisito para o APK.
- A API local está atrás do painel. O coletor escuta em loopback e não deve receber tráfego direto da internet. A ponte atual confia na identidade do Serve; não reutilizar cabeçalhos desse mecanismo como autenticação em outro proxy.
- APK nativo, URL HTTPS estável sem VPN no celular, autenticação nesse novo caminho e teste em celular real continuam pendentes. Não há domínio autorizado para essa etapa. Java 17 e SDK Android com plataforma/build-tools 35 foram encontrados na máquina do piloto; conferir no ambiente em que for compilar.

## Ordem de trabalho

1. Leia [AGENTS.md](../AGENTS.md), [PROJECT_STATE.md](PROJECT_STATE.md), [HANDOFF.md](HANDOFF.md) e [PAINEL-PRIVADO.md](PAINEL-PRIVADO.md). Trabalhe no mesmo origin; com modelo remoto prefira um clone limpo sem dados operacionais.
2. Desenvolva o APK e a autenticação em laboratório isolado, com dados fictícios. Valide a sessão e o perfil no servidor, bloqueio de escrita para leitura, revogação, origens permitidas, falhas de conexão e preservação do comportamento do painel atual. Não coloque senha, token de serviço ou chave de assinatura no APK ou no Git.
3. Antes de publicar, confirme domínio/endereço estável, autorização do responsável, método de login individual e ausência de cobrança. Cloudflare Tunnel com Access é uma opção a avaliar, não uma implantação existente. Não abra portas, não publique via Funnel, não use túnel temporário com dados reais e não altere a ponte atual sem confirmação.
4. Após aprovação, valide instalação e login no celular com Tailscale desligado e os perfis de administrador, edição e leitura. Documente como iniciar/recuperar os processos após reinício do PC e como revogar acesso. Só então entregue o APK de distribuição assinado.

Rode `npm test` e `git diff --check`, registre o que foi de fato testado e publique apenas código e documentação sanitizados. O arquivo de chamados, a sessão do WhatsApp, credenciais e anexos permanecem fora do repositório e de ferramentas de programação remotas.
