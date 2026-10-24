import type { CarnetDetail } from './types';

/** Échappe le JSON pour un `<script type="application/ld+json">` inline. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildCarnetJsonLd(detail: CarnetDetail, siteUrl: string) {
  const url = `${siteUrl}/carnets/${detail.id}`;
  const work: Record<string, unknown> = {
    '@type': 'CreativeWork',
    '@id': `${url}#carnet`,
    name: detail.title,
    url,
    ...(detail.description ? { description: detail.description } : {}),
    ...(detail.coverImage ? { image: detail.coverImage } : {}),
    ...(detail.startDate ? { datePublished: detail.startDate } : {}),
    ...(detail.author
      ? {
          author: {
            '@type': 'Person',
            name: detail.author.name,
            ...(detail.author.handle ? { alternateName: `@${detail.author.handle}` } : {}),
          },
        }
      : {}),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      work,
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Carnets', item: `${siteUrl}/carnets` },
          { '@type': 'ListItem', position: 3, name: detail.title, item: url },
        ],
      },
    ],
  };
}
