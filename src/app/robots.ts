import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/admin/',
          '/checkout/',
          '/panier/',
          '/compte/',
          '/communaute/messagerie/',
          '/messagerie/',
          '/dashboard/',
          '/workspace/',
          '/settings/',
          '/billing/',
          '/profile/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}