// Run: node --test scripts/
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkAgentReadiness, varyIncludesAccept, visibleText } from './check-agent-readiness.mjs';

const MARKDOWN = 'text/markdown; charset=utf-8';
const HTML = 'text/html; charset=utf-8';
const LONG_TEXT = 'Travelist turns any city into your personal travel list. '.repeat(12);

/**
 * A site that answers like travelist.live should once Markdown negotiation is live (D-081).
 * Tests break one behaviour at a time with `override`.
 */
class FakeSite {
  constructor() {
    /** @type {Map<string, { status: number, type: string, vary?: string, body: string }>} */
    this.overrides = new Map();
    this.fetchPage = this.fetchPage.bind(this);
  }

  override(path, accept, response) {
    this.overrides.set(`${path} ${accept}`, response);
    return this;
  }

  async fetchPage(path, accept) {
    const reply = this.overrides.get(`${path} ${accept}`) ?? this.answer(path, accept);
    const headers = new Map([
      ['content-type', reply.type],
      ['vary', reply.vary ?? 'accept,Accept-Encoding'],
    ]);
    return {
      status: reply.status,
      headers: { get: (n) => headers.get(n) ?? null },
      body: reply.body,
    };
  }

  answer(path, accept) {
    if (path === '/llms.txt')
      return { status: 200, type: 'text/plain', body: '# Travelist\n\n## When to use Travelist\n' };
    const known = ['/', '/about', '/about.md'].includes(path);
    const wantsMarkdown = /^text\/markdown(?!;q=0(\.0*)?\b)/.test(accept) || path.endsWith('.md');
    if (accept === 'text/markdown;q=0') return { status: 406, type: HTML, body: 'Not acceptable' };
    if (wantsMarkdown)
      return known
        ? { status: 200, type: MARKDOWN, body: `# Travelist\n\n${LONG_TEXT}` }
        : { status: 404, type: MARKDOWN, body: '# Not found\n\nSee [llms.txt](/llms.txt).' };
    const page = `<html><body><main><h1>Travelist</h1><p>${LONG_TEXT}</p></main><div id="root"></div></body></html>`;
    return known
      ? { status: 200, type: HTML, body: page }
      : { status: 404, type: HTML, body: page };
  }
}

const OPTIONS = { publicPaths: ['/', '/about'], probePath: '/__probe' };
const failures = (results) => results.filter((r) => !r.ok).map((r) => r.name);

test('visibleText drops scripts, styles, noscript and tags, and collapses whitespace', () => {
  const html =
    '<head><style>p{}</style><script>var x = "hidden";</script></head>' +
    '<body><noscript>Enable JS</noscript><h1>Travel &amp; lists</h1>\n<p>Lisbon</p></body>';
  assert.equal(visibleText(html), 'Travel & lists Lisbon');
});

test('varyIncludesAccept matches the Accept token in any case, not Accept-Encoding alone', () => {
  assert.equal(varyIncludesAccept('accept,Accept-Encoding'), true);
  assert.equal(varyIncludesAccept('Accept-Encoding, Accept'), true);
  assert.equal(varyIncludesAccept('Accept-Encoding'), false);
  assert.equal(varyIncludesAccept(null), false);
});

test('a site that negotiates Markdown and serves text in its HTML passes every check', async () => {
  const results = await checkAgentReadiness(new FakeSite().fetchPage, OPTIONS);
  assert.deepEqual(failures(results), []);
  assert.ok(results.length >= 10, `expected at least 10 checks, got ${results.length}`);
});

test('an app shell with an empty root fails the content check', async () => {
  const site = new FakeSite().override('/', 'text/html', {
    status: 200,
    type: HTML,
    body: '<html><body><div id="root"></div><script src="/app.js"></script></body></html>',
  });
  assert.deepEqual(failures(await checkAgentReadiness(site.fetchPage, OPTIONS)), [
    'homepage HTML has 500+ characters of text and an H1',
  ]);
});

test('HTML returned for Accept: text/markdown fails the homepage negotiation check', async () => {
  const site = new FakeSite().override('/', 'text/markdown', {
    status: 200,
    type: HTML,
    vary: 'accept-encoding',
    body: '<html></html>',
  });
  assert.deepEqual(failures(await checkAgentReadiness(site.fetchPage, OPTIONS)), [
    'GET / with Accept: text/markdown → Markdown with Vary: Accept',
  ]);
});

test('Markdown served to a client that refused it (q=0) fails', async () => {
  const accept = 'text/markdown;q=0, text/html';
  const site = new FakeSite().override('/', accept, { status: 200, type: MARKDOWN, body: '# T' });
  assert.deepEqual(failures(await checkAgentReadiness(site.fetchPage, OPTIONS)), [
    `GET / with Accept: ${accept} → HTML`,
  ]);
});

test('a 404 without a Markdown body fails the agent-friendly 404 check', async () => {
  const site = new FakeSite().override('/__probe', 'text/markdown', {
    status: 404,
    type: HTML,
    body: '<html></html>',
  });
  assert.deepEqual(failures(await checkAgentReadiness(site.fetchPage, OPTIONS)), [
    'unknown path with Accept: text/markdown → 404 Markdown linking llms.txt or the sitemap',
  ]);
});

test('llms.txt without when-to-use guidance fails', async () => {
  const site = new FakeSite().override('/llms.txt', 'text/plain', {
    status: 200,
    type: 'text/plain',
    body: '# Travelist\n',
  });
  assert.deepEqual(failures(await checkAgentReadiness(site.fetchPage, OPTIONS)), [
    'llms.txt has an H1 and a "When to use" section',
  ]);
});
