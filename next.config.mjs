import { imageHosts } from './image-hosts.config.mjs';
import { buildRedirects } from './route-redirects.config.mjs';
import { cspHeader } from './csp.config.mjs';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',
  compress: true,
  poweredByHeader: false,

  // L'aperçu local doit laisser la navigation mobile entièrement utilisable.
  devIndicators: false,

  typescript: {
    ignoreBuildErrors: process.env.FAST_BUILD === '1' ? true : false,
  },
  eslint: {
    // P0-5 (C-11, SEC-3) — 0 erreur au 2026-09-15 (915 warnings tolerés,
    // reduction regle par regle a planifier) : le lint s'execute au build.
    ignoreDuringBuilds: process.env.FAST_BUILD === '1' ? true : false,
  },

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    qualities: [75, 80, 85, 90, 95],
  },

  serverExternalPackages: [
    '@capacitor/core',
    '@capacitor/haptics',
    '@capacitor/app',
    '@capacitor/camera',
    '@capacitor/geolocation',
    '@capacitor/keyboard',
    '@capacitor/network',
    '@capacitor/preferences',
    '@capacitor/splash-screen',
    '@capacitor/status-bar',
  ],

  allowedDevOrigins: [
    '192.168.1.81:4028',
    '192.168.1.81:4000',
    '192.168.1.81:3000',
    '192.168.1.81',
    'localhost:4028',
    '127.0.0.1:4028',
    '192.168.1.123:4028',
    '192.168.1.123:4000',
    'localhost:4000',
    '127.0.0.1:4000',
    '192.168.1.123:3000',
    'localhost:3000',
    '127.0.0.1:3000',
    'capacitor://localhost',
    'lkdv://localhost',
    '*.local',
    '*.local:4028',
  ],
  // Drapeaux de langue figés au build, y compris absents (valeur vide = langue éteinte) :
  // une variable NEXT_PUBLIC_ absente n'est pas inlinée par Next, donc le bundler ne
  // pourrait pas élaguer les dictionnaires des langues éteintes (src/lib/i18n/translations).
  // Même sémantique que `isLocaleEnabled` (seule la valeur '1' active une langue).
  env: {
    NEXT_PUBLIC_I18N_EN_ENABLED: process.env.NEXT_PUBLIC_I18N_EN_ENABLED ?? '',
    NEXT_PUBLIC_I18N_ES_ENABLED: process.env.NEXT_PUBLIC_I18N_ES_ENABLED ?? '',
    NEXT_PUBLIC_I18N_DE_ENABLED: process.env.NEXT_PUBLIC_I18N_DE_ENABLED ?? '',
    NEXT_PUBLIC_I18N_IT_ENABLED: process.env.NEXT_PUBLIC_I18N_IT_ENABLED ?? '',
  },
  experimental: {
    optimizePackageImports: [
      '@heroicons/react/24/outline',
      '@heroicons/react/24/solid',
      '@heroicons/react',
      '@radix-ui/react-dialog',
      '@tanstack/react-query',
      '@tanstack/react-virtual',
      'dexie',
      'clsx',
      'tailwind-merge',
      'framer-motion',
      'lucide-react',
      'recharts',
      'zustand',
    ],
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },

  async redirects() {
    // P6 : AUCUNE liste de 301 en dur. Tout est derive de la source unique
    // src/constants/routeRegistry.json (via route-redirects.config.mjs).
    // H-AUTO-43 : /groupes reste CANONIQUE — la section groupe du hub pointe
    // vers /groupes. Le registre le porte en `kept`, jamais en redirection.
    // La coherence du registre est verrouillee par
    // tests/routing/no-broken-links.spec.ts.
    return buildRedirects();
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // Micro autorisé pour les notes vocales de la messagerie ; caméra et géoloc inchangées.
          value: 'camera=(), microphone=(self), geolocation=(self), interest-cohort=()',
          },
          // P0-5 (C-10) — CSP en Report-Only (une semaine d'observation des
          // rapports avant le mode bloquant ; nonce à poser sur les scripts
          // inline JSON-LD avant le durcissement). Plan 2.11 : les rapports
          // partaient vers /api/telemetry/hub, qui les refusait (400, sans
          // idempotency-key) ; ils vont à /api/csp-report (table app_errors,
          // lecture : csp_report_summary(7)). Ne pas passer en mode appliqué
          // sans une semaine de rapports lue.
          // Politique et mode dans `csp.config.mjs` : `CSP_MODE=enforce` (Vercel) la fait
          // appliquer, sans variable elle reste en Report-Only.
          cspHeader(process.env.CSP_MODE),
        ],
      },
      // SEC-1 — Routes authentifiées : interdiction de cache côté HTTP et SW
      // (double verrou avec la liste blanche du service worker).
      {
        source: '/hub/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/compte/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/messagerie',
        // `no-cache` (et non `no-store`) : rien n'est partagé entre utilisateurs,
        // mais le navigateur peut réutiliser la page au retour arrière (bfcache).
        headers: [{ key: 'Cache-Control', value: 'private, no-cache, must-revalidate' }],
      },
      {
        source: '/carnets/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/groupes/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/api/hub/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/api/voyages/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/api/trips/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/api/materiel/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/api/equipages/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/api/carnets/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/_next/static/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

};
export default withBundleAnalyzer(nextConfig);
