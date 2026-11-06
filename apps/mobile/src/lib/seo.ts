/** Public site origin: canonical URLs, the sitemap and link previews are absolute (D-073). */
export const SITE_URL = 'https://travelist.live';

/** Title of every page that is not public, and the suffix of the public ones. */
export const SITE_NAME = 'Travelist';

/** What search engines and link previews read about one page of the web app (D-079). */
export type PageSeo = {
  title: string;
  description: string;
  canonicalUrl: string;
  /** false → `noindex`: signed-in, personal and one-off pages stay out of search results. */
  indexable: boolean;
};

type PublicPageCopy = Pick<PageSeo, 'title' | 'description'>;

const LANDING_COPY: PublicPageCopy = {
  title: 'Travelist — Turn any city into your personal travel list',
  description:
    'Discover the best places in cities around the world, build your own travel lists, see them on a map and follow a walking route, all in one app.',
};

// The pages a signed-out visitor can open; public/sitemap.xml lists exactly these (seo.test.ts).
const PUBLIC_PAGES: Readonly<Record<string, PublicPageCopy>> = {
  '/': LANDING_COPY,
  '/welcome': LANDING_COPY,
  '/about': {
    title: 'About Travelist — where our travel data comes from',
    description:
      'Travelist is built on open data: places from OpenStreetMap and Wikidata, photos from Wikimedia Commons, history from Wikipedia and maps from OpenFreeMap.',
  },
  '/sign-up': {
    title: 'Create your free account — Travelist',
    description:
      'Sign up for Travelist to explore cities, save the places you want to visit and plan walking routes for your next trip.',
  },
  '/sign-in': {
    title: 'Log in — Travelist',
    description:
      'Log in to Travelist to open your travel lists, saved walks and trips, on the web or in the app.',
  },
};

export const PUBLIC_PAGE_PATHS: readonly string[] = Object.keys(PUBLIC_PAGES);

/**
 * Title, description, canonical URL and indexing of the page at `pathname` (D-079).
 * @example pageSeo('/about').canonicalUrl // 'https://travelist.live/about'
 */
export function pageSeo(pathname: string): PageSeo {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const canonicalUrl = `${SITE_URL}${path}`;
  const copy = PUBLIC_PAGES[path];
  if (!copy)
    return {
      title: SITE_NAME,
      description: LANDING_COPY.description,
      canonicalUrl,
      indexable: false,
    };
  return { ...copy, canonicalUrl, indexable: true };
}

/**
 * What Travelist is, in the words people search for with the brand (D-081). Search engines and
 * agent-readiness audits read them from the structured data; each must also appear in the home
 * page text (agent-pages/home.md, checked by agent-pages.test.ts).
 */
export const SITE_KEYWORDS: readonly string[] = [
  'travel list app',
  'city guide',
  'walking route planner',
];

/**
 * The schema.org `WebSite` + `Organization` JSON-LD of every page (D-079), with the product
 * terms as `keywords` / `knowsAbout` (D-081).
 * @example <script type="application/ld+json">{siteStructuredData()}</script>
 */
export function siteStructuredData(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: LANDING_COPY.description,
        keywords: SITE_KEYWORDS.join(', '),
      },
      {
        '@type': 'Organization',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
        knowsAbout: SITE_KEYWORDS,
      },
    ],
  });
}
