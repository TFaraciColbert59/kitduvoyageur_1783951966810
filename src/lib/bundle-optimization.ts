import React from 'react';
/**
 * Bundle Splitting & Code Optimization Configuration
 * Optimize JavaScript delivery and reduce main bundle size
 */

/**
 * Dynamic imports for heavy components
 * Reduces initial bundle size by deferring non-critical code
 */
export const DYNAMIC_IMPORTS = {
  // Heavy UI components
  ConfiguratorWizard: () =>
    import('@/app/ai-configurator/components/ConfiguratorWizard'),
  InteractiveMap: () =>
    import('@/components/explorer/ExplorerMap'),
  AdventureDetailPanel: () =>
    import('@/components/explorer/AdventureDetailPanel'),

  // Heavy data visualization
  WeightGauge: () => import('@/components/WeightGauge'),
  BentoGrid: () => import('@/components/home/BentoGrid'),
  TrailOfTheDay: () => import('@/components/home/TrailOfTheDay'),

  // Heavy forms
  MediaUpload: () => import('@/components/ui/MediaUpload'),
};

/**
 * Package import optimizations
 * Reduce bundle size by importing only needed functions
 */
export const OPTIMIZED_IMPORTS = {
  // Use tree-shaking for large libraries
  heroicons: {
    before: "import * as HeroIcons from '@heroicons/react/24/solid';",
    after: "import { MapPinIcon, StarIcon } from '@heroicons/react/24/solid';",
  },
  lucideReact: {
    before: "import * as LucideIcons from 'lucide-react';",
    after: "import { MapPin, Star, Heart } from 'lucide-react';",
  },
  supabase: {
    before: "import { createClient } from '@supabase/supabase-js';",
    after: "import { createClient } from '@supabase/supabase-js'; // Already optimized",
  },
};

/**
 * Bundle size targets (KB)
 */
export const BUNDLE_TARGETS = {
  main: 150, // Main bundle
  vendor: 250, // Vendor bundle
  shared: 100, // Shared chunks
  total: 500, // Total JS
};

/**
 * Code splitting strategy
 */
export const CODE_SPLITTING_STRATEGY = [
  {
    name: 'Route-based splitting',
    description: 'Each route loads only its required code',
    implementation: 'Next.js automatic (default)',
  },
  {
    name: 'Component-based splitting',
    description: 'Heavy components loaded on-demand',
    implementation: 'Dynamic imports with React.lazy()',
  },
  {
    name: 'Vendor splitting',
    description: 'Third-party libraries in separate chunk',
    implementation: 'next.config.mjs webpack optimization',
  },
  {
    name: 'Utility splitting',
    description: 'Shared utilities in separate chunk',
    implementation: 'next.config.mjs webpack optimization',
  },
];

/**
 * Webpack optimization configuration
 * Add to next.config.mjs webpack() function
 */
export const WEBPACK_OPTIMIZATION = `
config.optimization = {
  ...config.optimization,
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      // Vendor libraries
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
        reuseExistingChunk: true,
      },
      // Supabase
      supabase: {
        test: /[\\/]node_modules[\\/](@supabase|@postgrest)[\\/]/,
        name: 'supabase',
        priority: 20,
        reuseExistingChunk: true,
      },
      // React & Next.js
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
        name: 'react',
        priority: 20,
        reuseExistingChunk: true,
      },
      // UI libraries
      ui: {
        test: /[\\/]node_modules[\\/](@heroicons|lucide-react|recharts)[\\/]/,
        name: 'ui',
        priority: 15,
        reuseExistingChunk: true,
      },
      // Common code
      common: {
        minChunks: 2,
        priority: 5,
        reuseExistingChunk: true,
      },
    },
  },
};
`;

/**
 * Performance monitoring checklist
 */
export const PERFORMANCE_MONITORING = [
  {
    metric: 'Main bundle size',
    target: '< 150 KB',
    tool: 'npm run build && du -sh .next/static/chunks/main-*.js',
  },
  {
    metric: 'Vendor bundle size',
    target: '< 250 KB',
    tool: 'npm run build && du -sh .next/static/chunks/vendors-*.js',
  },
  {
    metric: 'Total JS size',
    target: '< 500 KB',
    tool: 'npm run build && du -sh .next/static/chunks/*.js | awk \'{sum+=$1} END {print sum}\'',
  },
  {
    metric: 'LCP',
    target: '< 2.5s',
    tool: 'Lighthouse DevTools',
  },
  {
    metric: 'FCP',
    target: '< 1.8s',
    tool: 'Lighthouse DevTools',
  },
  {
    metric: 'CLS',
    target: '< 0.1',
    tool: 'Lighthouse DevTools',
  },
];
