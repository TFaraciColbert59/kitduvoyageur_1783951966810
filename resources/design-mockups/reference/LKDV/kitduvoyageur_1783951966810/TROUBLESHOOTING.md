# Troubleshooting Guide — SEO Technical Refactor

## 🔍 Common Issues & Solutions

### 1. Build Issues

#### Issue: "generateStaticParams timeout"
```
Error: Build timed out while generating static params
```

**Root Cause:** Too many products to generate at build time

**Solution:**
```typescript
// src/app/produit/[slug]/page.tsx
export async function generateStaticParams() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('shop_products')
      .select('slug')
      .order('score_kdv', { ascending: false })
      .limit(300); // Reduce from 500 to 300

    return (data || []).map((p) => ({ slug: p.slug }));
  } catch {
    return []; // Fallback to on-demand generation
  }
}
```

---

#### Issue: "Cannot find module '@/lib/seo-utils'"
```
Error: Module not found: Can't resolve '@/lib/seo-utils'
```

**Root Cause:** File not created or path alias misconfigured

**Solution:**
```bash
# 1. Verify file exists
ls -la src/lib/seo-utils.ts

# 2. Check tsconfig.json paths
grep -A 5 '"paths"' tsconfig.json

# 3. Rebuild
rm -rf .next
npm run build
```

---

#### Issue: "Supabase query timeout"
```
Error: Supabase query timed out after 30s
```

**Root Cause:** Database query too slow or connection issue

**Solution:**
```typescript
// 1. Add timeout
const { data, error } = await supabase
  .from('shop_products')
  .select('slug')
  .limit(500)
  .timeout(10000); // 10 second timeout

if (error) {
  console.error('Supabase error:', error);
  return []; // Fallback
}

// 2. Verify database indexes
// In Supabase SQL editor:
CREATE INDEX idx_products_slug ON shop_products(slug);
CREATE INDEX idx_products_score ON shop_products(score_kdv);
```

---

### 2. Metadata Issues

#### Issue: "Open Graph image not showing on social media"
```
Twitter/Facebook preview shows no image
```

**Root Cause:** Image URL not absolute or image doesn't exist

**Solution:**
```typescript
// Wrong: relative URL
openGraph: {
  images: [{ url: '/assets/images/og-image.png' }]
}

// Correct: absolute URL
openGraph: {
  images: [{
    url: `${siteUrl}/assets/images/og-image.png`,
    width: 1200,
    height: 630,
    alt: 'Description'
  }]
}

// Verify image exists
curl -I https://kitduvoyag4153.builtwithrocket.new/assets/images/og-image.png
```

---

#### Issue: "JSON-LD not validating"
```
Google Rich Results Test shows errors
```

**Root Cause:** Invalid JSON-LD structure or missing required fields

**Solution:**
```typescript
// Validate JSON-LD structure
const schema = {
  '@context': 'https://schema.org', // Required
  '@type': 'Product', // Required
  name: 'Product Name', // Required
  description: 'Description', // Required
  image: 'https://example.com/image.jpg', // Required (absolute URL)
  offers: {
    '@type': 'Offer',
    price: '99.99', // String, not number
    priceCurrency: 'EUR', // Required
    availability: 'https://schema.org/InStock', // Full URL
  },
};

// Test at: https://search.google.com/test/rich-results
```

---

### 3. Performance Issues

#### Issue: "LCP > 2.5s"
```
Lighthouse shows LCP: 3.2s
```

**Root Cause:** Large image, slow server response, or render-blocking resources

**Solution:**
```bash
# 1. Check image size
du -sh public/assets/images/og-image.png
# Should be < 100 KB

# 2. Verify preload is working
# DevTools Network tab: look for preload links

# 3. Check TTFB (Time to First Byte)
# DevTools Network tab: should be < 600ms

# 4. Check for render-blocking resources
# DevTools Lighthouse: should show none
```

---

#### Issue: "CLS > 0.1"
```
Lighthouse shows CLS: 0.15
```

**Root Cause:** Images without dimensions, fonts causing FOUT/FOIT, or dynamic content

**Solution:**
```typescript
// 1. Add width/height to images
<Image
  src="/image.jpg"
  alt="Description"
  width={1200}
  height={630}
  priority // For LCP images
/>

// 2. Preload fonts
<link
  rel="preload"
  href="/fonts/public-sans-400.woff2"
  as="font"
  type="font/woff2"
  crossOrigin="anonymous"
/>

// 3. Reserve space for dynamic content
<div style={{ minHeight: '100px' }}>
  {/* Dynamic content */}
</div>
```

---

#### Issue: "Bundle size > 500 KB"
```
Build shows: Total JS: 650 KB
```

**Root Cause:** Large dependencies or missing code splitting

**Solution:**
```bash
# 1. Analyze bundle
npm run build
du -sh .next/static/chunks/*.js | sort -h

# 2. Use dynamic imports
// Before
import ConfiguratorWizard from '@/components/ConfiguratorWizard';

// After
const ConfiguratorWizard = dynamic(
  () => import('@/components/ConfiguratorWizard'),
  { loading: () => <Skeleton /> }
);

# 3. Tree-shake unused code
// Before
import * as HeroIcons from '@heroicons/react/24/solid';

// After
import { MapPinIcon, StarIcon } from '@heroicons/react/24/solid';
```

---

### 4. Sitemap Issues

#### Issue: "Sitemap is empty or incomplete"
```
Sitemap shows 0 URLs or missing products
```

**Root Cause:** Supabase query failing or returning no data

**Solution:**
```bash
# 1. Test Supabase connection
curl -X GET 'https://[project].supabase.co/rest/v1/shop_products?select=slug&limit=10' \
  -H 'apikey: [anon-key]'

# 2. Check for errors in logs
npm run build 2>&1 | grep -i error

# 3. Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. Test sitemap endpoint
curl http://localhost:3000/sitemap.xml | head -50
```

---

### 5. GitHub Actions Issues

#### Issue: "Lighthouse CI workflow fails"
```
GitHub Actions: Lighthouse CI failed
```

**Root Cause:** Server not starting, timeout, or assertion failure

**Solution:**
```yaml
# .github/workflows/lighthouse-ci.yml
- name: Wait for server
  run: npx wait-on http://localhost:3000 --timeout 60000

- name: Run Lighthouse CI
  run: lhci autorun
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
    NEXT_PUBLIC_SITE_URL: ${{ secrets.NEXT_PUBLIC_SITE_URL }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

**Verify secrets:**
```bash
# In GitHub repo settings:
# Settings > Secrets and variables > Actions
# Verify these secrets exist:
# - LHCI_GITHUB_APP_TOKEN
# - NEXT_PUBLIC_SITE_URL
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

### 6. SEO Issues

#### Issue: "Pages not indexed by Google"
```
Google Search Console: 0 indexed pages
```

**Root Cause:** robots.txt blocking, noindex tag, or crawl errors

**Solution:**
```bash
# 1. Check robots.txt
curl https://lekitduvoyageur.fr/robots.txt
# Should allow: /

# 2. Check for noindex
curl https://lekitduvoyageur.fr | grep -i noindex
# Should not find noindex on public pages

# 3. Submit sitemap to Google Search Console
# https://search.google.com/search-console

# 4. Request indexing
# Google Search Console > URL Inspection > Request Indexing
```

---

#### Issue: "Canonical URL not working"
```
Google Search Console: Duplicate without user-selected canonical
```

**Root Cause:** Canonical URL not set or incorrect

**Solution:**
```typescript
// Verify canonical is set
export async function generateMetadata({ params }): Promise<Metadata> {
  const canonicalUrl = `${siteUrl}/produit/${slug}`;
  
  return {
    alternates: {
      canonical: canonicalUrl, // Must be absolute URL
    },
  };
}

// Verify in HTML
// DevTools > Elements > <head>
// Should see: <link rel="canonical" href="https://...">
```

---

## 📚 Debugging Tools

### 1. Lighthouse DevTools
```
F12 > Lighthouse > Analyze page load
```

### 2. Google Rich Results Test
```
https://search.google.com/test/rich-results
```

### 3. Google Mobile-Friendly Test
```
https://search.google.com/test/mobile-friendly
```

### 4. PageSpeed Insights
```
https://pagespeed.web.dev
```

### 5. Lighthouse CI
```bash
npm install -g @lhci/cli
lhci autorun
```

### 6. Bundle Analyzer
```bash
npm run build
du -sh .next/static/chunks/*.js | sort -h
```

---

## 📞 Support

For additional help:
1. Check SEO_TECHNICAL_REFACTOR.md
2. Review CORE_WEB_VITALS_CHECKLIST.md
3. Check MONITORING_GUIDE.md
4. Review Lighthouse audit results
5. Check Google Search Console

---

**Last Updated:** 2025-07-20
**Status:** ✅ Active Support
