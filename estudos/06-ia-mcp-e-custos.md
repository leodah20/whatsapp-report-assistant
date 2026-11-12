# 6. IA, MCP e custos de programação

[Índice](README.md) · [Próximo: scripts e testes](07-scripts-ferramentas-e-testes.md)

## 6.1 Dois usos independentes de IA

| Uso | Quem executa | Contexto | Cobrança |
| --- | --- | --- | --- |
| Programar e estudar código | Modelo selecionado no OpenCode/Codex/Claude | Conversa, arquivos e resultados enviados pelas ferramentas | Depende do provedor e forma de autenticação |
| Organizar fontes e sugerir narrativa | Modelo configurado no Ollama do coletor | Texto fornecido pelo aplicativo | Modelo realmente local não cobra tokens de API remota; usa hardware/energia |

Ter uma API key da OpenAI no ambiente de programação não muda o modelo do coletor. O código de análise usa `CONFIG.ollamaURL` e `CONFIG.model`. Abrir o OpenCode também não hospeda nem inicia automaticamente o coletor.

## 6.2 Request de extração literal

Em [assistant.mjs](../src/assistant/assistant.mjs), `analyzeSources` envia POST para `/api/chat` do Ollama. O corpo inclui modelo, mensagens, esquema de saída, opções e `stream: false`.

- **Mensagem system:** orienta a tarefa, delimita dados não confiáveis e proíbe deduções indevidas.
- **Mensagem user:** carrega JSON com índices, texto, tipo, data e indicação de esclarecimento.
- **`format`:** pede estrutura JSON restrita por esquema.
- **`temperature: 0`:** reduz variação; não garante verdade nem determinismo absoluto.
- **`num_ctx`:** janela de contexto configurada.
- **`num_predict`:** limite de geração solicitado.
- **timeout:** evita espera indefinida no cliente.

Pedir JSON não basta. `validateAnalysis` verifica número de casos, índices válidos, vínculo das fontes e citações que realmente aparecem no texto. Fatos inválidos são filtrados e campos ausentes permanecem como lacuna; certas violações de estrutura rejeitam a análise.

Uma citação literal prova que o trecho foi escrito, não que o evento real foi tecnicamente verificado. Revisão humana continua importante.

## 6.3 Sugestão de narrativa é outro contrato

[report-assist.mjs](../src/cases/report-assist.mjs) primeiro consulta `/api/show` e exige identificação de modelo GGUF local, recusando aliases remotos. Depois prepara evidências textuais e chama `/api/chat` para obter `narrative` e `questions`.

O orçamento de contexto é aproximado. Se necessário, fontes/atualizações são recortadas e a saída indica `limited`. O modelo não recebe uma interpretação visual automática dos anexos. A sugestão retornada não salva nem aprova a revisão.

**Diferença de implementação:** a checagem explícita do GGUF em `/api/show` está nesse caminho de narrativa. Não atribua automaticamente essa mesma verificação ao extrator `analyzeSources`, que tem seu próprio request e validação.

## 6.4 Dados nunca viram autoridade

Uma mensagem pode conter “ignore instruções anteriores”. Para o produto, isso é conteúdo a ser tratado como dado. O modelo não recebe uma ferramenta genérica de shell, SQL, leitura de arquivos ou envio de WhatsApp.

O envio real fica em `src/app.mjs`: exige grupo fixado, autorização, estado ativo, tipo de mensagem permitido e formato/estado compatíveis. A saída textual do modelo não escolhe livremente destino ou ação. Essa limitação de autoridade é mais forte do que depender apenas de um aviso no prompt.

## 6.5 O que é MCP aqui?

MCP padroniza como um cliente descobre e chama ferramentas. Neste repositório, [server.py](../integrations/mcp/server.py) executa por **stdio**: o cliente inicia um processo Python e conversa pela entrada/saída padrão. Não há uma porta HTTP MCP do projeto.

| Ferramenta | Função | Limites relevantes |
| --- | --- | --- |
| `whatsapp_status` | Consulta o estado salvo pelo coletor | Não abre QR ou sessão; estado operacional ainda pode ser privado |
| `whatsapp_month` | Fontes de uma competência | Paginação, até 50 por chamada |
| `whatsapp_cases` | Itens propostos e dúvidas | Até 50; não são conclusões aprovadas |
| `whatsapp_image` | Imagem já arquivada | JPEG/PNG/WebP, até 4 MB |

O SQLite é aberto em modo leitura no MCP. Somente leitura impede alterações por essas ferramentas; não significa ausência de divulgação: o retorno entra no contexto do modelo que chamou a ferramenta. Ativar MCP para um modelo remoto exige autorização específica sobre esses dados.

## 6.6 Minha API key da OpenAI gasta créditos aqui?

**Se o OpenCode estiver autenticado com uma API key da OpenAI e usando um modelo dessa API, o consumo normalmente é cobrado na conta/projeto da API associado à chave.** Assinatura ChatGPT e faturamento da API são separados. Outras autenticações e provedores podem ter regras próprias; o modelo selecionado e a conta de faturamento precisam ser conferidos na interface correspondente.

O código público do aplicativo não informa o saldo, a chave usada pelo OpenCode ou o preço efetivo da sessão. Nada neste estudo exige abrir sua chave.

### O que costuma gerar consumo?

- Enviar uma pergunta ao modelo.
- Pedir análise, geração ou alteração de código.
- Enviar histórico, instruções, trechos de arquivos e resultados de ferramentas como contexto.
- Continuar uma tarefa com novas chamadas, tentativas ou agentes.

Uma tarefa pode exigir várias chamadas. Ler um arquivo local é uma operação de ferramenta; o conteúdo lido pode gerar tokens de entrada quando usado numa chamada posterior. Deixar o aplicativo aberto e ocioso geralmente não gera inferência por si só, mas extensões ou automações em segundo plano podem fazer chamadas.

### Como pensar no preço

```text
custo aproximado =
  tokens de entrada sem cache × tarifa de entrada
  + tokens de entrada em cache × tarifa de cache aplicável
  + tokens de saída × tarifa de saída
  + outros itens cobrados pelo serviço utilizado, quando houver
```

Tarifas geralmente são publicadas por milhão de tokens; converta a unidade antes de multiplicar. Regras sobre raciocínio, cache e ferramentas variam por modelo/serviço. Tokens são unidades do modelo, não uma contagem exata de palavras ou caracteres.

Confira [Usage](https://platform.openai.com/usage), [Billing](https://platform.openai.com/settings/organization/billing/overview) e [preços oficiais](https://openai.com/api/pricing/). Escolha a organização/projeto e o período corretos. Não trate um orçamento de alerta como bloqueio rígido de gastos sem conferir as condições atuais.

### Como estudar com consumo mais previsível

1. Use os capítulos locais para orientação inicial.
2. Peça explicações de uma função ou fluxo por vez e indique o arquivo.
3. Evite reenviar o repositório inteiro para perguntas pequenas.
4. Escolha conscientemente o modelo e acompanhe o consumo por período.
5. Confira o provedor efetivo: o script opcional `scripts/windows/opencode.ps1` seleciona um identificador específico, não a OpenAI automaticamente.

Documentação local é um recurso de consulta; lê-la no editor não exige uma chamada de IA. Pedir que um modelo explique ou amplie essa leitura pode gerar cobrança.
