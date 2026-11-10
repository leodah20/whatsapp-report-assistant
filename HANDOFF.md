# Continuidade do projeto

Leia AGENTS.md, PROJECT_STATE.md e README.md. Confira git status, git log -5 e git remote -v. Continue na mesma pasta, ramo e origin. Codex é o ambiente principal; outra ferramenta é alternativa temporária, sem duplicar o projeto.

## Procedimento

1. Rode npm run doctor (sem ler segredos/conectar WhatsApp) e npm test.
2. Preserve edições existentes e configurações privadas. Nunca altere chave/sessão ao trocar de agente.
3. Continue a primeira prioridade pendente de PROJECT_STATE.md: chamados e fechamento mensal antes de infraestrutura acessória.
4. Antes de publicar, git diff --check, revisão de git diff --cached e git ls-files. Sem estado operacional, identificadores ou credenciais.
5. Registre aqui o que passou, o que falta e a próxima etapa; commit/push apenas do código/documentação sanitizados.

## Último ponto

Fonte completa publicada em https://github.com/leodah20/whatsapp-report-assistant, main, checkpoint inicial 1cc42f5. A instalação existente é o worktree canônico, não uma cópia só de documentação. Git ignora configurações, banco, sessão, modelos e logs; revise isso antes de cada publicação.

Passaram 60 testes sintéticos tanto na instalação quanto em clone limpo do GitHub. npm ci --ignore-scripts passou no clone; doctor passou na instalação. Os scripts PowerShell de início/reinício passaram na verificação de sintaxe. OpenCode 1.19.5 reconhece opencode/deepseek-v4.1-flash-free; a oferta é temporária, confira antes do uso. Não foi executado um agente remoto com dados operacionais nem testada instalação Python limpa.

Não reiniciamos produção para publicar código/documentação. Arquivo alterado não significa versão já carregada pelo processo. O próximo início deve preservar as configurações privadas existentes. Próxima implementação: console de chamados por frente de serviço, histórico e pendências; depois fechamento mensal. Não gastar a próxima etapa ampliando infraestrutura acessória.

## Pedido para retomar

“Leia os arquivos de continuidade, confira Git e continue a próxima prioridade de chamados. Use esta pasta e o origin existente. Preserve dados privados, rode testes e atualize HANDOFF.md. Pergunte antes de acessar o arquivo privado com um modelo remoto ou ampliar os envios automáticos.”
