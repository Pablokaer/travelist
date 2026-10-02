// Links to Wikipedia articles (attraction pages, the city page "About" attribution, D-036).

export type WikipediaArticle = { language: 'en' | 'pt'; title: string };

/**
 * @example wikipediaUrl({ language: 'pt', title: 'Torre de Belém' })
 * // 'https://pt.wikipedia.org/wiki/Torre_de_Bel%C3%A9m'
 */
export function wikipediaUrl(article: WikipediaArticle): string {
  const path = encodeURIComponent(article.title.replace(/ /g, '_'));
  return `https://${article.language}.wikipedia.org/wiki/${path}`;
}

/**
 * The article in the app language when there is one, else the other language's.
 * @example preferredArticle('pt', 'Lisbon', null) // { language: 'en', title: 'Lisbon' }
 */
export function preferredArticle(
  language: string,
  titleEn: string | null,
  titlePt: string | null,
): WikipediaArticle | null {
  if (language === 'pt' && titlePt) return { language: 'pt', title: titlePt };
  if (titleEn) return { language: 'en', title: titleEn };
  return titlePt ? { language: 'pt', title: titlePt } : null;
}
