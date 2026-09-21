# PHASE 3 — RAPPORT FINAL (dette restante ciblée, faible risque)

> Base : `6203a5a0` (Phase 2 terminée). Aucune refonte UI, aucun nouveau composant,
> aucune logique métier modifiée, aucun test supprimé, `tokens.css` non modifié,
> `NATIVE_TABBAR_ENABLED = false` inchangé (`src/components/mobile-nav/NavigationBar.tsx:16`).

---

## 1. Mission 1 — `tests/design/x6-accessibility.spec.ts` recâblé sur les tokens réels

### Méthode de lecture
- `readFileSync('src/styles/tokens.css')` au runtime du test (aucune constante hex).
- Parse du **premier bloc `:root`** (thème clair ; le bloc `.dark` est ignoré) :
  regex `/:root\s*\{([\s\S]*?)\n\}/`, commentaires `/* */` retirés, déclarations
  `--token: valeur;` indexées dans une Map.
- Garde-fous : chaque token requis doit exister (sinon test rouge) et matcher
  `^#[0-9A-Fa-f]{6}$` (sinon test rouge) — plus aucune valeur dupliquée en dur.
- 10 cas conservés (mêmes intentions). `--lkv-primary` n'est plus utilisé pour le
  bouton : la source canonique de l'action est `--lkv-on-action` / `--lkv-action`
  (cf. `tokens.css` §1) ; `--lkv-surface-card` remplace le « blanc » historique.

### Résultats réels (valeurs parsées, formule WCAG 2.1)
| Cas | Couleurs réelles lues | Ratio | Seuil | Verdict |
|---|---|---|---|---|
| Texte primaire / surface | `#172B24` sur `#F5F7F3` | **13.84** | ≥ 7.0 (AAA) | ✅ |
| Texte primaire / surface-card | `#172B24` sur `#FFFFFF` | **14.92** | ≥ 7.0 (AAA) | ✅ |
| Bouton action (on-action / action) | `#FFFFFF` sur `#226148` | **7.31** | ≥ 7.0 (AAA) | ✅ |
| Danger / surface | `#A8443A` sur `#F5F7F3` | **5.48** | ≥ 4.5 (AA) | ✅ |
| Danger / surface-card | `#A8443A` sur `#FFFFFF` | **5.91** | ≥ 4.5 (AA) | ✅ |
| Info / surface-card | `#4B6B7C` sur `#FFFFFF` | **5.69** | ≥ 4.5 (AA) | ✅ |
| Texte muted / surface | `#5C6B62` sur `#F5F7F3` | **5.22** | ≥ 4.5 (AA ; ancien arbitrage 4.0) | ✅ |
| Texte secondaire / surface | `#56665D` sur `#F5F7F3` | **5.64** | ≥ 4.5 (AA) | ✅ |
| Warning foncé / surface | `#8C6418` sur `#F5F7F3` | **4.93** | ≥ 4.5 (AA) | ✅ |
| Warning graphique / surface | `#C89A3B` sur `#F5F7F3` | **2.39** | ≥ 2.0 (décoratif) | ⚠️ |

### Échecs / arbitrages
- **Aucun token modifié.** Aucun couple n'échoue par rapport à son seuil de rôle.
- **Dette signalée** : `--lkv-warning` seul = **2.39:1**, inférieur au seuil WCAG
  1.4.11 (3:1) des composants d'interface. Il reste utilisable en pastille
  décorative (seuil 2:1 gelé par le test) mais **pas** comme texte/bordure de
  contrôle : utiliser `--lkv-warning-dark` (4.93:1). Documenté en commentaire
  dans le test.
- L'ancien arbitrage « secondaire sauge ~3.5:1, texte large uniquement » est
  obsolète : `--lkv-text-secondary` Phase 2 est un neutre foncé (5.64:1, AA normal).
- Ancien test « blanc sur `#17402C` primary » requalifié sur `--lkv-action` (7.31).

Vérification : `npx vitest run tests/design/x6-accessibility.spec.ts` → **10/10**.

---

## 2. Mission 2 — Inline statiques nettoyés

### Compteur (script d'audit `style={{…}}`, classification statique/dynamique)
| Mesure | Avant Phase 3 | Après Phase 3 |
|---|---|---|
| Occurrences totales | 285 | **268** |
| Statiques | 123 | **106** |
| Dynamiques | 162 | 162 |
| Fichiers concernés | 128 | 118 |

### Fichiers nettoyés (17 inline / 13 fichiers, zéro changement visuel attendu)
| Fichier | Δ | Remplacement |
|---|---|---|
| `src/app/guides/page.tsx` | −1 | `font-mono` déjà présent (doublon supprimé) |
| `src/app/guides/[slug]/GuideDetailClient.tsx` | −2 | `font-display` déjà présent (doublon) |
| `src/app/layout.tsx` | −1 | `bg-transparent` déjà présent + `body{background:transparent!important}` |
| `src/app/randonnee-active/page.tsx` | −2 | `flex h-dvh w-full items-center justify-center bg-[var(--lkv-forest-950)]`, `font-mono text-xs text-[var(--sage-400)]` |
| `src/components/glass/LiquidGlass.tsx` | −1 | `absolute inset-0 pointer-events-none` (svg GlassFilter) |
| `src/components/icons/animated-base.tsx` | −1 | `inline-flex` |
| `src/components/icons/phone-call.tsx` | −1 | `overflow-visible` |
| `src/components/mobile-nav/navigation/HamburgerMenu.tsx` | −2 | `relative` ; `w-11 h-11 cursor-pointer` (glass-circle-btn ne pose que min-w/min-h) |
| `src/components/shell/AppShell.tsx` | −1 | `sticky top-0 z-40 w-full` |
| `src/components/ui-layouts/shimmer-loader.tsx` | −1 | `will-change-transform` |
| `src/components/ui/AppImage.tsx` | −2 | `w-full h-full` ; `object-cover` |
| `src/features/discovery/components/TripadvisorAttribution.tsx` | −1 | `h-5 w-auto shrink-0` (déjà présent → doublon) |
| `src/features/discovery/components/TripRatingBadge.tsx` | −1 | `h-4 w-auto min-w-[55px]` |

### Laissés (106 statiques = admin 44 + dev 20 + UI live 42) — raisons
- **`src/app/admin/**` (44)** : back-office, hors périmètre (déjà documenté Phase 2).
- **`src/components/dev/**` (20)** : labo/dev, hors périmètre.
- **Nav / géométrie (16)** : `HamburgerMenu` 6, `TabItem` 4, `NavigationSurface` 3,
  `NavigationPlateau` 1, `OfflineBanner` 2 — offsets, badges, safe-area, `--nav-height` :
  conversion à risque (aucun utility token pour ces géométries).
- **Safe-area / positions calculées (6)** : `KitConfiguratorWizard` 1,
  `evenements/page` 1, `DesktopDockBar` 1, `DesktopTopBar` 1, `SosFloatingButton` 1,
  `CookieConsentBanner` 2 — `env(safe-area-inset-*)`, `var(--bottom-nav-height)`.
- **Visuels/gradients non tokenisés (7)** : `pays/loading` 2, `Footer` 2,
  `Header` 1, `ExplorerMap` 2 — matériaux de verre littéraux ; les mapper sur des
  tokens changerait le rendu (rgba ≠ tokens) ; `ExplorerMap.touchAction` est une
  exception geste documentée Phase 2.
- **Motion / dataviz / divers (13)** : `rapport-expedition` 3 (délais d'animation),
  `Terrain3DViewer` 2 (3D : `transform-style`/`perspective` absents de Tailwind 3.4),
  `TraceMiniMap` 2 (arrêts de dégradé SVG = dataviz), `outils/page` 1 (data-URL SVG),
  `LiquidGlass` 1 et `AppShell` 2 (`z-index: 1/2` — pas d'utility sans réintroduire
  un `z-[…]` littéral, interdiction Phase 2), `bookmark.tsx` 1 (⚠️ `transformOrigin`
  volontaire : `.lkv-ia [data-anim]:not(...)` a une spécificité supérieure à
  `origin-top`, la classe régresserait l'animation squash), `materiel`/`hiking` résiduels.

---

## 3. Mission 3 — Accessibilité (`npm run test:a11y`, Playwright + axe)

- Exécution : **57/57 passed** (8 surfaces hub + 11 surfaces voyage × 3 gabarits),
  exit `0` — avant et après les changements Phase 3. **0 violation critical/serious.**
- Critère de la suite : `color-contrast` désactivé (couvert par le garde-fou statique
  x6, cf. commentaires des specs) ; seules critical/serious bloquent.
- Inventaire complémentaire (spec temporaire, supprimée ensuite, desktop 1440) :
  **8 violations moderate, 0 serious, 0 critical** — `landmark-unique` ×5 (`aside`
  `.w-[260px]`), `heading-order` ×2 (h3 sans h2 parent), `page-has-heading-one` ×1.
  Ce sont des violations **préexistantes et structurelles** (hiérarchie/landmarks,
  pas des labels manquants) : non corrigées, documentées ici (mission : ne pas
  toucher aux violations structurelles complexes).
- Correction simple appliquée (révélée par l'axe e2e, voir §4) :
  `src/app/hub/loading.tsx` — `aria-label` sur un `div` sans rôle
  (axe `aria-prohibited-attr`, serious) → ajout de `role="status"` (aucun impact visuel).
- Limites : VoiceOver non testé ; tuiles/canvas tiers exclus ; `color-contrast`
  non re-scanné dynamiquement par la suite (mais 10 couples statiques validés §1).

---

## 4. Mission 4 — E2E (`npm run test:e2e`, config `playwright.config.ts`, serveur `npm run start` :4028)

### Bilan chiffré
| | Avant corrections e2e Phase 3 (cleanups UI déjà appliqués) | Après corrections e2e Phase 3 |
|---|---|---|
| Passés | 159 | **180** |
| Échoués | 42 | **21** |
| Skipped | 12 | 12 |
| Total tentative | 213 | 213 |

### Échecs corrigés (21 nets) — régressions de sélecteurs Phase 2 + 1 fix a11y
1. **`hub-nav.spec.ts` BAR-1** : 4 liens attendus → la nav Phase 2 en compte **5**
   (registre `DESTINATIONS` : Aventures, Explorer, Matériel, Communauté, Moi) ;
   aria-label du tab Hub → `Aventures : aventure active, préparation et voyages`.
2. **`hub-nav.spec.ts` RED `/materiel`** : l'alias 307 vers `/hub` a été supprimé en
   Phase 2 (`hubRedirects.ts:27-29`, surface autonome) → cas obsolète remplacé par
   `SURFACE /materiel` (200, non redirigé). Tous les autres cas 307 restent verts (18).
3. **`hub-nav.spec.ts` HUB-2** + **`materiel.spec.ts`** (Kits, Inventaire, Alertes) :
   titres de section devenus `sr-only` dans `PageHeader` (Phase 2) →
   `toBeVisible()` remplacé par `toBeAttached()` (nom accessible conservé).
4. **`materiel.spec.ts` axe** : `aria-prohibited-attr` sur `hub/loading.tsx` →
   `role="status"` (fix app, §3).
5. **`atlas-explorer.spec.ts`** : la bannière cookies recouvrait les CTA bas de page
   (interception de clics) → seed du consentement `lkdv_cookie_consent` en
   `beforeEach` (même protocole que `voyage.spec.ts` et les specs a11y) ; les
   3 tests redeviennent verts sur desktop-chromium.
6. **`adventure-intelligence.spec.ts`** : avertissement console WebKit
   `interactive-widget` ajouté aux motifs ignorés (bruit navigateur, non applicatif).
7. **`voyage.spec.ts` TEST-12** : premier `h1/h2` du DOM = variante masquée
   (dual-view Phase 2) → sélection du heading visible.

### Échecs restants (21) — documentés, non corrigés (hors « simple »)
- **Environnement Supabase / données (bug infra, pas UI)** : `a13-journey` ×4
  (session Supabase non établie, timeout SQL `canceling statement due to statement
  timeout`, nettoyage impossible après timeout), et échecs intermittents desktop
  `depart-cockpit` (cockpit absent selon les runs), `hub-nav HUB-3` (404 vs erreur
  de données), `voyage TEST-10` (h1 absent après redirect). Ces 4 tests desktop
  passent dans au moins un des runs (run1 / ciblé / final) → **flakiness serveur**.
- **Tests desktop exécutés sur les projets mobiles** (design de suite, préexistant) :
  `depart-cockpit:35` (cockpit desktop volontairement caché en mobile) ×2 projets.
- **Spécificités mobile** (préexistant, sémantique responsive Phase 2) :
  `hub-nav HUB-1` et `materiel:31` (« Mon matériel » absent de l'expérience hub
  mobile), `voyage TEST-12` (aucun heading visible au premier paint), `atlas` ×4
  (panneau de détail desktop vs carrousel mobile), ×2 projets.
- **WebKit** : `atlas pan/zoom` (texte `Load request cancelled` ≠ `net::ERR_ABORTED`
  attendu), `sw-security` (`WebKit encountered an internal error` hors-ligne).

---

## 5. Vérifications finales (exit codes)

| Commande | Exit | Détail |
|---|---|---|
| `npm run type-check` | **0** | `tsc --noEmit` sans erreur |
| `npm run lint` | **0** | 0 erreur (608 warnings préexistants) |
| `npm test` | **0** | 407 fichiers / **2 947 passed**, 27 skipped (4 fichiers skipped) |
| `npm run verify:invariants` | **0** | 6/6 invariants + noms d'icônes (1079 usages) |
| `npm run test:a11y` | **0** | 57/57 |
| `npm run test:e2e` | **1** | 180 passed / 21 failed (détaillés §4) / 12 skipped |
| `npm run build` | **0** | build de production utilisé par l'e2e |

Aucune régression constatée : 0 test supprimé (vitest 2 947 avant/après ; e2e
213 entrées avant/après), `tokens.css` inchangé, `NATIVE_TABBAR_ENABLED=false`
inchangé.

---

## 6. Dette restante après Phase 3
- 42 inline statiques UI live (nav/géométrie/safe-area/motion/dataviz/verre littéral) — §2.
- 106 inline statiques au total (dont admin 44, dev 20).
- 8 violations axe moderate préexistantes (landmarks/heading-order) — chantier a11y structurel.
- Couverture e2e mobile à réaligner (tests desktop exécutés sur projets mobiles).
- Flakiness Supabase (timeouts SQL) sur les parcours authentifiés.
- `--lkv-warning` < 3:1 en usage composant (dette documentée §1).
