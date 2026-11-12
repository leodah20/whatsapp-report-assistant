'use strict';

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function enhanceCodeBlocks() {
  for (const pre of document.querySelectorAll('.prose pre')) {
    const block = pre.closest('.code-block, .diagram');
    if (!block || block.querySelector('.copy-button')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = 'Copiar';
    button.setAttribute('aria-label', 'Copiar bloco de código');
    button.addEventListener('click', async () => {
      const text = pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copiado';
        button.setAttribute('aria-live', 'polite');
        setTimeout(() => { button.textContent = 'Copiar'; }, 1800);
      } catch {
        button.textContent = 'Selecione e copie';
      }
    });
    block.append(button);
  }
}

function enhancePostSearch() {
  const input = document.querySelector('[data-post-search]');
  if (!input) return;
  const cards = [...document.querySelectorAll('[data-post]')];
  const count = document.querySelector('[data-post-count]');
  const empty = document.querySelector('[data-post-empty]');
  const label = count ? count.textContent : '';

  const filter = () => {
    const query = normalize(input.value.trim());
    let visible = 0;
    for (const card of cards) {
      const haystack = normalize([
        card.dataset.search || '',
        card.textContent || ''
      ].join(' '));
      const match = !query || haystack.includes(query);
      card.hidden = !match;
      if (match) visible += 1;
    }
    if (count) {
      count.textContent = query
        ? `${visible} de ${cards.length} capítulos`
        : label;
    }
    if (empty) empty.classList.toggle('visible', visible === 0);
  };

  input.addEventListener('input', filter);
  filter();
}

function enhanceToc() {
  const links = [...document.querySelectorAll('.article-toc a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map(link => [link.getAttribute('href').slice(1), link]));
  const headings = [...byId.keys()].map(id => document.getElementById(id)).filter(Boolean);
  if (!headings.length) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of links) link.removeAttribute('aria-current');
      const link = byId.get(entry.target.id);
      if (link) link.setAttribute('aria-current', 'location');
    }
  }, { rootMargin: '-92px 0px -68% 0px', threshold: 0 });
  for (const heading of headings) observer.observe(heading);
}

enhanceCodeBlocks();
enhancePostSearch();
enhanceToc();
