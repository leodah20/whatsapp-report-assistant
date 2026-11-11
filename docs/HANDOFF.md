# Continuidade do projeto

Leia AGENTS.md, PLANO-ESTRATEGICO.md, PROJECT_STATE.md e README.md. Confira git status, git log -5 e git remote -v. Continue na mesma pasta, ramo e origin. Codex é o ambiente principal; outra ferramenta é alternativa temporária, sem duplicar o projeto.

## Procedimento

1. Rode npm run doctor (sem ler segredos/conectar WhatsApp) e npm test.
2. Preserve edições existentes e configurações privadas. Nunca altere chave/sessão ao trocar de agente.
3. Continue a primeira prioridade pendente de PROJECT_STATE.md: chamados e fechamento mensal antes de infraestrutura acessória.
4. Antes de publicar, git diff --check, revisão de git diff --cached e git ls-files. Sem estado operacional, identificadores ou credenciais.
5. Registre aqui o que passou, o que falta e a próxima etapa; commit/push apenas do código/documentação sanitizados.

## Último ponto

Fonte completa publicada em https://github.com/leodah20/whatsapp-report-assistant, main, checkpoint inicial 1cc42f5. A instalação existente é o worktree canônico, não uma cópia só de documentação. Git ignora configurações, banco, sessão, modelos e logs; revise isso antes de cada publicação.

Passaram 60 testes sintéticos tanto na instalação quanto em clone limpo do GitHub. npm ci --ignore-scripts passou no clone; doctor passou na instalação. Os scripts PowerShell de início/reinício passaram na verificação de sintaxe. OpenCode 1.19.5 reconhece opencode/deepseek-v4.1-flash-free; a oferta é temporária, confira antes do uso. Não foi executado um agente remoto com dados operacionais nem testada instalação Python limpa.

Em 11/11/2026, a organização passou a src/, web/, integrations/, scripts/, tests/ e docs/. Na instalação migrada, pontes locais ignoradas pelo Git preservam o atalho de inicialização e o registro MCP antigos. Instalações novas usam scripts/windows/start.ps1 e integrations/mcp/server.py. Não recrie chave, sessão ou perfil.

O supervisor recuperou uma instância travada; a central /chamados foi conferida no navegador e os testes HTTP exercitaram gravação em banco sintético. Cada novo chamado envia só confirmação ou pergunta; respostas vinculadas mantêm sua confirmação. Próxima entrega: conciliar o mês e preparar minuta revisável, sem tratar a exportação TXT como relatório final.

## Pedido para retomar

Fechamento: /fechamento revisa inclusões, exclusões e perguntas, guarda decisões criptografadas e exige nova revisão após mudanças nas fontes. /minuta gera a versão imprimível, sem editar arquivos finais. /historico lista fontes não vinculadas, permite atribuição manual e prepara rascunhos silenciosos por IA local. Arquivar é reversível e não apaga evidências. Verificar cobertura mês a mês; importação do WhatsApp não garante histórico completo.

O histórico sugere o texto posterior à mídia sem legenda em até três minutos, com prioridade para resposta citada. A proximidade não confirma vínculo nem abre chamado. Na central, data do atendimento e local só são confirmados manualmente; o registro continua datado e há ordenação por data, nome ou andamento. A etapa usa evidência operacional explícita, distingue origem manual/automática e não cria conclusão a partir de hipótese, encaminhamento ou reparo parcial.

Na aba Contexto, Tab aceita o trecho sugerido e deixa o navegador avançar o foco. Shift+Tab e texto divergente não são afetados; a alteração só é persistida ao salvar. Em Evidências ficam anexos e vínculo de fontes históricas; Mais ações reúne edição, conclusão manual, união e arquivo. Contexto permite definir etapa e motivo e, na remarcação, informar nova data sem usá-la como data do atendimento.

O resumo do mês conta cada chamado uma vez por etapa e filtra a fila. A dependência documentada aparece no Resumo; tarefas extras permanecem opcionais. Em novos chamados, dúvida de etapa entra na mesma pergunta já autorizada, sem disparo retroativo pela atualização. Testes: 84 sintéticos e fluxo de interface em 1366 e 390 px, incluindo soma, filtro, bloqueio e controles de remarcação.

Após a revisão visual, passaram `npm test` (78 testes) e `node scripts/ui-smoke.mjs` (desktop e celular, cinco telas com fontes sintéticas). O coletor ativo serviu as rotas locais sem reiniciar. Não houve acesso ao WhatsApp para teste, alterações em registros ou mudanças no formato de impressão. Próximo passo: acompanhar um fechamento real, especialmente cobertura, preventivas e revisão da minuta.

“Leia os arquivos de continuidade, confira Git e continue a próxima prioridade de chamados. Use esta pasta e o origin existente. Preserve dados privados, rode testes e atualize HANDOFF.md. Pergunte antes de acessar o arquivo privado com um modelo remoto ou ampliar os envios automáticos.”
