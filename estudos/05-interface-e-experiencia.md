# 5. Interface: do clique ao estado persistido

[Índice](README.md) · [Próximo: IA e custos](06-ia-mcp-e-custos.md)

## 5.1 As peças da interface

| Tela | Estrutura | Comportamento | Estilo |
| --- | --- | --- | --- |
| Configuração | `web/setup.html` | `web/setup.js` | `web/setup.css` |
| Central | `web/cases.html` | `web/cases.js` | `web/cases.css` |
| Histórico | `web/history.html` | `web/history.js` | Veja folhas vinculadas no HTML |
| Fechamento | `web/closing.html` | `web/closing.js` | `web/closing.css` |
| Minuta | `web/draft.html` | `web/draft.js` | `web/draft.css` |

São arquivos entregues diretamente pelo servidor. O JavaScript manipula o DOM, sem React/Vue no código atual. DOM é a representação em memória dos elementos HTML; mudar um nó altera a tela.

## 5.2 Leia a Central em cinco etapas

Abra [cases.js](../web/cases.js) e siga:

1. **Helpers:** `$` encontra elementos por ID; `node` cria elementos; `button` associa ações.
2. **Estado:** `model`, `selected`, `detail`, `tab` e `contextDirty` guardam a situação atual da interface.
3. **Rede:** `api` prefixa `/api/cases`, impõe timeout e converte erros HTTP em exceções.
4. **Renderização:** `renderList` e `renderDetail` representam o estado atual em elementos.
5. **Interação:** eventos alteram filtros, abrem chamados ou submetem operações; a resposta atualiza o estado exibido.

### Estado local não é banco

Digitar num formulário muda a interface. Só a operação de salvar persiste a alteração aceita pelo servidor. Fechar a tela antes disso pode perder o preenchimento.

Da mesma forma, Tab aceitar uma sugestão apenas preenche o campo. A confirmação humana continua sendo a ação de salvar.

## 5.3 Fluxo de uma atualização

```text
clique “Registrar atualização”
  → formulário de nota
  → coleta dos campos e da versão lida
  → POST JSON
  → validação HTTP
  → CaseBoard.change
  → transação SQLite e incremento da versão
  → detalhe atualizado em JSON
  → renderização
```

Validação de formulário ajuda a orientar a pessoa, mas a decisão final está no servidor. Um request pode ser criado sem usar a tela.

`listRequest` e `detailRequest` ajudam a controlar respostas assíncronas: ao trocar rapidamente de seleção, a resposta de uma consulta antiga não deve substituir o detalhe mais recente. Esse é um problema de ordem de chegada, mesmo numa aplicação de um único usuário.

## 5.4 Renderizar texto com segurança

O helper `node` atribui `textContent`. Assim, uma mensagem contendo `<script>` é exibida como texto, não interpretada como um elemento executável. Compare conceitualmente com `innerHTML`, que interpreta marcação e exige cuidado adicional com conteúdo não confiável.

Leia também as restrições CSP em `src/cases/http.mjs`: o navegador recebe políticas junto com a página. Defesa na renderização e defesa nos cabeçalhos são camadas complementares.

## 5.5 Experiência alinhada ao negócio

- **Data do registro** e **data do atendimento** têm rótulos separados.
- **Local sugerido** não vira local confirmado automaticamente.
- **Falta de contexto** não é igual a **serviço em andamento**.
- **Evidências** reúne anexos e vínculo de fontes.
- **Mais ações** agrupa operações ocasionais, preservando uma ação principal visível.
- **Arquivar** preserva fontes e permite restauração quando cabível; união de duplicados tem trilha própria.

Essas escolhas são regras do produto visíveis na interface. Um painel pode ser visualmente claro e ainda assim induzir erro se misturar data, etapa e confirmação.

## 5.6 Histórico e fechamento

No Histórico, abrir uma mídia não a vincula. Selecionar fonte, escolher chamado, criar um novo e ignorar são ações distintas. Proximidade temporal pode sugerir texto de contexto; não confirma o vínculo.

No fechamento:

1. A pessoa revisa fontes e anexos em **A revisar**.
2. Confirmar leva o item a **Conferidos** e avança pela fila.
3. A extração permite preparar contexto e mídias para uso manual.
4. A emissão pelo painel é opcional e acrescenta decisões, narrativa e verificações de impressão.
5. Fontes alteradas exigem nova revisão.

`web/draft.js` apresenta a minuta; o navegador imprime/salva em PDF. Não confunda isso com um backend gerando DOCX ou com aprovação automática da redação.

## 5.7 Acessibilidade e responsividade como leitura de código

Observe `button` nativo, foco após ações, atributos como `aria-pressed`, avisos e CSS para larguras menores. Navegação por teclado e indicação de estado tornam a ferramenta compreensível além da aparência.

**Exercício:** explique quais informações precisam ser persistidas para sobreviver ao recarregamento e quais podem existir só durante a interação, como aba aberta ou filtro de busca. Depois compare com as estratégias usadas nos arquivos da interface.
