import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',
  compress: true,

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    qualities: [75, 80, 85, 90, 95],
  },

  transpilePackages: ['react-globe.gl', 'three'],

  experimental: {
    optimizePackageImports: [
      '@heroicons/react/24/outline',
      '@heroicons/react/24/solid',
      '@heroicons/react',
      '@tanstack/react-query',
      '@tanstack/react-virtual',
      'dexie',
      'clsx',
      'tailwind-merge',
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
    return [
      {
        source: '/boutique',
        destination: '/explorer',
        permanent: true,
      },
      {
        source: '/mon-kit',
        destination: '/explorer',
        permanent: true,
      },
      {
        source: '/inventaire',
        destination: '/explorer',
        permanent: true,
      },
      {
        source: '/shop',
        destination: '/explorer',
        permanent: true,
      },
      {
        source: '/catalogue/:path*',
        destination: '/explorer',
        permanent: true,
      },
      {
        source: '/configurateur',
        destination: '/ai-configurator',
        permanent: true,
      },
      {
        source: '/manifeste',
        destination: '/explorer',
        permanent: false,
      },
      {
        source: '/ateliers',
        destination: '/explorer',
        permanent: false,
      },
      {
        source: '/presse',
        destination: '/contact',
        permanent: false,
      },
      {
        source: '/confidentialite',
        destination: '/politique-confidentialite',
        permanent: true,
      },
      {
        source: '/carte',
        destination: '/carte-interactive',
        permanent: true,
      },
    ];
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
        ],
      },
    ];
  },

};
export default nextConfig;