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

Menus laterais contextuais testados com cliques em Chrome a 1366 e 390 px: alternância do Histórico, filas e modos do Fechamento e atalhos da Configuração. Os 88 testes sintéticos passaram; as quatro rotas locais serviram a interface atualizada sem reiniciar o coletor. Nenhuma mudança no armazenamento, nos envios ou na minuta. Próximo passo: acompanhar o fechamento real.

O cartão de mensagens automáticas usa a mesma consulta de estado da configuração e distingue fila, totais e avisos. Validação: 88 testes sintéticos e teste de interface em Chrome a 1366 e 390 px, com transição simulada de envios autorizados para pausados. A página local serviu o novo cartão sem reinício. Não houve teste de envio real; a próxima prioridade continua sendo acompanhar o fechamento real.

A janela de união reaproveita o catálogo de chamados ativos do Histórico e não exige copiar código. Validação: 88 testes sintéticos e Chrome a 1366 e 390 px, com seleção de outra competência e cancelamento ou confirmação simulados. A interface atualizada foi servida sem reinício; nenhuma união real foi executada. Próxima prioridade: acompanhar o fechamento real.

A janela de união permite escolher o principal sem reabrir o outro chamado. O painel usa a versão do principal escolhido, confirma a direção e abre seu histórico. A operação no servidor é a mesma. Validação: 88 testes sintéticos, cliques nos dois sentidos em Chrome a 1366 e 390 px e atualização servida sem reinício.

Resumo e extração distinguem procedimento ou resultado anteriores de atualizações vinculadas que sustentam etapa posterior. Passaram 89 testes sintéticos e Chrome a 1366 e 390 px. O coletor carregou a regra após reinício e o painel local retornou a atualização recente e os campos anteriores sem alteração manual dos registros. Próxima prioridade: acompanhar o fechamento real.

Explorador da API testado com 89 testes automatizados e navegação a 1366 e 390 px com dados fictícios. O coletor continua restrito a 127.0.0.1. Antes de disponibilizar o painel em rede, confirmar destino e usuários, exigir autenticação, manter a configuração do WhatsApp fora da superfície remota e testar leitura e edição no celular.

A demo independente passou em navegador a 1366, 390 e 320 px. Os 90 testes automatizados incluem rejeição de gravação, configuração do coletor e arquivos operacionais na demo. Publicação privada deve apontar só para o processo da demonstração, após verificar acesso dos destinatários; não publicar o coletor.

A ponte do painel real passou nos 91 testes automatizados, incluindo bloqueio de conta não autorizada, transporte sem HTTPS, escrita de outra origem e rotas administrativas. A preparação não altera a demo nem o coletor. Antes da publicação real, habilitar HTTPS na rede aprovada, verificar o encaminhamento e validar o acesso e a edição a partir do celular.

Após a aprovação no Tailscale, a instalação passou a usar uma porta HTTPS dedicada, pois a 443 do Windows já estava ocupada. Validados certificado, sessão segura, leitura da fila real, rejeição de acesso sem identidade e bloqueio das rotas administrativas. Não houve gravação em chamado real. A demo mantém o endereço próprio. A ponte em execução depende do note ligado; não foi instalado início automático para ela.

O proprietário abriu o painel real no Android pelo Tailscale. Para aceitar sugestões sem Tab, use o botão por campo na aba Contexto. A ação preenche sem enviar o formulário. Validado com teste de proteção de texto divergente e navegação sintética por teclado e toque.

A ponte privada passou a servir as quatro abas e as rotas de triagem, revisão, mídia e TXT/ZIP. Passaram 92 testes automatizados, navegação sintética em duas larguras e verificação HTTPS das abas, do acesso autenticado e do bloqueio administrativo na instalação. Nenhuma gravação ou extração de dados operacionais foi feita nos testes da instalação. O endereço externo e a demo permanecem separados; a troca da ponte não reiniciou o coletor.

**Mapa de arquitetura:** Chamados e Configuração apontam para `/api-explorer#arquitetura`. As camadas e os percursos são conteúdo versionado, sem consultar dados até o operador acionar o explorador. O painel privado já serve essa rota e os dois assets por HTTPS, sem nova porta, alteração de permissões ou reinício. Os 92 testes e o smoke test com dados sintéticos em 1366 e 390 px passaram. Veja [ARQUITETURA.md](ARQUITETURA.md). Quando mudar uma rota ou fronteira de acesso, atualize mapa e documentação juntos.

**Conclusão automática no contexto:** o painel calcula os campos efetivos a partir das fontes já vinculadas ou das notas locais. Texto técnico posterior substitui a exibição anterior sem regravar o perfil; exportação mantém procedência e separa contexto anterior. Não altera automação do WhatsApp nem gera conclusão técnica a partir de um simples status. Validados 94 testes sintéticos e navegação em 1366 e 390 px. O serviço foi recarregado e a verificação de leitura confirmou a atualização dos dois campos e a reconexão, sem editar o chamado. Manter revisão humana no fechamento mensal.

**Runavolt 01:** o visual da operação usa ativos de marca locais; a arquitetura visual saiu do Explorador da API e está em HTML separado, sem acesso ao coletor. Guia de produto e implantação em [RUNAVOLT.md](RUNAVOLT.md). Passaram fluxos completos em 390/1366 px e verificações de largura em 320/768/1920 px. Painel privado e ativos responderam por HTTPS; o coletor reconectou após o recarregamento.

**E-mail de suporte:** conector de leitura ativado na instalação autorizada com recorte inicial aprovado; duas fontes foram arquivadas num único ticket na primeira consulta. O estado e o número de fontes foram confirmados sem imprimir conteúdo. Passaram 96 testes sintéticos, incluindo deduplicação com troca de UIDVALIDITY, isolamento do arquivo WhatsApp e ausência de disparo automático. Consulte [EMAIL-DE-SUPORTE.md](EMAIL-DE-SUPORTE.md); mantenha a configuração fora do Git.

**Marca na Central:** reforçada a assinatura Runavolt em Chamados, com monograma vetorial atualizado e uma única assinatura visível conforme a largura. Passaram 96 testes e a verificação em Chrome de 320 a 1920 px; a instalação local respondeu com HTML, CSS e SVG atualizados sem reinício. Nenhuma mudança em dados ou fluxos operacionais. Próximo passo de produto: acompanhar o fechamento mensal real.
