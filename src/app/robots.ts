import { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

/** Routes publiques indexables (après nettoyage du 24/10/2026). */
const ALLOW = [
  '/',
  '/explorer',
  '/explorer/',
  '/compas',
  '/carte-interactive',
  '/pays',
  '/pays/',
  '/communaute',
  '/pro',
  '/contact',
  '/carbone',
  '/cgu',
  '/cgv',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cookies',
];

/** Routes privées ou sans valeur SEO. */
const DISALLOW = [
  '/api/',
  '/_next/',
  '/admin',
  '/admin/',
  '/compte',
  '/compte/',
  '/profil',
  '/profil/',
  '/connexion',
  '/inscription',
  '/auth',
  '/auth/',
  '/checkout',
  '/checkout/',
  '/panier',
  '/panier/',
  '/messagerie',
  '/messagerie/',
  '/groupes',
  '/groupes/',
  '/hub',
  '/mon-kit',
  '/mes-aventures',
  '/terrain',
  '/alertes',
  '/voyage-ia',
  '/recommandations',
  '/activite',
  '/*?*search=*',
  '/*?*q=*',
  '/*?*filter=*',
  '/*?*sort=*',
  '/*?*page=*',
  '/*?*clubId=*',
  '/*?*routeId=*',
  '/*?*token=*',
  '/*?*signature=*',
];

const AI_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Bytespider', 'CCBot', 'PerplexityBot'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ALLOW, disallow: DISALLOW },
      { userAgent: 'Googlebot', allow: ALLOW, disallow: DISALLOW },
      { userAgent: 'Bingbot', allow: ALLOW, disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, disallow: '/' })),
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
