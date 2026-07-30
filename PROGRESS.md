# PROGRESS — Session autonome 30/07/2026

## Chantier 1 — Navigation mobile cleanup ✅
- MobileDrawer already has correct structure (Découvrir, Vie pro & occasion, Compte & légal sections)
- No "Accueil" or "Paramètres" duplicates
- Verified: no overlap with BottomTabBar

## Chantier 2 — Supprimer routes mortes ✅
- ✅ robots.ts — removed `/catalogue/` from allow rules (replaced with `/boutique/`)
- ✅ TopBar.tsx — removed dead `/catalogue` and `/shop` references from PARENT_TAB and PAGE_TITLES
- ✅ not-found.tsx — fixed `/shop` → `/boutique`
- ✅ CopilotFAB.tsx — redirected `/copilote` → `/ai-configurator`
- ✅ middleware.ts — `/catalogue` → `/boutique` (direct, not via `/shop`), removed from matcher
- ✅ panier/page.tsx — all `/catalogue` links → `/boutique`
- ✅ carbone/page.tsx — all `/catalogue` links → `/boutique`
- ✅ ProductDetailClient.tsx — `/catalogue` link → `/boutique`
- ✅ produit/[slug]/page.tsx — breadcrumb JSON-LD → `/boutique?categorie=...`
- ✅ ConfiguratorWizard.tsx — `/catalogue` link → `/boutique`
- ✅ abonnements/page.tsx — "Remise 10%/20% catalogue" = descriptive text, not links, à garder

## Chantier 3 — SEO Metadata Enrichment ✅
- ✅ Audit complet: 58 client-component pages → toutes couvertes par layouts
- ✅ 22 nouveaux layouts créés (session précédente) pour pages sans metadata
- ✅ admin/produits/page.tsx — description ajoutée au metadata
- ✅ groupes/layout.tsx — description + openGraph enrichis
- ✅ 14 layouts enrichis (description + OG tags) : admin, carnets, checkout, compte, connexion, inscription, inventaire, mes-aventures, messagerie, mon-kit, panier, profil, rapport-expedition, rapport-kit
- ✅ Titres nettoyés (suppression double marque avec le template racine)
- ✅ Build vérifié (exit 0)

## Chantier 4 — Structured Data Enrichment ✅
### Phase 1 (7 layouts — previous session)
- ✅ guides/\[slug\]/page.tsx — WebPage → Article schema (@graph format)
- ✅ explorer/layout.tsx, contact/layout.tsx, abonnements/layout.tsx, location/layout.tsx, encheres/layout.tsx, occasion/layout.tsx — WebPage + BreadcrumbList

### Phase 2 (25 layouts — this session)
- ✅ pays, communaute, avis, carte-interactive, evenements, faq — Tier 1 high-traffic public pages
- ✅ ambassadeurs, carbone, clubs, communaute-pro, cookies, copilote, createurs, entraide, experts, feed, fidelite, gamification, jumeau-3d, naviguer, nouveau-groupe, pro, publier, recommandations, voyage-ia — Tier 2 public pages
- ✅ 25 layouts enriched with WebPage + BreadcrumbList via metadata `other` field
- ✅ All reference root website via `isPartOf: { '@id': \`\${siteUrl}/#website\` }`
- ✅ Build vérifié (exit 0, clean build)

## Chantier 5 — JSON-LD page.tsx enrichment ✅
### Phase 1 — Pages sans structured data (7 pages)
- ✅ cgu/page.tsx — WebPage + BreadcrumbList (CGU légales)
- ✅ cgv/page.tsx — WebPage + BreadcrumbList (CGV e-commerce)
- ✅ mentions-legales/page.tsx — WebPage + BreadcrumbList
- ✅ politique-confidentialite/page.tsx — WebPage + BreadcrumbList
- ✅ carte/page.tsx — WebPage + BreadcrumbList (carte interactive)
- ✅ outils/page.tsx — WebPage + BreadcrumbList (boîte à outils)
- ✅ ai-configurator/page.tsx — WebPage + BreadcrumbList

### Phase 2 — Upgraded schema types (4 listing pages)
- ✅ boutique/page.tsx — WebPage → CollectionPage
- ✅ kits/page.tsx — WebPage → CollectionPage
- ✅ blog/page.tsx — WebPage → Blog
- ✅ guides/page.tsx — WebPage → CollectionPage

### Phase 3 — Build vérifié
- ✅ `npx next build` — 194 pages, exit 0, clean build

## Chantier 7 — SEO Fixes (robots, sitemap, llms.txt, carte) ✅
- ✅ robots.ts — `/cookies/` moved from disallow to allow in Googlebot, Bingbot, and * blocks (legal page should be indexable)
- ✅ sitemap.ts — added `/clubs` to staticRoutes (priority 0.5, monthly)
- ✅ llms.txt — added `/clubs` under Communauté section, added all 20 individual tool links under Outils
- ✅ `/carte-interactive/page.tsx` — replaced "à venir" placeholder with real InteractiveMap (CarteClient + JSON-LD inline scripts)
- ✅ `/carte-interactive/CarteClient.tsx` — created client component wrapping InteractiveMap with Header
- ✅ `/carte-interactive/layout.tsx` — removed duplicate JSON-LD (page.tsx now handles inline scripts)
- ✅ `next.config.mjs` — added 308 redirect `/carte` → `/carte-interactive`
- ✅ Old `/carte/` directory deleted (dead code, replaced by `/carte-interactive`)
- ✅ Build vérifié (exit 0, 193 pages, clean build)

## Chantier 8 — SEO Fixes P0/P2 (this session) 🏗️
- ✅ P0 — Homepage WebPage schema: injected inline JSON-LD (WebPage + BreadcrumbList) in `page.tsx` (client component can't export metadata, so inline `<script>` tags used)
- ✅ P2 — `/carnets` contradiction: changed `noindex: false` → `index: true` in carnets/layout.tsx (public page, sitemap priority 0.7/weekly)
- ✅ P2 — SearchAction in seo-utils.ts: fixed broken `/search?q=` URL → `/boutique?q=` (no `/search` route exists)
- ✅ P2 — 404 page structured data: added WebPage JSON-LD to `not-found.tsx`
- ✅ P2 — Missing canonicals on layouts: ajouté `alternates: { canonical }` à 47 layouts
- ✅ Build vérifié (exit 0, 193 pages, clean build)

## Chantier 9 — Final verification & cleanup ✅
- ✅ robots.ts — `/cookies/` added to Googlebot allow list (was missing after previous edits)
- ✅ Build verified: 193 pages, compiled 11.2s, exit 0, no errors

## Chantier 10 — Sitemap cleanup (non-implemented tools) ✅
- ✅ Removed 11 unimplemented tool slugs from sitemap.ts (`decompression`, `altimetre`, `meteo-montagne`, `carbone`, `debit-eau`, `pharmacie`, `visa`, `vaccins`, `langue`, `noeud`, `soleil`) — these slugs show "Outil introuvable" (not in toolRegistry) and were wasting crawl budget with thin content
- ✅ Build verified: 193 pages, compiled 7.2s, exit 0, no errors
