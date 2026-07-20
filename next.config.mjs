import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [85],
    // Enable AVIF for better compression
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    optimizePackageImports: [
      '@heroicons/react',
      'lucide-react',
      '@supabase/supabase-js',
    ],
  },
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/xml' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'text/plain' },
        ],
      },
      // Preload LCP images
      {
        source: '/produit/:slug',
        headers: [
          { key: 'Link', value: '</assets/images/og-image.png>; rel=preload; as=image; imagesrcset' },
        ],
      },
      {
        source: '/pays/:code',
        headers: [
          { key: 'Link', value: '</assets/images/og-image.png>; rel=preload; as=image; imagesrcset' },
        ],
      },
    ];
  },
  webpack(
    config,
    {
      dev: dev
    }
  ) {
    config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      exclude: [
        /node_modules/,
        /\.next/,
        /src[\/\\]app[\/\\]page\.tsx$/,
        /src[\/\\]app[\/\\]components[\/\\]HomePageContent\.tsx$/,
        /src[\/\\]app[\/\\]components[\/\\]home[\/\\]/,
        /\[id\]/,
        /src[\/\\]app[\/\\]carnets[\/\\]/,
        /src[\/\\]app[\/\\]clubs[\/\\]/,
        /src[\/\\]app[\/\\]pays[\/\\]/,
        /src[\/\\]app[\/\\]ai-configurator[\/\\]/,
        /src[\/\\]app[\/\\]profil[\/\\]/,
        /src[\/\\]app[\/\\]compte[\/\\]/,
        /src[\/\\]app[\/\\]evenements[\/\\]/,
        /src[\/\\]app[\/\\]carte-interactive[\/\\]/,
        /src[\/\\]app[\/\\]naviguer[\/\\]/,
        /src[\/\\]app[\/\\]mon-kit[\/\\]/,
        /src[\/\\]app[\/\\]activite[\/\\]/,
        /src[\/\\]components[\/\\]mobile-nav[\/\\]/,
      ],
      use: [{
        loader: '@dhiwise/component-tagger/nextLoader',
        options: {
          verbose: false,
          sourceMaps: false,
          maxContentLength: 200,
        },
      }],
    });
    if (dev) {
      const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      config.watchOptions = {
        ignored: ignoredPaths.length
          ? ignoredPaths.map((p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`)
          : undefined,
      };
    }
    return config;
  },
};
export default nextConfig;