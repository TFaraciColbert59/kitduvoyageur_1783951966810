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

  webpack(config) {
config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      exclude: [
        /node_modules/,
        /\.next/,
        /app[\/\\]layout\.tsx$/,
        /app[\/\\]page\.tsx$/,
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
        /src[\/\\]components[\/\\]/,
      ],
      use: [{ loader: '@dhiwise/component-tagger/nextLoader' }],
    });

    return config;
  }
};
export default nextConfig;