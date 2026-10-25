import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ slug: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

/**
 * Generate static params for all products
 * Enables ISR with revalidate: 3600 (1 hour)
 */
export async function generateStaticParams() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('products')
      .select('slug')
      .order('score_kdv', { ascending: false })
      .limit(500); // Limit to prevent build timeout

    return (data || []).map((p) => ({
      slug: p.slug,
    }));
  } catch {
    // Fallback: return empty array, pages will be generated on-demand
    return [];
  }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;

  try {
    const supabase = await createClient();
    const { data: product } = await supabase
      .from('shop_products')
      .select(
        'id, slug, name, brand, description_why, price_eur, weight_g, image, image_alt, category_main, score_kdv, rating, review_count'
      )
      .eq('slug', slug)
      .single();

    if (!product) {
      return {
        title: 'Produit non trouvé',
        robots: { index: false, follow: false },
      };
    }

    const title = `${product.name} ${product.brand} — Le Kit du Voyageur`;
    const description = product.description_why
      ? product.description_why.slice(0, 160)
      : `${product.name} par ${product.brand} — ${product.weight_g}g — ${product.price_eur}€`;

    const ogImage = product.image || '/assets/images/og-image.png';
    const canonicalUrl = `${siteUrl}/produit/${slug}`;

    return {
      title,
      description,
      keywords: [
        product.name,
        product.brand,
        product.category_main,
        'équipement outdoor',
        'matériel voyage',
      ],
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        type: 'website',
        title: `${product.name} — ${product.brand}`,
        description,
        url: canonicalUrl,
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: product.image_alt || product.name,
            type: 'image/jpeg',
          },
        ],
        siteName: 'Le Kit du Voyageur',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${product.name} — ${product.brand}`,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: 'Produit — Le Kit du Voyageur',
      description: 'Découvrez notre sélection d\'équipements outdoor.',
      robots: { index: false },
    };
  }
}

export default async function ProduitPage({ params }: Props) {
  const { slug } = await params;

  let schemaOrg: Record<string, unknown> | null = null;
  let initialProduct: Record<string, unknown> | null = null;

  try {
    const supabase = await createClient();
    const { data: product } = await supabase
      .from('shop_products')
      .select('*')
      .eq('slug', slug)
      .single();

    if (product) {
      initialProduct = product;
      const canonicalUrl = `${siteUrl}/produit/${slug}`;

      // JSON-LD: Product + BreadcrumbList
      schemaOrg = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Product',
            '@id': `${canonicalUrl}#product`,
            name: product.name,
            brand: {
              '@type': 'Brand',
              name: product.brand,
            },
            description: product.description_why || '',
            image: product.image || '/assets/images/og-image.png',
            url: canonicalUrl,
            category: product.category_main,
            offers: {
              '@type': 'Offer',
              url: canonicalUrl,
              price: product.price_eur,
              priceCurrency: 'EUR',
              availability: 'https://schema.org/InStock',
            },
            ...(product.rating &&
              product.review_count && {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: product.rating,
                  reviewCount: product.review_count,
                  bestRating: 5,
                  worstRating: 1,
                },
              }),
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
                name: 'Boutique',
                item: `${siteUrl}/boutique`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: product.category_main,
                item: `${siteUrl}/boutique?categorie=${encodeURIComponent(product.category_main)}`,
              },
              {
                '@type': 'ListItem',
                position: 4,
                name: product.name,
                item: canonicalUrl,
              },
            ],
          },
        ],
      };
    }
  } catch {
    // Silent fail — client component will handle with its own fallback
  }

  // Only call notFound() for clearly invalid slugs (empty or malformed)
  if (!slug || slug.length < 2) {
    notFound();
  }

  return (
    <>
      {schemaOrg && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
          suppressHydrationWarning
        />
      )}
      <ProductDetailClient slug={slug} initialProduct={initialProduct} />
    </>
  );
}

// ISR: Revalidate every hour
export const revalidate = 3600;