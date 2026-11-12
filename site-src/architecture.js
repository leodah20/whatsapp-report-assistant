'use strict';
const byId = id => document.getElementById(id);

// Inventário estático. Selecionar um fluxo ou componente nunca consulta dados operacionais.
const components = {
  group: ['external', 'WhatsApp Web', 'Entrada e retorno de campo do único grupo autorizado.',
    'HTTPS entre WhatsApp e Chrome/Chromium; eventos da sessão chegam ao coletor Node.',
    'Integração não oficial, via whatsapp-web.js, não via API Business. A disponibilidade do histórico depende do WhatsApp.',
    'src/app.mjs · src/whatsapp/history.mjs'],
  collector: ['local', 'Coletor Node.js', 'Normaliza eventos, guarda fontes e mídias disponíveis e coloca registros na fila de análise.',
    'whatsapp-web.js + Puppeteer; eventos message_create/message_edit e leitura de histórico disponível.',
    'Checa o grupo e a pausa antes de capturar. Usa o ID da fonte para evitar arquivamento duplicado; a sessão de navegador fica separada do código.',
    'src/app.mjs · src/core.mjs · src/whatsapp/media.mjs'],
  archive: ['local', 'SQLite e cofre local', 'Mantém fontes, mídias, vínculos, filas, contexto de chamados e revisão mensal no notebook.',
    'node:sqlite em modo WAL; Python sqlite3 no MCP. BLOBs protegidos por AES-256-GCM na aplicação.',
    'A chave vem do Gerenciador de Credenciais do Windows. É criptografia de campos, não de todo o arquivo SQLite: identificadores, datas e estados de fila podem ficar em claro.',
    'src/app.mjs · src/core.mjs · integrations/mcp/vault.py'],
  inference: ['local', 'Ollama / modelo local', 'Extrai trechos literais das fontes ou sugere narrativa sob demanda.',
    'Node → HTTP de loopback → POST /api/chat; resposta estruturada em JSON. Ollama hospeda o modelo; Qwen é o modelo usado na instalação de referência.',
    'Não interpreta a mídia neste fluxo nem confirma fatos novos. Fonte e resposta do modelo são dados não confiáveis. A análise não depende de créditos do Codex, Claude ou OpenCode.',
    'src/config.mjs · src/assistant/assistant.mjs · src/cases/report-assist.mjs'],
  reconcile: ['local', 'Triagem e vínculo', 'Relaciona fontes e respostas ao chamado, sugere contexto e identifica o que falta.',
    'Fila persistente, código do chamado, mensagens citadas, fontes vinculadas e contexto local.',
    'Proximidade é sugestão, não prova. No Histórico o operador pode vincular, criar, ignorar ou restaurar uma fonte. Etapa e completude de contexto são dimensões diferentes.',
    'src/assistant/intake.mjs · src/assistant/media-context.mjs · src/cases/history.mjs · src/cases/stage.mjs'],
  notify: ['local', 'Retorno no grupo', 'Confirma entrada ou pergunta só o que falta; registra respostas vinculadas.',
    'Node → cliente WhatsApp Web → grupo autorizado, com diário de confirmações.',
    'Envios dependem das autorizações locais. Depois de uma falha externa, o resultado de um envio pode ficar incerto; não há garantia de entrega exatamente uma vez.',
    'src/assistant/assistant.mjs · src/assistant/followup.mjs · src/assistant/receipts.mjs'],
  desktop: ['human', 'Interface no notebook', 'Opera chamados, histórico, fechamento e configuração do coletor.',
    'HTML, CSS e JavaScript sem framework de front-end; HTTP em 127.0.0.1:8767; Fetch na mesma origem.',
    'O navegador não consulta o SQLite diretamente. Vínculo do WhatsApp, importação e controles do grupo ficam no notebook.',
    'web/cases.js · web/history.js · web/closing.js · web/setup.js'],
  mobile: ['external', 'Navegador no celular', 'Abre o painel real na rede privada, sem copiar o banco.',
    'HTTPS até o hostname Tailscale do notebook; HTML/CSS/JS e Fetch na mesma origem.',
    'Requer dispositivo conectado à tailnet e conta autorizada. O notebook deve estar ligado, sem suspensão e com a pilha ativa.',
    'web/cases.html · web/private-settings.html · docs/PAINEL-PRIVADO.md'],
  serve: ['external', 'Tailscale Serve', 'Termina o TLS e encaminha ao processo de ponte em loopback.',
    'HTTPS na tailnet → HTTP de loopback; Serve fornece a identidade de login ao proxy local.',
    'Não usa Funnel. Não confundir criptografia da tailnet, certificado HTTPS e autorização do aplicativo. Não encaminhar a porta do coletor diretamente.',
    'docs/PAINEL-PRIVADO.md'],
  bridge: ['local', 'Ponte privada Node', 'Aplica a lista de páginas, consultas e operações aceitas antes do encaminhamento.',
    'Verifica Host, HTTPS encaminhado e login; em escrita, também Origin, sessão, tipo e tamanho do corpo. Traduz a sessão para cookie remoto Secure, HttpOnly e SameSite=Strict.',
    'Não é proxy genérico: QR, vínculo, pausa, grupo e envios administrativos não passam. A interface remota não administra o WhatsApp.',
    'scripts/serve-private-panel.mjs'],
  api: ['local', 'API de chamados', 'Valida a requisição e chama os módulos de domínio. Responde JSON, mídia ou ZIP conforme a rota.',
    'node:http; GET /api/cases, GET /api/cases/:código e POST /api/cases/:código; rotas específicas para histórico e fechamento.',
    'Host e sessão local são verificados; gravações validam origem e corpo. Anexos e fotos passam por rotas próprias. O explorador local executa apenas três consultas GET sob demanda.',
    'src/cases/http.mjs · src/cases/history-media.mjs'],
  board: ['local', 'Domínio de chamados', 'Reúne fontes, atualizações, etapa, evidências e pendências. Guarda as mudanças do operador.',
    'CaseBoard combina arquivo de fontes e perfil do chamado; operações validam a versão quando aplicável.',
    'Arquivar não apaga fontes. Uma união preserva a trilha no chamado principal. Evidência de visita não prova normalização.',
    'src/cases/board.mjs · src/cases/stage.mjs'],
  closing: ['human', 'Conferência mensal', 'O responsável valida o material por competência e revisa as preventivas.',
    'GET /api/cases/closing para carregar; POST na mesma rota para salvar fontes, decisão de revisão e preventivas.',
    'Uma mudança nas fontes exige nova conferência. Conferir evidências não aprova a redação final.',
    'web/closing.js · src/cases/closing.mjs'],
  export: ['local', 'Extração TXT / ZIP', 'Reúne contexto, histórico e mídias arquivadas selecionadas; não exporta fontes avulsas.',
    'POST /api/cases/closing/context retorna texto e impressão digital do contexto. POST /api/cases/closing/package confere a impressão digital e retorna application/zip.',
    'Se o contexto mudar, o ZIP é recusado até preparar outra extração. Limites do pacote: até 100 chamados, 2 MB de texto estruturado e ZIP de até 100 MB/200 arquivos.',
    'src/cases/http.mjs · src/cases/report-archive.mjs'],
  draft: ['human', 'Redação e emissão', 'O responsável escolhe como redigir e valida o resultado antes da entrega.',
    'TXT/ZIP pode ser anexado manualmente a outra IA. A sugestão via Ollama é textual e por chamado. /minuta é HTML imprimível, com revisão separada.',
    'Abrir ChatGPT ou Claude não transmite o pacote nem identifica uma conversa ativa. Sugestão local não aprova nem salva a redação.',
    'web/closing.js · web/draft.js · src/cases/report-assist.mjs'],
  watchdog: ['local', 'Supervisão Windows', 'Verifica a saúde do runtime e tenta recuperar falhas persistentes com intervalo entre tentativas.',
    'PowerShell, verificação local de processo e sinais de saúde; sem consulta externa de monitoramento nesta camada.',
    'Preserva sessão, pausa e necessidade de novo vínculo. Não funciona com o notebook desligado ou suspenso.',
    'scripts/windows/watchdog.ps1 · scripts/windows/watchdog-policy.ps1'],
  recovery: ['local', 'Retomada e fila durável', 'Busca registros disponíveis após reconexão e retoma o processamento pendente.',
    'Fila em SQLite, janela de recuperação e leitura do histórico acessível no WhatsApp Web.',
    'Não promete preencher lacunas fora da janela ou recuperar o que o WhatsApp não disponibiliza. Última busca concluída não significa fila vazia.',
    'src/whatsapp/recovery.mjs · src/whatsapp/history.mjs'],
  client: ['human', 'Cliente MCP autorizado', 'Consulta o arquivo local por ferramentas específicas, fora do caminho do painel web.',
    'Processo cliente ↔ servidor Python por stdio. Não é uma API HTTPS nem é publicado por Tailscale Serve.',
    'Autorização local ao MCP não autoriza encaminhar conteúdo privado a um modelo remoto.',
    'integrations/mcp/server.py · integrations/mcp/envconfig.py'],
  mcp: ['local', 'MCP de leitura', 'Expõe whatsapp_status, whatsapp_month, whatsapp_image e whatsapp_cases.',
    'Python, SDK MCP, sqlite3 somente leitura e cryptography para abrir registros autorizados.',
    'Não vincula WhatsApp, não grava e não envia mensagens. Tem validação por competência, limites de consulta e restrições de imagem.',
    'integrations/mcp/server.py · requirements.txt'],
  repo: ['human', 'Git e ambiente de desenvolvimento', 'Mantém o código sanitizado e permite alternar editores e agentes de programação.',
    'Git/GitHub para versionamento; VS Code, Codex, Claude ou OpenCode para desenvolvimento.',
    'Git ignora arquivos de produção, mas ignorar não isola o sistema de arquivos. A trilha de estudos usa os arquivos versionados deste repositório.',
    'AGENTS.md · COMANDOS.md · docs/HANDOFF.md'],
  tests: ['local', 'Verificação sintética', 'Valida comportamento do servidor, permissões e fluxo de interface antes de publicar mudanças.',
    'node:test para cenários unitários e HTTP; Puppeteer/Chrome para navegação em larguras de desktop e celular.',
    'Usa dados fictícios. Passar nos testes não valida a cobertura de histórico real nem o fechamento de um cliente.',
    'tests/ · scripts/ui-smoke.mjs · scripts/doctor.mjs'],
  demo: ['local', 'Demonstração independente', 'Apresenta o painel e o explorador com exemplos fictícios para estudo.',
    'Servidor Node próprio, restrito a GET e sem encaminhamento ao coletor.',
    'Não tem sessão do WhatsApp, edição, configuração de coleta ou banco operacional. É uma demonstração, não um espelho do painel real.',
    'scripts/serve-demo.mjs · docs/DEMO.md']
};

const flows = [
  ['Coleta e retorno', 'A fonte é arquivada antes de virar contexto. O retorno ao grupo depende da autorização e do resultado da análise.', [
    ['group', 'Sessão vinculada'], ['collector', 'Gravação local'], ['archive', 'Trechos para análise'], ['inference', 'JSON validado'], ['reconcile', 'Pergunta ou confirmação'], ['notify', 'Somente grupo autorizado'], ['group']]],
  ['Painel local', 'O navegador opera o domínio pela API; não abre o banco ou o cofre de credenciais.', [
    ['desktop', 'HTTP · loopback'], ['api', 'Validação e despacho'], ['board', 'SQL local'], ['archive']]],
  ['HTTPS pelo celular', 'A requisição cruza a fronteira da tailnet em HTTPS; as duas conexões internas ficam em loopback. A resposta volta pelo mesmo caminho.', [
    ['mobile', 'HTTPS · tailnet'], ['serve', 'HTTP · loopback'], ['bridge', 'HTTP · loopback'], ['api', 'Validação e despacho'], ['board', 'SQL local'], ['archive']]],
  ['Triagem e evidências', 'Revisar o histórico não altera uma fonte original. O vínculo confirmado é o que torna a fonte parte do chamado.', [
    ['desktop', 'GET /api/cases/history'], ['api', 'Fontes e operações validadas'], ['reconcile', 'Associação e revisão'], ['board', 'Persistência'], ['archive']]],
  ['Fechamento mensal', 'Primeiro conferir, depois extrair. A decisão de redação e entrega não é automática.', [
    ['archive', 'Fontes, contexto e anexos'], ['closing', 'Seleção conferida'], ['export', 'Download pelo navegador'], ['draft']]],
  ['Recuperação', 'Supervisão do processo, estado do transporte e retomada da fila são verificações diferentes.', [
    ['watchdog', 'Verificação / retomada local'], ['collector', 'Transporte reconectado'], ['recovery', 'Registros recuperáveis'], ['archive']]],
  ['Acesso MCP', 'Caminho separado para ferramentas de leitura. Não passa pela API do navegador.', [
    ['client', 'MCP · stdio'], ['mcp', 'SQLite · somente leitura'], ['archive']]],
  ['Desenvolvimento e demo', 'O código pode ser estudado e testado sem conectar a sessão do WhatsApp ou copiar dados reais.', [
    ['repo', 'Código sanitizado'], ['tests', 'Dados fictícios'], ['demo']]]
];

const zones = { external: 'Rede / serviços externos', local: 'Notebook / loopback', human: 'Operação / revisão humana' };

function node(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function activate(button, container) {
  for (const control of container.querySelectorAll('button')) {
    control.setAttribute('aria-pressed', String(control === button));
  }
}

function showComponent(id, button) {
  const [zone, title, purpose, protocol, control, code] = components[id];
  activate(button, byId('arch-steps'));
  byId('arch-inspect').className = 'arch-inspect arch-' + zone;
  const fields = { zone: zones[zone], 'node-title': title, purpose, interface: protocol, control, code };
  for (const [field, value] of Object.entries(fields)) {
    byId('arch-' + field).textContent = value;
  }
}

function showFlow(flow, button) {
  activate(button, byId('arch-tabs'));
  byId('arch-flow-summary').textContent = flow[1];
  const steps = byId('arch-steps');
  steps.replaceChildren(...flow[2].map(([id, edge], index) => {
    const [zone, title] = components[id];
    const item = node('li', '', 'arch-step arch-' + zone);
    const card = node('button', '', 'arch-node arch-' + zone);
    card.type = 'button';
    card.setAttribute('aria-controls', 'arch-inspect');
    card.setAttribute('aria-pressed', 'false');
    card.append(node('span', String(index + 1).padStart(2, '0'), 'arch-number'), node('span', title, 'arch-node-name'));
    card.onclick = event => {
      showComponent(id, card);
      if (event.detail && matchMedia('(max-width: 760px)').matches) {
        byId('arch-inspect').scrollIntoView({ block: 'start' });
      }
    };
    item.append(card);
    if (edge) item.append(node('span', edge, 'arch-edge'));
    return item;
  }));
  showComponent(flow[2][0][0], steps.querySelector('button'));
}

const tabs = byId('arch-tabs');
for (const flow of flows) {
  const button = node('button', flow[0], 'arch-tab');
  button.type = 'button';
  button.onclick = () => showFlow(flow, button);
  tabs.append(button);
}
showFlow(flows[0], tabs.firstElementChild);
