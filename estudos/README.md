# Estudos — por dentro do assistente de chamados

Uma documentação didática para aprender programação usando este projeto real: entender o problema de negócio, localizar responsabilidades, seguir dados entre processos, ler requests de API e relacionar decisões do código aos fundamentos das linguagens.

**Base:** código versionado consultado em 11/11/2026. Exemplos fictícios. Os capítulos descrevem a implementação atual; propostas de exercícios não são funcionalidades entregues. Configurações efetivas da instalação podem diferir dos padrões documentados.

## Trilha de leitura

| Ordem | Capítulo | O que você aprende |
| --- | --- | --- |
| 1 | [Negócio e arquitetura](01-negocio-e-arquitetura.md) | O que o sistema resolve, camadas, processos e mapa dos arquivos |
| 2 | [Linguagens e princípios](02-linguagens-e-principios.md) | JavaScript, Python, PowerShell, HTML, CSS, SQL e decisões de construção |
| 3 | [Fluxo dos dados e persistência](03-fluxo-de-dados.md) | Da mensagem à revisão, tabelas, transações, filas e datas |
| 4 | [HTTP, APIs e redes](04-http-apis-e-redes.md) | Requests, responses, portas, cookies, catálogo de rotas e DevTools |
| 5 | [Interface e experiência](05-interface-e-experiencia.md) | DOM, eventos, estado, chamadas assíncronas e revisão mensal |
| 6 | [IA, MCP e custos](06-ia-mcp-e-custos.md) | Extração literal, sugestões, ferramentas de leitura e cobrança por API |
| 7 | [Scripts, ferramentas e testes](07-scripts-ferramentas-e-testes.md) | Inicialização, supervisão, dependências, Git e verificações |
| 8 | [Laboratório e glossário](08-laboratorio-e-glossario.md) | Exercícios progressivos, respostas orientativas e vocabulário |

### Como estudar cada capítulo

1. Leia a explicação e abra os links para o código.
2. Escolha uma função. Anote **entrada → validação → transformação → efeito → saída**.
3. Procure o teste correspondente e explique qual comportamento ele protege.
4. Desenhe o caminho de uma informação fictícia sem consultar dados de produção.
5. Registre dúvidas com o nome do arquivo e do símbolo, por exemplo: `CaseBoard.change` em `src/cases/board.mjs`.

O Markdown pode ser lido no GitHub ou na prévia do editor. Diagramas Mermaid têm também explicação textual; não é necessário executar o coletor para acompanhar a trilha.

## Roteiro sugerido em quatro semanas

- **Semana 1:** capítulos 1 e 2; reconhecer arquivos e explicar `inScope`, `recordOf` e `monthOf`.
- **Semana 2:** capítulos 3 e 4; desenhar um request e o armazenamento de uma fonte.
- **Semana 3:** capítulos 5 e 6; seguir uma atualização da tela ao banco e distinguir extração de aprovação.
- **Semana 4:** capítulos 7 e 8; compreender testes, simular conflitos no papel e propor uma pequena melhoria com critérios de aceite.

Não precisa decorar sintaxe. A meta é conseguir explicar **por que** cada etapa existe e **onde** alterar um comportamento.

## Documentos que se complementam

- [README do produto](../README.md): instalação, uso e limites.
- [COMANDOS.md](../COMANDOS.md): referência operacional de comandos e cuidados.
- [Plano estratégico](../docs/PLANO-ESTRATEGICO.md): prioridades e critérios de entrega.
- [Estado](../docs/PROJECT_STATE.md) e [continuidade](../docs/HANDOFF.md): implementação e validações registradas.
- [Orientações do repositório](../AGENTS.md): limites de acesso e trabalho.

Esta pasta explica o código público. Conversas, imagens, configurações, sessão, chaves e modelos privados não são material de estudo compartilhável. O padrão de relatório de um cliente continua no contexto privado daquele projeto.
