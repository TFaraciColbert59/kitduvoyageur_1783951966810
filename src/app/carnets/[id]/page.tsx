import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import CarnetProfileView from '@/components/carnet/profile/CarnetProfileView';
import { getCarnetDetail } from '@/features/carnet/detail/getCarnetDetail';
import { buildCarnetJsonLd, serializeJsonLd } from '@/features/carnet/detail/jsonld';

interface Props {
  params: Promise<{ id: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

/** Une seule lecture par requête, partagée entre `generateMetadata` et la page. */
const loadCarnet = cache(getCarnetDetail);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadCarnet(id);

  if (!detail) {
    return { title: 'Carnet introuvable', robots: { index: false, follow: false } };
  }

  const title = `${detail.title} — Le Kit du Voyageur`;
  const description =
    detail.description ??
    `Carnet d'expédition outdoor${detail.destination ? ` — ${detail.destination}` : ''} — Le Kit du Voyageur`;
  const canonical = `${siteUrl}/carnets/${detail.id}`;
  const images = detail.coverImage
    ? [{ url: detail.coverImage, alt: detail.coverImageAlt ?? detail.title }]
    : [{ url: '/assets/images/og-image.png', width: 1200, height: 630, alt: detail.title }];

  return {
    title,
    description,
    alternates: { canonical },
    robots: detail.isPublic ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      siteName: 'Le Kit du Voyageur',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function CarnetDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await loadCarnet(id);

  // Vrai 404 : l'ancienne fiche rendait un brouillon local et répondait 200.
  if (!detail) notFound();

  return (
    <>
      {detail.isPublic ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildCarnetJsonLd(detail, siteUrl)) }}
        />
      ) : null}
      <CarnetProfileView detail={detail} />
    </>
  );
}

// Rendu dynamique requis : la lecture passe par `cookies()` (session + RLS).
// En ISR, `DYNAMIC_SERVER_USAGE` casse toutes les fiches en production.
export const dynamic = 'force-dynamic';
