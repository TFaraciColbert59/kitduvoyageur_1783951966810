import { MetadataRoute } from 'next';
import { getPublishedCountries } from '@/lib/countries';
import { createClient } from '@/lib/supabase/server';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

// Static public routes with business priorities and change frequencies
const staticRoutes: Array<{
  url: string;
  priority: number;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}> = [
  { url: '/', priority: 1.0, changeFrequency: 'daily' },
  { url: '/mon-materiel', priority: 0.95, changeFrequency: 'daily' },
  { url: '/pays', priority: 0.9, changeFrequency: 'weekly' },
  { url: '/explorer', priority: 0.85, changeFrequency: 'weekly' },
  { url: '/carte-interactive', priority: 0.85, changeFrequency: 'weekly' },
  { url: '/guides', priority: 0.8, changeFrequency: 'weekly' },
  { url: '/blog', priority: 0.8, changeFrequency: 'daily' },
  { url: '/kits', priority: 0.8, changeFrequency: 'weekly' },
  { url: '/carnets', priority: 0.75, changeFrequency: 'daily' },
  { url: '/clubs', priority: 0.75, changeFrequency: 'weekly' },
  { url: '/communaute', priority: 0.7, changeFrequency: 'daily' },
  { url: '/ai-configurator', priority: 0.7, changeFrequency: 'monthly' },
  { url: '/outils', priority: 0.65, changeFrequency: 'monthly' },
  { url: '/avis', priority: 0.65, changeFrequency: 'weekly' },
  { url: '/evenements', priority: 0.6, changeFrequency: 'weekly' },
  { url: '/occasion', priority: 0.6, changeFrequency: 'daily' },
  { url: '/location', priority: 0.6, changeFrequency: 'weekly' },
  { url: '/encheres', priority: 0.6, changeFrequency: 'weekly' },
  { url: '/experts', priority: 0.6, changeFrequency: 'monthly' },
  { url: '/ambassadeurs', priority: 0.55, changeFrequency: 'monthly' },
  { url: '/createurs', priority: 0.55, changeFrequency: 'monthly' },
  { url: '/abonnements', priority: 0.55, changeFrequency: 'monthly' },
  { url: '/pro', priority: 0.55, changeFrequency: 'monthly' },
  { url: '/fidelite', priority: 0.55, changeFrequency: 'monthly' },
  { url: '/carbone', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/naviguer', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/faq', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/cookies', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/mentions-legales', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/cgv', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/cgu', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/politique-confidentialite', priority: 0.3, changeFrequency: 'yearly' },
];

const kitSlugs = ['islande-trek', 'gr20-corse', 'vanlife-europe'];

const outilsSlugs = [
  'poids-sac',
  'budget-voyage',
  'convertisseur',
  'checklist',
  'tailles',
  'fuseaux',
  'boussole',
  'chronometre',
  'rations',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1. Static Pages
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(
    ({ url, priority, changeFrequency }) => ({
      url: `${base}${url}`,
      lastModified: now,
      changeFrequency,
      priority,
    })
  );

  // 2. Published Countries (Flagship destinations)
  const publishedCountries = getPublishedCountries();
  const countryEntries: MetadataRoute.Sitemap = publishedCountries.map((country) => ({
    url: `${base}/pays/${country.code.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  // 3. Flagship Kits
  const kitEntries: MetadataRoute.Sitemap = kitSlugs.map((slug) => ({
    url: `${base}/kits/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // 4. Outils Utilitaires
  const outilsEntries: MetadataRoute.Sitemap = outilsSlugs.map((slug) => ({
    url: `${base}/outils/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.65,
  }));

  // 5. Dynamic Products from Supabase (Available / Active only)
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('score_kdv', { ascending: false })
      .limit(1000);

    if (products && products.length > 0) {
      productEntries = products.map((p) => ({
        url: `${base}/produit/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }
  } catch {
    // Fallback gracefully
  }

  // 6. Dynamic Guides from Supabase
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
    // Fallback gracefully
  }

  // 7. Dynamic Public Carnets from Supabase
  let carnetEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data: carnets } = await supabase
      .from('carnets')
      .select('id, updated_at, created_at, visibility')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(500);

    if (carnets && carnets.length > 0) {
      carnetEntries = carnets.map((c) => ({
        url: `${base}/carnets/${c.id}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : c.created_at ? new Date(c.created_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.75,
      }));
    }
  } catch {
    // Fallback gracefully
  }

  // 8. Dynamic Open Clubs from Supabase
  let clubEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id, slug, privacy, created_at')
      .eq('privacy', 'open')
      .order('members_count', { ascending: false })
      .limit(200);

    if (clubs && clubs.length > 0) {
      clubEntries = clubs.map((c) => ({
        url: `${base}/clubs/${c.slug || c.id}`,
        lastModified: c.created_at ? new Date(c.created_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch {
    // Fallback gracefully
  }

  return [
    ...staticEntries,
    ...countryEntries,
    ...kitEntries,
    ...outilsEntries,
    ...productEntries,
    ...guideEntries,
    ...carnetEntries,
    ...clubEntries,
  ];
}