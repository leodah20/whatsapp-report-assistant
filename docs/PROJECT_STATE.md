# Estado — 2026-11-12

## Objetivo principal

Acompanhamento dos chamados, histórico, atualizações e pendências para gerar o relatório mensal no padrão aprovado, com fatos confirmados e revisão do responsável. Ferramentas e arquitetura são apoio a esse fluxo, não o produto principal. Codex continua como ambiente de desenvolvimento principal; OpenCode/DeepSeek é alternativa quando indisponível.

## Implementado

Coletor local Windows (Node + whatsapp-web.js), SQLite criptografado e chave no Gerenciador de Credenciais; vínculo e seleção explícita do grupo. Ollama local com extração literal. Chamados, perguntas de contexto, respostas vinculadas e confirmação por atualização. Recibos de coleta/cadastro. Recuperação durável após reconexão e controle de envios incertos. Painel operacional loopback e quatro ferramentas MCP de leitura. Testes sintéticos.

O funcionamento não depende de Codex/OpenCode/Claude abertos ou dos créditos desses produtos. Esses agentes alteram o código; não hospedam o coletor. A IA local do coletor e a IA que programa são independentes.

## Próximas prioridades de produto

1. Acompanhar o primeiro fechamento real, validar a cobertura histórica e ajustar o fluxo de revisão conforme o uso. Não inventar datas nem conclusões.
2. Documentação interativa e explorador técnico somente como apoio; não ampliar infraestrutura enquanto o fluxo de chamados estiver pendente.

## Concluído nesta etapa

Código completo sanitizado publicado em https://github.com/leodah20/whatsapp-report-assistant (main), usando a instalação atual como worktree canônico. README de instalação, AGENTS/HANDOFF compartilhados e abertura opcional no OpenCode com seleção explícita do modelo Free. Nenhum dado operacional publicado. Não há troca do modelo local do coletor.

Validação: 60 testes sintéticos aprovados na instalação e também em clone limpo baixado do GitHub; npm ci --ignore-scripts concluiu nesse clone. Doctor confirmou Node, Python, navegador e modelo local. OpenCode 1.19.5 instalado; catálogo confirmou o modelo Free. Não houve inferência de programação nem acesso ao arquivo privado por esse provedor. Não foi validada uma instalação Python limpa ponta a ponta.

Em 11/11/2026, a central local por frente de serviço e a supervisão Windows entraram em operação. A central oferece arquivo reversível de chamados, fila de fontes históricas sem vínculo, revisão por competência, preventivas com status explícito e minuta A4 imprimível. A capa e as rotinas do projeto ficam no modelo privado local. O explorador técnico e a exportação DOCX não estão implementados.

Na revisão de contexto, Tab aceita a sugestão compatível e avança. Isso apenas preenche o formulário; o responsável ainda precisa salvar.

Interface revisada de ponta a ponta: fila com filtros recolhíveis, detalhe com uma ação principal e menu de ações ocasionais, uma aba de contexto, fotos em Evidências, seleção de fontes no histórico, revisão mensal em duas etapas e configuração organizada por finalidade. A barra da minuta mudou apenas na tela; a impressão A4 permanece igual. Validados 78 testes sintéticos e as cinco telas em Chrome com dados fictícios (1366 e 390 px). A validação não substitui o primeiro fechamento real.

A Central exibe Chamados, Histórico sem chamado, Fechamento mensal e Configuração na barra superior. Histórico e fechamento mantêm a competência selecionada na Central.

O glossário de comandos fica em [COMANDOS.md](../COMANDOS.md), na raiz, e é atualizado quando o usuário pede um comando do projeto.

Em 11/11/2026 foi adicionada a [trilha didática em estudos/](../estudos/README.md), com oito capítulos sobre negócio, estrutura do código, linguagens, persistência, HTTP/redes, interface, IA/MCP/custos, scripts e exercícios. O material usa fontes versionadas e exemplos fictícios; é textual e não substitui o Explorador da API nem altera o fluxo operacional. Verificação desta entrega documental: `npm test` passou com 88 testes sintéticos. Não foram consultados dados operacionais ou credenciais para produzir os capítulos.

O destino padrão da extração é **Exportar para outra IA**. O painel não detecta qual agente ou conversa o usuário tem aberto.

O Histórico permite prévia da mídia arquivada sob demanda, seleção de chamado existente por título/local/frente, criação explícita de chamado e ignorar/restaurar sem apagar a fonte. Tipos sem prévia compatível ficam disponíveis para baixar; anexos não arquivados não podem ser abertos.

No fechamento, **A revisar** e **Conferidos** têm listas e contagens próprias, com busca. A lista rola separadamente no desktop; abrir um chamado revela o início do conteúdo também no celular. Fontes alteradas voltam a **A revisar**.

Em 12/11/2026, o mapa de arquitetura e a trilha de estudos passaram a ter uma edição pública estática no GitHub Pages, com link destacado no README. O build `npm run site` gera 11 páginas a partir de `site-src/`, `estudos/*.md` e ativos locais; o workflow `.github/workflows/pages.yml` publica apenas conteúdo sanitizado, sem coletor, sessão, chaves, mensagens ou logs. Validação: 98 testes sintéticos aprovados, build de 8 capítulos e 11 páginas, smoke local em Chrome a 1366 e 390 px com 8 links internos e revisão visual. Na publicação, raiz, blog, capítulo, CSS, sitemap e robots responderam 200; a rota inexistente devolveu o 404 personalizado. O site é documentação: não comprova disponibilidade do coletor e não substitui o acompanhamento do primeiro fechamento real.

Os blocos Mermaid dos capítulos 01 e 04 são renderizados no navegador com Mermaid 12.3.0 (MIT) servido localmente; o código-fonte do diagrama fica em template inerte e não aparece como bloco. Falha de renderização vira aviso textual, sem requisição externa. Validação: 98 testes e smoke em Chrome a 1366 e 390 px com os dois diagramas, sem código visível e sem estouro de largura.

## Limites

O fechamento abre no fluxo de extração. A revisão da redação, as decisões de inclusão e a emissão aparecem somente ao escolher **Fechar PDF pelo painel**. As preventivas também podem ser salvas no fluxo de extração, sem emissão. Ao confirmar fontes na fila de revisão, o painel abre o próximo chamado e, ao terminar, exibe a extração no próprio detalhe.

A extração mensal usa os chamados selecionados, seus fatos, histórico e evidências vinculadas, separando revisão de fontes de aprovação da narrativa. O ZIP inclui as mídias confirmadas para o pacote. ChatGPT e Claude são destinos manuais; o painel não acessa conversas remotas. A opção Ollama gera sugestões textuais e não interpreta os anexos. Limites da extração: 100 chamados, 2 MB de texto estruturado e ZIP de até 100 MB/200 arquivos.

A central calcula a etapa pelo histórico já vinculado, pelas respostas no painel e pelas atualizações locais. A fila resume por etapa e expõe o motivo de espera sem exigir uma pendência duplicada. Ajuste manual persiste até ser alterado ou voltar ao modo pelos registros. Não há reclassificação automática de material não vinculado nem leitura do conteúdo de fotos ou vídeos. A atualização foi carregada no coletor local e a API de etapas respondeu após reconexão.

Ainda sem interpretação de fotos/áudios e sem gerador completo de relatório final. Histórico depende do WhatsApp; envio exatamente uma vez não é garantido em falha externa. CPU pode demorar minutos. Armazenamento de credenciais Linux/macOS não implementado. Clientes OpenCode/Claude e provedores alternativos não foram testados ponta a ponta. Ofertas Free podem expirar; API direta da DeepSeek é paga.

O alerta de registros sem chamado usa a competência aberta: há uma bolinha na navegação e um aviso no fechamento e na extração. Registros ignorados ou já vinculados não contam; os pendentes não são exportados.

Cada aba operacional tem menu lateral contextual. Chamados mantém as frentes; Histórico separa A vincular e Ignorados e abre as ferramentas; Fechamento concentra filas, preventivas e saída; Configuração salta para as seções do coletor. Em telas estreitas, os atalhos ficam acima do conteúdo. A minuta imprimível não mudou.

Em Configuração, o cartão Mensagens automáticas separa autorização de envio, atividade de análise, fila, totais e avisos. Os totais são do coletor, não da competência. A conclusão da última busca de retomada não significa que a fila foi esvaziada.

Reunir duplicado lista chamados não arquivados da competência e de outros meses, sem incluir o chamado atual. A busca é local no painel, por título, local, frente ou código. Após selecionar o outro chamado, o responsável escolhe qual permanece. A confirmação mostra os dois títulos e, ao concluir, o painel abre o histórico do principal.

Uma etapa explícita mais recente, em fonte vinculada ou atualização local, sinaliza procedimento e resultado confirmados antes dela como contexto anterior. O Resumo destaca os trechos recentes; o contexto salvo e o histórico continuam disponíveis. A extração marca os campos anteriores com `prior`. Isso não reescreve respostas, não atribui causa e não interpreta mídias.

Na conclusão sustentada por texto técnico mais recente, o Resumo e a extração usam automaticamente os trechos literais de procedimento e resultado, com origem e data do registro. Não é necessário copiar a atualização para Contexto. O formulário preserva respostas anteriores ao salvar outros campos. Um status genérico sozinho não informa o resultado técnico; hipótese, bloqueio e reabertura não reaproveitam conclusões anteriores como atuais.

O Explorador da API, em Configuração, mostra rota e resposta JSON de três consultas locais: estado do coletor, lista mensal e detalhe de chamado. Usa a sessão local existente e não executa consultas antes do clique. Não há acesso do navegador de outro dispositivo nem alteração das permissões de rede.

A demonstração independente usa o painel e o explorador em modo somente leitura, com cinco chamados fictícios. É servida em loopback, em porta separada, sem encaminhar consultas para o coletor. Instruções em [DEMO.md](DEMO.md).

A ponte descrita em [PAINEL-PRIVADO.md](PAINEL-PRIVADO.md) permite encaminhar apenas consultas e edições selecionadas a partir de Serve HTTPS e uma conta autorizada. A instalação respondeu pela rede privada em porta HTTPS separada.

O proprietário confirmou a navegação do painel privado no Android. Na aba Contexto, telas de toque têm o botão **Usar sugestão**; Tab continua disponível no desktop. Nenhum atalho sobrescreve texto divergente ou salva o formulário.

O painel privado oferece Chamados, Histórico sem chamado, Fechamento e Configuração. A configuração remota mostra o estado e o explorador; controles do WhatsApp permanecem locais. O TXT/ZIP é baixado pelo navegador, sem envio automático para IA.

O [mapa interativo de arquitetura](ARQUITETURA.md) é documentação separada, com nove percursos e inspeção de protocolos, controles e módulos. O painel operacional não incorpora o mapa. O Explorador da API continua em Configuração.

O [Protótipo Runavolt 01](RUNAVOLT.md) aplica identidade, fontes locais e navegação responsiva a Chamados, Histórico, Fechamento, Configuração e diagnóstico. Na minuta, somente a barra em tela muda; o PDF não muda. O [e-mail de suporte](EMAIL-DE-SUPORTE.md) entra em um chamado por ticket e não altera a etapa técnica por status do fornecedor. A instalação independente por cliente ainda precisa ser validada.

Na Central de chamados, a assinatura Runavolt combina o R de circuito com o nome e o descritor. No desktop fica na lateral; no celular, na faixa superior. O símbolo atualizado também é o ícone da aba. A mudança não afeta a fila nem a impressão.

O painel privado é instalável pelo navegador e tem administrador, colaborador de leitura e colaborador de edição. O administrador gerencia a lista no painel privado; colaboradores acessam o chamado e suas pendências, sem mídia, exportação, coletor ou fontes brutas. A produção atende somente ao administrador até cadastro e autorização de rede. Sem modo offline ou app de loja. Consulte [PAINEL-PRIVADO.md](PAINEL-PRIVADO.md).
