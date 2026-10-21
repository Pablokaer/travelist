import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import type { ReactElement } from 'react';
import { Platform } from 'react-native';

import { pageSeo } from '@/lib/seo';

/**
 * The current page's title, description, canonical URL and robots tag in the web `<head>` (D-079).
 * Rendered by the root layout before it waits for the session, so the static export writes them
 * into every page's HTML. Site-wide tags (icons, preview image) are in `app/+html.tsx`.
 * @example <RouteHead /> // on /about: <title>About Travelist — …</title>, canonical …/about
 */
export function RouteHead(): ReactElement | null {
  const seo = pageSeo(usePathname());
  if (Platform.OS !== 'web') return null;
  return (
    <Head>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="robots" content={seo.indexable ? 'index, follow' : 'noindex, follow'} />
      <link rel="canonical" href={seo.canonicalUrl} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={seo.canonicalUrl} />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
    </Head>
  );
}
