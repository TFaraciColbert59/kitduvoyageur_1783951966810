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
  { url: '/hub', priority: 0.95, changeFrequency: 'daily' },
  { url: '/explorer', priority: 0.9, changeFrequency: 'weekly' },
  { url: '/communaute', priority: 0.7, changeFrequency: 'daily' },
  { url: '/pro', priority: 0.55, changeFrequency: 'monthly' },
  { url: '/carbone', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/cookies', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/mentions-legales', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/cgv', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/cgu', priority: 0.3, changeFrequency: 'yearly' },
  { url: '/politique-confidentialite', priority: 0.3, changeFrequency: 'yearly' },
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
    ...carnetEntries,
    ...clubEntries,
  ];
}