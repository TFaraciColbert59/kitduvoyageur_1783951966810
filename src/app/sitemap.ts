import { MetadataRoute } from 'next';
import { getPublishedCountries } from '@/lib/countries';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

const staticRoutes = [
  { url: '/', priority: 1.0, changeFrequency: 'daily' as const },
  { url: '/catalogue', priority: 0.9, changeFrequency: 'daily' as const },
  { url: '/kits', priority: 0.9, changeFrequency: 'weekly' as const },
  { url: '/pays', priority: 0.8, changeFrequency: 'weekly' as const },
  { url: '/guides', priority: 0.8, changeFrequency: 'weekly' as const },
  { url: '/ai-configurator', priority: 0.9, changeFrequency: 'monthly' as const },
  { url: '/copilote', priority: 0.7, changeFrequency: 'monthly' as const },
  { url: '/outils', priority: 0.7, changeFrequency: 'monthly' as const },
  { url: '/recommandations', priority: 0.6, changeFrequency: 'monthly' as const },
  { url: '/location', priority: 0.7, changeFrequency: 'weekly' as const },
  { url: '/occasion', priority: 0.7, changeFrequency: 'weekly' as const },
  { url: '/encheres', priority: 0.6, changeFrequency: 'daily' as const },
  { url: '/abonnements', priority: 0.7, changeFrequency: 'monthly' as const },
  { url: '/communaute', priority: 0.6, changeFrequency: 'daily' as const },
  { url: '/experts', priority: 0.6, changeFrequency: 'weekly' as const },
  { url: '/gamification', priority: 0.5, changeFrequency: 'weekly' as const },
  { url: '/rapport-expedition', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/pro', priority: 0.6, changeFrequency: 'monthly' as const },
  { url: '/fidelite', priority: 0.6, changeFrequency: 'monthly' as const },
  { url: '/carbone', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/avis', priority: 0.6, changeFrequency: 'weekly' as const },
  { url: '/ambassadeurs', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/alertes', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/inventaire', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/connexion', priority: 0.4, changeFrequency: 'yearly' as const },
  { url: '/groupe', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/communaute-pro', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/jumeau-3d', priority: 0.5, changeFrequency: 'monthly' as const },
  { url: '/compte', priority: 0.4, changeFrequency: 'monthly' as const },
  { url: '/panier', priority: 0.4, changeFrequency: 'monthly' as const },
  { url: '/ai-configurator', priority: 0.9, changeFrequency: 'monthly' as const },
  { url: '/copilote', priority: 0.7, changeFrequency: 'monthly' as const },
];

// Common catalogue categories
const CATALOGUE_CATEGORIES = [
  'sacs', 'tentes', 'sacs-de-couchage', 'cuisine', 'eau',
  'vetements', 'eclairage', 'sommeil', 'navigation', 'securite', 'batons',
];

// Kit slugs
const KIT_SLUGS = ['islande-trek', 'gr20-corse', 'vanlife-europe'];

// Product slugs
const PRODUCT_SLUGS = [
  'sac-a-dos-osprey-atmos-65', 'osprey-exos-58', 'big-agnes-copper-spur',
  'sea-to-summit-reactor', 'msr-pocket-rocket', 'sawyer-squeeze',
  'arcteryx-beta-jacket', 'black-diamond-spot', 'thermarest-neoair',
  'leki-micro-vario', 'platypus-gravityworks', 'patagonia-nano-puff',
];

// Outils slugs
const OUTILS_SLUGS = [
  'poids-du-sac', 'budget-voyage', 'checklist', 'convertisseur-devises',
  'calculateur-calories', 'planificateur-itineraire',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(({ url, priority, changeFrequency }) => ({
    url: `${base}${url}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Only include published countries in sitemap
  const publishedCountries = getPublishedCountries();
  const countryEntries: MetadataRoute.Sitemap = publishedCountries.map((country) => ({
    url: `${base}/pays/${country.code.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const catalogueEntries: MetadataRoute.Sitemap = CATALOGUE_CATEGORIES.map((cat) => ({
    url: `${base}/catalogue/${cat}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const kitEntries: MetadataRoute.Sitemap = KIT_SLUGS.map((slug) => ({
    url: `${base}/kits/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const productEntries: MetadataRoute.Sitemap = PRODUCT_SLUGS.map((slug) => ({
    url: `${base}/produit/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const outilsEntries: MetadataRoute.Sitemap = OUTILS_SLUGS.map((slug) => ({
    url: `${base}/outils/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    ...staticEntries,
    ...countryEntries,
    ...catalogueEntries,
    ...kitEntries,
    ...productEntries,
    ...outilsEntries,
  ];
}