# Quick Start Guide — SEO Technical Refactor

## 🚀 5-Minute Setup

### 1. Verify Environment Variables
```bash
# Check .env file
cat .env | grep NEXT_PUBLIC_SITE_URL

# Should output:
# NEXT_PUBLIC_SITE_URL=https://kitduvoyag4153.builtwithrocket.new
```

### 2. Build & Test Locally
```bash
# Install dependencies
npm ci

# Build
npm run build

# Start server
npm run start

# Open browser
open http://localhost:3000
```

### 3. Run Lighthouse Audit
```bash
# Open DevTools (F12)
# Go to Lighthouse tab
# Click "Analyze page load"
# Wait for results

# Target scores:
# - Performance: >= 90
# - SEO: >= 95
# - Accessibility: >= 90
# - Best Practices: >= 95
```

### 4. Verify Sitemap & Robots
```bash
# Check sitemap
curl http://localhost:3000/sitemap.xml | head -20

# Check robots.txt
curl http://localhost:3000/robots.txt
```

### 5. Deploy
```bash
git add .
git commit -m "feat: SEO technical refactor - Server Components, JSON-LD, ISR, Lighthouse CI"
git push origin main
```

---

## 📄 File Structure

```
project/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                    # ✅ Optimized with preload, DNS prefetch
│  │  ├─ robots.ts                     # ✅ New: Unique robots.txt
│  │  ├─ sitemap.ts                    # ✅ Updated: Dynamic from Supabase
│  │  ├─ produit/
│  │  │  └─ [slug]/
│  │  │     └─ page.tsx                # ✅ Updated: Server Component + JSON-LD
│  │  ├─ pays/
│  │  │  └─ [code]/
│  │  │     └─ page.tsx                # ✅ Updated: Server Component + JSON-LD
│  ├─ lib/
│  │  ├─ seo-utils.ts               # ✅ New: SEO utilities
│  │  ├─ core-web-vitals.ts         # ✅ New: CWV thresholds & checklist
│  │  └─ bundle-optimization.ts     # ✅ New: Bundle splitting config
├─ .github/
│  └─ workflows/
│     └─ lighthouse-ci.yml          # ✅ New: GitHub Actions workflow
├─ .lighthouseci/
│  ├─ lighthouserc.json           # ✅ New: Lighthouse CI config
│  └─ lighthouserc-config.json   # ✅ New: Lighthouse audit config
├─ next.config.mjs                # ✅ Updated: Performance optimizations
├─ SEO_TECHNICAL_REFACTOR.md     # ✅ New: Complete documentation
├─ CORE_WEB_VITALS_CHECKLIST.md  # ✅ New: Checklist & monitoring
├─ MONITORING_GUIDE.md            # ✅ New: Monitoring setup & dashboards
└─ QUICK_START.md                 # ✅ This file
```

---

## 📋 Key Changes Summary

### 1. Product Pages (`/produit/[slug]`)
**Before:** Client Component, basic metadata
**After:** Server Component with:
- generateStaticParams() for all products
- generateMetadata() with dynamic title, description, OG
- JSON-LD Product + BreadcrumbList
- ISR revalidate: 3600

### 2. Country Pages (`/pays/[code]`)
**Before:** Client Component, basic metadata
**After:** Server Component with:
- generateStaticParams() for published countries
- generateMetadata() with dynamic title, description, OG
- JSON-LD TouristDestination + BreadcrumbList + FAQPage
- ISR revalidate: 86400

### 3. Sitemap (`sitemap.ts`)
**Before:** Static routes only
**After:** Dynamic from Supabase:
- 15 static routes
- All products (limit 1000)
- All published countries
- All kits, tools, guides, categories
- Optimized priorities & changeFrequency

### 4. Robots (`robots.ts`)
**Before:** Basic rules
**After:** Unique with:
- Googlebot: explicit allow for SEO pages
- Bingbot: similar rules with crawlDelay
- Other crawlers: crawlDelay: 2
- Disallow all private routes

### 5. Layout (`layout.tsx`)
**Before:** Basic metadata
**After:** Optimized with:
- Preload LCP images
- DNS prefetch for external domains
- Preconnect to critical origins
- JSON-LD Organization + WebSite
- Main id for accessibility

### 6. Performance (`next.config.mjs`)
**Before:** Basic config
**After:** Optimized with:
- AVIF/WebP image formats
- Preload LCP images
- Bundle splitting config
- Cache headers for assets
- ISR support

---

## 🔧 Troubleshooting

### Issue: Build fails with "generateStaticParams timeout"
**Solution:**
```typescript
// Limit products to prevent timeout
const { data } = await supabase
  .from('shop_products')
  .select('slug')
  .limit(500); // Reduce if still timing out
```

### Issue: Lighthouse CI workflow fails
**Solution:**
```bash
# Check GitHub Actions logs
# Verify LHCI_GITHUB_APP_TOKEN is set in secrets
# Ensure server starts correctly
npm run start &
npx wait-on http://localhost:3000 --timeout 60000
```

### Issue: Sitemap is empty
**Solution:**
```bash
# Check Supabase connection
# Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# Test query manually:
curl -X GET 'https://[project].supabase.co/rest/v1/shop_products?select=slug' \
  -H 'apikey: [anon-key]'
```

### Issue: JSON-LD not rendering
**Solution:**
```typescript
// Ensure script tag has suppressHydrationWarning
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
  suppressHydrationWarning
/>
```

### Issue: LCP still > 2.5s
**Solution:**
```bash
# 1. Check image sizes
du -sh public/assets/images/*

# 2. Verify preload is working
# DevTools Network tab: look for preload links

# 3. Check server response time
# DevTools Network tab: TTFB should be < 600ms

# 4. Defer non-critical scripts
# Move analytics to defer
```

---

## 📊 Monitoring Checklist

### Daily
- [ ] Check GitHub Actions Lighthouse CI results
- [ ] Monitor Sentry for errors
- [ ] Check GA4 traffic

### Weekly
- [ ] Run PageSpeed Insights audit
- [ ] Review Google Search Console
- [ ] Check Core Web Vitals
- [ ] Review bundle size

### Monthly
- [ ] Full SEO audit
- [ ] Competitor analysis
- [ ] Keyword ranking review
- [ ] Performance optimization review

---

## 📚 Documentation

- **SEO_TECHNICAL_REFACTOR.md** — Complete implementation guide
- **CORE_WEB_VITALS_CHECKLIST.md** — Checklist & monitoring
- **MONITORING_GUIDE.md** — Monitoring setup & dashboards
- **QUICK_START.md** — This file

---

## 🚀 Next Steps

1. **Deploy to production**
   ```bash
   git push origin main
   ```

2. **Monitor for 24 hours**
   - Check Lighthouse scores
   - Monitor Core Web Vitals
   - Check for errors

3. **Set up monitoring dashboards**
   - Google Search Console
   - Google Analytics 4
   - PageSpeed Insights
   - Sentry

4. **Optimize based on data**
   - Review Lighthouse opportunities
   - Optimize slow pages
   - Improve Core Web Vitals

---

## 📞 Support

For questions or issues:
1. Check the troubleshooting section above
2. Review SEO_TECHNICAL_REFACTOR.md
3. Check Lighthouse audit results
4. Review Google Search Console

---

**Last Updated:** 2025-07-20
**Status:** ✅ Ready for Production
