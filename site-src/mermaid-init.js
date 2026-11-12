'use strict';

function prepareDiagrams() {
  const diagrams = [];
  for (const figure of document.querySelectorAll('.prose .diagram')) {
    const template = figure.querySelector('template.diagram-source');
    const source = template?.content.querySelector('code.language-mermaid');
    if (!source) continue;
    const node = document.createElement('div');
    node.className = 'mermaid';
    node.textContent = source.textContent;
    const loading = figure.querySelector('.diagram-loading');
    if (loading) loading.remove();
    template.replaceWith(node);
    figure.setAttribute('aria-busy', 'true');
    diagrams.push({ figure, node });
  }
  return diagrams;
}

function showFailure({ figure, node }) {
  figure.removeAttribute('aria-busy');
  figure.classList.add('diagram-error');
  node.replaceChildren();
  const note = document.createElement('p');
  note.className = 'diagram-error-note';
  note.textContent = 'Não foi possível renderizar este diagrama. O conteúdo textual do capítulo continua disponível.';
  figure.append(note);
}

async function renderDiagrams() {
  const diagrams = prepareDiagrams();
  if (!diagrams.length) return;
  if (!window.mermaid) {
    for (const diagram of diagrams) showFailure(diagram);
    return;
  }

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif',
    themeVariables: {
      background: '#fbfaf6',
      primaryColor: '#eee9fb',
      primaryTextColor: '#1b2230',
      primaryBorderColor: '#6c4ce0',
      lineColor: '#5a6872',
      secondaryColor: '#dff2f3',
      tertiaryColor: '#ffffff',
      fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif',
      fontSize: '15px',
      edgeLabelBackground: '#fbfaf6',
      clusterBkg: '#f7f4ff',
      clusterBorder: '#c9bcef',
      actorBkg: '#eee9fb',
      actorBorder: '#6c4ce0',
      actorTextColor: '#1b2230',
      actorLineColor: '#5a6872',
      signalColor: '#36454f',
      signalTextColor: '#1b2230',
      labelBoxBkgColor: '#dff2f3',
      labelBoxBorderColor: '#2b7a78',
      labelTextColor: '#1b2230',
      loopTextColor: '#1b2230',
      noteBkgColor: '#fff4d6',
      noteTextColor: '#1b2230',
      noteBorderColor: '#c9a227',
      activationBkgColor: '#eee9fb',
      activationBorderColor: '#6c4ce0'
    },
    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis', padding: 16 },
    sequence: { useMaxWidth: true, mirrorActors: false, wrap: true, width: 170, actorMargin: 30, diagramMarginX: 12, diagramMarginY: 12 }
  });

  for (const diagram of diagrams) {
    try {
      await window.mermaid.run({ nodes: [diagram.node] });
      diagram.figure.removeAttribute('aria-busy');
      diagram.figure.classList.add('diagram-ready');
    } catch (error) {
      console.error('Falha ao renderizar diagrama Mermaid:', error);
      showFailure(diagram);
    }
  }
}

renderDiagrams().catch(error => {
  console.error('Falha ao iniciar os diagramas Mermaid:', error);
});
