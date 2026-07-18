import { getTrailOfDay, getTrustStats, getFeaturedCarnets } from '@/lib/home-queries';
import HomePageClient from '@/app/components/HomePageClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Le Kit du Voyageur — Équipement outdoor & aventure',
  description:
    'Configurez votre kit de voyage parfait avec notre IA. Équipements outdoor vérifiés, kits prêts à partir, communauté de voyageurs passionnés.',
  url: siteUrl,
  image: `${siteUrl}/assets/images/og-image.png`,
  isPartOf: {
    '@type': 'WebSite',
    name: 'Le Kit du Voyageur',
    url: siteUrl,
  },
};

export const metadata = {
  title: 'Le Kit du Voyageur — Équipement outdoor & aventure',
  description:
    'Configurez votre kit de voyage parfait avec notre IA. Équipements outdoor vérifiés, kits prêts à partir, communauté de voyageurs passionnés.',
  other: {
    'script:ld+json': JSON.stringify(webPageSchema),
  },
};

export const revalidate = 3600;

export default async function HomePage() {
  const [trail, stats, carnets] = await Promise.all([
    getTrailOfDay(),
    getTrustStats(),
    getFeaturedCarnets(),
  ]);

  return <HomePageClient trail={trail} stats={stats} carnets={carnets} />;
}
