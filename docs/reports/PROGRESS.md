# PROGRESS — MISSION: 8 bugs bloquants mobile (30-31/07/2026)

## Livrable final — Récapitulatif des 12 chantiers

| # | Chantier | Statut | Fichiers | Cause racine | Correctif |
|---|---|---|---|---|---|
| 1 | Collision `dynamic` (TDZ) | ✅ | `src/app/groupes/[groupId]/page.tsx` | `import dynamic from 'next/dynamic'` + `export const dynamic = 'force-dynamic'` dans la même route → `Cannot access 'dynamic' before initialization` | Import renommé `nextDynamic`, plus de conflit de nom |
| 2 | Ancien chantier « Jumeau 3D » (page depuis supprimée) | ✅ | ~~`src/app/jumeau-3d/page.tsx`~~ (retiré v3) | Jumeau 3D peu interactif sur mobile ; globe fragile | Refactor historique puis **suppression définitive** de la page dans la refonte Mon Matériel v3 — aucune référence restante |
| 3 | Interactions sociales (like / comment / fav) | ✅ | `src/app/carnets/page.tsx` + migration `content_counters_triggers` | Compteurs (likes/comments/views/favorites) jamais resynchronisés après mutation → état UI incohérent | Triggers SQL `sync_carnet_*_count` + resync état React (`onCommentCountChange`, diff calculé à la lecture) |
| 4 | Carnets ne chargent pas au clic (mobile) | ✅ | `src/app/carnets/page.tsx` | Modals (détail/création/suppression) rendues DANS le bloc desktop `hidden md:block` → invisibles sur mobile ; clic carte ne montrait rien | Modals + toast déplacés à la racine, partagés desktop & mobile |
| 5 | Clubs ne chargent pas (liste + détail) | ✅ | migration `clubs_public_read_policy_fix` | Table `clubs` RLS activée mais AUCUNE policy SELECT (supposée existante puis droppée) → zéro ligne côté client, détail replié sur données factices | Création policy `clubs_read` FOR SELECT TO public USING (true) |
| 6 | Panier : clic article n'ouvre pas le produit | ✅ | `src/app/panier/page.tsx` | Image + nom d'article sans lien en mobile (desktop OK) | Liens `<Link href="/produit/[slug]">` sur l'image et le nom |
| 7 | Nettoyage sidebar (drawer) | ✅ | `src/components/mobile-nav/MobileDrawer.tsx` | Safe-areas iOS absentes (notch / home indicator) sur le drawer | `env(safe-area-inset-top/bottom)` dans les paddings header/footer. Audit complet : aucun doublon BottomTabBar/drawer, aucun lien mort, z-index cohérents (scrim 50 / panel 51), fermeture au clic |
| 8 | Transitions de page | ✅ | `src/components/ui/PageTransition.tsx` | Pas de support `prefers-reduced-motion` | `useReducedMotion()` — animations désactivées si requis ; défaut : fade + y 6→0, sortie y -4, easing Apple `[0.16,1,0.3,1]` |
| 14 | Feed communauté interactif + accès clubs (mobile) | ✅ | `src/app/communaute/page.tsx` | Feed mobile : posts rendus en `<div>` inertes (compteurs ❤️/💬 sans interaction, zéro handler) ; onglet Clubs : cartes sans onClick, `selectedDetailClub` jamais alimenté malgré le `ClubDetailModal` root existant | Feed mobile réutilise `PostCard` (like optimiste + commentaires, même logique que desktop, aucune duplication) ; cartes clubs ouvrent `ClubDetailModal` au tap (discussions/membres/défis/agenda), bouton Rejoindre isolé via `e.stopPropagation()` |
| 15 | RLS : likes feed + flux adhésion/modération clubs | ✅ | migration `club_requests_likes_rls_policies` | Le like (exposé en mobile, chantier 14) échouait silencieusement sur les posts d'autrui (policy UPDATE author-only). Flux clubs morts : `club_join_requests` sans AUCUNE policy (demande + modération invisibles), INSERT `club_members` bloqué pour l'approbation admin, `upsert` cassé (pas de contrainte unique) | Contrainte `UNIQUE (club_id, user_id)` ; policies `club_join_requests` SELECT (soi-même OU membre actif) / INSERT (soi-même) / UPDATE (admin+modérateur) ; policy `club_members` INSERT admin/modérateur (role `member` figé) ; `REVOKE UPDATE` table + `GRANT UPDATE (likes_count)` sur `community_posts` → like ouvert à tout connecté SANS jamais permettre l'édition du contenu par un tiers. Vérifié par probes RLS (simulation JWT, ROLLBACK) : like par non-auteur ✅, édition contenu ❌, anon ❌, demande d'adhésion ✅, approbation modérateur ✅, modérateur voit les demandes ✅, outsider voit 0 ✅ |
| 15b | RLS : escalade de privilèges `club_members` + self-approval `club_join_requests` | ✅ | migrations `club_members_policy_escalation_fix` + `club_join_requests_moderate_with_check_tighten` | (1) La policy FOR ALL héritée `club_members_manage` (WITH CHECK `user_id = auth.uid()`) était OR-combinée avec les nouvelles policies → n'importe quel connecté pouvait s'insérer en `admin` dans n'importe quel club et se promouvoir. (2) Le WITH CHECK de `club_join_requests_moderate` avait une branche `user_id = auth.uid()` → RLS évalue USING/WITH CHECK indépendamment entre policies → self-approval `status='approved'` possible | (1) `DROP club_members_manage` remplacée par 5 policies de commande : self-join (open, role `member`), créateur-as-admin (gated `clubs.created_by`), UPDATE ban/promote admin+modérateur, self-DELETE (quitter), self-UPDATE pending (re-soumission). (2) WITH CHECK moderate resserré sur admin/modérateur. Vérifié par probes RLS (simulation JWT, ROLLBACK) : self-insert admin ❌, self-join fermé ❌, self-promote ❌, ré-insertion banned ❌, self-approve ❌, self-reject ❌, approbation admin ✅, créateur auto-admin ✅, self-join open ✅, re-soumission pending ✅, quitter ✅, ban/promote admin ✅ |
| 16 | Crash carte explorer `Invalid LatLng object: (NaN, NaN)` (mobile) | ✅ | `src/components/explorer/ExplorerMap.tsx` | Gardes de coordonnées faibles à 5 appels Leaflet : `trail.lat !== null` laisse passer `undefined` (`undefined !== null` → `true`), `isFinite(lat)` nu laisse passer `null` (coercition `Number(null) = 0`) → `flyTo`/`latLngBounds`/`L.marker` reçoivent `(NaN, NaN)` → crash runtime sur mobile | Helper `isValidLatLng(lat, lng)` (`!= null` au sens large ET `isFinite(Number(...))`) appliqué aux 5 call sites : flyTo géoloc auto, `fitToTrail`, auto-fit bounds, marqueur utilisateur, locate manuel. `Number()` explicite avant passage à Leaflet |

## Migrations Supabase appliquées (projet `icxyvwzfjbflcbqukpfz`)

- `content_counters_triggers` (20260731084705) — triggers `sync_carnet_likes_count`, `sync_carnet_comments_count`, `sync_carnet_views_count`, `sync_carnet_favorites_count`
- `clubs_public_read_policy_fix` (20260731085235) — policy SELECT `clubs_read` sur `public.clubs`
- `club_requests_likes_rls_policies` (20260731160000) — policies likes `community_posts` + adhésion/modération clubs (voir chantier 15)
- `club_members_policy_escalation_fix` (20260731170000) — remplacement de la policy FOR ALL `club_members_manage` par 5 policies de commande restreintes (voir chantier 15b)
- `club_join_requests_moderate_with_check_tighten` (20260731171500) — WITH CHECK strictement admin/modérateur sur `club_join_requests_moderate` (voir chantier 15b)

## Build

- ✅ `npm run build` — exit 0, aucune erreur (chantier 14 : re-vérifié, "Compiled successfully", 194 pages)
- ⚠️ `npx tsc --noEmit` remonte ~60 erreurs **pré-existantes** (ignoreBuildErrors dans next.config) — aucune dans les fichiers modifiés par cette mission

## Points en pause / notes

- ⚠️ Table `activities` : toujours pas de policy SELECT (hors mission, à traiter ultérieurement)
- ⏸️ Migration `security_audit_rls_cleanup` : NON appliquée (décision — ne pas durcir les policies sans recette claire)
- ⚠️ Chantier 15/15b — limites assumées (résiduelles) : (1) à l'approbation d'une demande, `clubs.members_count` est incrémenté côté client par `ClubDetailModal.handleApproveRequest` (pas atomique avec l'INSERT membre) ; (2) `auth_like_community_posts` USING(true) permet de mettre `likes_count` à n'importe quelle valeur (non négative) — counter fiable mais pas inviolable ; (3) le post like reste `INSERT` libre (`auth_insert_community_posts`) — pas d'anti-spam ; (4) `club_join_requests` rejetées restent visibles par l'admin (pas de purge)
- ⚠️ `TopBar.tsx` : composant mort (aucun import), conservé tel quel (noté, pas supprimé)
- ⚠️ Cartes clubs mobile utilisent `window.location.href` (déviation pré-existante vs règle CLAUDE.md `router.push`), non modifiée pour ne pas casser le flux
- ℹ️ `stash@{0}` présent dans le repo : laissé intact (pas à moi)

---

## Sessions précédentes (SEO, sitemap, terrain)

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
- ✅ ambassadeurs, carbone, clubs, communaute-pro, cookies, copilote, createurs, entraide, experts, feed, fidelite, gamification (⚠️ jumeau-3d supprimé en v3), naviguer, nouveau-groupe, pro, publier, recommandations, voyage-ia — Tier 2 public pages
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

## Chantier 11 — Animation components default exports ✅
- ✅ SearchProvider context error fixed (previous session)
- ✅ AnimatedPage.tsx — added default export + kept named export for backward compatibility
- ✅ ScrollReveal.tsx — added default export + kept named export
- ✅ StaggerGrid.tsx — added default export + kept named export
- ✅ page.tsx — re-added animation component imports (AnimatedPage, ScrollReveal, StaggerGrid)
- ✅ Build verified: 193 pages, compiled 6.5s, exit 0, no errors

## Chantier 12 — Cleanup Navigation Refactor (Design Spec) ✅
### ÉTAPE 2 — Code mort homepage (déjà fait)
- ✅ Vérification: aucun fichier dans `src/app/components/` (les 13 composants obsolètes avaient déjà été supprimés en session précédente)
- ✅ Les composants actifs vivent dans `src/components/home/*` (17 sections utilisées)

### ÉTAPE 3 — Consolidation IA (déjà fait)
- ✅ CopilotFAB.tsx existe déjà et redirige vers `/ai-configurator`
- ✅ `/copilote` accessible uniquement par URL directe (non présent dans MobileDrawer)
- ✅ `/voyage-ia` n'apparaît pas dans la navigation structurée

### ÉTAPE 4 — Pages inachevées (déjà masquées)
- ✅ `/gamification` et `/communaute-pro` ne sont pas dans MobileDrawer
- ✅ Accessibles uniquement par URL directe

### ÉTAPE 5 — Navigation mobile (déjà conforme)
- ✅ MobileDrawer structure validée : 3 sections (Découvrir, Vie pro & occasion, Compte & légal)
- ✅ Pas de doublons avec BottomTabBar
- ✅ Toutes les routes atteignables en 2 taps max

### Build final
- ✅ `npm run build` — 193 pages, compiled 4.6s, exit 0, no errors
- ✅ Toutes les étapes du design spec déjà implémentées ou obsolètes

## Chantier 13 — Terrain Fluidité (Design Spec) ✅
### Hub terrain mobile
- ✅ `/terrain` — page statique (3.23 kB) : desktop redirige vers `/explorer`, mobile rend `TerrainHub` dans `MobilePageShell`
- ✅ `TerrainHub.tsx` — header avec badge GPS actif/hors ligne (`useOnlineStatus`), hero card "Naviguer" (gradient forest, lien `/naviguer`), grille Accès rapide 2×2 (Mon Kit, Recherche, Carte, Guides), CTA "Mode terrain persistant" (à venir)
- ✅ Badge hors ligne en ink `#6B7A72` (orange `#E4501C` interdit par le design system)

### Recherche persistante
- ✅ `SearchOverlay.tsx` — overlay global (déjà existant, haptic ajouté) : scrim + panneau glassmorphism, autofocus, recent searches persistées en localStorage
- ✅ `useRecentSearches.ts` — hooks localStorage pour recherches récentes (add/clear/remove)
- ✅ Soumission → `/boutique?q=` (URL encode), fermeture auto de l'overlay
- ✅ `SearchContext` + `SearchProvider` déjà branchés dans le layout racine

### Offline
- ✅ `OfflineBanner.tsx` — bannière sticky (z-index 55, sous safe-area) quand `navigator.onLine` est faux, toast "Connexion rétablie" au retour du réseau, icône wifi-off en SVG inline (pas de `LkvIcon` dédié), indicateur sage `#A3C4A3`
- ✅ `useOfflineCache.ts` — hook générique cache localStorage + TTL (`lkdv_cache_<key>`), expose `{ data, isLoading, error, isCached, invalidate, clearCache, refetch }`
- ✅ `OfflineBanner` monté dans `MobileNavWrapper` (global via layout)

### Haptique
- ✅ `useHapticFeedback` (`navigator.vibrate`) branché sur : `BottomTabBar` (tab switch, light/medium), `SearchOverlay` (ouverture = selection, submit = success, recent click = light), `TopBar` (back = selection, search = selection)

### Build final
- ✅ `npx next build` — 194 pages, exit 0, aucun warning
- ⚠️ `tsc --noEmit` remonte ~30 erreurs de type **pré-existantes** (abonnements, avis, carnets, clubs, connexion, copilote, faq, groupes, inventaire, kits, location, mes-aventures, nouveau-groupe, produit, GestureCard) — aucune dans les fichiers créés/modifiés par ce chantier
- ⚠️ `GestureCard.tsx` a un mismatch haptic pré-existant (`haptic.light` vs hook `haptic(style)`) — fichier non modifié
