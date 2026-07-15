import ProductDetailClient from './ProductDetailClient';
import { createClient } from '@/lib/supabase/server';
import { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('shop_products')
      .select('name, brand, description_why, price_eur, weight_g, image, image_alt, category_main, score_kdv')
      .eq('slug', slug)
      .single();

    if (!data) {
      return {
        title: 'Produit — Le Kit du Voyageur',
        description: 'Découvrez notre sélection d\'équipements outdoor.',
      };
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';
    const description = data.description_why
      ? data.description_why.slice(0, 160)
      : `${data.name} par ${data.brand} — ${data.weight_g}g — ${data.price_eur}€`;

    return {
      title: `${data.name} ${data.brand} — Le Kit du Voyageur`,
      description,
      openGraph: {
        title: `${data.name} — ${data.brand}`,
        description,
        images: data.image ? [{ url: data.image, alt: data.image_alt ?? data.name }] : [],
        url: `${base}/produit/${slug}`,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.name} — ${data.brand}`,
        description,
        images: data.image ? [data.image] : [],
      },
    };
  } catch {
    return {
      title: 'Produit — Le Kit du Voyageur',
      description: 'Découvrez notre sélection d\'équipements outdoor.',
    };
  }
}

export default async function ProduitPage({ params }: Props) {
  const { slug } = await params;

  // Schema.org JSON-LD
  let schemaOrg: Record<string, unknown> | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('shop_products')
      .select('name, brand, description_why, price_eur, image, image_alt, rating, review_count, slug, score_kdv')
      .eq('slug', slug)
      .single();

    if (data) {
      const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';
      schemaOrg = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: data.name,
        brand: { '@type': 'Brand', name: data.brand },
        description: data.description_why ?? '',
        image: data.image ?? '',
        url: `${base}/produit/${data.slug}`,
        offers: {
          '@type': 'Offer',
          price: data.price_eur,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          url: `${base}/produit/${data.slug}`,
        },
        aggregateRating: data.rating && data.review_count ? {
          '@type': 'AggregateRating',
          ratingValue: data.rating,
          reviewCount: data.review_count,
          bestRating: 5,
          worstRating: 1,
        } : undefined,
      };
    }
  } catch {
    // schema.org optionnel
  }

  return (
    <>
      {schemaOrg && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      )}
      <ProductDetailClient slug={slug} />
    </>
  );
}