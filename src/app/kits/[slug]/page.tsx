import { Metadata } from 'next';
import KitDetailPage from './KitDetailPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

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
    other: {
      'script:ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: meta.nom,
        description: meta.description,
        brand: {
          '@type': 'Brand',
          name: 'Le Kit du Voyageur',
        },
        url: `${siteUrl}/kits/${slug}`,
      }),
    },
  };
}

export default KitDetailPage;