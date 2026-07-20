import { MetadataRoute } from 'next';
import { getPublishedCountries } from '@/lib/countries';
import { createClient } from '@/lib/supabase/server';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

const staticRoutes: Array<{
  url: string;
  priority: number;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}> = [
  { url: '/', priority: 1.0, changeFrequency: 'daily' },
  { url: '/boutique', priority: 0.95, changeFrequency: 'daily' },
  { url: '/kits', priority: 0.9, changeFrequency: 'weekly' },
  { url: '/pays', priority: 0.85, changeFrequency: 'weekly' },
  { url: '/guides', priority: 0.8, changeFrequency: 'weekly' },
  { url: '/catalogue', priority: 0.85, changeFrequency: 'daily' },
  { url: '/ai-configurator', priority: 0.8, changeFrequency: 'monthly' },
  { url: '/explorer', priority: 0.75, changeFrequency: 'weekly' },
  { url: '/communaute', priority: 0.7, changeFrequency: 'daily' },
  { url: '/experts', priority: 0.7, changeFrequency: 'weekly' },
  { url: '/avis', priority: 0.65, changeFrequency: 'weekly' },
  { url: '/outils', priority: 0.6, changeFrequency: 'monthly' },
  { url: '/abonnements', priority: 0.6, changeFrequency: 'monthly' },
  { url: '/pro', priority: 0.6, changeFrequency: 'monthly' },
  { url: '/fidelite', priority: 0.6, changeFrequency: 'monthly' },
];

const kitSlugs = ['islande-trek', 'gr20-corse', 'vanlife-europe'];
const outilsSlugs = [
  'poids-du-sac',
  'budget-voyage',
  'checklist',
  'convertisseur-devises',
  'calculateur-calories',
  'planificateur-itineraire',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static routes
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(
    ({ url, priority, changeFrequency }) => ({
      url: `${base}${url}`,
      lastModified: now,
      changeFrequency,
      priority,
    })
  );

  // Published countries
  const publishedCountries = getPublishedCountries();
  const countryEntries: MetadataRoute.Sitemap = publishedCountries.map((country) => ({
    url: `${base}/pays/${country.code.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Kits
  const kitEntries: MetadataRoute.Sitemap = kitSlugs.map((slug) => ({
    url: `${base}/kits/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Outils
  const outilsEntries: MetadataRoute.Sitemap = outilsSlugs.map((slug) => ({
    url: `${base}/outils/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Dynamic products from Supabase
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data: products } = await supabase
      .from('shop_products')
      .select('slug, updated_at')
      .order('score_kdv', { ascending: false })
      .limit(1000);

    if (products && products.length > 0) {
      productEntries = products.map((p) => ({
        url: `${base}/produit/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      }));
    }
  } catch {
    // Sitemap continues without products if error
  }

  // Dynamic guides from Supabase
  let guideEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data: guides } = await supabase
      .from('guides')
      .select('slug, created_at, featured')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);

    if (guides && guides.length > 0) {
      guideEntries = guides.map((g) => ({
        url: `${base}/guides/${g.slug}`,
        lastModified: g.created_at ? new Date(g.created_at) : now,
        changeFrequency: 'weekly' as const,
        priority: g.featured ? 0.8 : 0.7,
      }));
    }
  } catch {
    // Sitemap continues without guides if error
  }

  // Dynamic categories from Supabase
  let categoryEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data: categories } = await supabase
      .from('shop_products')
      .select('category_main')
      .distinct()
      .limit(50);

    if (categories && categories.length > 0) {
      categoryEntries = categories.map((c) => ({
        url: `${base}/catalogue/${c.category_main.toLowerCase().replace(/\s+/g, '-')}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.75,
      }));
    }
  } catch {
    // Sitemap continues without categories if error
  }

  return [
    ...staticEntries,
    ...countryEntries,
    ...kitEntries,
    ...outilsEntries,
    ...productEntries,
    ...guideEntries,
    ...categoryEntries,
  ];
}