#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_SRC = path.join(ROOT, 'site-src');
const ESTUDOS_DIR = path.join(ROOT, 'estudos');
const DEFAULT_OUT = path.join(ROOT, 'site');
const REPO_URL = 'https://github.com/leodah20/whatsapp-report-assistant';
const SITE_URL = 'https://leodah20.github.io/whatsapp-report-assistant';
const CONTENT_BASE = '11/11/2026';
const CHAPTER_META = {
  '01-negocio-e-arquitetura': {
    title: 'Negócio e arquitetura',
    summary: 'O problema, as camadas e o mapa do repositório para entender o sistema antes de abrir os símbolos.',
    tags: ['Negócio', 'Arquitetura']
  },
  '02-linguagens-e-principios': {
    title: 'Linguagens e princípios',
    summary: 'JavaScript, Python, PowerShell, HTML, CSS e SQL na prática, com as decisões de construção que aparecem no código.',
    tags: ['JavaScript', 'Python', 'Fundamentos']
  },
  '03-fluxo-de-dados': {
    title: 'Fluxo dos dados e persistência',
    summary: 'Da mensagem ao chamado: tabelas, transações, filas, criptografia e recuperação de trabalho pendente.',
    tags: ['Dados', 'SQLite', 'Filas']
  },
  '04-http-apis-e-redes': {
    title: 'HTTP, APIs e redes',
    summary: 'Requests, responses, portas, cookies, catálogo de rotas e como ler o tráfego com o DevTools.',
    tags: ['HTTP', 'API', 'Redes']
  },
  '05-interface-e-experiencia': {
    title: 'Interface e experiência',
    summary: 'DOM, eventos, estado, chamadas assíncronas e a revisão mensal do clique até a persistência.',
    tags: ['Interface', 'DOM', 'UX']
  },
  '06-ia-mcp-e-custos': {
    title: 'IA, MCP e custos',
    summary: 'Extração literal, sugestões, ferramentas de leitura e a diferença entre cobrança de API e modelo local.',
    tags: ['IA', 'MCP', 'Custos']
  },
  '07-scripts-ferramentas-e-testes': {
    title: 'Scripts, ferramentas e testes',
    summary: 'Inicialização no Windows, supervisão, dependências, Git e verificações automatizadas com dados sintéticos.',
    tags: ['PowerShell', 'Testes', 'Git']
  },
  '08-laboratorio-e-glossario': {
    title: 'Laboratório e glossário',
    summary: 'Exercícios progressivos, respostas orientativas e vocabulário essencial para consolidar o aprendizado.',
    tags: ['Exercícios', 'Glossário']
  }
};

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const escapeAttr = value => escapeHtml(value);

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'secao';
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, length = 158) {
  if (value.length <= length) return value;
  const cut = value.slice(0, length - 1);
  const atSpace = cut.lastIndexOf(' ');
  return (atSpace > 80 ? cut.slice(0, atSpace) : cut).trimEnd() + '…';
}

function rewriteHref(href, sourceDir) {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith('#')) return href;
  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const rawPath = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  if (!rawPath) return href;

  const decoded = decodeURIComponent(rawPath);
  const resolved = path.posix.normalize(path.posix.join(sourceDir, decoded));

  if (resolved.startsWith('estudos/')) {
    if (resolved === 'estudos/README.md') return './' + hash;
    if (resolved.endsWith('.md')) return './' + path.posix.basename(resolved, '.md') + '.html' + hash;
    return './' + path.posix.basename(resolved) + hash;
  }

  const absolute = path.join(ROOT, resolved);
  const type = existsSync(absolute) && statSync(absolute).isDirectory() ? 'tree' : 'blob';
  return `${REPO_URL}/${type}/main/${encodeURI(resolved)}${hash}`;
}

function renderInline(text, sourceDir) {
  let output = escapeHtml(text);
  const codeSpans = [];
  output = output.replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000C${codeSpans.length}\u0000`;
    codeSpans.push(`<code>${code}</code>`);
    return token;
  });

  const links = [];
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, href) => {
    const token = `\u0000L${links.length}\u0000`;
    links.push(`<a href="${escapeAttr(rewriteHref(href, sourceDir))}">${renderInline(label, sourceDir)}</a>`);
    return token;
  });

  output = output
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  output = output.replace(/\u0000C(\d+)\u0000/g, (_, index) => codeSpans[Number(index)]);
  output = output.replace(/\u0000L(\d+)\u0000/g, (_, index) => links[Number(index)]);
  return output;
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function renderTable(lines, sourceDir) {
  const header = splitTableRow(lines[0]);
  const separator = splitTableRow(lines[1]);
  const alignments = separator.map(cell => {
    if (/^:-+:$/.test(cell)) return 'center';
    if (/^-+:$/.test(cell)) return 'right';
    return 'left';
  });
  const rows = lines.slice(2).map(splitTableRow);
  const cell = (tag, value, index, headerCell = false) => {
    const align = alignments[index] || 'left';
    const content = renderInline(value, sourceDir);
    return `<${tag}${align !== 'left' ? ` style="text-align:${align}"` : ''}>${headerCell ? content : content}</${tag}>`;
  };
  return [
    '<div class="table-wrap">',
    '<table>',
    `<thead><tr>${header.map((value, index) => cell('th', value, index, true)).join('')}</tr></thead>`,
    `<tbody>${rows.map(row => `<tr>${header.map((_, index) => cell('td', row[index] || '', index)).join('')}</tr>`).join('')}</tbody>`,
    '</table>',
    '</div>'
  ].join('');
}

function renderCodeBlock(code, language) {
  const lang = language || 'text';
  const escaped = escapeHtml(code);
  if (lang === 'mermaid') {
    return [
      '<figure class="diagram">',
      '<figcaption>Diagrama Mermaid</figcaption>',
      '<div class="diagram-canvas">',
      '<p class="diagram-loading">Carregando diagrama…</p>',
      `<template class="diagram-source"><pre><code class="language-mermaid">${escaped}</code></pre></template>`,
      '</div>',
      '<p class="diagram-hint">Em telas estreitas, deslize para o lado para ver o diagrama completo.</p>',
      '<noscript><p class="diagram-fallback">Ative o JavaScript para visualizar este diagrama.</p></noscript>',
      '</figure>'
    ].join('');
  }
  return `<div class="code-block"><pre><code class="language-${escapeAttr(lang)}">${escaped}</code></pre></div>`;
}

function renderMarkdown(markdown, sourceDir = 'estudos') {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  const toc = [];
  const ids = new Map();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const language = line.slice(3).trim().split(/\s+/)[0] || 'text';
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(renderCodeBlock(code.join('\n'), language));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      let id = slugify(text);
      const count = ids.get(id) || 0;
      ids.set(id, count + 1);
      if (count) id = `${id}-${count + 1}`;
      if (level === 2) toc.push({ text, id });
      output.push(`<h${level} id="${id}">${renderInline(text, sourceDir)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*\|/.test(line) && index + 1 < lines.length) {
      const tableLines = [];
      while (index < lines.length && /^\s*\|/.test(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      if (tableLines.length >= 2 && splitTableRow(tableLines[1]).every(cell => /^:?-{3,}:?$/.test(cell))) {
        output.push(renderTable(tableLines, sourceDir));
      } else {
        output.push(`<p>${renderInline(tableLines.join(' '), sourceDir)}</p>`);
      }
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (!match) break;
        let text = match[2];
        index += 1;
        while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
          text += ' ' + lines[index].trim();
          index += 1;
        }
        items.push(text);
      }
      output.push(`<${tag}>${items.map(item => `<li>${renderInline(item, sourceDir)}</li>`).join('')}</${tag}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, '').trim());
        index += 1;
      }
      output.push(`<blockquote><p>${renderInline(quote.join(' '), sourceDir)}</p></blockquote>`);
      continue;
    }

    if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*\s*$/.test(line)) {
      output.push('<hr>');
      index += 1;
      continue;
    }

    const paragraph = [];
    while (index < lines.length) {
      const current = lines[index];
      if (!current.trim()) break;
      if (/^(#{1,6})\s+/.test(current) || /^```/.test(current) || /^\s*\|/.test(current)
        || /^\s*([-*]|\d+\.)\s+/.test(current) || /^>\s?/.test(current)
        || /^\s*---+\s*$/.test(current) || /^\s*\*\*\*\s*$/.test(current)) break;
      paragraph.push(current.trim());
      index += 1;
    }
    if (paragraph.length) output.push(`<p>${renderInline(paragraph.join(' '), sourceDir)}</p>`);
  }

  return { html: output.join('\n'), toc };
}

function stripChapterChrome(markdown) {
  const withoutTitle = markdown.replace(/^\s*#\s+.*\n+/, '');
  return withoutTitle
    .split('\n')
    .filter(line => !/^\[Índice\]\(README\.md\)/.test(line.trim()))
    .join('\n')
    .replace(/^\n+/, '');
}

function renderPage({ title, description, canonical, base, bodyClass, content, extraHead = '', archCurrent = '', studiesCurrent = '' }) {
  return readFile(path.join(SITE_SRC, 'layout.html'), 'utf8')
    .then(layout => layout
      .replaceAll('{{CONTENT}}', content)
      .replaceAll('{{EXTRA_HEAD}}', extraHead)
      .replaceAll('{{TITLE}}', escapeHtml(title))
      .replaceAll('{{DESCRIPTION}}', escapeAttr(description))
      .replaceAll('{{CANONICAL}}', escapeAttr(canonical))
      .replaceAll('{{BASE}}', base)
      .replaceAll('{{BODY_CLASS}}', bodyClass)
      .replaceAll('{{ARCH_CURRENT}}', archCurrent)
      .replaceAll('{{STUDIES_CURRENT}}', studiesCurrent));
}

async function readChapters() {
  const files = (await readdir(ESTUDOS_DIR))
    .filter(file => /^\d{2}-.+\.md$/.test(file))
    .sort();

  return Promise.all(files.map(async (file, order) => {
    const slug = path.basename(file, '.md');
    const markdown = await readFile(path.join(ESTUDOS_DIR, file), 'utf8');
    const number = slug.slice(0, 2);
    const meta = CHAPTER_META[slug] || {
      title: plainText(markdown.match(/^#\s+(.*)$/m)?.[1] || slug),
      summary: 'Capítulo da trilha de estudos do assistente de chamados.',
      tags: ['Estudos']
    };
    const body = stripChapterChrome(markdown);
    const words = plainText(body).split(/\s+/).filter(Boolean).length;
    return {
      file,
      slug,
      number,
      order: order + 1,
      title: meta.title,
      summary: meta.summary,
      tags: meta.tags,
      minutes: Math.max(1, Math.ceil(words / 180)),
      hasMermaid: /^```mermaid\s*$/m.test(body),
      body
    };
  }));
}

function renderPostCard(chapter) {
  const search = [chapter.title, chapter.summary, ...chapter.tags, chapter.slug].join(' ');
  return [
    `<li class="post-card" data-post data-search="${escapeAttr(search)}">`,
    '<div class="post-topline">',
    `<span class="post-number">${escapeHtml(chapter.number)}</span>`,
    `<span class="post-time">${chapter.minutes} min de leitura</span>`,
    '</div>',
    `<h2><a href="./${escapeAttr(chapter.slug)}.html">${escapeHtml(chapter.title)}</a></h2>`,
    `<p>${escapeHtml(chapter.summary)}</p>`,
    `<ul class="post-tags" aria-label="Temas do capítulo">${chapter.tags.map(tag => `<li class="tag">${escapeHtml(tag)}</li>`).join('')}</ul>`,
    '</li>'
  ].join('\n');
}

function renderToc(toc) {
  if (!toc.length) return '';
  return [
    '<aside class="article-toc" aria-labelledby="toc-title">',
    '<h2 id="toc-title">Nesta página</h2>',
    '<nav aria-label="Seções do capítulo"><ol>',
    ...toc.map(item => `<li><a href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a></li>`),
    '</ol></nav>',
    '<a class="toc-back" href="./">Voltar ao blog</a>',
    '</aside>'
  ].join('');
}

function renderPager(chapters, current) {
  const previous = chapters[current.order - 2];
  const next = chapters[current.order];
  return [
    '<nav class="article-nav" aria-label="Navegação entre capítulos">',
    '<div class="pager">',
    previous
      ? `<a class="previous" href="./${escapeAttr(previous.slug)}.html"><small>Capítulo anterior</small><strong>${escapeHtml(previous.title)}</strong></a>`
      : '',
    next
      ? `<a class="next" href="./${escapeAttr(next.slug)}.html"><small>Próximo capítulo</small><strong>${escapeHtml(next.title)}</strong></a>`
      : '',
    '</div>',
    '</nav>'
  ].join('');
}

function renderArticle(chapter, chapters) {
  const { html, toc } = renderMarkdown(chapter.body, 'estudos');
  return [
    '<section class="article-header">',
    '<div class="container">',
    '<ul class="breadcrumb"><li><a href="../">Arquitetura</a></li><li><a href="./">Blog de estudos</a></li><li>Capítulo ' + escapeHtml(chapter.number) + '</li></ul>',
    `<p class="eyebrow">Capítulo ${escapeHtml(chapter.number)} · Série de estudos</p>`,
    `<h1>${escapeHtml(chapter.title)}</h1>`,
    `<p class="lead">${escapeHtml(chapter.summary)}</p>`,
    `<ul class="article-meta" aria-label="Sobre o capítulo"><li>${chapter.minutes} min de leitura</li><li>Base do código: ${CONTENT_BASE}</li><li>Exemplos fictícios</li></ul>`,
    '</div>',
    '</section>',
    '<div class="container article-layout">',
    '<article class="prose">',
    html,
    renderPager(chapters, chapter),
    '<div class="article-cta">',
    '<div><strong>Continue a trilha</strong><p>O próximo capítulo aprofunda um aspecto diferente da mesma aplicação. Você também pode voltar ao mapa de arquitetura.</p></div>',
    '<a class="btn btn-ghost" href="../">Ver arquitetura</a>',
    '</div>',
    '</article>',
    renderToc(toc),
    '</div>'
  ].join('\n');
}

async function copyAssets(outDir) {
  const assets = path.join(outDir, 'assets');
  const mermaid = path.join(assets, 'vendor', 'mermaid');
  await mkdir(path.join(assets, 'fonts'), { recursive: true });
  await mkdir(path.join(assets, 'brand'), { recursive: true });
  await mkdir(mermaid, { recursive: true });
  await cp(path.join(SITE_SRC, 'styles.css'), path.join(assets, 'styles.css'));
  await cp(path.join(SITE_SRC, 'site.js'), path.join(assets, 'site.js'));
  await cp(path.join(SITE_SRC, 'mermaid-init.js'), path.join(assets, 'mermaid-init.js'));
  await cp(path.join(SITE_SRC, 'architecture.js'), path.join(assets, 'architecture.js'));
  await cp(path.join(SITE_SRC, 'vendor', 'mermaid', 'mermaid.min.js'), path.join(mermaid, 'mermaid.min.js'));
  await cp(path.join(SITE_SRC, 'vendor', 'mermaid', 'LICENSE'), path.join(mermaid, 'LICENSE'));
  await cp(path.join(ROOT, 'web', 'brand', 'fonts'), path.join(assets, 'fonts'), { recursive: true });
  await cp(path.join(ROOT, 'web', 'brand', 'runavolt.svg'), path.join(assets, 'brand', 'runavolt.svg'));
  await cp(path.join(ROOT, 'web', 'brand', 'app-512.png'), path.join(assets, 'brand', 'app-512.png'));
}

export async function buildSite({ outDir = DEFAULT_OUT } = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'estudos'), { recursive: true });
  await copyAssets(outDir);

  const chapters = await readChapters();
  const architecture = await readFile(path.join(SITE_SRC, 'architecture.html'), 'utf8');
  const studiesTemplate = await readFile(path.join(SITE_SRC, 'studies.html'), 'utf8');

  const home = await renderPage({
    title: 'Arquitetura do assistente de chamados · Runavolt',
    description: 'Mapa interativo da arquitetura, dos protocolos e dos limites de acesso do assistente de chamados. Documentação estática, sem dados operacionais.',
    canonical: SITE_URL + '/',
    base: './',
    bodyClass: 'page-architecture',
    content: architecture,
    extraHead: '<script defer src="./assets/architecture.js"></script>',
    archCurrent: ' aria-current="page"'
  });
  await writeFile(path.join(outDir, 'index.html'), home, 'utf8');

  const studiesContent = studiesTemplate.replaceAll('{{POSTS}}', chapters.map(renderPostCard).join('\n'))
    .replaceAll('{{POST_COUNT}}', String(chapters.length));
  const studies = await renderPage({
    title: 'Blog de estudos · Runavolt',
    description: 'Trilha didática em oito capítulos sobre negócio, código, dados, HTTP, interface, IA e testes de uma aplicação real.',
    canonical: SITE_URL + '/estudos/',
    base: '../',
    bodyClass: 'page-studies',
    content: studiesContent,
    studiesCurrent: ' aria-current="page"'
  });
  await writeFile(path.join(outDir, 'estudos', 'index.html'), studies, 'utf8');

  for (const chapter of chapters) {
    const page = await renderPage({
      title: `${chapter.title} · Estudos Runavolt`,
      description: truncate(chapter.summary),
      canonical: `${SITE_URL}/estudos/${chapter.slug}.html`,
      base: '../',
      bodyClass: 'page-article',
      content: renderArticle(chapter, chapters),
      extraHead: chapter.hasMermaid
        ? '<script defer src="../assets/vendor/mermaid/mermaid.min.js"></script>\n<script defer src="../assets/mermaid-init.js"></script>'
        : '',
      studiesCurrent: ' aria-current="page"'
    });
    await writeFile(path.join(outDir, 'estudos', `${chapter.slug}.html`), page, 'utf8');
  }

  const notFound = await renderPage({
    title: 'Página não encontrada · Runavolt',
    description: 'A página solicitada não existe na documentação pública.',
    canonical: SITE_URL + '/404.html',
    base: './',
    bodyClass: 'page-not-found',
    content: [
      '<section class="page-hero"><div class="container">',
      '<p class="eyebrow">Erro 404</p>',
      '<h1>Esta página não existe</h1>',
      '<p class="lead">O endereço pode ter mudado ou o link está incompleto. Use a arquitetura ou o blog de estudos para continuar.</p>',
      '<div class="hero-actions"><a class="btn btn-primary" href="./">Ir para a arquitetura</a><a class="btn btn-line" href="./estudos/">Abrir o blog</a></div>',
      '</div></section>'
    ].join('\n')
  });
  await writeFile(path.join(outDir, '404.html'), notFound, 'utf8');

  const urls = [
    SITE_URL + '/',
    SITE_URL + '/estudos/',
    ...chapters.map(chapter => `${SITE_URL}/estudos/${chapter.slug}.html`)
  ];
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`),
    '</urlset>',
    ''
  ].join('\n');
  await writeFile(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8');
  await writeFile(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');
  await writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');

  return { outDir, chapters: chapters.length, pages: chapters.length + 3 };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const outDir = outIndex >= 0 && args[outIndex + 1] ? path.resolve(args[outIndex + 1]) : DEFAULT_OUT;
  const result = await buildSite({ outDir });
  console.log(`Site gerado em ${path.relative(ROOT, result.outDir) || result.outDir} (${result.chapters} capítulos, ${result.pages} páginas).`);
}
