# Core Web Vitals & SEO Optimization Checklist

## 🎯 Performance Targets

### Lighthouse Scores
- [ ] **Performance**: ≥ 90
- [ ] **SEO**: ≥ 95
- [ ] **Accessibility**: ≥ 90
- [ ] **Best Practices**: ≥ 95

### Core Web Vitals
- [ ] **LCP (Largest Contentful Paint)**: < 2.5s
- [ ] **FID (First Input Delay)**: < 100ms
- [ ] **CLS (Cumulative Layout Shift)**: < 0.1
- [ ] **TTFB (Time to First Byte)**: < 600ms
- [ ] **FCP (First Contentful Paint)**: < 1.8s

---

## 📄 SEO Implementation

### Metadata & Structured Data
- [x] **metadataBase** in layout.tsx (first property)
- [x] **Title tags**: 30-60 chars, product name + value prop
- [x] **Meta descriptions**: 140-160 chars, [what] + [who] + [differentiator]
- [x] **Canonical URLs**: alternates.canonical on all public pages
- [x] **H1 tags**: Exactly one per page, correct formula
- [x] **H2→H3 hierarchy**: Never broken, logical structure
- [x] **Open Graph**: og:title (30-40 chars), og:description (60-80 chars), og:image (1200×630px)
- [x] **Twitter Cards**: summary_large_image with title, description, image
- [x] **JSON-LD Schemas**:
  - [x] Organization (layout.tsx)
  - [x] WebSite (layout.tsx)
  - [x] Product (produit/[slug]/page.tsx)
  - [x] BreadcrumbList (produit/[slug], pays/[code])
  - [x] TouristDestination (pays/[code])
  - [x] FAQPage (pays/[code])

### Technical SEO
- [x] **Sitemap**: Dynamic from Supabase (produits, pays, kits, guides, catégories)
- [x] **Robots.txt**: Unique, disallow private routes, allow public pages
- [x] **Robots meta tags**: index/noindex per route type
- [x] **Canonical tags**: All public pages
- [x] **Internal linking**: `<Link>` component, descriptive anchor text
- [x] **Image alt text**: Descriptive, not empty
- [x] **Mobile-friendly**: Responsive design, viewport meta tag
- [x] **HTTPS**: Enforced

### Content Optimization
- [x] **Hero paragraph**: 40-60 words
- [x] **Footer company description**: 15-25 words
- [x] **FAQ answers**: 2-3 sentences each
- [x] **H2 intro sentences**: One per section
- [x] **No text in cards/stats/CTAs**: Content only in text blocks

---

## ⚡ Performance Optimization

### Image Optimization
- [x] **AVIF format**: Primary format for modern browsers
- [x] **WebP format**: Fallback for older browsers
- [x] **Image compression**: 85% quality, optimized sizes
- [x] **Responsive images**: deviceSizes, imageSizes configured
- [x] **LCP image preload**: og-image.png, hero images
- [x] **Image alt text**: Descriptive for SEO

### Font Optimization
- [x] **Font preload**: Public Sans (400, 500, 600, 700), Space Grotesk (600, 700)
- [x] **Font display**: swap (avoid FOUT/FOIT)
- [x] **Subset**: latin only
- [x] **Defer mono font**: IBM Plex Mono (preload: false)

### JavaScript Optimization
- [x] **Dynamic imports**: Heavy components (ConfiguratorWizard, etc.)
- [x] **Code splitting**: Automatic via Next.js
- [x] **Bundle analysis**: GitHub Actions workflow
- [x] **Defer non-critical JS**: Analytics, ads, tracking
- [x] **Minimize main thread work**: Break up long tasks

### CSS Optimization
- [x] **Tailwind CSS**: Purged, minimal CSS
- [x] **Critical CSS**: Inline above-the-fold styles
- [x] **Defer non-critical CSS**: Media queries, animations

### Caching & ISR
- [x] **Static assets**: Cache-Control: public, max-age=31536000, immutable
- [x] **Sitemap/Robots**: Cache-Control: public, max-age=3600
- [x] **ISR revalidate**:
  - [x] produit/[slug]: 3600 (1 hour)
  - [x] pays/[code]: 86400 (24 hours)
  - [x] kits/[slug]: 3600 (1 hour)

### Server Response Time
- [x] **Supabase queries**: Optimized, indexed
- [x] **Database indexes**: On slug, code, category_main
- [x] **Connection pooling**: Configured
- [x] **TTFB target**: < 600ms

---

## 🔍 Monitoring & Testing

### GitHub Actions Workflows
- [x] **Lighthouse CI**: Runs on push/PR to main/develop
- [x] **Performance assertions**: Perf ≥ 90, SEO ≥ 95, A11y ≥ 90, BP ≥ 95
- [x] **Core Web Vitals assertions**: LCP < 2.5s, CLS < 0.1, TBT < 300ms
- [x] **Bundle analysis**: Size tracking, alerts
- [x] **Artifact uploads**: Results retained 30 days

### Local Testing
- [ ] Run `npm run build` locally
- [ ] Run `npm run start` and test with Lighthouse DevTools
- [ ] Check PageSpeed Insights: https://pagespeed.web.dev
- [ ] Test on mobile device (< 2.5s LCP)
- [ ] Test on slow 4G network (DevTools throttling)

### Production Monitoring
- [ ] Set up Google Search Console
- [ ] Monitor Core Web Vitals in GSC
- [ ] Set up Sentry for error tracking
- [ ] Monitor Lighthouse scores weekly
- [ ] Track rankings in Google Analytics

---

## 📊 Audit Results

### Current State (Before Optimization)
- Mobile OnPage Score: 92.95
- Desktop OnPage Score: 92.95
- LCP: 0ms (not measured)
- TTI: 1898ms (mobile), 2457ms (desktop)
- DOM Complete: 3397ms (mobile), 7151ms (desktop)
- Page Size: 293KB
- Render-blocking resources: Yes
- Low content rate: Yes

### Target State (After Optimization)
- Mobile OnPage Score: ≥ 95
- Desktop OnPage Score: ≥ 95
- LCP: < 2.5s
- TTI: < 3s
- DOM Complete: < 4s
- Page Size: < 200KB
- Render-blocking resources: None
- Low content rate: No

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All Lighthouse CI checks pass
- [ ] Core Web Vitals thresholds met
- [ ] No console errors or warnings
- [ ] All links working (internal & external)
- [ ] Images loading correctly
- [ ] Mobile responsive on all breakpoints
- [ ] Accessibility audit passes (WCAG 2.1 AA)

### Post-Deployment
- [ ] Monitor Lighthouse scores for 24 hours
- [ ] Check Google Search Console for crawl errors
- [ ] Verify sitemap.xml is accessible
- [ ] Verify robots.txt is accessible
- [ ] Test Core Web Vitals on real devices
- [ ] Monitor error tracking (Sentry)
- [ ] Check analytics for traffic changes

---

## 📚 References

- [Google Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring](https://developer.chrome.com/docs/lighthouse/scoring/)
- [Next.js Performance](https://nextjs.org/learn/seo/introduction-to-seo)
- [Schema.org](https://schema.org/)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Tags](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
