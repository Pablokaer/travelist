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
