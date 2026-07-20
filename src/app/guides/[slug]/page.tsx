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

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${title} — Guides Le Kit du Voyageur`,
    description: `Guide de voyage complet : ${title}. Conseils d'experts, checklists et équipement recommandé.`,
    url: `${siteUrl}/guides/${slug}`,
    isPartOf: {
      '@type': 'WebSite',name: 'Le Kit du Voyageur',
      url: siteUrl,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides',
        item: `${siteUrl}/guides`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: `${siteUrl}/guides/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        suppressHydrationWarning
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        suppressHydrationWarning
      />
      <GuideDetailClient slug={slug} />
    </>
  );
}
