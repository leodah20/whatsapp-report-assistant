# Demonstração do painel

Na raiz do repositório, rode `node scripts/serve-demo.mjs` e abra `http://127.0.0.1:8768/`. Não é necessário iniciar o coletor, vincular o WhatsApp, instalar o Ollama ou configurar banco. A demo usa o painel de chamados e o explorador com cinco exemplos fictícios em memória. Histórico do WhatsApp, fechamento e configuração do coletor não são servidos por ela.

Para uma apresentação remota aprovada, publique apenas essa porta de demonstração pelo Tailscale Serve, numa rede privada com acesso restrito aos destinatários. Não compartilhe a máquina de trabalho inteira nem a porta do coletor. Antes de encaminhar o endereço, confirme no celular, fora do Wi-Fi: o link carrega dentro da rede autorizada e fica inacessível fora dela. Não use o endereço de login do dispositivo como convite.
