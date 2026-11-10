# Continuidade do projeto

Leia AGENTS.md, PROJECT_STATE.md e README.md. Confira git status, git log -5 e git remote -v. Continue na mesma pasta, ramo e origin. Codex é o ambiente principal; outra ferramenta é alternativa temporária, sem duplicar o projeto.

## Procedimento

1. Rode npm run doctor (sem ler segredos/conectar WhatsApp) e npm test.
2. Preserve edições existentes e configurações privadas. Nunca altere chave/sessão ao trocar de agente.
3. Continue a primeira prioridade pendente de PROJECT_STATE.md: chamados e fechamento mensal antes de infraestrutura acessória.
4. Antes de publicar, git diff --check, revisão de git diff --cached e git ls-files. Sem estado operacional, identificadores ou credenciais.
5. Registre aqui o que passou, o que falta e a próxima etapa; commit/push apenas do código/documentação sanitizados.

## Último ponto

Publicação completa e portabilidade em preparação. Baseline anterior: 60 testes sintéticos. Reexecute após alterações; arquivo alterado não significa versão já carregada pelo processo em produção. Reinício deve preservar configurações e ser deliberado. Os painéis novos e a geração mensal continuam pendentes.

## Pedido para retomar

“Leia os arquivos de continuidade, confira Git e continue a próxima prioridade de chamados. Use esta pasta e o origin existente. Preserve dados privados, rode testes e atualize HANDOFF.md. Pergunte antes de acessar o arquivo privado com um modelo remoto ou ampliar os envios automáticos.”
