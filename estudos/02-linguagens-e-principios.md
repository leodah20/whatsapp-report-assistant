# 2. Linguagens e princípios de construção

[Índice](README.md) · [Próximo: fluxo dos dados](03-fluxo-de-dados.md)

## 2.1 Linguagem, runtime, biblioteca e protocolo

| Termo | Neste projeto |
| --- | --- |
| Linguagem | JavaScript, Python, PowerShell e SQL |
| Runtime | Node.js executa JavaScript fora do navegador; Python executa integrações |
| Biblioteca | `whatsapp-web.js`, `qrcode`, `cryptography` |
| Protocolo | HTTP entre navegador e Node; MCP no canal stdio |
| Persistência | SQLite guarda tabelas num arquivo |
| Marcação e estilo | HTML descreve a estrutura; CSS define apresentação |

JavaScript é a linguagem. Node não é outra linguagem. API não significa necessariamente internet: dois processos no mesmo computador também podem conversar por uma API.

## 2.2 JavaScript moderno lendo o código real

O [package.json](../package.json) declara `type: "module"`; os módulos do servidor usam `.mjs`, `import` e `export`. Não há etapa de compilação TypeScript ou bundler declarada nos scripts npm atuais.

### Variáveis, objetos e funções

```js
// Exemplo didático independente, com dados fictícios.
const fonte = { text: 'Equipamento em teste', hasMedia: false };
const texto = String(fonte.text || '').trim();
const temTexto = valor => valor.length > 0;
console.log(temTexto(texto)); // true
```

- `const` impede reatribuir a variável; não torna o objeto internamente imutável.
- `let` serve para uma referência que será reatribuída.
- Um objeto reúne propriedades; uma função recebe valores e devolve um resultado ou produz efeitos.
- `Object.freeze` em `CONFIG` impede alterações diretas nas propriedades do objeto congelado; é um congelamento superficial.

### Sintaxes que você vai encontrar

| Sintaxe | Leitura | Local para observar |
| --- | --- | --- |
| `const { Client } = pkg` | Desestrutura uma propriedade | `src/app.mjs` |
| `{ ...r, isClarification: true }` | Cria objeto com cópia superficial e campo adicional | `src/assistant/assistant.mjs` |
| `item.answerIds?.length` | Acesso opcional: não falha se `answerIds` for nulo/ausente | Assistente e painel |
| `valor ?? fallback` | Usa fallback somente para `null` ou `undefined` | Histórico e fechamento |
| `valor || fallback` | Usa fallback para qualquer valor falsy, inclusive `0` e `''` | Configuração e textos |
| `!!valor` | Converte para booleano | `inScope` |
| `a === b` | Igualdade estrita sem coerção de tipos | Validações |
| `array.map(fn)` | Transforma cada elemento | Construção de respostas |
| `array.filter(fn)` | Mantém elementos aceitos pelo predicado | Filas e filtros |
| `new Set(ids)` | Coleção de valores únicos | Fontes e vínculos |
| `new Map()` | Associação chave → valor | Sessões da Central |

### Tipagem dinâmica exige validação em execução

Um JSON recebido pode ser um objeto, um array, `null` ou dados inesperados. O programa confere tipo, tamanho, formato e campos permitidos. Leia `CaseBoard.change` e `validateAnalysis`: a ausência de TypeScript não elimina a necessidade de contratos.

`JSON.parse` converte texto em valores. Isso não prova que esses valores obedecem ao contrato esperado. `JSON.stringify` faz a conversão inversa e não criptografa nada.

## 2.3 Assíncrono: Promise, async e await

`fetch` devolve uma Promise: um resultado futuro. `await` suspende aquela função até o resultado chegar; não transforma toda a aplicação em execução paralela nem bloqueia necessariamente o event loop durante a espera de rede.

```js
// Esboço didático; não é uma chamada para executar em produção.
async function consultar(fetcher, caminho) {
  const resposta = await fetcher(caminho);
  if (!resposta.ok) throw new Error('Consulta falhou');
  return resposta.json();
}
```

No projeto:

- `enqueue` encadeia Promises para serializar captura de mensagens.
- `schedule` usa temporizador para agrupar entradas próximas antes da análise.
- `busy` impede sobreposição de uma operação específica.
- `try/catch/finally` trata falha e libera estados mesmo quando ocorre exceção.
- `void connect()` descarta o valor da Promise naquele ponto; a operação continua. Por isso a resposta HTTP pode chegar antes de o vínculo terminar.
- `AbortSignal.timeout` limita uma espera. Não é garantia de que todo processamento no outro lado deixou de ocorrer.

**Distinção importante:** uma fila de Promises em memória se perde ao encerrar o processo. A fila SQLite permite retomar trabalho após reinício.

## 2.4 Classes, composição e injeção de dependências

`ReportAssistant`, `CaseBoard`, `MonthlyClosing` e `RecoveryQueue` são classes: agrupam estado e operações relacionadas. `src/app.mjs` cria instâncias e fornece dependências por objetos de configuração.

Por exemplo, `RecoveryQueue` recebe `deliver` e `now`. A classe não precisa saber como uma entrega é implementada, e um teste pode fornecer um relógio controlado. `ReportAssistant` aceita outra função `analyze`; testes podem simular IA sem chamar o modelo real.

Esse padrão se chama **injeção de dependências**. Ele torna comportamento testável e reduz dependência direta de rede, tempo e serviços externos.

## 2.5 Python e interoperabilidade

Em [server.py](../integrations/mcp/server.py), `def` declara funções, indentação define blocos e `@mcp.tool(...)` registra uma função como ferramenta. Anotações como `month: str` ajudam a descrever o contrato; as validações continuam necessárias.

`with connection() as db` organiza o contexto de uso da conexão. Consultas usam parâmetros. `bytes`, Base64 e JSON permitem trocar conteúdo entre Python e Node, mas representam coisas diferentes:

- **bytes:** sequência binária;
- **Base64:** codificação de bytes como texto;
- **JSON:** representação textual de estruturas;
- **criptografia:** proteção que depende de chave.

Node chama `vault.py` via `execFileSync` com argumentos separados. O processo Python consulta a credencial específica. Isso é interoperabilidade entre processos; não é uma chamada de função dentro do mesmo runtime. Nunca execute esse script manualmente para “ver o resultado”: sua saída contém a chave.

## 2.6 PowerShell, HTML, CSS e SQL

- **PowerShell:** `$variavel`, `param`, funções e pipelines de objetos automatizam o Windows. O dot sourcing (`. arquivo.ps1`) carrega funções no escopo atual. Leia `start.ps1` e `runtime.ps1`.
- **HTML:** define botões, campos, seções e a estrutura das cinco telas. Veja `web/cases.html`.
- **CSS:** controla layout, responsividade e impressão. `web/draft.css` separa apresentação da minuta, inclusive impressão.
- **SQL:** descreve consultas e alterações em tabelas. `SELECT` lê; `INSERT` cria; `UPDATE` modifica; uma transação agrupa mudanças.

## 2.7 Princípios observáveis

| Princípio | Exemplo concreto | Benefício |
| --- | --- | --- |
| Responsabilidade delimitada | `core.mjs` concentra pequenas operações comuns | Leitura e testes mais simples |
| Validar na fronteira | API e saída da IA têm validações | Dados inválidos não viram estado aceito |
| Negar fora do escopo | `inScope` exige grupo e ausência de pausa | Captura delimitada |
| Preservar antes de enriquecer | Texto salvo antes do download de mídia | Falha do anexo não perde o registro textual |
| Rastreabilidade | Fato guarda `sourceId`, perfil guarda eventos | Revisão explica a origem |
| Idempotência | Chaves primárias e `INSERT OR IGNORE` | Repetição não duplica certas entradas |
| Concorrência otimista | Perfil exige `version` atual | Evita sobrescrever edição de outra janela |

Esses princípios têm escopo: deduplicar um registro local não garante envio externo exatamente uma vez.
