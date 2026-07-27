import { Metadata, ResolvingMetadata } from 'next';

import CarnetView from '@/components/carnet/CarnetView';
import LocalCarnetRenderer from '@/components/carnets/LocalCarnetRenderer';
import { createClient } from '@/lib/supabase/server';
import { getCarnetComplet } from '@/lib/queries/carnet';

interface Props {
  params: Promise<{ id: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

/**
 * Generate static params for public carnets
 * Enables ISR with revalidate: 3600 (1 hour)
 */
export async function generateStaticParams() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('carnets')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(200);

    return (data || []).map((c) => ({
      id: c.id,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: carnet } = await supabase
      .from('carnets')
      .select('id, title, description, destination, cover_image, visibility, created_at')
      .eq('id', id)
      .maybeSingle();

    if (!carnet) {
      return {
        title: 'Carnet introuvable',
        robots: { index: false, follow: false },
      };
    }

    const title = `${carnet.title || 'Carnet de voyage'} — Le Kit du Voyageur`;
    const description = carnet.description
      ? carnet.description.slice(0, 160)
      : `Carnet d'expédition outdoor ${carnet.destination ? `vers ${carnet.destination}` : ''} — Le Kit du Voyageur`;

    const ogImage = carnet.cover_image || '/assets/images/og-image.png';
    const canonicalUrl = `${siteUrl}/carnets/${id}`;

    // TODO produit: décider si les carnets partagés doivent être indexables
    const isPublic = (carnet as any).is_public === true || carnet.visibility === 'public';
    const robots = isPublic
      ? { index: true, follow: true }
      : { index: false, follow: false };

    return {
      title,
      description,
      robots,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        type: 'article',
        title,
        description,
        url: canonicalUrl,
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: carnet.title || 'Carnet de voyage',
          },
        ],
        siteName: 'Le Kit du Voyageur',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: 'Carnet de voyage — Le Kit du Voyageur',
      robots: { index: false, follow: false },
    };
  }
}

export default async function CarnetDetailPage({ params }: Props) {
  const { id } = await params;
  const carnetData = await getCarnetComplet(id);

  if (!carnetData) {
    return <LocalCarnetRenderer id={id} />;
  }

  const canonicalUrl = `${siteUrl}/carnets/${id}`;

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        '@id': `${canonicalUrl}#carnet`,
        name: `${carnetData.meta.titleLine1} ${carnetData.meta.titleLine2}`.trim(),
        description: carnetData.meta.subtitleLine1 || 'Carnet d\'expédition outdoor',
        url: canonicalUrl,
        image: '/assets/images/og-image.png',
        author: {
          '@type': 'Organization',
          name: 'Le Kit du Voyageur',
          url: siteUrl,
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
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
            name: 'Carnets',
            item: `${siteUrl}/carnets`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: carnetData.meta.titleLine1 || 'Carnet',
            item: canonicalUrl,
          },
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
      <CarnetView data={carnetData} />
    </>
  );
}

// ISR: Revalidate every hour
export const revalidate = 3600;
