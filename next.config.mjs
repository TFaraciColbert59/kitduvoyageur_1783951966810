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
    dangerouslyAllowSVG: true,
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