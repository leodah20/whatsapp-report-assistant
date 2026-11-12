# 8. Laboratório guiado e glossário

[Índice](README.md)

## 8.1 Método para explorar qualquer função

Preencha uma ficha:

```text
Arquivo e símbolo:
Objetivo no negócio:
Entradas e tipos esperados:
Quem chama:
Validações e limites:
Dados consultados:
Transformações:
Efeitos (banco, rede, arquivo, envio):
Saída:
Como falha:
Teste que cobre o comportamento:
```

Essa ficha é mais útil que tentar decorar todas as linhas. Depois conecte a saída de uma função à entrada da seguinte.

## 8.2 Exercícios progressivos

### A. Escopo — primeiro contato

Leia `groupOf` e `inScope` em [core.mjs](../src/core.mjs). Use apenas estes valores sintéticos:

| Mensagem | Grupo fixado | Pausado | Deve capturar? |
| --- | --- | --- | --- |
| `from: estudo@g.us` | `estudo@g.us` | Não | ? |
| `from: outro@g.us` | `estudo@g.us` | Não | ? |
| `fromMe: true, to: estudo@g.us` | `estudo@g.us` | Não | ? |
| `from: estudo@g.us` | `estudo@g.us` | Sim | ? |
| `from: estudo@g.us` | Nenhum | Não | ? |

**Resposta:** sim, não, sim, não, não, considerando os demais campos válidos e ausência de status. Explique por que mensagens próprias usam `to`.

### B. Datas — diferença entre instante e calendário

Leia `monthOf` e seu teste. Às `2026-11-01T01:00:00Z`, qual competência corresponde ao fuso de São Paulo usado no código?

**Resposta:** outubro. UTC e calendário local atravessam a fronteira do mês em horários diferentes. Isso ainda não determina a data real de um atendimento mencionado no texto.

### C. Request — rastreio vertical

Desenhe a consulta de uma competência com estas caixas: `web/cases.js`, `createCaseHandler`, `CaseBoard.list`, SQLite e renderização. Marque em que ponto cada responsabilidade acontece:

- conferir cookie;
- validar o mês;
- calcular resumos;
- filtrar visualmente por frente;
- serializar JSON.

**Orientação:** cookie e resposta JSON ficam no handler; mês e resumo no domínio; filtro visual em `renderList`. O banco devolve dados, não elementos HTML.

### D. Conflito — duas janelas

Ambas leem `version: 2`. A primeira salva uma nota. A segunda tenta salvar sem recarregar. Preveja o status e a ação esperada.

**Resposta:** conflito `409`; recarregar, conferir a alteração e decidir a nova edição. Não basta aumentar manualmente o número e reenviar sem revisar.

### E. IA — estrutura e evidência

Fonte fictícia: “Detector da bancada aguardando troca.” O modelo devolve `quote: "Detector substituído e normalizado"`. Siga `validateAnalysis`.

**Resposta:** o trecho não está na fonte e não deve virar fato aceito. Os campos correspondentes continuam faltando. Um JSON bem formado pode conter conteúdo sem sustentação.

### F. Recuperação — falha no meio

Um trabalho foi marcado `processing` quando o processo terminou. O que acontece na próxima inicialização de `RecoveryQueue`? Por que um ID único importa?

**Resposta:** volta a `pending`. A mesma fonte pode ser reencontrada pela sobreposição da janela; a chave primária impede duplicar a entrada da fila. Isso não resolve sozinho uma entrega externa incerta.

### G. Fechamento — revisão invalidada

O usuário confirmou fontes; depois uma nova resposta foi vinculada ao chamado. Compare o cálculo de `stamp` com `sourceReviewState` em `MonthlyClosing`.

**Resposta:** a mudança relevante altera o resumo criptográfico e a revisão fica `stale`. É preciso conferir novamente; a aprovação anterior se referia a outro conjunto de informações.

### H. Arquitetura — pequena melhoria no papel

Proponha um rótulo mais claro para uma lacuna de contexto, usando uma fonte fictícia. Liste:

1. Critério de aceite visível ao usuário.
2. Arquivos que provavelmente mudariam.
3. Se muda só apresentação ou também contrato de API.
4. Qual verificação existente seria pertinente.

Não é preciso implementar para aprender. Se for implementar depois, mantenha a mudança isolada e use ambiente sintético; não inicie coleta real como experimento.

## 8.3 Roteiros de leitura por interesse

- **Quero entender JavaScript:** `core.mjs` → testes do core → `stage.mjs` → helper `api` e `renderList` da Central.
- **Quero entender backend/API:** servidor em `app.mjs` → `createCaseHandler` → `CaseBoard.change` → testes de chamados.
- **Quero entender banco:** instruções `CREATE TABLE` → `save` do assistente → transação de `change` → fechamento.
- **Quero entender redes:** mapa de processos → request da interface → `verifyTransport` → diferença entre stdio e HTTP.
- **Quero entender automação Windows:** `start.ps1` → política do watchdog → laço do watchdog → funções do runtime.
- **Quero entender IA:** `analyzeSources` → `validateAnalysis` → `suggestNarrative` → pacote de contexto → ferramentas MCP.

## 8.4 Glossário essencial

| Termo | Explicação |
| --- | --- |
| API | Contrato para um componente pedir operações ou dados a outro |
| Endpoint | Um ponto de acesso, frequentemente método + caminho HTTP |
| Request / response | Pedido e resposta numa interação |
| Header | Metadado de uma mensagem HTTP |
| Payload / body | Conteúdo transportado ou armazenado |
| JSON | Formato textual de objetos, listas e valores |
| Cookie | Dado que o navegador guarda e envia conforme regras de escopo |
| Origin | Combinação de protocolo, host e porta |
| Loopback | Rede da própria máquina |
| Porta | Identificador de serviço num endereço de rede |
| DNS | Resolução de nomes para endereços; um IP literal não precisa dessa resolução |
| TCP | Transporte com conexão e fluxo ordenado de bytes |
| TLS | Proteção criptográfica de transporte usada em HTTPS |
| DOM | Estrutura de elementos manipulada pelo navegador |
| Event loop | Mecanismo que agenda callbacks e trabalho assíncrono do runtime |
| Promise | Representação de resultado futuro ou falha |
| Debounce | Espera/agrupamento para evitar processar cada evento imediatamente |
| Timeout | Limite de tempo de espera |
| Retry / backoff | Nova tentativa / intervalo entre tentativas, frequentemente crescente |
| Heartbeat | Sinal periódico de atividade |
| Mutex | Mecanismo de exclusão mútua entre execuções |
| Idempotência | Repetir uma operação tem o mesmo efeito relevante que executá-la uma vez |
| Transação | Conjunto de alterações confirmado ou revertido em bloco |
| Índice | Estrutura que acelera certos padrões de consulta |
| WAL | Registro de alterações do SQLite separado do arquivo principal durante operação |
| Hash / fingerprint | Resumo usado para comparar conteúdo; não é criptografia reversível |
| AAD | Dado associado autenticado junto da cifra, sem precisar estar cifrado |
| Token de sessão | Valor aleatório usado para reconhecer uma sessão |
| Token de modelo | Unidade de representação textual usada pelo modelo e no cálculo de consumo |
| MCP | Protocolo de descoberta e chamada de ferramentas por clientes de IA |
| stdio | Entrada e saída padrão de um processo |
| Mock / fake | Substituto controlado de uma dependência durante teste |
| Regressão | Comportamento que deixa de funcionar após uma mudança |
| Worktree | Pasta de trabalho associada a um repositório Git |

## 8.5 Referências para aprofundar

- [JavaScript — MDN](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Guide)
- [HTTP — MDN](https://developer.mozilla.org/pt-BR/docs/Web/HTTP)
- [Node.js — documentação](https://nodejs.org/api/)
- [Python — tutorial](https://docs.python.org/pt-br/3/tutorial/)
- [PowerShell — documentação](https://learn.microsoft.com/pt-br/powershell/)
- [SQLite — transações](https://www.sqlite.org/lang_transaction.html)
- [SQLite — WAL](https://www.sqlite.org/wal.html)
- [Git — livro](https://git-scm.com/book/pt-br/v2)
- [Ollama — API](https://docs.ollama.com/api)
- [MCP — documentação](https://modelcontextprotocol.io/docs/getting-started/intro)
- [OWASP — segurança de aplicações](https://owasp.org/www-project-top-ten/)

Leia referências externas junto do contrato efetivamente usado no repositório: versões e capacidades das bibliotecas podem diferir de exemplos mais recentes.
