import { Metadata } from 'next';
import KitDetailPage from './KitDetailPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

const KIT_META: Record<string, { nom: string; description: string; destination: string }> = {
  'islande-trek': {
    nom: 'Kit Islande — Trek & Volcans',
    description: 'Équipement complet pour affronter les conditions extrêmes islandaises : vent violent, pluie horizontale, froid et terrains volcaniques.',
    destination: 'Islande',
  },
  'gr20-corse': {
    nom: 'Kit GR20 — Corse Intégrale',
    description: 'Le kit optimisé pour le GR20, l\'un des sentiers les plus exigeants d\'Europe. 180 km en autonomie complète.',
    destination: 'Corse',
  },
  'vanlife-europe': {
    nom: 'Kit Vanlife — Europe',
    description: 'Tout ce qu\'il faut pour vivre et dormir dans son van à travers l\'Europe. Compact, fonctionnel, durable.',
    destination: 'Europe',
  },
};

export async function generateStaticParams() {
  return Object.keys(KIT_META).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = KIT_META[slug];

  if (!meta) {
    return {
      title: 'Kit de voyage — Le Kit du Voyageur',
      description: 'Découvrez nos kits de voyage complets pour toutes les destinations.',
    };
  }

  return {
    title: `${meta.nom} — Équipement outdoor`,
    description: meta.description,
    alternates: {
      canonical: `${siteUrl}/kits/${slug}`,
    },
    openGraph: {
      title: `${meta.nom} | Le Kit du Voyageur`,
      description: meta.description,
      url: `${siteUrl}/kits/${slug}`,
      images: [
        {
          url: '/assets/images/app_logo.png',
          width: 1200,
          height: 630,
          alt: `${meta.nom} — Le Kit du Voyageur`,
        },
      ],
    },
  };
}

export default async function KitDetailPageWrapper({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = KIT_META[slug];

  if (!meta) {
    return <KitDetailPage params={params as any} />;
  }

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: meta.nom,
    description: meta.description,
    url: `${siteUrl}/kits/${slug}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Le Kit du Voyageur',
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
        name: 'Kits',
        item: `${siteUrl}/kits`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: meta.nom,
        item: `${siteUrl}/kits/${slug}`,
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
      <KitDetailPage params={params as any} />
    </>
  );
}