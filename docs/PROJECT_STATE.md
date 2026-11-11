# Estado — 2026-11-10

## Objetivo principal

Acompanhamento dos chamados, histórico, atualizações e pendências para gerar o relatório mensal no padrão aprovado, com fatos confirmados e revisão do responsável. Ferramentas e arquitetura são apoio a esse fluxo, não o produto principal. Codex continua como ambiente de desenvolvimento principal; OpenCode/DeepSeek é alternativa quando indisponível.

## Implementado

Coletor local Windows (Node + whatsapp-web.js), SQLite criptografado e chave no Gerenciador de Credenciais; vínculo e seleção explícita do grupo. Ollama local com extração literal. Chamados, perguntas de contexto, respostas vinculadas e confirmação por atualização. Recibos de coleta/cadastro. Recuperação durável após reconexão e controle de envios incertos. Painel operacional loopback e quatro ferramentas MCP de leitura. Testes sintéticos.

O funcionamento não depende de Codex/OpenCode/Claude abertos ou dos créditos desses produtos. Esses agentes alteram o código; não hospedam o coletor. A IA local do coletor e a IA que programa são independentes.

## Próximas prioridades de produto

1. Console de chamados por CFTV, SDAI, SCA, PABX, MEDICAO, BMS e ZABBIX, busca e acesso direto ao histórico.
2. Atualizações, fontes, perguntas/respostas e pendências de cada chamado; distinguir informação completa de serviço concluído. Classificação sugerida conservadora e revisão humana.
3. Fluxo de fechamento mensal: conciliar fontes, confirmar pendências, redigir itens variados e objetivos, revisar e gerar relatório. Não inventar datas nem conclusões.
4. Documentação interativa e explorador técnico somente como apoio; não ampliar infraestrutura enquanto o fluxo de chamados estiver pendente.

## Concluído nesta etapa

Código completo sanitizado publicado em https://github.com/leodah20/whatsapp-report-assistant (main), usando a instalação atual como worktree canônico. README de instalação, AGENTS/HANDOFF compartilhados e abertura opcional no OpenCode com seleção explícita do modelo Free. Nenhum dado operacional publicado. Não há troca do modelo local do coletor.

Validação: 60 testes sintéticos aprovados na instalação e também em clone limpo baixado do GitHub; npm ci --ignore-scripts concluiu nesse clone. Doctor confirmou Node, Python, navegador e modelo local. OpenCode 1.19.5 instalado; catálogo confirmou o modelo Free. Não houve inferência de programação nem acesso ao arquivo privado por esse provedor. Não foi validada uma instalação Python limpa ponta a ponta.

Em 11/11/2026, a central local por frente de serviço e a supervisão Windows entraram em operação. A recuperação de um perfil de navegador travado foi verificada com o vínculo existente. A central oferece histórico, fontes, atualizações locais, pendências e base TXT. O gerador mensal e o explorador técnico continuam pendentes.

## Limites

Ainda sem interpretação de fotos/áudios e sem gerador completo de relatório final. Histórico depende do WhatsApp; envio exatamente uma vez não é garantido em falha externa. CPU pode demorar minutos. Armazenamento de credenciais Linux/macOS não implementado. Clientes OpenCode/Claude e provedores alternativos não foram testados ponta a ponta. Ofertas Free podem expirar; API direta da DeepSeek é paga.
