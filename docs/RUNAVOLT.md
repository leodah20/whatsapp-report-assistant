# Runavolt · Protótipo 01

**Proposta:** software de gestão de chamados instalado e adaptado ao processo de cada empresa. O serviço combina levantamento, desenvolvimento, implantação local e sustentação conforme o escopo contratado. O protótipo atual demonstra o núcleo; não é um pacote comercial pronto nem exige que todo cliente use WhatsApp ou IA.

## Separação do produto

| Núcleo reutilizável | Varia por implantação |
| --- | --- |
| Chamados, etapas, fontes, evidências, auditoria e revisão mensal | Taxonomia de serviços, fluxos, formulários e modelos de relatório |
| Contratos de API e armazenamento local | Conectores, permissões, servidor, política de backup e retenção |
| Sistema visual Runavolt e componentes reutilizáveis | Acentos, nomenclatura e assinatura de uma implantação, quando contratados |

Uma instalação por cliente, com base, chaves e credenciais próprias. A LAN/VLAN é parte do desenho de rede aprovado, não é acionada pelo painel. Definir regras de acesso, origem dos dados, condições de manutenção, recuperação e responsabilidade do cliente antes da implantação. Não confundir frente de serviço com segmento de rede.

## Interface

- Grafite e papel como base, violeta nas ações, lavanda em contraste escuro. Cores de etapa continuam semânticas e sempre têm texto.
- Space Grotesk para títulos, Manrope para leitura e formulários, IBM Plex Mono para códigos e microtexto. Fontes originais e licenças OFL em `web/brand/fonts`; ativos servidos pela própria instalação, sem CDN.
- O R em vetor é uma adaptação do conceito para a interface, não uma validação de marca ou uma arte final de impressão.
- Desktop mantém fila e detalhe lado a lado; telas menores têm navegação compacta, trilho interno de frentes, alvos de toque e retorno à fila. A prévia A4 mantém rolagem própria e não altera o layout do PDF.
- O diagrama não faz parte do painel operacional. A página HTML separada documenta percursos e simula a ordem dos eventos com dados de referência, sem consultar o serviço. O Explorador da API permanece uma ferramenta de diagnóstico sob demanda.

## Próximas entregas

1. Validar o piloto com dados sintéticos e depois com o responsável autorizado. Transformar variações de frentes, modelos e regras em configuração por instalação antes de replicar o piloto.
2. Evoluir a [entrada de tickets por e-mail](EMAIL-DE-SUPORTE.md). O conector atual já arquiva as notificações recebidas por ticket e deduplica por mensagem. Outros fornecedores, formatos e a pasta de enviados exigem validação e escopo próprios.
3. Validar o app web instalável e os perfis de colaboração no primeiro celular autorizado. O app usa a ponte privada autenticada; não abre o SQLite nem expõe a porta do modelo. Aplicativo de loja é outra etapa.
4. Preparar a primeira instalação independente: configuração de marca e áreas, servidor dimensionado para o modelo, testes de backup e restauração e segmentação aprovada. O núcleo local é a proposta; fontes externas usadas no piloto não são requisitos de cada cliente. O modelo de linguagem roda no local, sem implicar treinamento próprio.
