import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren, ReactElement } from 'react';

import { SITE_NAME, SITE_URL, siteStructuredData } from '@/lib/seo';

// Link-preview crawlers need absolute image URLs (D-073).
const PREVIEW_IMAGE = `${SITE_URL}/og-image.png`;

// Who publishes the site and what it is, for search engines' knowledge panel and site name
// (D-079) and the product terms searched with the brand (D-081).
const STRUCTURED_DATA = siteStructuredData();

/**
 * Root HTML of the static web export: favicon, home-screen icons, the link-preview image and
 * structured data. Each page's title, description and canonical URL come from `RouteHead`.
 */
export default function RootHtml({ children }: PropsWithChildren): ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#D7383B" />

        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:image" content={PREVIEW_IMAGE} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Travelist logo: a white swallow on a red tile" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={PREVIEW_IMAGE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} />

        <ScrollViewStyleReset />
      </head>
      <body>
        {/* For browsers without JavaScript: the app itself is client-rendered. On the public
          pages and the 404, scripts/agent-pages.mjs replaces this with the page's full text
          after the export (D-081). */}
        <noscript>
          <h1>Travelist — turn any city into your personal travel list</h1>
          <p>
            Discover the best places in cities around the world, build your own travel lists, see
            them on a map and follow a walking route. Travelist needs JavaScript to run.
          </p>
          <a href="/welcome">Home</a> · <a href="/about">About</a> ·{' '}
          <a href="/sign-up">Create an account</a>
        </noscript>
        {children}
      </body>
    </html>
  );
}
