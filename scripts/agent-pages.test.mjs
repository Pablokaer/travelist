// Run: node --test scripts/
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  injectAgentContent,
  markdownToHtml,
  outputName,
  publishAgentPages,
  typeMap,
} from './agent-pages.mjs';

/** An in-memory folder tree standing in for the export and the Markdown sources. */
class MemoryFiles {
  constructor(entries) {
    this.entries = new Map(Object.entries(entries));
  }
  read(path) {
    const text = this.entries.get(path);
    if (text === undefined) throw new Error(`MemoryFiles: no file at ${path}`);
    return text;
  }
  write(path, text) {
    this.entries.set(path, text);
  }
  exists(path) {
    return this.entries.has(path);
  }
}

const EXPORTED_PAGE =
  '<!DOCTYPE html><html lang="en"><head><title>T</title></head>' +
  '<body><noscript><h1>Old summary</h1></noscript><div id="root"><div>Loading…</div></div>' +
  '<script src="/_expo/entry.js" defer></script></body></html>';

test('markdownToHtml renders headings, paragraphs, lists, links and bold, escaping HTML', () => {
  const markdown = [
    '# Travelist & you',
    '',
    'Plan a **walk** in',
    '[Lisbon](https://travelist.live/sign-up).',
    '',
    '## Steps',
    '',
    '- Pick a <city>',
    '- Follow the route',
  ].join('\n');
  assert.equal(
    markdownToHtml(markdown),
    '<h1>Travelist &amp; you</h1>\n' +
      '<p>Plan a <strong>walk</strong> in <a href="https://travelist.live/sign-up">Lisbon</a>.</p>\n' +
      '<h2>Steps</h2>\n' +
      '<ul><li>Pick a &lt;city&gt;</li><li>Follow the route</li></ul>',
  );
});

test('markdownToHtml rejects syntax it does not render, naming the line', () => {
  assert.throws(() => markdownToHtml('# T\n\n> quoted'), /unsupported Markdown line "> quoted"/);
  assert.throws(() => markdownToHtml('1. first'), /unsupported Markdown line "1. first"/);
});

test('outputName maps a route to its exported file name', () => {
  assert.equal(outputName('/'), 'index');
  assert.equal(outputName('/sign-in'), 'sign-in');
  assert.throws(() => outputName('about'), /expected a route starting with "\/", got "about"/);
});

test('typeMap offers the HTML page first and the Markdown at a lower source quality', () => {
  assert.equal(
    typeMap('about', 'about'),
    'URI: about.html\nContent-Type: text/html; charset=utf-8; qs=1.0\n\n' +
      'URI: about.md\nContent-Type: text/markdown; charset=utf-8; qs=0.9\n',
  );
});

test('injectAgentContent puts the text before the app root and drops the noscript summary', () => {
  const html = injectAgentContent(EXPORTED_PAGE, {
    bodyHtml: '<h1>Travelist</h1>',
    markdownHref: '/about.md',
  });
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/about.md"\/><\/head>/);
  assert.match(html, /<body><div id="agent-content">.*<main><h1>Travelist<\/h1><\/main><\/div>/);
  assert.match(
    html,
    /<script>document.getElementById\('agent-content'\).remove\(\)<\/script><div id="root">/,
  );
  assert.doesNotMatch(html, /noscript|Old summary/);
});

test('injectAgentContent refuses a page it has already processed or that has no body', () => {
  const once = injectAgentContent(EXPORTED_PAGE, { bodyHtml: '<p>x</p>' });
  assert.throws(
    () => injectAgentContent(once, { bodyHtml: '<p>x</p>' }),
    /already has agent content/,
  );
  assert.throws(
    () => injectAgentContent('<html></html>', { bodyHtml: '' }),
    /no <body> in "<html><\/html>"/,
  );
});

test('publishAgentPages writes Markdown, type maps and enriched HTML for each public page and the 404', () => {
  const files = new MemoryFiles({
    'content/pages.json': JSON.stringify({
      pages: { '/': 'home.md', '/about': 'about.md' },
      notFound: 'not-found.md',
    }),
    'content/home.md': '# Home\n\nWelcome.',
    'content/about.md': '# About\n\nOpen data.',
    'content/not-found.md': '# Not found\n\nSee [llms.txt](/llms.txt).',
    'dist/index.html': EXPORTED_PAGE,
    'dist/about.html': EXPORTED_PAGE,
    'dist/+not-found.html': EXPORTED_PAGE,
  });
  const written = publishAgentPages({ distDir: 'dist', contentDir: 'content', files });
  assert.deepEqual(written.sort(), [
    'dist/+not-found.html',
    'dist/404.md',
    'dist/404.var',
    'dist/about.html',
    'dist/about.md',
    'dist/about.var',
    'dist/index.html',
    'dist/index.md',
    'dist/index.var',
  ]);
  assert.equal(files.read('dist/about.md'), '# About\n\nOpen data.');
  assert.match(files.read('dist/about.html'), /<main><h1>About<\/h1>\n<p>Open data.<\/p><\/main>/);
  assert.match(files.read('dist/404.var'), /^URI: \+not-found\.html\n/);
  assert.match(files.read('dist/+not-found.html'), /<h1>Not found<\/h1>/);
});

test('publishAgentPages fails when the export lacks a page the manifest lists', () => {
  const files = new MemoryFiles({
    'content/pages.json': JSON.stringify({ pages: { '/gone': 'home.md' }, notFound: 'n.md' }),
    'content/home.md': '# Home',
  });
  assert.throws(
    () => publishAgentPages({ distDir: 'dist', contentDir: 'content', files }),
    /no exported page dist\/gone.html for "\/gone"/,
  );
});
