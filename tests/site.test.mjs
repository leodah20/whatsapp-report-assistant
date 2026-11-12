import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildSite } from '../scripts/build-site.mjs';

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function assertInternalLinksExist(file, html) {
  const root = path.resolve(path.dirname(file));
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|#)/.test(href)) continue;
    const clean = decodeURIComponent(href.split('#')[0].split('?')[0]);
    if (!clean) continue;
    let target = path.resolve(root, clean);
    if (existsSync(target) && statSync(target).isDirectory()) target = path.join(target, 'index.html');
    assert.ok(existsSync(target), `${path.basename(file)} aponta para ${href}, que não existe`);
  }
}

test('gera o site público de arquitetura e estudos sem dados operacionais', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'runavolt-site-'));
  try {
    const result = await buildSite({ outDir });
    assert.equal(result.chapters, 8);
    assert.equal(result.pages, 11);

    const files = walk(outDir);
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    assert.equal(htmlFiles.length, 11);

    for (const required of ['index.html', '404.html', 'estudos/index.html', 'robots.txt', 'sitemap.xml', '.nojekyll']) {
      assert.ok(existsSync(path.join(outDir, required)), `faltou ${required}`);
    }

    const home = readFileSync(path.join(outDir, 'index.html'), 'utf8');
    const studies = readFileSync(path.join(outDir, 'estudos', 'index.html'), 'utf8');
    assert.match(home, /id="arch-tabs"/);
    assert.match(home, /assets\/architecture\.js/);
    assert.match(home, /https:\/\/github\.com\/leodah20\/whatsapp-report-assistant/);
    assert.match(studies, /data-post-search/);
    assert.equal((studies.match(/class="post-card"/g) || []).length, 8);

    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf8');
      assert.doesNotMatch(html, /\{\{|\}\}/, `${path.basename(file)} manteve placeholder`);
      assert.doesNotMatch(html, /<script[^>]+src="https?:/i, `${path.basename(file)} carrega script externo`);
      assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="https?:/i, `${path.basename(file)} carrega estilo externo`);
      assertInternalLinksExist(file, html);
    }

    for (const chapter of readdirSync(path.join(outDir, 'estudos')).filter(file => /^\d{2}-.*\.html$/.test(file))) {
      const html = readFileSync(path.join(outDir, 'estudos', chapter), 'utf8');
      assert.match(html, /class="article-toc"/, `${chapter} sem sumário`);
      assert.match(html, /class="article-nav"/, `${chapter} sem navegação entre capítulos`);
      assert.match(html, /https:\/\/github\.com\/leodah20\/whatsapp-report-assistant/, `${chapter} sem link para o código`);
    }

    const httpChapter = readFileSync(path.join(outDir, 'estudos', '04-http-apis-e-redes.html'), 'utf8');
    assert.match(httpChapter, /blob\/main\/src\/app\.mjs/);
    assert.match(httpChapter, /language-mermaid/);
    assert.match(httpChapter, /Origem → destino/);

    const architectureScript = readFileSync(path.join(outDir, 'assets', 'architecture.js'), 'utf8');
    const siteScript = readFileSync(path.join(outDir, 'assets', 'site.js'), 'utf8');
    assert.doesNotMatch(architectureScript, /\bfetch\s*\(|XMLHttpRequest/);
    assert.doesNotMatch(siteScript, /\bfetch\s*\(|XMLHttpRequest/);

    const sitemap = readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
    assert.equal((sitemap.match(/<url>/g) || []).length, 10);
    assert.match(readFileSync(path.join(outDir, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/leodah20\.github\.io\/whatsapp-report-assistant\/sitemap\.xml/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
