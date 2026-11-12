# 7. Scripts, ferramentas, operação e testes

[Índice](README.md) · [Próximo: laboratório](08-laboratorio-e-glossario.md)

## 7.1 Scripts npm: atalhos, não linguagens novas

O [package.json](../package.json) contém comandos nomeados que o npm executa. Consulte [COMANDOS.md](../COMANDOS.md) antes de usar os comandos operacionais.

| Script | Expansão atual | O que faz |
| --- | --- | --- |
| `start` | `node src/app.mjs` | Inicia aplicação; abre recursos da instalação |
| `resume` | `node src/app.mjs --retry-authorized-link --enable-recovery` | Retoma vínculo autorizado e habilita recuperação |
| `doctor` | `node scripts/doctor.mjs` | Confere runtime, dependências, navegador e modelo local |
| `test` | `node --test tests/*.test.mjs` | Executa a suíte automatizada |

O início da aplicação tem efeitos: consulta chave, abre banco e escreve estado. Não use `npm start` como simples teste de sintaxe. `doctor` não abre fontes ou chave, mas importa a configuração local e faz uma consulta ao catálogo do Ollama.

## 7.2 Dependências diretas e transitivas

As dependências diretas declaradas incluem `whatsapp-web.js` e `qrcode`. Puppeteer entra pela árvore de dependências e tem versão controlada em `overrides`. Node fornece módulos nativos como HTTP, criptografia e SQLite.

- `package.json` descreve a intenção, scripts e restrições.
- `package-lock.json` registra a resolução de dependências para instalação reproduzível.
- `node_modules` é o material instalado, não o código-fonte autoral a estudar primeiro.
- `requirements.txt` descreve dependências Python.
- Instalações podem executar scripts de pacotes; a etapa de instalar não é uma operação puramente declarativa.

Comece pelo código de `src/`. Só investigue uma dependência quando precisar entender o contrato usado pelo aplicativo.

## 7.3 Inicialização Windows

```text
start.ps1
  → carrega runtime.ps1
  → resolve esta instalação
  → inicia watchdog.ps1
      → mutex por instalação
      → consulta processo, heartbeat e transporte
      → aplica watchdog-policy.ps1
      → inicia/recupera coletor quando cabível
  → abre a Central, salvo opção Background
```

| Arquivo | Papel | Conceito para estudar |
| --- | --- | --- |
| [start.ps1](../scripts/windows/start.ps1) | Aciona supervisão e opcionalmente navegador | Parâmetros e criação de processo |
| [runtime.ps1](../scripts/windows/runtime.ps1) | Resolve configuração e identifica processos desta instalação | Caminhos, identidade e ciclo de vida |
| [watchdog.ps1](../scripts/windows/watchdog.ps1) | Laço de supervisão e tentativas com intervalo crescente | Heartbeat, mutex e backoff |
| [watchdog-policy.ps1](../scripts/windows/watchdog-policy.ps1) | Decide como reagir ao estado observado | Política separada da execução |
| [restart.ps1](../scripts/windows/restart.ps1) | Reinicia o coletor identificado | Recuperação preservando sessão |
| [opencode.ps1](../scripts/windows/opencode.ps1) | Abre o ambiente de programação com modelo específico | Validação de catálogo e execução de CLI |

`runtime.ps1` identifica o Node pelo executável/caminho e o navegador pelo perfil específico. Isso evita tratar todo Chrome ou Node do computador como se pertencesse ao coletor. O supervisor usa mutex para impedir dois supervisores equivalentes concorrendo.

Heartbeat recente só indica que algum código escreveu estado. O projeto também observa a verificação real do transporte. Um processo pode estar vivo e desconectado.

Pausa e necessidade de novo vínculo são estados respeitados, não falhas a resolver apagando perfil. A supervisão roda na sessão do usuário conectado ao Windows; não promete funcionamento com PC desligado, suspenso ou antes do login.

## 7.4 Outras ferramentas do projeto

| Arquivo | Uso | Particularidade |
| --- | --- | --- |
| [doctor.mjs](../scripts/doctor.mjs) | Pré-requisitos | Retorna falha se houver pendência |
| [ui-smoke.mjs](../scripts/ui-smoke.mjs) | Exercita telas em navegador com fontes sintéticas | Requer navegador e cria ambiente de teste |
| [probe.py](../scripts/probe.py) | Verifica contrato HTTP e protocolo MCP | Consulta servidor local; requer autorização operacional |

O probe não vincula WhatsApp nem busca mensagens, mas consulta estado operacional e inicia o processo MCP de leitura. Não é a mesma coisa que uma suíte isolada sem consultar a instalação.

Arquivos locais fora da lista versionada podem ser pontes de compatibilidade ou material privado. Eles não devem ser assumidos como pontos de entrada canônicos. Para instalações novas, siga os caminhos de `scripts/windows/` e `integrations/mcp/` documentados.

## 7.5 Testes como documentação executável

Um teste estabelece uma condição inicial, executa um comportamento e verifica uma propriedade. A suíte usa `node:test` e `node:assert/strict`.

| Arquivo(s) em `tests/` | Tema |
| --- | --- |
| `core.test.mjs` | Cifra, integridade, escopo e competência no fuso local |
| `assistant.test.mjs` | Extração validada, respostas, perguntas e confirmações |
| `recovery.test.mjs` | Recuperação persistente e retomada |
| `transport.test.mjs`, `compat.test.mjs` | Conexão e compatibilidade de IDs |
| `cases.test.mjs`, `case-workflow.test.mjs` | Painel, regras de domínio e operações HTTP |
| `history-cases.test.mjs`, `media-context.test.mjs` | Histórico, vínculo e contexto próximo de mídia |
| `stage.test.mjs` | Etapas e evidências operacionais |
| `context-shortcut.test.mjs` | Aceite de sugestão por teclado |

Em `core.test.mjs`, veja três propriedades distintas: decifrar o que foi cifrado, rejeitar AAD diferente e rejeitar alteração da cifra. O primeiro teste sozinho não demonstraria proteção contra adulteração.

Mocks/fakes permitem fornecer outra função de análise ou relógio. Assim, um teste do domínio não precisa chamar IA real nem WhatsApp. Testes automatizados dão evidência sobre os cenários exercitados; não comprovam cobertura completa do histórico externo nem substituem o fechamento real.

## 7.6 Git e qualidade da mudança

Git versiona código e documentação; não instala dependências, transfere créditos ou carrega a memória completa de uma conversa. A pasta de trabalho pode conter alterações ainda não commitadas. Verifique o estado antes de editar para preservar trabalho existente.

Uma mudança bem delimitada tem objetivo claro, impacto conhecido, verificação proporcional e documentação correspondente. `git diff --check` detecta problemas de whitespace no diff; não é um teste funcional nem um detector completo de segredos.

**Exercício:** escolha um teste, descreva em português a propriedade protegida e identifique qual defeito faria o teste falhar. Evite apenas reescrever a mesma implementação dentro da expectativa.
