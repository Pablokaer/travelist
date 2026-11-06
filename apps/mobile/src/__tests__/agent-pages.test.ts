import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PUBLIC_PAGE_PATHS, SITE_KEYWORDS, SITE_URL, siteStructuredData } from '@/lib/seo';

const appFile = (path: string) => readFileSync(join(__dirname, '../..', path), 'utf8');
type AgentPagesManifest = { pages: Record<string, string>; notFound: string };
const manifest = JSON.parse(appFile('agent-pages/pages.json')) as AgentPagesManifest;

describe('agent-pages (D-081)', () => {
  test('every public page, and only those, has a Markdown version', () => {
    expect(Object.keys(manifest.pages).sort()).toEqual([...PUBLIC_PAGE_PATHS].sort());
  });

  test('each Markdown page starts with one H1 and keeps heading levels sequential', () => {
    for (const file of [...Object.values(manifest.pages), manifest.notFound]) {
      const levels = [...appFile(`agent-pages/${file}`).matchAll(/^(#+) /gm)].map(
        (m) => m[1]?.length ?? 0,
      );
      expect(levels[0]).toBe(1);
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      levels
        .slice(1)
        .forEach((level, i) => expect(level).toBeLessThanOrEqual((levels[i] ?? 0) + 1));
    }
  });

  test('the home page has 500+ characters and says the product terms of the structured data', () => {
    const home = appFile(`agent-pages/${manifest.pages['/']}`);
    expect(home.length).toBeGreaterThanOrEqual(500);
    for (const term of SITE_KEYWORDS) expect(home.toLowerCase()).toContain(term);
  });

  test('the 404 explains the error and links llms.txt and the sitemap', () => {
    const notFound = appFile(`agent-pages/${manifest.notFound}`);
    expect(notFound).toContain(`(${SITE_URL}/llms.txt)`);
    expect(notFound).toContain(`(${SITE_URL}/sitemap.xml)`);
  });
});

describe('public/llms.txt (llmstxt.org)', () => {
  const llms = appFile('public/llms.txt');
  const sections = llms.split(/^## /m);

  test('starts with the H1 and the blockquote summary, with no other heading before the H2s', () => {
    expect(llms).toMatch(/^# Travelist\n\n> \S/);
    expect((sections[0] ?? '').match(/^#/gm)).toHaveLength(1);
  });

  test('every H2 section is a file list of [name](url): notes items', () => {
    for (const section of sections.slice(1)) {
      const [, ...body] = section.trim().split('\n');
      const items = body.filter((line) => line.trim() !== '');
      expect(items.length).toBeGreaterThan(0);
      for (const item of items)
        expect(item).toMatch(/^- \[[^\]]+\]\(https:\/\/travelist\.live\/\S*\)(: .+)?$/);
    }
  });

  test('has a "When to use Travelist" section and links every public page in Markdown', () => {
    expect(llms).toMatch(/^## When to use Travelist$/m);
    for (const path of PUBLIC_PAGE_PATHS.filter((p) => p !== '/welcome')) {
      const name = path === '/' ? 'index' : path.slice(1);
      expect(llms).toContain(`(${SITE_URL}/${name}.md)`);
    }
  });
});

describe('siteStructuredData', () => {
  test('names the product terms as WebSite keywords and Organization knowsAbout', () => {
    const graph = JSON.parse(siteStructuredData())['@graph'] as Record<string, unknown>[];
    const website = graph.find((node) => node['@type'] === 'WebSite');
    const organization = graph.find((node) => node['@type'] === 'Organization');
    expect(website?.keywords).toBe(SITE_KEYWORDS.join(', '));
    expect(organization?.knowsAbout).toEqual(SITE_KEYWORDS);
  });
});
