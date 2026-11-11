# Continuidade do projeto

Leia AGENTS.md, PLANO-ESTRATEGICO.md, PROJECT_STATE.md e README.md. Confira git status, git log -5 e git remote -v. Continue na mesma pasta, ramo e origin. Codex é o ambiente principal; outra ferramenta é alternativa temporária, sem duplicar o projeto.

## Procedimento

1. Rode npm run doctor (sem ler segredos/conectar WhatsApp) e npm test.
2. Preserve edições existentes e configurações privadas. Nunca altere chave/sessão ao trocar de agente.
3. Continue a primeira prioridade pendente de PROJECT_STATE.md: chamados e fechamento mensal antes de infraestrutura acessória.
4. Antes de publicar, git diff --check, revisão de git diff --cached e git ls-files. Sem estado operacional, identificadores ou credenciais.
5. Registre aqui o que passou, o que falta e a próxima etapa; commit/push apenas do código/documentação sanitizados.
6. Registre em [COMANDOS.md](../COMANDOS.md) cada comando do projeto pedido pelo usuário. As entradas iniciais foram conferidas contra os scripts, o pacote e o README; não foi necessário iniciar o coletor para validar o glossário.

## Último ponto

Fonte completa publicada em https://github.com/leodah20/whatsapp-report-assistant, main, checkpoint inicial 1cc42f5. A instalação existente é o worktree canônico, não uma cópia só de documentação. Git ignora configurações, banco, sessão, modelos e logs; revise isso antes de cada publicação.

Passaram 60 testes sintéticos tanto na instalação quanto em clone limpo do GitHub. npm ci --ignore-scripts passou no clone; doctor passou na instalação. Os scripts PowerShell de início/reinício passaram na verificação de sintaxe. OpenCode 1.19.5 reconhece opencode/deepseek-v4.1-flash-free; a oferta é temporária, confira antes do uso. Não foi executado um agente remoto com dados operacionais nem testada instalação Python limpa.

Em 11/11/2026, a organização passou a src/, web/, integrations/, scripts/, tests/ e docs/. Na instalação migrada, pontes locais ignoradas pelo Git preservam o atalho de inicialização e o registro MCP antigos. Instalações novas usam scripts/windows/start.ps1 e integrations/mcp/server.py. Não recrie chave, sessão ou perfil.

O supervisor recuperou uma instância travada; a central /chamados foi conferida no navegador e os testes HTTP exercitaram gravação em banco sintético. Cada novo chamado envia só confirmação ou pergunta; respostas vinculadas mantêm sua confirmação. Próxima entrega: conciliar o mês e preparar minuta revisável, sem tratar a exportação TXT como relatório final.

## Pedido para retomar

As três ferramentas podem ser abertas diretamente pelas abas no topo da Central, inclusive com o WhatsApp desconectado. A navegação e a preservação da competência em Histórico e Fechamento foram testadas com cliques reais em Chrome a 1366 e 390 px, usando dados sintéticos; 84 testes unitários e de integração passaram.

Fechamento: /fechamento revisa inclusões, exclusões e perguntas, guarda decisões criptografadas e exige nova revisão após mudanças nas fontes. /minuta gera a versão imprimível, sem editar arquivos finais. /historico lista fontes não vinculadas, permite atribuição manual e prepara rascunhos silenciosos por IA local. Arquivar é reversível e não apaga evidências. Verificar cobertura mês a mês; importação do WhatsApp não garante histórico completo.

No fechamento, confirme fontes e anexos de cada chamado sem precisar redigir o item. Prepare a extração em TXT ou ZIP (contexto e arquivos escolhidos). O link privado de ChatGPT/Claude é uma preferência do navegador; copiar, baixar e abrir o destino não enviam nada. A sugestão local via Ollama não salva a revisão. Para imprimir, aprove o texto, datas e fotos na revisão final. Testados 87 casos automatizados, prévia e extração em Chrome a 1366 e 390 px e consulta ao Ollama instalado com dados sintéticos.

As decisões de impressão e a emissão ficam ocultas no fluxo padrão de extração. **Fechar PDF pelo painel** abre esses controles, sem selecionar uma decisão por padrão. As preventivas permanecem acessíveis para a extração; o salvamento dos status é independente da emissão.

**Exportar para outra IA** é o rótulo neutro do destino padrão, sem integração com uma conversa aberta. O teste de interface confirma o rótulo e a ausência de um link de conversa nesse modo.

A fila de revisão abre em **A revisar**. Confirmar abre o próximo pendente; terminar a fila exibe o botão de extração no próprio detalhe. A revisão manual de um item já conferido permanece no detalhe. Mudanças nas fontes devolvem o item à fila ao atualizar o fechamento. Testados 88 casos automatizados e, no Chrome a 1366 e 390 px, avanço pela fila, extração no detalhe e salvamento das preventivas sem emissão.

No Histórico, abrir imagem/vídeo/áudio não seleciona nem vincula a mensagem. A prévia é local, sob demanda, e só serve fontes elegíveis para o mês; arquivos de outros tipos são entregues como download. Vincular usa o menu de chamados não arquivados, e criar novo exige ação distinta. Ignorar tira a fonte da fila e da análise, sem apagá-la; a opção Ver mensagens ignoradas permite restaurar. Validação: 85 testes, incluindo HTTP com banco sintético, e navegação em Chrome a 1366 e 390 px.

O histórico sugere o texto posterior à mídia sem legenda em até três minutos, com prioridade para resposta citada. A proximidade não confirma vínculo nem abre chamado. Na central, data do atendimento e local só são confirmados manualmente; o registro continua datado e há ordenação por data, nome ou andamento. A etapa usa evidência operacional explícita, distingue origem manual/automática e não cria conclusão a partir de hipótese, encaminhamento ou reparo parcial.

Na aba Contexto, Tab aceita o trecho sugerido e deixa o navegador avançar o foco. Shift+Tab e texto divergente não são afetados; a alteração só é persistida ao salvar. Em Evidências ficam anexos e vínculo de fontes históricas; Mais ações reúne edição, conclusão manual, união e arquivo. Contexto permite definir etapa e motivo e, na remarcação, informar nova data sem usá-la como data do atendimento.

O resumo do mês conta cada chamado uma vez por etapa e filtra a fila. A dependência documentada aparece no Resumo; tarefas extras permanecem opcionais. Em novos chamados, dúvida de etapa entra na mesma pergunta já autorizada, sem disparo retroativo pela atualização. Testes: 84 sintéticos e fluxo de interface em 1366 e 390 px, incluindo soma, filtro, bloqueio e controles de remarcação.

Após a revisão visual, passaram `npm test` (78 testes) e `node scripts/ui-smoke.mjs` (desktop e celular, cinco telas com fontes sintéticas). O coletor ativo serviu as rotas locais sem reiniciar. Não houve acesso ao WhatsApp para teste, alterações em registros ou mudanças no formato de impressão. Próximo passo: acompanhar um fechamento real, especialmente cobertura, preventivas e revisão da minuta.

“Leia os arquivos de continuidade, confira Git e continue a próxima prioridade de chamados. Use esta pasta e o origin existente. Preserve dados privados, rode testes e atualize HANDOFF.md. Pergunte antes de acessar o arquivo privado com um modelo remoto ou ampliar os envios automáticos.”

O alerta de registros sem chamado foi validado com 88 testes e em Chrome a 1366 e 390 px. A bolinha some quando a competência não tem pendências; a extração avisa se fontes avulsas ficaram de fora.
