# WhatsApp Report Assistant

Assistente local de registros de manutenção. Acompanha **um grupo autorizado**, guarda fontes criptografadas, organiza chamados e pergunta quando faltam informações. Roda no computador, **não dentro do Codex**.

Repositório completo: https://github.com/leodah20/whatsapp-report-assistant

[Glossário de comandos](COMANDOS.md) · [Plano estratégico](docs/PLANO-ESTRATEGICO.md) · [Estado do projeto](docs/PROJECT_STATE.md) · [Continuidade](docs/HANDOFF.md)

> Integração não oficial via whatsapp-web.js: há risco de bloqueio e mudanças incompatíveis. A vinculação dá acesso técnico à conta inteira; o filtro de grupo é do programa, não uma permissão do WhatsApp. Obtenha autorização dos participantes e da organização. Nunca publique dados, sessão, QR ou credenciais.

## Instalação local — Windows / PowerShell

Pré-requisitos: Git, Node.js **24+**, Python **3.12+**, Chrome instalado e [Ollama](https://ollama.com/download/windows). Não desative a proteção do navegador. O modelo inicial ocupa aproximadamente 2,5 GB; CPU pode levar minutos por análise.

```powershell
git clone https://github.com/leodah20/whatsapp-report-assistant.git
cd whatsapp-report-assistant
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
ollama pull qwen3:4b
npm run doctor
npm test
npm start -- --enable-recovery
```

O Ollama deve estar iniciado (aplicativo ou `ollama serve` em outro terminal). Abra **http://127.0.0.1:8767/**, autorize o vínculo, escaneie o QR e confirme o grupo correto. Habilite conscientemente as mensagens automáticas pelo painel; o consentimento é separado da coleta.

Se a detecção falhar, ajuste REPORT_PYTHON e REPORT_CHROME_PATH no .env.local. **Nunca sobrescreva configurações existentes**: o nome da chave e da sessão devem continuar iguais para acessar o arquivo atual.

Para retomar uma instalação autorizada: `npm run resume`. O script `scripts/windows/start.ps1` inicia em segundo plano. Atalho de inicialização é opcional; o projeto não instala um serviço nem muda energia/suspensão. PC desligado não processa: ao reconectar, tenta buscar o histórico disponível. Não há garantia de recuperar mensagens apagadas ou mídias expiradas.

## Extração mensal e minuta

Abra **Chamados → Fechamento mensal**, selecione a competência e abra um item em **A revisar**. **Confirmar fontes e anexos** move o chamado para **Conferidos** e abre o próximo. No fim da fila, a extração fica no próprio painel de revisão. Se as fontes mudarem, o chamado volta a **A revisar**. Em **Preventivas do mês**, salve os status para o pacote sem preencher a data de emissão.

Em **Preparar o relatório com IA**, escolha **Exportar para outra IA** para levar o TXT ou ZIP ao chat de sua escolha. ChatGPT e Claude têm atalhos opcionais para um link privado salvo no navegador. Não é preciso criar uma chave de API. O painel não identifica a conversa aberta nem envia arquivos: anexe manualmente apenas o que puder compartilhar. Se a conversa não aceitar ZIP, extraia e anexe o TXT e os arquivos necessários.

Para redigir sem cobrança de API, use um modelo GGUF baixado no Ollama. O modelo lê contexto textual, não interpreta anexos, e devolve sugestões por chamado sem salvar nem aprovar a redação. Revise as sugestões no painel. Para uma instalação somente local, também é possível desabilitar as funções de nuvem do Ollama com `OLLAMA_NO_CLOUD=1`, conforme a [documentação oficial](https://docs.ollama.com/faq).

**Fechar PDF pelo painel** é opcional: mostra a revisão de texto, datas, fotos, preventivas e emissão. Depois de revisar, use **Abrir minuta** para imprimir ou salvar em PDF. A tela abre no fluxo de extração, sem exigir essa aprovação.

## Mesma pasta, mesmo Git, qualquer agente

Abra esta pasta no VS Code e no agente escolhido. **Não crie outra cópia para alternar entre Codex, Claude e OpenCode.**

O **Codex permanece o ambiente principal**. OpenCode/DeepSeek é uma alternativa temporária quando não houver créditos disponíveis aqui. O objetivo é acompanhar chamados e fechar o relatório mensal, não manter várias instalações.

```powershell
code .
git remote -v
git status --short
opencode
```

Pedido para o próximo agente:

> Leia AGENTS.md, docs/PROJECT_STATE.md e docs/HANDOFF.md, confira git status e continue a próxima pendência. Use este worktree e o origin existente. Preserve dados privados, execute testes, atualize o HANDOFF e faça commit/push somente do código sanitizado.

Na volta ao Codex, use o mesmo pedido e a mesma pasta. Em outro computador, primeiro salve trabalho local e use `git pull --ff-only`. Não use reset destrutivo. Git transporta código, testes e decisões; não transfere créditos nem a memória integral de um chat.

### OpenCode + DeepSeek gratuito

Instale conforme a [documentação oficial do OpenCode](https://opencode.ai/docs/), abra na pasta do projeto e use `/models` para escolher uma opção explicitamente **Free**. Em 10/11/2026, o [catálogo oficial](https://opencode.ai/docs/console/models/) oferecia **DeepSeek V4.1 Flash Free por tempo limitado**. Isso pode mudar. Não habilite recarga automática nem aceite fallback pago. A [API direta da DeepSeek é tarifada](https://api-docs.deepseek.com/quick_start/pricing/).

Alternativa sem cobrança de API: [OpenCode com Ollama local](https://docs.ollama.com/integrations/opencode). Existem modelos locais da [família DeepSeek](https://ollama.com/library/deepseek-r1); não foram validados neste projeto para programação ou ferramentas. Modelos pequenos podem ter qualidade insuficiente; hardware/energia continuam tendo custo.

Nesta máquina, o OpenCode 1.19.5 já está instalado e o catálogo retornou `opencode/deepseek-v4.1-flash-free`. O script opcional `scripts/windows/opencode.ps1` confere se esse identificador ainda existe e abre a mesma pasta com ele selecionado; se não existir, interrompe. Não aceita autorização automática, não muda o modelo do coletor e não testa inferência com dados reais. A presença no catálogo não garante oferta gratuita futura; confirme as condições antes de usar.

O modelo que **programa no OpenCode** é independente do modelo que **analisa o grupo**. O coletor continua com IA local configurada em REPORT_MODEL. Trabalhar no código público não exige acesso a mensagens. Nunca conecte um modelo remoto ao arquivo privado/MCP sem autorização específica.

### MCP opcional — somente leitura

`integrations/mcp/server.py` expõe whatsapp_status, whatsapp_month, whatsapp_cases e whatsapp_image. Não envia mensagens nem lê QR/perfil da sessão. Habilitar o conector pode enviar conteúdo privado ao agente/modelo: autorize separadamente.

Exemplos; substitua C:/CAMINHO pela pasta real da instalação:

```text
codex mcp add whatsapp-reports -- C:/CAMINHO/.venv/Scripts/python.exe C:/CAMINHO/integrations/mcp/server.py
claude mcp add --transport stdio whatsapp-reports -- C:/CAMINHO/.venv/Scripts/python.exe C:/CAMINHO/integrations/mcp/server.py
```

Confira a versão instalada: [Codex MCP](https://developers.openai.com/codex/mcp), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [OpenCode MCP](https://opencode.ai/docs/mcp-servers/). O protocolo MCP foi validado, mas não houve teste ponta a ponta com todos esses clientes/provedores. Não é necessário ativar MCP para editar o código.

## Arquitetura e limites atuais

`WhatsApp → filtro de grupo → fonte criptografada → fila persistente → análise local → chamado → confirmação OU pergunta → resposta vinculada → confirmação de atualização`

Confirmação de recebimento não significa serviço concluído. Informação completa para redação não prova equipamento normalizado. Mensagens, anexos e saída da IA são dados não confiáveis, nunca instruções.

| Fonte | Função |
| --- | --- |
| src/app.mjs | Servidor local, vínculo, captura, importação, permissões e envio restrito |
| src/assistant/assistant.mjs | Análise literal, chamados, perguntas e respostas |
| src/assistant/intake.mjs / src/assistant/receipts.mjs | Confirmação de cadastro ou resposta, sem aviso duplicado |
| src/whatsapp/recovery.mjs / src/whatsapp/history.mjs | Fila durável, reconexão e busca por período |
| src/whatsapp/transport.mjs / src/whatsapp/compat.mjs / src/whatsapp/media.mjs | Estado real da conexão, IDs e anexos |
| src/core.mjs / integrations/mcp/vault.py | AES-256-GCM e chave no Gerenciador de Credenciais do Windows |
| src/config.mjs / integrations/mcp/envconfig.py | Configuração local, sem avaliar código |
| integrations/mcp/server.py | Quatro ferramentas de consulta |
| src/cases/ e web/ | Painel de chamados, acompanhamento local e configuração |
| scripts/windows/ | Inicialização, supervisão e reinício no Windows |
| tests/ e scripts/probe.py | Testes sintéticos e verificação HTTP/MCP |
| .env.local | Ajustes privados; fora do Git |
| data/ | Banco, sessão e escopo; fora do Git |
| local-ai/ / node_modules/ / .venv/ | Modelos, binários e dependências; fora do Git |

Ollama: **127.0.0.1:11434**. Painel: **127.0.0.1:8767**. MCP usa entrada/saída do processo, sem porta. Não exponha portas na rede.

SQLite: data/archive.sqlite, modo WAL. Tabelas messages, assistant_items, assistant_inbox, assistant_links, assistant_receipts, recovery_meta, recovery_jobs e collection_notices. Conteúdo/anexos criptografados; índices de IDs, meses, timestamps e alguns estados em claro. Visualizador SQLite mostra esquema e índices, não decifra as fontes. Não apague a chave nem presuma backup completo copiando só o banco. O cache interno do Chrome não tem a mesma garantia de criptografia do arquivo.

### Interfaces locais

O cookie é criado ao abrir o painel; POST exige origem local exata e JSON.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | /api/status | Estado, grupos e QR quando houver; privado |
| GET | /api/month?month=AAAA-MM | Fontes do mês, até 500 |
| GET | /api/assistant | Chamados, perguntas e respostas |
| POST | /api/connect | Vincular com consentimento explícito |
| POST | /api/select | Fixar grupo |
| POST | /api/pause | Pausar/retomar captura |
| POST | /api/questions | Habilitar/desabilitar mensagens automáticas |
| POST | /api/context | Rever fonte específica |
| POST | /api/history | Importar período |

Não há API genérica de envio, SQL, comandos ou leitura de arquivos. Isso não é isolamento contra processos/malware da mesma conta do Windows.

### Central de chamados e supervisão

Abra [a central local](http://127.0.0.1:8767/chamados). Filtre por competência, frente de serviço e andamento. Abra a linha do tempo, fontes e fotos; registre atualizações, corrija a frente sugerida e mantenha pendências e conclusão técnica separadas. As alterações manuais ficam no arquivo criptografado e não enviam WhatsApp. A base do mês é um TXT para revisão, não um relatório final.

O painel indica a última conexão verificada e sincronização. Para iniciar o supervisor pelo CMD, na pasta do projeto:

```cmd
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\windows\start.ps1" -Background
```

Para iniciar ao entrar no Windows, configure o atalho de inicialização para esse comando com a pasta do projeto como diretório de trabalho. A supervisão respeita pausa e pedido de novo vínculo; reinicia apenas processos da instalação, com intervalo entre tentativas. PC desligado, suspenso ou sem login não executa a coleta. Em caso de erro persistente, `scripts/windows/restart.ps1` permite reiniciar essa instalação, sem limpar a sessão.

Cada novo chamado gera só uma mensagem: confirmação ou pergunta com o código. Não há recibo adicional antes da análise. Respostas vinculadas continuam recebendo uma confirmação própria.

### Não implementado / limites

Interpretação de fotos/áudios, explorador técnico interativo e geração do relatório final completo ainda não implementados. Sem garantia de envio exatamente uma vez em falha externa. Recuperação limitada ao histórico disponibilizado pelo WhatsApp. Windows-first: armazenamento de credenciais Linux/macOS não implementado.

## Verificação e continuidade

### Fechamento mensal

No painel, abra **Fechamento mensal → Fechar PDF pelo painel**. Revise cada chamado, confirme data ou acompanhamento sem intervenção datada, edite a narrativa e selecione as fotos do próprio chamado. Escolha **Aguardar contexto** com a pergunta se faltar uma informação. A revisão é local e não envia mensagens. Registre os status das preventivas, a emissão e a conferência da cobertura; a minuta abre em A4 para imprimir ou salvar pelo navegador. Não é uma exportação DOCX.

O modelo privado fica em `data/report-template.json` com `name`, `footer` e seis `groups`; cada grupo tem `name` e `rows` com trios `[semana, tarefa, classificação]`. Use `data/report-cover.png` para a capa autorizada. Nunca versione esses arquivos. Para outra pasta de dados, use o diretório configurado na instalação.

**Histórico sem chamado** exibe fontes já arquivadas, com opção de criar rascunho, vincular a um chamado ou preparar sugestões em lotes locais sem notificação retroativa. **Arquivar chamado** tira um duplicado da lista ativa e da minuta, sem apagar fontes. Para reverter, use **Mostrar chamados arquivados**.

```powershell
npm run doctor  # não lê chaves/mensagens, não conecta WhatsApp
npm test        # fontes sintéticas, sem envios reais
# Somente com servidor iniciado e autorização de consulta:
.\.venv\Scripts\python.exe scripts/probe.py
git diff --check
git status --short
```

Antes de publicar, revise `git diff --cached` e `git ls-files`. Sem dados operacionais ou identificação de clientes. Atualize AGENTS.md, docs/PROJECT_STATE.md e docs/HANDOFF.md ao trocar de agente. Veja também [arquitetura pública](https://leodah20.github.io/docs/whatsapp-report-assistant/).

Licença Apache-2.0; dependências mantêm suas licenças. Sem afiliação ao WhatsApp/Meta, OpenAI, Anthropic ou OpenCode.
