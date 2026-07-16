import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';
  return {
    rules: [
      {
        // Googlebot : accès explicite aux pages SEO prioritaires
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/pays/',
          '/shop/',
          '/boutique/',
          '/produit/',
          '/catalogue/',
          '/kits/',
          '/guides/',
          '/experts/',
          '/carnets/',
          '/evenements/',
          '/communaute/',
          '/explorer/',
          '/avis/',
        ],
        disallow: [
          '/api/',
          '/_next/',
          '/admin/',
          '/checkout/',
          '/panier/',
          '/compte/',
          '/messagerie/',
          '/groupe/',
          '/groupes/',
          '/inventaire/',
          '/connexion/',
          '/inscription/',
          '/auth/',
        ],
      },
      {
        // Tous les autres crawlers
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/admin/',
          '/checkout/',
          '/panier/',
          '/compte/',
          '/messagerie/',
          '/groupe/',
          '/groupes/',
          '/inventaire/',
          '/connexion/',
          '/inscription/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}