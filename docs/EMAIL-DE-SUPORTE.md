# E-mail de suporte · Invenzi

Conector opcional para o coletor local. Reutiliza a instalação irmã `imap-readonly` e suas permissões e credenciais já cadastradas no Windows. Não instala ou cadastra uma conta nova.

- A busca lê a **Caixa de Entrada** e filtra o remetente da central de atendimento. A resposta do IMAP é conferida novamente antes de interpretar o texto. Um cabeçalho From não é prova criptográfica de autoria.
- A associação usa o número explícito no banner do ticket, nunca a semelhança do assunto. Cada Message-ID é processado uma vez. O cursor IMAP é persistido com UIDVALIDITY; se a validade mudar, o reprocessamento não duplica registros.
- Novos e-mails entram no histórico e como fontes do fechamento, com a data do registro separada da data real do atendimento. `Resolvido` do fornecedor não encerra a etapa técnica local. Formatos sem ID e mensagens fora do limite contam como pendência de conferência em Configuração.
- Mensagens, tickets e cursor ficam no SQLite em tabelas próprias, com conteúdo protegido pela chave da instalação. As ferramentas MCP de WhatsApp continuam restritas ao grupo. Não há cópia para IA remota, download de anexos, SMTP, alteração de flags ou resposta no WhatsApp por causa de um e-mail. A pasta de enviados não é consultada nesta fase.
- O primeiro lote começa na data local configurada; novas mensagens são verificadas a cada três minutos enquanto o coletor estiver ligado. Lotes maiores são retomados em blocos de até 20. O painel de Configuração exibe o estado sem mostrar endereços ou credenciais.

Para ativar em uma instalação autorizada, crie `.support-mail.local.json` na raiz local, com `enabled: true` e `since` no formato `AAAA-MM-DD`. Esse arquivo deve ficar fora do Git. Para pausar, use `enabled: false` e recarregue o coletor; o histórico importado permanece. O usuário não precisa configurar SMTP nem fornecer senha no chat.
