import { Metadata } from 'next';
import ProductDetailClient from './ProductDetailClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const productName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    brand: { '@type': 'Brand', name: 'Le Kit du Voyageur' },
    url: `${siteUrl}/produit/${slug}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Le Kit du Voyageur' },
    },
  };

  return {
    title: `${productName} — Équipement outdoor`,
    description: `Découvrez ${productName} sur Le Kit du Voyageur. Équipement outdoor de qualité pour randonnée, trekking et aventure.`,
    alternates: {
      canonical: `${siteUrl}/produit/${slug}`,
    },
    openGraph: {
      title: `${productName} | Le Kit du Voyageur`,
      description: `Équipement outdoor de qualité — ${productName}`,
      url: `${siteUrl}/produit/${slug}`,
      images: [
        {
          url: '/assets/images/app_logo.png',
          width: 1200,
          height: 630,
          alt: `${productName} — Le Kit du Voyageur`,
        },
      ],
    },
    other: {
      'script:ld+json': JSON.stringify(jsonLd),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}