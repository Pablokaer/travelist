#!/usr/bin/env node
// Agent-readable public pages (D-081). The web app is client-rendered, so its exported HTML holds
// only a loading spinner until JavaScript runs, and AI agents and crawlers that run none saw an
// empty page. After `expo export`, for each public page of apps/mobile/agent-pages/pages.json:
//   - <page>.md      the page's Markdown (the source file as written);
//   - <page>.html    gains that text as HTML before the app root, removed by an inline script
//                    as soon as JavaScript runs, so people with JavaScript see the app as before;
//   - <page>.var     an Apache type map (mod_negotiation) offering the HTML and the Markdown, so
//                    `Accept: text/markdown` gets Markdown with q-values honoured and Vary: Accept.
// The 404 gets the same: 404.md, 404.var and the text in +not-found.html.
//
// Usage (after `expo export --platform web`, from apps/mobile):
//   node ../../scripts/agent-pages.mjs dist agent-pages
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{ read(path: string): string, write(path: string, text: string): void, exists(path: string): boolean }} PageFiles
 * @typedef {{ pages: Record<string, string>, notFound: string }} AgentPagesManifest
 */

const NOT_FOUND_HTML = '+not-found';
const NOT_FOUND_MARKDOWN = '404';

// Only what the agent-pages sources use; anything else fails the build instead of rendering wrong.
const UNSUPPORTED_LINE = /^(>|\||```|~~~|\d+[.)]\s|[*+]\s|#{4,}|<|\s)/;
const HEADING = /^(#{1,3}) (.+)$/;

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes `text`, then renders **bold** and [links](url). */
function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** One blank-line-separated block of Markdown as HTML. */
function renderBlock(lines) {
  const unsupported = lines.find((line) => UNSUPPORTED_LINE.test(line));
  if (unsupported)
    throw new Error(
      `unsupported Markdown line "${unsupported}"; expected a #–### heading, a "- " list item or paragraph text`,
    );
  const heading = HEADING.exec(lines[0]);
  if (heading && lines.length === 1)
    return `<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`;
  if (lines.every((line) => line.startsWith('- ')))
    return `<ul>${lines.map((line) => `<li>${renderInline(line.slice(2))}</li>`).join('')}</ul>`;
  if (heading || lines.some((line) => line.startsWith('- ')))
    throw new Error(
      `mixed Markdown block "${lines.join('\\n')}"; separate headings, lists and paragraphs with a blank line`,
    );
  return `<p>${renderInline(lines.join(' '))}</p>`;
}

/**
 * Renders the small Markdown subset of the agent-pages sources: #–### headings, paragraphs,
 * "- " lists, **bold** and [links](url). Throws on any other syntax.
 * @param {string} markdown
 * @returns {string}
 * @example markdownToHtml('# Travelist\n\nPlan a **walk**.') // '<h1>Travelist</h1>\n<p>Plan a <strong>walk</strong>.</p>'
 */
export function markdownToHtml(markdown) {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0)
    .map(renderBlock)
    .join('\n');
}

/**
 * The exported file name (without extension) of a route.
 * @param {string} route
 * @returns {string}
 * @example outputName('/') // 'index'
 */
export function outputName(route) {
  if (!route.startsWith('/')) throw new Error(`expected a route starting with "/", got "${route}"`);
  return route === '/' ? 'index' : route.slice(1);
}

/**
 * An Apache type map offering `<htmlName>.html` and `<markdownName>.md`. The HTML has the higher
 * source quality, so `*\/*`, browsers and ties get HTML; Markdown wins only when asked for.
 * @param {string} htmlName
 * @param {string} markdownName
 * @returns {string}
 * @example typeMap('about', 'about') // 'URI: about.html\nContent-Type: text/html; …'
 */
export function typeMap(htmlName, markdownName) {
  return (
    `URI: ${htmlName}.html\nContent-Type: text/html; charset=utf-8; qs=1.0\n\n` +
    `URI: ${markdownName}.md\nContent-Type: text/markdown; charset=utf-8; qs=0.9\n`
  );
}

// Readable without JavaScript (the app's own styles need it): the text scrolls and the spinner
// of the empty app is hidden. Removed with the block when JavaScript runs.
const NO_SCRIPT_STYLE =
  'body{overflow:auto!important}#root{display:none!important}' +
  '#agent-content main{max-width:720px;margin:0 auto;padding:24px 16px;' +
  'font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a}' +
  '#agent-content a{color:#D7383B}';

/** The page's text for readers without JavaScript, and the script that removes it for the app. */
function agentBlock(bodyHtml) {
  return (
    `<div id="agent-content"><style>${NO_SCRIPT_STYLE}</style><main>${bodyHtml}</main></div>` +
    `<script>document.getElementById('agent-content').remove()</script>`
  );
}

/**
 * Adds a page's text to its exported HTML, before the app root, replacing the `<noscript>`
 * summary of app/+html.tsx; links the Markdown version when `markdownHref` is given.
 * @param {string} html
 * @param {{ bodyHtml: string, markdownHref?: string }} content
 * @returns {string}
 * @example injectAgentContent(exported, { bodyHtml: '<h1>About</h1>', markdownHref: '/about.md' })
 */
export function injectAgentContent(html, { bodyHtml, markdownHref }) {
  if (html.includes('id="agent-content"'))
    throw new Error('page already has agent content; run agent-pages once per export');
  if (!html.includes('<body>')) throw new Error(`no <body> in "${html.slice(0, 80)}"`);
  const withoutNoscript = html.replace(/<body>\s*<noscript>[\s\S]*?<\/noscript>/, '<body>');
  const alternate = markdownHref
    ? `<link rel="alternate" type="text/markdown" href="${markdownHref}"/></head>`
    : '</head>';
  return withoutNoscript
    .replace('</head>', alternate)
    .replace('<body>', `<body>${agentBlock(bodyHtml)}`);
}

/** Writes `<markdownName>.md`, `<markdownName>.var` and the enriched `<htmlName>.html`. */
function publishPage(files, distDir, { htmlName, markdownName, markdown, label, linkMarkdown }) {
  const htmlPath = `${distDir}/${htmlName}.html`;
  if (!files.exists(htmlPath)) throw new Error(`no exported page ${htmlPath} for "${label}"`);
  const markdownHref = linkMarkdown ? `/${markdownName}.md` : undefined;
  const html = injectAgentContent(files.read(htmlPath), {
    bodyHtml: markdownToHtml(markdown),
    markdownHref,
  });
  const outputs = {
    [`${distDir}/${markdownName}.md`]: markdown,
    [`${distDir}/${markdownName}.var`]: typeMap(htmlName, markdownName),
    [htmlPath]: html,
  };
  for (const [path, text] of Object.entries(outputs)) files.write(path, text);
  return Object.keys(outputs);
}

/**
 * Publishes the agent versions of the public pages and the 404 into an `expo export` folder.
 * @param {{ distDir: string, contentDir: string, files: PageFiles }} options
 * @returns {string[]} the files written
 * @example publishAgentPages({ distDir: 'dist', contentDir: 'agent-pages', files: new NodeFiles() })
 */
export function publishAgentPages({ distDir, contentDir, files }) {
  /** @type {AgentPagesManifest} */
  const manifest = JSON.parse(files.read(`${contentDir}/pages.json`));
  const source = (name) => files.read(`${contentDir}/${name}`);
  const pages = Object.entries(manifest.pages).flatMap(([route, file]) => {
    const name = outputName(route);
    const page = { htmlName: name, markdownName: name, markdown: source(file), label: route };
    return publishPage(files, distDir, { ...page, linkMarkdown: true });
  });
  const notFound = publishPage(files, distDir, {
    htmlName: NOT_FOUND_HTML,
    markdownName: NOT_FOUND_MARKDOWN,
    markdown: source(manifest.notFound),
    label: 'not found',
    linkMarkdown: false,
  });
  return [...pages, ...notFound];
}

/** The real filesystem, as UTF-8 text. */
export class NodeFiles {
  read(path) {
    return readFileSync(path, 'utf8');
  }
  write(path, text) {
    writeFileSync(path, text);
  }
  exists(path) {
    return existsSync(path);
  }
}

function main([distDir, contentDir]) {
  if (!distDir || !contentDir)
    throw new Error(
      `Usage: agent-pages.mjs <dist-dir> <content-dir> (got ${distDir}, ${contentDir})`,
    );
  const written = publishAgentPages({ distDir, contentDir, files: new NodeFiles() });
  console.log(`agent-pages: wrote ${written.length} files into ${distDir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
