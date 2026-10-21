import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PUBLIC_PAGE_PATHS, SITE_URL, pageSeo } from '@/lib/seo';

const publicFile = (name: string) => readFileSync(join(__dirname, '../../public', name), 'utf8');

describe('pageSeo', () => {
  test('a public page gets its own title, description and self-referencing canonical URL', () => {
    const about = pageSeo('/about');
    expect(about.title).toMatch(/Travelist/);
    expect(about.title).not.toBe(pageSeo('/welcome').title);
    expect(about.description.length).toBeGreaterThan(50);
    expect(about.description.length).toBeLessThanOrEqual(160);
    expect(about.canonicalUrl).toBe(`${SITE_URL}/about`);
    expect(about.indexable).toBe(true);
  });

  test('the home page canonical URL is the bare origin with a trailing slash', () => {
    expect(pageSeo('/').canonicalUrl).toBe(`${SITE_URL}/`);
  });

  test('a trailing slash leads to the same page', () => {
    expect(pageSeo('/about/')).toEqual(pageSeo('/about'));
  });

  test('signed-in and personal pages are kept out of search results', () => {
    for (const path of ['/trips', '/trip/abc', '/profile', '/shared', '/auth/callback', '/x']) {
      const seo = pageSeo(path);
      expect(seo.indexable).toBe(false);
      expect(seo.title).toBe('Travelist');
    }
  });

  test('every public page fits in a search result: title ≤ 60, description ≤ 160 characters', () => {
    for (const path of PUBLIC_PAGE_PATHS) {
      expect(pageSeo(path).title.length).toBeLessThanOrEqual(60);
      expect(pageSeo(path).description.length).toBeLessThanOrEqual(160);
    }
  });
});

describe('public/sitemap.xml and public/robots.txt', () => {
  test('the sitemap lists exactly the public pages', () => {
    const listed = [...publicFile('sitemap.xml').matchAll(/<loc>(.+?)<\/loc>/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual(PUBLIC_PAGE_PATHS.map((p) => pageSeo(p).canonicalUrl).sort());
  });

  test('robots.txt points crawlers at the sitemap and hides the router debug page', () => {
    const robots = publicFile('robots.txt');
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(robots).toContain('Disallow: /_sitemap');
  });
});
