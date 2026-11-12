# Arquitetura e operação de rede

A página HTML de apresentação e estudo é separada da operação. O mapa documenta a instalação de referência sem mostrar topologia do cliente, credenciais ou dados operacionais. Ele é estático: não faz chamadas de diagnóstico nem certifica que os serviços estão online. No painel operacional, o **Explorador da API** só consulta dados quando o operador clicar.

## Publicação pública

A versão pública fica em https://leodah20.github.io/whatsapp-report-assistant/ e reúne o mapa interativo e o blog de estudos em oito capítulos. O build `npm run site` lê `site-src/`, `estudos/*.md` e os ativos locais de `web/brand/`, grava `site/` (ignorado pelo Git) e não consulta o coletor. O workflow `.github/workflows/pages.yml` publica esse resultado no GitHub Pages a cada push na `main` que altere essas fontes. Nenhuma sessão, chave, QR, mensagem, banco ou log entra no build; o conteúdo é documentação sanitizada e não substitui o Explorador da API nem comprova disponibilidade dos serviços.

## Planos e fronteiras

| Plano | Caminho | O que fica fora |
| --- | --- | --- |
| Captura | WhatsApp Web → Chrome/Chromium (Puppeteer) → whatsapp-web.js → coletor Node | Sem API Business, sem coleta de outros grupos, sem garantia de histórico integral. |
| Operação local | Navegador → HTTP/loopback → `node:http` → serviços de domínio → SQLite | Sem conexão direta do navegador com o banco, sem front-end React ou framework de servidor. |
| Operação remota | Navegador → HTTPS na tailnet → Serve → ponte Node em loopback → coletor em loopback | Sem Funnel, sem QR, vínculo, pausa, troca de grupo ou controle dos envios pelo remoto. |
| Inferência | Coletor ou fechamento → HTTP local → Ollama `POST /api/chat` | Não depende dos créditos do agente que edita o código; não analisa os anexos. |
| Consulta MCP | Cliente autorizado → stdio → Python → SQLite somente leitura | Não passa pela ponte, não publica rede e não envia mensagens. |
| Tickets de suporte | IMAP/TLS somente leitura → adaptador Python → vínculo por número do ticket → tabelas de suporte → painel | Sem SMTP, anexos, acesso aos enviados ou encaminhamento para o WhatsApp. |
| Desenvolvimento | VS Code e Git → repositório sanitizado → Codex/OpenCode/Claude, quando autorizados | Sessão do WhatsApp, dados, chave, perfil de navegador e configurações privadas não entram no Git. |

## Percurso de uma requisição HTTPS

1. No celular, resolva o nome do notebook na tailnet, estabeleça o transporte e valide o certificado HTTPS. A porta externa configurada é independente da porta interna do coletor.
2. Serve termina TLS e encaminha a requisição à ponte por HTTP local. A ponte aceita somente a autoridade configurada, a origem local do encaminhamento, a identidade permitida e o protocolo HTTPS encaminhado. Ela usa uma lista explícita de rotas e operações; não é um proxy genérico.
3. Uma página do painel pode receber um cookie de sessão emitido pelo coletor. Na ponte ele é entregue como `Secure; HttpOnly; SameSite=Strict`; escritas passam por conferência de `Origin`, sessão, tipo e tamanho do corpo antes do encaminhamento. Não confunda o login fornecido por Serve com a sessão HTTP do painel.
4. No coletor, `src/cases/http.mjs` valida Host, sessão e origem de escrita; chama o domínio e devolve a resposta. A ponte encaminha a resposta de volta ao navegador. Não há TLS entre os processos em loopback; a terminação fica em Serve. Não disponibilize as portas internas à LAN.

## Interfaces HTTP de trabalho

| Método e rota | Função | Resposta / controle |
| --- | --- | --- |
| GET `/api/cases/runtime` | Estado operacional para o painel | JSON, sessão; não é o endpoint local de configuração do coletor. |
| GET `/api/cases?month=AAAA-MM` | Fila por competência | JSON; pendência de vínculo não é um chamado. |
| GET / POST `/api/cases/:código` | Leitura e alteração do chamado | JSON; operações permitidas, validação e controle de versão onde aplicável. |
| GET / POST `/api/cases/history?month=AAAA-MM` | Consulta e triagem de fontes | JSON; associar, ignorar ou restaurar não remove a fonte arquivada. |
| GET / POST `/api/cases/closing?month=AAAA-MM` | Conferência, decisões e preventivas | JSON; revisão de fontes separada da revisão de redação. |
| POST `/api/cases/closing/context` e `/package` | Preparar contexto e montar ZIP | JSON na preparação; `application/zip` no download. O segundo passo revalida o fingerprint. |
| POST `/api/cases/closing/local` | Sugestão textual por chamado | JSON via Ollama; não aprova a redação. |

Mídia não é retornada como arquivo bruto pelo caminho do sistema de arquivos. O painel pede uma evidência vinculada ou fonte elegível pelas rotas de mídia. O navegador pode solicitar um intervalo de bytes na prévia, quando suportado. A autorização de acesso ao painel não autoriza compartilhamento externo de anexos.

## Persistência e trilha técnica

O Node usa `node:sqlite` em modo WAL. `messages` guarda fontes e mídias; `assistant_items`, `assistant_links`, `assistant_inbox` e `assistant_receipts` sustentam análise, vínculo e retorno. `case_profiles` guarda revisão operacional e `monthly_closings` guarda decisões da competência. `recovery_jobs` e `recovery_meta` sustentam a retomada. A aplicação protege BLOBs com AES-256-GCM e dados autenticados associados ao registro; isso **não** é criptografia integral do arquivo SQLite ou do perfil do Chrome. Identificadores, datas e estados podem ficar em claro. Use somente os canais autorizados para backup e acesso.

As telas organizam CFTV, SDAI, SCA, PABX, Medição, BMS e Zabbix como **frentes de atendimento**. Não há consulta SNMP, BACnet ou integração automática com esses ativos apenas por existir uma categoria na tela.

## Diagnóstico sem misturar camadas

- **Erro de resolução de nome:** verifique Tailscale ativo e resolução na tailnet antes de olhar Node, SQLite ou WhatsApp.
- **Página carrega, API retorna 401:** reabra o painel para renovar a sessão; **403** aponta validação de acesso/origem/operação; **502** na ponte indica que ela não obteve resposta válida do coletor.
- **Captura conectada, fila atrasada:** separe busca de recuperação, fila de análise, confirmação enviada e etapa do chamado. Verifique o estado no painel antes de repetir uma ação.
- **ZIP recusado por alteração de contexto (409):** gere outra preparação e confira as fontes atualizadas. A extração não inclui fontes sem vínculo.
- **Notebook desligado ou suspenso:** não há coleta, inferência nem painel remoto. A retomada depende dos serviços voltarem e do histórico que o WhatsApp disponibilizar.

Código de referência: [coletor](../src/app.mjs), [ponte](../scripts/serve-private-panel.mjs), [API](../src/cases/http.mjs), [domínio](../src/cases/board.mjs), [fechamento](../src/cases/closing.mjs), [MCP](../integrations/mcp/server.py) e [supervisão](../scripts/windows/watchdog.ps1). Veja também [painel privado](PAINEL-PRIVADO.md) e [demonstração](DEMO.md).
