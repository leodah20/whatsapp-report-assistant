# 3. Fluxo dos dados, banco e recuperação

[Índice](README.md) · [Próximo: APIs e redes](04-http-apis-e-redes.md)

## 3.1 Da mensagem ao chamado

Siga os símbolos em [app.mjs](../src/app.mjs), [core.mjs](../src/core.mjs) e [assistant.mjs](../src/assistant/assistant.mjs):

1. `message_create` informa uma mensagem ao cliente.
2. `inScope` confere grupo fixado, pausa e tipo de origem. Mensagem própria usa o destino (`to`); recebida usa a origem (`from`).
3. `enqueue` ordena a captura; `capture` aplica também condições de recuperação e tempo.
4. `recordOf` cria um registro normalizado com ID, timestamp, competência, texto limitado e estado de revisão.
5. O ID é consultado no SQLite. Se já existir, só certos enriquecimentos pendentes justificam nova captura.
6. O texto é criptografado e salvo antes de tentar baixar a mídia.
7. Mídia e resposta citada são buscadas quando cabíveis. O registro recebe estados como `saved`, `failed`, `unavailable` ou `too-large`.
8. No fluxo normal, o registro vai à recuperação persistente quando habilitada, ou diretamente a `assistant.accept`.
9. O assistente distingue texto próprio, resposta vinculada, conversa sem relevância e candidato a novo chamado.
10. Entradas pendentes são agrupadas; a análise local propõe fatos literais e vínculos.
11. A validação confere fontes e citações. O chamado e os vínculos são gravados numa transação.
12. Sob autorização e limites, segue uma confirmação de cadastro **ou** uma pergunta. Respostas têm confirmação própria.

**Importação histórica tem caminho diferente:** `importMonth` usa captura com `override=true`, preservando fontes sem disparar automaticamente o mesmo fluxo de entrada nova. O Histórico permite revisar e organizar essas fontes depois.

## 3.2 Forma de um registro

Exemplo simplificado, fictício e apenas didático:

```json
{
  "id": "fonte-sintetica-1",
  "timestamp": 1793451600,
  "month": "2026-10",
  "text": "Câmera de bancada aguardando fonte de alimentação.",
  "type": "chat",
  "fromMe": false,
  "hasMedia": false,
  "mediaState": "none",
  "review": "unreviewed"
}
```

O timestamp acima representa um instante que ainda pertence a outubro em São Paulo, embora já seja novembro em UTC. O código calcula `month`; ele não deve ser preenchido por suposição. O registro normalizado pode receber campos adicionais ao longo da captura, como `quotedId`, `mime` e estado de mídia.

## 3.3 Entidades e tabelas

O esquema está nas instruções `CREATE TABLE` dos próprios módulos. Não é necessário abrir o banco privado para estudá-lo.

| Tabela | Papel | Onde é criada |
| --- | --- | --- |
| `messages` | Metadados indexáveis, payload e mídia das fontes | `app.mjs` |
| `assistant_items` | Chamados propostos e seus fatos/estados | `assistant.mjs` |
| `assistant_inbox` | Entradas pendentes, processadas, respostas ou ignoradas | `assistant.mjs` |
| `assistant_links` | Identificador de mensagem → chamado | `assistant.mjs` |
| `assistant_receipts` | Diário das confirmações de respostas | `receipts.mjs` |
| `recovery_meta` | Configuração, checkpoint e dados da recuperação | `recovery.mjs` |
| `recovery_jobs` | Fila persistente com estado e próxima tentativa | `recovery.mjs` |
| `case_profiles` | Contexto humano, versão, eventos e tarefas | `board.mjs` |
| `monthly_closings` | Revisões e ajustes por competência | `closing.mjs` |

A fonte é preservada separadamente das correções humanas do perfil. `CaseBoard.detail` combina os dois para exibir o contexto. Um campo confirmado no perfil pode prevalecer na apresentação sem apagar a fonte original.

Alguma documentação anterior cita `collection_notices`; o código atual consultado não cria essa tabela. Para aprender o esquema vigente, priorize as declarações dos módulos acima, sem presumir que um banco existente esteja livre de estruturas históricas.

## 3.4 Consultas parametrizadas, índices e transações

```sql
-- Exemplo de consulta presente no desenho do sistema.
SELECT id, payload FROM messages WHERE month = ? ORDER BY ts LIMIT 500;
```

O `?` recebe o parâmetro via driver; o valor não é concatenado ao SQL. O índice `month_ts` ajuda consultas por competência e ordem temporal.

Uma transação usa `BEGIN IMMEDIATE`, `COMMIT` e `ROLLBACK` para manter um conjunto de alterações coerente. Ao criar um chamado, não queremos salvar o item e esquecer de marcar suas fontes como processadas. Se uma etapa do bloco falhar, o rollback evita a aplicação parcial daquele bloco.

SQLite roda em modo WAL. Isso melhora a convivência entre operações de leitura e escrita, mas não cria vários escritores simultâneos sem contenção. Também significa que copiar apenas o arquivo principal durante uso não deve ser considerado um backup completo e consistente.

## 3.5 Criptografia de payloads

`seal` e `open`, em `core.mjs`, usam AES-256-GCM:

```text
armazenado = IV de 12 bytes + conteúdo cifrado + tag de autenticação de 16 bytes
```

AAD é um dado associado autenticado, como o ID da fonte. Ele vincula o conteúdo ao contexto esperado: uma cifra de uma fonte não deve ser aceita sob outro ID. Node e Python precisam concordar em algoritmo, formato binário e AAD.

A chave fica numa credencial Windows específica, acessada por `vault.py`. Metadados de índice, como IDs, competência, timestamps e alguns estados, continuam em claro. Isso é criptografia de determinados conteúdos, não de cada byte do arquivo SQLite nem do perfil do navegador.

## 3.6 Duas filas e dois tipos de falha

| Mecanismo | Para que serve | Sobrevive ao reinício? |
| --- | --- | --- |
| Promise de `enqueue` | Ordenar trabalho de captura no processo | Não |
| `recovery_jobs` | Retomar entrega de fontes arquivadas ao assistente | Sim |
| `assistant_inbox` | Guardar o trabalho de análise pendente | Sim |

Em `RecoveryQueue`, trabalhos percorrem `pending → processing → done`. Na inicialização, `processing` volta a `pending`: o processo anterior pode ter terminado antes de concluir. Falhas recebem nova tentativa futura. IDs únicos evitam inserir o mesmo trabalho repetidamente.

A janela de recuperação inclui sobreposição no checkpoint para reencontrar eventos próximos da fronteira. Isso exige deduplicação. A disponibilidade do histórico externo continua limitada pelo WhatsApp.

Já um envio pode ter sido entregue antes de uma queda impedir a confirmação. O estado `delivery-uncertain` representa essa incerteza; repetir cegamente pode duplicar mensagens. Persistência local não elimina esse problema distribuído.

## 3.7 Edição humana e conflito de versões

`CaseBoard.change` exige a versão lida pelo formulário. Suponha:

```text
Janela A lê versão 3 ── salva ──> versão 4
Janela B leu versão 3 ─ tenta salvar ─> HTTP 409; precisa recarregar
```

Esse mecanismo é concorrência otimista. O evento guarda quando a alteração foi registrada; `occurredOn`, quando fornecido, identifica o dia do fato. A atualização do perfil não dispara mensagem de WhatsApp.

## 3.8 Do acompanhamento ao fechamento

`MonthlyClosing` reúne candidatos, revisão de fontes, anexos escolhidos, decisões de inclusão, narrativa e preventivas. Um hash (`stamp`) resume elementos relevantes. Se as fontes/perfil mudam, a revisão anterior fica desatualizada.

- Confirmar fontes não equivale a aprovar a narrativa.
- O pacote de contexto seleciona fontes e anexos revisados para TXT/ZIP.
- Um fingerprint confere se o conteúdo continua igual entre preparar e baixar o pacote.
- A minuta imprimível só é liberada quando as verificações exigidas passam.
- Nada disso autoriza inventar datas de serviço nem substituir um arquivo final entregue.

**Exercício:** desenhe três colunas — fonte, sugestão automática e confirmação humana — e distribua os campos retornados por `CaseBoard.detail`.
