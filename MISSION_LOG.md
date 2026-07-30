# Mission Log — Finalisation Mobile v2

## Lot A — DB Security Audit & RLS Cleanup ✅
**Migration:** `20260729110000_security_audit_rls_cleanup.sql`
- `is_admin()` : SECURITY DEFINER → SECURITY INVOKER (ne lit que auth.uid())
- Duplicate policies nettoyées sur ~20 tables (DROP POLICY IF EXISTS)
- `spatial_ref_sys` : documenté comme bloqué (table postgres, pas via API Supabase)
- Vérifié que les RLS permissives authenticated étaient déjà corrigées par migration antérieure

## Lot B — Groupes/Carnet pages integration ✅
**Fichiers modifiés :**
- `src/app/groupes/page.tsx` — Conversion dual-view complète :
  - Desktop : conservé avec Header/Footer/AppIcon
  - Mobile : nouvel affichage avec MobilePageShell + LkvIcon + cartes simplifiées
  - États : loading, empty, connecté/non connecté, mes groupes, découverte
- `src/app/groupes/[groupId]/page.tsx` — AppIcon → LkvIcon (breadcrumbs chevrons)
- `src/app/nouveau-groupe/page.tsx` — Conversion dual-view :
  - Desktop : conservé intégralement
  - Mobile : formulaire simplifié avec MobilePageShell + champs essentiels
- `src/app/carnets/[id]/page.tsx` — Aucun changement (server component, délègue à CarnetView)
- `src/app/carnets/nouveau/page.tsx` — Aucun changement (thin wrapper CreateCarnetView)

## Lot C — Fix 3 bugs récurrents ✅
1. **`/admin` accessible sans auth** ✅
   - Middleware: ajout explicite de `/admin` dans le matcher (défense-in-depth)
   - Client-side guard: vérification auth + admin role dans `admin/page.tsx` avec spinner loading
   - Deux couches de protection : middleware + client

2. **SSR des pages produit** ✅
   - Server Component (`produit/[slug]/page.tsx`) : récupère `shop_products` et passe `initialProduct` au client
   - Client (`ProductDetailClient.tsx`) : utilise `initialProduct` pour initialiser l'état → skip le loading state
   - Élimine le loading flash / layout shift à chaque navigation

3. **Compteurs de contenu** ✅
   - **Migration `20260729120000_content_counters_triggers.sql`** :
     - Trigger `carnet_likes` INSERT/DELETE → `carnets.likes_count`
     - Trigger `carnet_comments` INSERT/DELETE → `carnets.comments_count`
     - Trigger `carnet_favorites` INSERT/DELETE → `carnets.favorites_count`
     - Table `carnet_views` + trigger INSERT → `carnets.views_count`
     - Backfill des compteurs existants
   - **Application** :
     - `carnets/page.tsx` : retrait des `.update({count})` redondants (trigger gère)
     - `CarnetDetailModal` : insertion `carnet_views` à l'ouverture
   - Avantage : compteurs atomiques et cohérents, pas de race conditions

## Lot D — Mobile shell rollout ✅
Rollout mobile shell dual-view à ~60 pages (59 fichiers modifiés, +7520 / -12994 lignes)

**Social pages :**
- `messagerie/page.tsx` — Dual-view : desktop responsive existant, mobile vue simplifiée inline-styles
- `communaute/page.tsx` — Dual-view : 2035 lignes, héro + 4 tabs + sidebar desktop, compact mobile
- `communaute/publier/page.tsx` — Dual-view : formulaire 2-colonnes desktop, mono-colonne mobile
- `clubs/page.tsx` — Dual-view : héro immersive + ClubCard grid desktop, liste compacte mobile
- `clubs/[id]/page.tsx` — Dual-view : détail club complet desktop, simplifié mobile
- `clubs/nouveau/page.tsx` — Dual-view : wrapper CreateClubView

**Shop / Catalogue :**
- `boutique/BoutiqueClient.tsx` — Dual-view : grille produits + filtres desktop, mobile simplifié
- `kits/page.tsx` — Dual-view : grille 2/3 colonnes desktop, cartes simple colonne mobile
- `kits/[slug]/KitDetailPage.tsx` — Dual-view : héro + layout complet desktop, compact mobile
- `outils/page.tsx` — Dual-view : héro stats + grille 3-col desktop, liste mobile
- `outils/[slug]/page.tsx` — Dual-view : détail outil complet desktop, simplifié mobile
- `shop/page.tsx`, `catalogue/page.tsx`, `catalogue/[categorie]/page.tsx` — Redirects, sans changement UI

**Contenu / Info :**
- `guides/page.tsx` — Dual-view : grille cartes desktop, liste simplifiée mobile
- `guides/[slug]/GuideDetailClient.tsx` — Dual-view : loading/notFound/détail, inline-styles mobile
- `blog/BlogClient.tsx` — Dual-view : featured + posts grid + newsletter desktop, compact mobile
- `evenements/page.tsx` — Dual-view : EventCard + sidebar desktop, carte compacte mobile
- `abonnements/page.tsx` — Dual-view : plans abonnement dark theme, inline-styles mobile
- `fidelite/page.tsx` — Dual-view : 4 tabs fidélité, inline-styles mobile
- `inventaire/page.tsx` — Dual-view : MobileInventaireView existant intégré
- `inventaire/[id]/page.tsx` — Dual-view : détail équipement complet, specs + tabs mobile
- `mes-aventures/page.tsx` — Dual-view : liste trails, forest-800 pour états actifs mobile

**Pages diverses (~30) :**
- Pages légales : cgu, cgv, mentions-legales, politique-confidentialite, cookies
- Communauté : ambassadeurs, createurs, communaute-pro, entraide, experts
- Outils : configurateur, copilote, voyage-ia, ai-configurator
- Commerce : encheres, occasion, location
- Navigation : carte, carte-interactive, pays, pays/[code], naviguer
- Profil : profil, profil/[id], compte/modifier
- Autres : contact, faq, activite, feed, gamification, mon-kit, not-found, rapport-expedition, rapport-kit, recommandations, publier, jumeau-3d, carbone, avis, alertes, pro, inscription, connexion

**Pattern appliqué :** Dual-view `hidden md:block` / `block md:hidden` + `MobilePageShell` sur toutes les pages. Inline styles pour les vues mobiles (pas de Tailwind). Footer spacer `calc(62px + 12px + 12px + env(safe-area-inset-bottom))`. Forest-800 `#17402C` pour les états actifs (zéro orange `#E4501C` dans les vues mobiles).

## Lot E — Design System Audit & Standardisation ✅

### Fix composants cassés (template literal Tailwind)
- **`Button.tsx`** : Refactor complet — les classes Tailwind dynamiques (`bg-${theme.colors.primary}`) produisaient des chaînes invalides comme `bg-#132219`. Remplacé par inline styles avec `React.CSSProperties`, gestion d'état hover/focus, variant `primary`/`secondary`/`danger`/`ghost`, taille `sm`/`md`/`lg`, état loading avec spinner.
- **`Card.tsx`** : Même correctif — les 3 variants (`default`/`elevated`/`outlined`) utilisent désormais des styles inline avec couleurs et ombres ink-based.

### Bannissement orange `#E4501C` → forest-800 `#17402C`
- 67 fichiers nettoyés de `#E4501C` (orange) par sed. Remplacement systématique par `#17402C` (forest-800) conformément à la charte.
- Composants concernés : carnet, carnets, clubs, compte, explorer, groupes, home, mobile-nav, app pages, map, admin, layout, mock data, og-image-generator.
- `MediaUpload.tsx` : icône upload, bordures dashed, barre progression orange → forest-800.

### Animation curves standardisées
- Standard `--spring-smooth` : `cubic-bezier(0.16, 1, 0.3, 1)` (courbe iOS-like).
- `LkvButton.tsx` : `220ms cubic-bezier(0.2, 0.8, 0.2, 1)` → `220ms cubic-bezier(0.16, 1, 0.3, 1)`.
- `Button.tsx` : `150ms cubic-bezier(0.2, 0.8, 0.2, 1)` → `200ms cubic-bezier(0.16, 1, 0.3, 1)`.
- `PageTransition.tsx`, `ScrollReveal.tsx` : déjà conformes ✅.
- `PremiumBottomSheet.tsx` : déjà conforme ✅.

### Dark mode renforcé
- `.dark` CSS : ajout des overrides pour `primary`, `primary-hover`, `primary-subtle`, `secondary`, `accent`, `surface`, `surface-elevated`, `border-subtle`, `ring`, `success`, `warning`, `danger`.
- Ombres dark mode : toutes les variables `--shadow-*` passent en `rgba(0,0,0, x%)` au lieu de `rgba(26,31,28, x%)`.
- Override `.dark .premium-card:hover` pour ombres adaptées.

### Accessibilité
- `*:focus-visible` global : outline `2px solid var(--primary)` pour navigation clavier.
- `.focus-ring:focus` → `.focus-ring:focus-visible` (ne concerne que la navigation clavier).
- Respect `prefers-reduced-motion` déjà présent ✅.

### Audit composants UI (16 fichiers)
| Composant | Statut | Notes |
|-----------|--------|-------|
| Button.tsx | ✅ Fixé | Inline styles, hover/focus state |
| Card.tsx | ✅ Fixé | Inline styles, 3 variants |
| LkvButton.tsx | ✅ Conforme | Transition curve standardisée |
| LkvChip.tsx | ✅ Conforme | Inline styles, glassmorphism |
| LkvIcon.tsx | ✅ Conforme | SVG inline, 22 icônes |
| AppIcon.tsx | ✅ Conforme | Heroicons wrapper |
| AppImage.tsx | ✅ Conforme | Next/Image avec fallback |
| AppLogo.tsx | ✅ Conforme | Thin wrapper |
| Skeleton.tsx | ✅ Conforme | Shimmer animation |
| EmptyState.tsx | ✅ Conforme | Static Tailwind |
| BackButton.tsx | ✅ Conforme | 3 variants |
| PremiumBottomSheet.tsx | ✅ Conforme | Snap points, drag, glassmorphism |
| PageTransition.tsx | ✅ Conforme | Framer motion, spring-smooth |
| ScrollReveal.tsx | ✅ Conforme | Framer motion, spring-smooth |
| GlobalSearchModal.tsx | ✅ Conforme | Recherche multi-source |
| MediaUpload.tsx | ✅ Fixé | Orange → forest-800 |

### Typographie
- Polices configurées dans `tailwind.config.js` : `font-sans` (DM Sans), `font-display` (Manrope), `font-mono` (IBM Plex Mono).
- CSS variables `--font-sans`, `--font-display`, `--font-mono` dans `tailwind.css`.
- Pattern serif italic (Georgia, `#17402C`) préservé pour les emphases typographiques.
- Headings (h1-h4) utilisent `font-display` via `@layer base`.
- Tokens dans `src/design/tokens.ts` alignés.
