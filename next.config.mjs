import { imageHosts } from './image-hosts.config.mjs';
import { buildRedirects } from './route-redirects.config.mjs';
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

  // L'aperçu local doit laisser la navigation mobile entièrement utilisable.
  devIndicators: false,

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // P0-5 (C-11, SEC-3) — 0 erreur au 2026-09-15 (915 warnings tolerés,
    // reduction regle par regle a planifier) : le lint s'execute au build.
    ignoreDuringBuilds: false,
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
    '192.168.1.123:4000',
    'localhost:4000',
    '127.0.0.1:4000',
    '192.168.1.123:3000',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
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

  webpack: (config) => {
    return config;
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
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
          // P0-5 (C-10) — CSP en Report-Only (une semaine d'observation des
          // rapports avant le mode bloquant ; nonce à poser sur les scripts
          // inline JSON-LD avant le durcissement).
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://va.vercel-scripts.com https://hcaptcha.com https://*.hcaptcha.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://hcaptcha.com https://*.hcaptcha.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://va.vercel-scripts.com https://*.arcgis.com https://hcaptcha.com https://*.hcaptcha.com https://api.stripe.com",
              "frame-src https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com",
              "worker-src 'self' blob:",
              "report-uri /api/telemetry/hub",
            ].join('; '),
          },
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
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
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
    ];
  },

};
export default withBundleAnalyzer(nextConfig);
