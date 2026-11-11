# Plano estratégico — Assistente de chamados

**Objetivo:** acompanhar chamados durante o mês, preservar histórico, evidências, atualizações e pendências, e fechar um relatório revisado no padrão do responsável. O painel, a IA e o Git servem a esse fluxo.

**Última revisão:** 11/11/2026. Este documento é a ordem de execução compartilhada. [PROJECT_STATE.md](PROJECT_STATE.md) descreve o que existe; [HANDOFF.md](HANDOFF.md) registra a validação e o próximo passo concreto.

## Ordem de execução

### P0 — Coleta confiável, sem depender do chat

- [x] Arquivo local criptografado, fila de recuperação, deduplicação, perguntas e confirmações.
- [x] Corrigir a recuperação quando o navegador exclusivo do coletor permanece aberto e impede a reconexão.
- [x] Supervisionar o coletor ao entrar no Windows: verificar processo e conexão real, recuperar falhas persistentes com intervalo entre tentativas, manter a sessão.
- [x] Mostrar última conexão verificada, última sincronização e quando houver necessidade de ação manual.

**Pronto quando:** uma falha simulada de transporte/processo é detectada, não há duas instâncias concorrendo pelo perfil, a fila permanece íntegra e o coletor volta a consultar o grupo autorizado. Pausa manual e necessidade de novo vínculo são respeitadas. Não prometer funcionamento desligado, antes do login ou recuperação de histórico que o WhatsApp não disponibilize.

### P1 — Central de chamados

- [x] Concluir o painel local por **CFTV, SDAI, SCA, PABX, Medição, BMS e Zabbix**, com competência, busca e link direto por chamado.
- [x] Mostrar linha do tempo, fontes, fotos arquivadas, perguntas e respostas disponíveis.
- [x] Permitir corrigir a frente sugerida, registrar atualizações e acompanhar pendências sem sobrescrever fontes ou disparar WhatsApp.
- [x] Separar lacunas de informação, pendências operacionais e conclusão técnica confirmada.
- [x] Oferecer uma base de conferência do mês com datas de origem e distinção de chamados anteriores; não apresentar a base como relatório final.

**Pronto quando:** o responsável chega a um chamado sem ler a conversa inteira, registra e recupera uma atualização após recarregar, identifica o que falta e consegue consultar o período sem confundir data do registro com data do serviço. Testar com dados sintéticos e verificar a versão local.

### P2 — Fechamento e relatório mensal

- [ ] Conciliar fontes do mês e lacunas de cobertura; revisar a inclusão de cada atendimento e revalidar pendências anteriores.
- [ ] Pedir esclarecimento apenas para informação ausente/ambígua que altera o item, reaproveitando contexto confirmado.
- [ ] Montar a minuta no modelo aprovado do projeto e conferir narrativa, datas, equipamentos, resultados e fotos antes de exportar.
- [ ] Gerar versão para revisão humana. Não alterar nem substituir o arquivo final já entregue sem pedido expresso.

**Pronto quando:** a minuta mantém o formato aprovado, um item por atendimento distinto, texto profissional e variado, sem rótulos artificiais repetidos. Tabelas do modelo são preservadas conforme orientação do responsável. O resultado é rastreável às fontes ou confirmações, e não inventa datas, normalização ou causas.

### P3 — Continuidade e documentação de apoio

- [x] Código completo sanitizado no repositório público original do produto; README de instalação e orientação de continuidade.
- [x] Codex como ambiente principal; OpenCode/DeepSeek e Claude como alternativas opcionais no mesmo worktree e origin. O coletor local não depende dos créditos dessas ferramentas.
- [ ] Atualizar o diagrama/stepper e a documentação pública conforme entregas reais, sem trocar o foco por infraestrutura.

**Pronto quando:** outro ambiente consegue retomar com Git e os arquivos de continuidade, sem acessar chats antigos ou dados privados para entender a arquitetura. Não depender de oferta gratuita permanente nem conectar modelo remoto ao arquivo sem autorização.

## Regras de trabalho que não mudam

- Fonte original, atualização humana e sugestão automática são coisas diferentes. Um recebimento, uma foto ou um teste não encerram um chamado. Não tratar hipótese como causa confirmada.
- Registrar a data real. Se não for conhecida, marcar a lacuna; não distribuir chamados artificialmente no calendário.
- Ao redigir, seguir a referência aprovada daquele projeto, com linguagem adequada ao público. Orientações de clientes ficam no contexto privado, não no repositório público.
- Alterações do painel são locais, auditáveis e não ampliam permissões de envio. A coleta continua restrita ao grupo autorizado.
- Não versionar banco, sessão, chaves, QR, conversas, imagens, logs ou identificadores reais. Testes e documentação pública usam exemplos sintéticos.

## Como retomar em outro ambiente

1. Abra o mesmo repositório e confira o ramo, o origin e as alterações locais. Leia [AGENTS.md](../AGENTS.md), este plano, [PROJECT_STATE.md](PROJECT_STATE.md) e [HANDOFF.md].
2. Continue o primeiro item prioritário ainda aberto. Se houver incidente que impede a coleta, diagnostique antes de ampliar funcionalidades.
3. Antes do commit, rode os testes e revise o conteúdo publicado. Atualize este plano, o estado e o handoff quando um critério de aceite for realmente atendido.

**Ponto atual:** P0 e P1 disponíveis localmente. A recuperação de uma sessão travada foi observada sem novo vínculo. A próxima entrega é a conciliação e a revisão mensal (P2); ainda não há geração automática do relatório final.
