/**
 * Core Web Vitals Monitoring & Optimization
 * LCP < 2.5s, FID < 100ms, CLS < 0.1
 */

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint (ms)
  fid: number; // First Input Delay (ms)
  cls: number; // Cumulative Layout Shift (unitless)
  ttfb: number; // Time to First Byte (ms)
  fcp: number; // First Contentful Paint (ms)
}

export const CWV_THRESHOLDS = {
  lcp: 2500, // 2.5s
  fid: 100, // 100ms
  cls: 0.1, // 0.1
  ttfb: 600, // 600ms
  fcp: 1800, // 1.8s
};

export const CWV_TARGETS = {
  lcp: 'Good: < 2.5s | Needs Improvement: 2.5s - 4s | Poor: > 4s',
  fid: 'Good: < 100ms | Needs Improvement: 100ms - 300ms | Poor: > 300ms',
  cls: 'Good: < 0.1 | Needs Improvement: 0.1 - 0.25 | Poor: > 0.25',
  ttfb: 'Good: < 600ms | Needs Improvement: 600ms - 1800ms | Poor: > 1800ms',
  fcp: 'Good: < 1.8s | Needs Improvement: 1.8s - 3s | Poor: > 3s',
};

/**
 * Checklist for Core Web Vitals optimization
 */
export const CWV_OPTIMIZATION_CHECKLIST = [
  {
    metric: 'LCP (Largest Contentful Paint)',
    target: '< 2.5s',
    optimizations: [
      'Preload critical images (og-image.png, hero images)',
      'Optimize image formats (AVIF, WebP)',
      'Minimize CSS blocking rendering',
      'Defer non-critical JavaScript',
      'Use dynamic imports for heavy components',
      'Enable ISR for dynamic pages (revalidate: 3600)',
      'Compress images with next/image',
    ],
  },
  {
    metric: 'FID (First Input Delay)',
    target: '< 100ms',
    optimizations: [
      'Break up long JavaScript tasks',
      'Use Web Workers for heavy computations',
      'Defer non-critical JavaScript',
      'Minimize main thread work',
      'Use requestIdleCallback for non-urgent tasks',
    ],
  },
  {
    metric: 'CLS (Cumulative Layout Shift)',
    target: '< 0.1',
    optimizations: [
      'Reserve space for images (width/height attributes)',
      'Avoid inserting content above existing content',
      'Use transform animations instead of layout changes',
      'Preload fonts to avoid FOUT/FOIT',
      'Set font-display: swap for Google Fonts',
    ],
  },
  {
    metric: 'TTFB (Time to First Byte)',
    target: '< 600ms',
    optimizations: [
      'Use CDN for static assets',
      'Enable gzip/brotli compression',
      'Optimize server response time',
      'Cache headers: public, max-age=31536000 for assets',
      'Use ISR for dynamic pages',
    ],
  },
  {
    metric: 'FCP (First Contentful Paint)',
    target: '< 1.8s',
    optimizations: [
      'Minimize critical CSS',
      'Defer non-critical CSS',
      'Preload critical fonts',
      'Optimize server response time',
      'Minimize render-blocking resources',
    ],
  },
];

/**
 * Performance budget thresholds
 */
export const PERFORMANCE_BUDGET = {
  lighthouse: {
    performance: 90,
    seo: 95,
    accessibility: 90,
    bestPractices: 95,
  },
  bundleSize: {
    main: 200, // KB
    vendor: 300, // KB
    total: 500, // KB
  },
  imageSize: {
    hero: 100, // KB
    thumbnail: 30, // KB
    og: 50, // KB
  },
};
