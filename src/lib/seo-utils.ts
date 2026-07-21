/**
 * SEO & Performance Optimization Utilities
 * Preload LCP images, optimize fonts, bundle splitting
 */

/**
 * Preload critical images for LCP optimization
 * Call in layout.tsx <head>
 */
export function getPreloadLinks(): Array<{
  rel: string;
  as: string;
  href: string;
  type?: string;
  imagesrcset?: string;
  imagesizes?: string;
}> {
  return [
    {
      rel: 'preload',
      as: 'image',
      href: '/assets/images/og-image.png',
      type: 'image/png',
    },
    {
      rel: 'preload',
      as: 'image',
      href: '/assets/images/app_logo.png',
      type: 'image/png',
    },
  ];
}

/**
 * Preload fonts for faster rendering
 */
export function getFontPreloadLinks(): Array<{
  rel: string;
  href: string;
  as: string;
  type: string;
  crossOrigin?: string;
}> {
  return [
    {
      rel: 'preload',
      href: '/fonts/public-sans-400.woff2',
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
    },
    {
      rel: 'preload',
      href: '/fonts/space-grotesk-700.woff2',
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
    },
  ];
}

/**
 * DNS prefetch for external domains
 */
export function getDnsPrefetchLinks(): Array<{
  rel: string;
  href: string;
}> {
  return [
    { rel: 'dns-prefetch', href: 'https://cdn.jsdelivr.net' },
    { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
    { rel: 'dns-prefetch', href: 'https://www.googletagmanager.com' },
  ];
}

/**
 * Preconnect to critical third-party origins
 */
export function getPreconnectLinks(): Array<{
  rel: string;
  href: string;
  crossOrigin?: string;
}> {
  return [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  ];
}

/**
 * Generate structured data for Organization
 */
export function getOrganizationSchema(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Le Kit du Voyageur',
    url: siteUrl,
    logo: `${siteUrl}/assets/images/app_logo.png`,
    description: 'Configurateur IA, équipement outdoor, fiches pays et outils terrain. La plateforme complète du voyageur et de l\'aventurier.',
    sameAs: [
      'https://www.facebook.com/lekitduvoyageur',
      'https://www.instagram.com/lekitduvoyageur',
      'https://www.twitter.com/lekitduvoyageur',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      availableLanguage: 'fr',
    },
  };
}

/**
 * Generate structured data for WebSite (search action)
 */
export function getWebsiteSchema(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: siteUrl,
    name: 'Le Kit du Voyageur',
    description: 'Configurateur IA, équipement outdoor, fiches pays et outils terrain.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
