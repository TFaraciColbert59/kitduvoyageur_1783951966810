import { Metadata } from 'next';
import GuideDetailClient from './GuideDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${title} — Guides Le Kit du Voyageur`,
    description: `Guide de voyage complet : ${title}. Conseils d'experts, checklists et équipement recommandé.`,
    alternates: {
      canonical: `${siteUrl}/guides/${slug}`,
    },
    openGraph: {
      title: `${title} — Guides Le Kit du Voyageur`,
      description: `Guide de voyage complet : ${title}. Conseils d'experts, checklists et équipement recommandé.`,
      url: `${siteUrl}/guides/${slug}`,
      type: 'article',
    },
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${siteUrl}/guides/${slug}#article`,
        headline: title,
        description: `Guide de voyage complet : ${title}. Conseils d'experts, checklists et équipement recommandé.`,
        url: `${siteUrl}/guides/${slug}`,
        image: `${siteUrl}/assets/images/og-image.png`,
        author: {
          '@type': 'Organization',
          name: 'Le Kit du Voyageur',
          url: siteUrl,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Le Kit du Voyageur',
          url: siteUrl,
        },
        isPartOf: {
          '@type': 'WebPage',
          '@id': `${siteUrl}/guides/${slug}#webpage`,
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${siteUrl}/guides/${slug}#webpage`,
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}/guides/${slug}#webpage`,
        name: `${title} — Guides Le Kit du Voyageur`,
        description: `Guide de voyage complet : ${title}. Conseils d'experts, checklists et équipement recommandé.`,
        url: `${siteUrl}/guides/${slug}`,
        isPartOf: { '@id': `${siteUrl}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteUrl}/guides/${slug}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${siteUrl}/guides` },
          { '@type': 'ListItem', position: 3, name: title, item: `${siteUrl}/guides/${slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        suppressHydrationWarning
      />
      <GuideDetailClient slug={slug} />
    </>
  );
}
