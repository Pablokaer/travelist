#!/usr/bin/env node
// Is the deployed web app readable by AI agents (D-081)? Checks, over HTTP, what agents and
// crawlers that run no JavaScript get: text in the raw HTML, Markdown through content
// negotiation (acceptmarkdown.com: q-values, Vary: Accept, 406), a Markdown 404 and llms.txt.
//
// Usage:
//   node scripts/check-agent-readiness.mjs https://travelist.live
//   node scripts/check-agent-readiness.mjs http://localhost:8080   # a local Apache (README)
// Prints one line per check; exits 1 when any check fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRootOf } from './repo-root.mjs';

/**
 * @typedef {{ get(name: string): string | null }} ResponseHeaders
 * @typedef {{ status: number, headers: ResponseHeaders, body: string }} SiteResponse
 * @typedef {(path: string, accept: string) => Promise<SiteResponse>} FetchPage
 * @typedef {{ name: string, ok: boolean, detail: string }} CheckResult
 * @typedef {{ publicPaths: string[], probePath: string }} ReadinessOptions
 */

const HOME_MIN_TEXT = 500;
const PAGE_MIN_TEXT = 200;
const ERROR_MIN_TEXT = 20;

/**
 * The text a reader without JavaScript sees: no scripts, styles, `<noscript>` or tags.
 * @param {string} html
 * @returns {string}
 * @example visibleText('<p>Lisbon &amp; Porto</p>') // 'Lisbon & Porto'
 */
export function visibleText(html) {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether a Vary header lists Accept (header names are case-insensitive, RFC 9110 §12.5.5).
 * @param {string | null} vary
 * @returns {boolean}
 * @example varyIncludesAccept('accept,Accept-Encoding') // true
 */
export function varyIncludesAccept(vary) {
  if (!vary) return false;
  return vary.split(',').some((name) => name.trim().toLowerCase() === 'accept');
}

const isMarkdown = (res) => /^text\/markdown\b/i.test(res.headers.get('content-type') ?? '');
const isHtml = (res) => /^text\/html\b/i.test(res.headers.get('content-type') ?? '');
const describe = (res) =>
  `HTTP ${res.status}, Content-Type ${res.headers.get('content-type')}, Vary ${res.headers.get('vary')}`;

/** @returns {CheckResult} */
function result(name, ok, detail) {
  return { name, ok, detail };
}

/** @param {FetchPage} fetchPage @returns {Promise<CheckResult>} */
async function checkHomeHtml(fetchPage) {
  const res = await fetchPage('/', 'text/html');
  const chars = visibleText(res.body).length;
  const ok = res.status === 200 && chars >= HOME_MIN_TEXT && /<h1[\s>]/i.test(res.body);
  return result(
    `homepage HTML has ${HOME_MIN_TEXT}+ characters of text and an H1`,
    ok,
    `${chars} characters; ${describe(res)}`,
  );
}

/** @param {FetchPage} fetchPage @param {string} path @returns {Promise<CheckResult>} */
async function checkPageHtml(fetchPage, path) {
  const res = await fetchPage(path, 'text/html');
  const chars = visibleText(res.body).length;
  return result(
    `${path} HTML has ${PAGE_MIN_TEXT}+ characters of text`,
    res.status === 200 && chars >= PAGE_MIN_TEXT,
    `${chars} characters; ${describe(res)}`,
  );
}

/** @param {FetchPage} fetchPage @param {string} path @returns {Promise<CheckResult>} */
async function checkMarkdownVariant(fetchPage, path) {
  const res = await fetchPage(path, 'text/markdown');
  const ok =
    res.status === 200 &&
    isMarkdown(res) &&
    varyIncludesAccept(res.headers.get('vary')) &&
    res.body.trim().length > 0;
  return result(
    `GET ${path} with Accept: text/markdown → Markdown with Vary: Accept`,
    ok,
    describe(res),
  );
}

// acceptmarkdown.com/guides/accept-parsing test vectors: q-values decide, never a substring.
const NEGOTIATION_VECTORS = [
  { accept: 'text/html', expect: 'HTML' },
  { accept: 'text/markdown, text/html;q=0.8', expect: 'Markdown' },
  { accept: 'text/markdown;q=0, text/html', expect: 'HTML' },
  { accept: '*/*', expect: 'HTML' },
  { accept: 'text/markdown;q=0', expect: 'a 406' },
];

/** @param {SiteResponse} res @param {string} expect */
function matchesExpectation(res, expect) {
  if (expect === 'a 406') return res.status === 406;
  const typeOk = expect === 'HTML' ? isHtml(res) : isMarkdown(res);
  return res.status === 200 && typeOk && varyIncludesAccept(res.headers.get('vary'));
}

/** @param {FetchPage} fetchPage @returns {Promise<CheckResult[]>} */
async function checkNegotiation(fetchPage) {
  return Promise.all(
    NEGOTIATION_VECTORS.map(async ({ accept, expect }) => {
      const res = await fetchPage('/', accept);
      return result(
        `GET / with Accept: ${accept} → ${expect}`,
        matchesExpectation(res, expect),
        describe(res),
      );
    }),
  );
}

/** @param {FetchPage} fetchPage @param {string} probePath @returns {Promise<CheckResult[]>} */
async function checkNotFound(fetchPage, probePath) {
  const html = await fetchPage(probePath, 'text/html');
  const md = await fetchPage(probePath, 'text/markdown');
  const linksOut = /\]\([^)]*(llms\.txt|sitemap\.xml)\)/.test(md.body);
  const mdOk = md.status === 404 && isMarkdown(md) && md.body.trim().length >= ERROR_MIN_TEXT;
  return [
    result('unknown path → HTTP 404', html.status === 404, describe(html)),
    result(
      'unknown path with Accept: text/markdown → 404 Markdown linking llms.txt or the sitemap',
      mdOk && linksOut,
      `${describe(md)}; links llms.txt/sitemap: ${linksOut}`,
    ),
  ];
}

/** @param {FetchPage} fetchPage @returns {Promise<CheckResult>} */
async function checkLlmsTxt(fetchPage) {
  const res = await fetchPage('/llms.txt', 'text/plain');
  const ok = res.status === 200 && /^# \S/.test(res.body) && /^## When to use\b/m.test(res.body);
  return result('llms.txt has an H1 and a "When to use" section', ok, describe(res));
}

/**
 * Runs every agent-readiness check against a site.
 * @param {FetchPage} fetchPage
 * @param {ReadinessOptions} options
 * @returns {Promise<CheckResult[]>}
 * @example await checkAgentReadiness(httpFetcher('https://travelist.live'), { publicPaths: ['/'], probePath: '/__x' })
 */
export async function checkAgentReadiness(fetchPage, { publicPaths, probePath }) {
  const innerPaths = publicPaths.filter((path) => path !== '/');
  return [
    await checkHomeHtml(fetchPage),
    ...(await Promise.all(innerPaths.map((path) => checkPageHtml(fetchPage, path)))),
    ...(await Promise.all(publicPaths.map((path) => checkMarkdownVariant(fetchPage, path)))),
    ...(await checkNegotiation(fetchPage)),
    ...(await checkNotFound(fetchPage, probePath)),
    await checkLlmsTxt(fetchPage),
  ];
}

/**
 * Fetches pages of `baseUrl` with a given Accept header, following redirects.
 * @param {string} baseUrl
 * @returns {FetchPage}
 */
export function httpFetcher(baseUrl) {
  return async (path, accept) => {
    const res = await fetch(new URL(path, baseUrl), { headers: { Accept: accept } });
    return { status: res.status, headers: res.headers, body: await res.text() };
  };
}

/** The public pages listed in the agent-pages manifest (apps/mobile/agent-pages/pages.json). */
function manifestPublicPaths() {
  const manifest = join(repoRootOf(import.meta.url), 'apps/mobile/agent-pages/pages.json');
  return Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).pages);
}

async function main([baseUrl]) {
  if (!baseUrl) throw new Error(`Usage: check-agent-readiness.mjs <base-url> (got ${baseUrl})`);
  const probePath = `/__agent-readiness-probe-${Date.now().toString(36)}`;
  const options = { publicPaths: manifestPublicPaths(), probePath };
  const results = await checkAgentReadiness(httpFetcher(baseUrl), options);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed
      ? `${failed} of ${results.length} checks failed.`
      : `All ${results.length} checks passed.`,
  );
  if (failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
