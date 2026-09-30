---

# CHANTIER Y — HUB VOYAGE UNIQUE

**Plan d'intégration exécutable en autonomie totale**

| Champ | Valeur |
|---|---|
| Document | `docs/CHANTIER_Y_HUB_VOYAGE.md` |
| Version | 1.0 |
| Rédigé le | 07/09/2026 |
| Dépôt | `TFaraciColbert59/kitduvoyageur_1783951966810` |
| Branche de départ | `chantier/x-design-unique` @ `ce605ac0b051877f53f5b19f6d52864e2ee192de` |
| Parent du départ | `b9ad7c5982c4ef978587e1c205c0fa0232b87fdb` |
| Branche de travail | `chantier/y-hub-voyage` |
| Cible finale | `main` (actuellement `6ce8fc2b949d001ed7fc7b574309ab021ab939ed`) |
| Mode d'exécution | Agent autonome, arrêt uniquement sur conditions §9.4 |
| Doctrine | App-first (Capacitor 8, iOS + Android), mobile 430×932 prioritaire |

## Comment lire et utiliser ce document

Ce document est la **source unique de vérité du chantier Y**. Il est écrit pour être exécuté par un agent en autonomie complète, de la première ligne jusqu'à la recette finale, sans question intermédiaire. Chaque sous-phase est autoportante : elle déclare son objectif, ses fichiers, ses skills, ses actions, ses portes de qualité, ses preuves attendues et son plan de retour arrière.

Trois règles absolues gouvernent tout le document. Premièrement, **aucune sous-phase n'est déclarée terminée sans les preuves listées dans son bloc « Preuves »** — pas une affirmation, une sortie de commande ou un SHA. Deuxièmement, **aucun chiffre n'est recopié depuis ce document dans un rapport sans revérification** : les tailles de fichiers et les compteurs de tests ci-dessous ont été relevés le 07/09/2026 et vont bouger. Troisièmement, **toute ambiguïté rencontrée est un arrêt**, consignée dans `docs/Y_BLOCKERS.md`, jamais résolue par invention.

La convention de marquage suivante est utilisée partout : ✅ signifie vérifié sur le remote le 07/09/2026 ; ⚠️ signifie inféré ou partiellement lu, à revérifier en Y0 ; ❓ signifie inconnu, arbitrage requis.

---

# PARTIE 0 — ÉTAT VÉRIFIÉ DU DÉPÔT

Cette partie fige ce qui est **su** au moment de la rédaction. Elle sert de base de comparaison : si l'agent trouve autre chose, c'est un signal que la branche a bougé et Y0.0 doit être rejoué.

## 0.1 Git

✅ `main` = `6ce8fc2b949d001ed7fc7b574309ab021ab939ed`, message `fix(build): explorer et fiches pays rendus à la requête`, 07/09 13:33, 861/861 tests au dernier rapport.

✅ `chantier/x-design-unique` = `ce605ac0b051877f53f5b19f6d52864e2ee192de`, auteur Tony `<faracitonyp@gmail.com>`, 07/09/2026 17:44:26 UTC, message `fix(voyages): shadow-2xs canonique dans VoyagesClient`, arbre `9c65ffa0508d0139f69ed79b4dc6e197104209df`, parent `b9ad7c5982c4ef978587e1c205c0fa0232b87fdb`.

✅ **La branche n'est pas protégée.** `"protected": false`, `required_status_checks.enforcement_level: "off"`, `contexts: []`, `checks: []`. Conséquence directe et structurante pour ce chantier : **aucune porte de qualité n'est opposable côté serveur**. Un agent en autonomie totale peut pousser du code cassé sans qu'aucun mécanisme GitHub ne l'en empêche. Toutes les portes définies dans ce document sont donc des portes *que l'agent s'applique à lui-même*, et leur respect n'est vérifiable qu'a posteriori par relecture des commits et des artefacts. La phase Y0.6 corrige partiellement ce trou en installant un workflow GitHub Actions, mais tant que la protection de branche n'est pas activée côté réglages du dépôt — action manuelle, hors périmètre agent — la discipline reste déclarative.

✅ PR #31 ouverte, non fusionnée, pointant sur la même SHA que la branche distante. PR #30 existe (chantier U). ⚠️ Le corps de la PR #31 contient des valeurs fausses (polices `Playfair Display`, `Plus Jakarta Sans`, `Fira Code` au lieu de `Manrope`, `DM Sans`, `IBM Plex Mono`, `Instrument Serif` ; rayons 8/12/16/24 au lieu de 6/10/14/20/26/28/32) — à corriger en Y0.1.

## 0.2 Outillage disponible

✅ Scripts `package.json` réellement présents :

```
dev                   next dev -p 4000
build                 next build
start                 next start -p 4028
lint                  next lint
lint:fix              next lint --fix
format                prettier --write "src/**/*.{ts,tsx,css,md,json}"
serve                 next start
type-check            tsc --noEmit
test                  vitest run
test:e2e              playwright test
test:visual           playwright test --config=playwright.visual.config.ts
test:visual:update    playwright test --config=playwright.visual.config.ts --update-snapshots
seed:demo             node scripts/seed/seed_massive_demo.mjs
supabase:status       supabase status
mobile:sync           npx cap sync
mobile:build          npm run build && npx cap sync
mobile:open:ios       npx cap open ios
mobile:open:android   npx cap open android
verify:invariants     node scripts/verify/ci_invariants.mjs
```

Il n'existe **pas** de script `test:a11y` ni de script de génération de planche de contact. Les deux sont à créer (Y0.5, Y0.7).

✅ Stack vérifiée : Next.js `15.5.18`, React `19.0.3`, Tailwind `3.4.6` (v3, directives `@tailwind`, `tailwind.config.js` présent, 6 857 o), TypeScript `^5`, Vitest `^4.1.11`, Playwright `^1.51.1`, `@axe-core/playwright` `^4.13.0`, `framer-motion` `^12.43.0`, `zustand` `^5.0.15`, `zod` `^4.4.3`, `dexie` `^4.4.5`, `cmdk` `^1.1.1`, `@tanstack/react-query` `^5.101.4`, `@tanstack/react-virtual` `^3.14.10`, `react-hot-toast` `^2.6.0`, `@radix-ui/react-dialog` `^1.1.23`, `@radix-ui/react-toast` `^1.2.23`, `@headlessui/react` `^2.2.10`.

✅ Capacitor 8 complet : `@capacitor/core`, `cli`, `ios`, `android`, `app`, `camera`, `geolocation`, `haptics`, `keyboard`, `network`, `preferences`, `splash-screen`, `status-bar`. **Le projet est une application native, pas un site avec un thème mobile.** C'est le fondement du « app-first » demandé.

✅ Cartographie et 3D lourdes présentes simultanément : `leaflet` `1.9.4` + `react-leaflet` `5.0.0` + `leaflet.markercluster`, `maplibre-gl` `^6.4.1`, `three` `^0.185.1` + `react-globe.gl` `^2.38.0`, `recharts` `^2.15.2`. Trois moteurs de carte coexistent — point de performance majeur, traité en Y8.2.

✅ `playwright.visual.config.ts` :

```ts
testDir: './tests/visual'
fullyParallel: false
workers: 1
retries: CI ? 1 : 0
timeout: 60_000
baseURL: process.env.PW_BASE_URL || 'http://localhost:4000'
projects:
  - desktop-chrome    → viewport 1440 × 900
  - iphone-14-pro     → chromium, viewport 430 × 932
webServer: npm run dev, reuseExistingServer: true, timeout 120_000
```

Les deux viewports nécessaires aux captures demandées existent déjà. Aucune config à créer, seulement à étendre (Y0.5).

## 0.3 Skills disponibles

✅ Confirmées à la racine de `.agents/skills/` : `ai-agent-workflow`, `ai-engineering-toolkit`, `apple-ui-designer`, `brainstorming` (avec `scripts/server.cjs` 25 693 o, `frame-template.html` 8 094 o, `helper.js`, `start-server.sh`, `stop-server.sh`), `claude-android-skill`, `claude-seo` (avec sous-agents `seo-schema.md`, `seo-sitemap.md`, `seo-sxo.md`, `seo-technical.md`), `code-quality`, `defuddle`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `github-workflow`, `interaction-design`, `json-canvas`, `lkdv-development`, `using-superpowers`, `ux-mobile`, `verification-before-completion`, `writing-plans`, `writing-skills`.

**`verification-before-completion` est désormais présente.** C'était la skill que je signalais manquante au chantier U ; sa présence est la condition qui rend ce plan tenable en autonomie.

⚠️ La lecture du répertoire a été tronquée entre `lkdv-development` et `using-superpowers`. Les skills probablement présentes dans cet intervalle et référencées par ce plan sont `nextjs-performance`, `receiving-code-review`, `requesting-code-review`, `root-cause-tracing`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `testing-anti-patterns`. **Y0.0 doit lister explicitement le répertoire** et, pour chaque skill référencée dans ce document mais absente, soit trouver l'équivalent, soit consigner l'absence dans `docs/Y_BLOCKERS.md` et poursuivre sans elle.

✅ Documents de gouvernance à la racine : `AGENTS.md` (4 771 o), `CLAUDE.md` (30 971 o), `DESIGN_SYSTEM.md` (3 647 o), `HANDOFF_AGENT.md` (7 208 o), `MISSION_LOG.md` (19 179 o), `README.md` (7 623 o). `docs/DESIGN_TRUTH.md` sur la branche X. Les cinq premiers doivent être relus en Y0.0 avant toute écriture de code, et `MISSION_LOG.md` mis à jour à chaque fin de phase.

## 0.4 Inventaire `src/features/trips/` — relevé 07/09

| Fichier | Taille | Statut Y |
|---|---|---|
| `blueprints/blueprintRegistry.ts` | 46 887 o | À auditer (perf, Y8.2) |
| `blueprints/types.ts` | 443 o | Conservé |
| `components/ActiveTripBanner.tsx` | 2 373 o | **Supprimé** → `ActiveTripSwitcher` |
| `components/KitSidebarLeft.tsx` | 2 657 o | **Supprimé** → `TripSidebarLeft` |
| `components/KitSidebarRight.tsx` | 3 235 o | Refondu en widgets |
| `components/QuickCreateTripModal.tsx` | 9 455 o | Conservé, audité X-D70 |
| `components/ResumeActiveTripCard.tsx` | 3 865 o | ⚠️ Doublon suspect du switcher |
| `components/TripBadge.tsx` | 2 708 o | Conservé, primitive |
| `components/TripBudgetView.tsx` | 18 427 o | Section `budget` |
| `components/TripCard.tsx` | 4 685 o | Conservé, liste |
| `components/TripChecklistView.tsx` | 13 199 o | Section `checklist` |
| `components/TripCompactHeader.tsx` | 2 747 o | Conservé, header de section |
| `components/TripHero.tsx` | ⚠️ 5 825 o | Restreint à `overview` |
| `components/TripItineraryTab.tsx` | ⚠️ 13 533 o | ❓ Arbitrage Y0.2 |
| `components/TripOfflineBar.tsx` | 3 654 o | **Réduit** → `TripOfflineToggle` |
| `components/TripSidebarLeft.tsx` | ⚠️ ~6 500 o | **Pivot du chantier** |
| `components/TripSyncStatusIndicator.tsx` | 4 246 o | **Renommé** → `TripNetworkStatus` |
| `planner/ItineraryPlannerClient.tsx` | ⚠️ 17 520 o | ❓ Arbitrage Y0.2 |
| `planner/ItinerarySidebarLeft.tsx` | 2 679 o | **Supprimé** → `TripSidebarLeft` |
| `planner/ItinerarySidebarRight.tsx` | 2 285 o | Refondu en widgets |
| `planner/MoveStepModal.tsx` | 4 756 o | Conservé, audité |
| `planner/StepCard.tsx` | 7 947 o | Conservé |
| `context/ActiveTripContext.tsx` | ⚠️ | **Étendu** (Y5) |
| `engine/temporalPhaseEngine.ts` | ⚠️ | Modèle pour `tripProfileEngine` |
| `hooks/useKitCounters.ts` | ⚠️ | Conservé |
| `hooks/useTripDuration.ts` | ⚠️ | Consommé par le profil |
| `offline/tripOfflineStorage.ts` | ⚠️ | Audit sécurité Y8.3 |
| `offline/tripOfflineSyncQueue.ts` | ⚠️ | Conservé |
| `types/trip.types.ts` | ✅ lu | Étendu (`TripProfile`) |
| `types/kit.types.ts` | ✅ lu | Conservé |

⚠️ Ce tableau est partiel : la lecture de l'arbre `src/features/trips` a été tronquée. **Y0.0 régénère l'inventaire complet** et le commite dans `docs/Y_INVENTORY.md`.

## 0.5 Inventaire `src/components/pays/` — la référence visuelle

| Fichier | Taille | Rôle pour Y |
|---|---|---|
| `PaysLeftSidebar.tsx` | 5 769 o | **Modèle canonique** de la colonne gauche |
| `PaysRightSidebar.tsx` | 5 119 o | **Modèle canonique** de la colonne droite |
| `PaysHeroOverview.tsx` | 11 418 o | Modèle de l'aperçu |
| `MobileCountryDetailView.tsx` | 28 188 o | Modèle mobile |
| `PaysPratiqueView.tsx` | 40 910 o | ⚠️ À auditer (poids) |
| `BouteilleALaMer.tsx` | 41 553 o | ⚠️ Hors périmètre, à auditer |
| `CountryGlobe.tsx` | 13 442 o | `three` — import dynamique obligatoire |
| `PaysActivitesView.tsx` | 8 880 o | Référence |
| `PaysCarnetsList.tsx` | 5 601 o | Référence liste |
| `PaysClubsList.tsx` | 5 076 o | Référence liste |
| `PaysCultureView.tsx` | 3 301 o | Référence |
| `PaysDestinationsView.tsx` | 2 786 o | Référence |
| `PaysGastronomieView.tsx` | 2 439 o | Référence |
| `PaysCommunauteView.tsx` | 1 982 o | Référence |

## 0.6 Modèle de données — acquis

✅ `Trip` porte déjà tout ce qu'il faut pour l'adaptation : `group_id?`, `primary_activity: TripActivityType` (`hiking`, `trekking`, `bivouac`, `roadtrip`, `cultural`, `bushcraft`, `mixed`), `difficulty: TripDifficulty` (`easy`, `moderate`, `hard`, `expert`), `status: TripStatus` (`draft`, `planned`, `active`, `completed`, `cancelled`), `visibility` (`private`, `unlisted`, `public`), `start_date?`, `end_date?`, `destination_country_code?`, `share_token?`, `estimated_budget?`, `budget_currency`, `metadata?`.

✅ `TripFull` agrège `collaborators`, `steps`, `items`, `expenses`, `documents`, `pois`, `safety_checkpoints`, `notes`, plus `permissions: TripPermissions` (`canEdit`, `canDelete`, `canInvite`, `canManageBudget`, `canViewDocuments`).

✅ `TripItem.inventory_item_id?` est le pont vers `/materiel`. `TripItem.shop_product_id?` est le pont vers la boutique. Aucune migration de schéma n'est nécessaire pour la fusion — **c'est le fait le plus important du chantier**.

✅ Deux entités portent des données **sans section d'interface** : `TripSafetyCheckpoint` (avec `scheduled_at`, `checked_at`, `contact_phone`, `status: pending|checked|missed|alert_sent`) et `TripNote` (avec `day_number`, `is_pinned`, `author`). `TripSidebarLeft` n'expose que sept sections et n'en propose aucune. Deux sections sont donc à créer, pas seulement à migrer.

## 0.7 Recettes visuelles canoniques — extraites du code réel

Ces chaînes sont **copiées depuis `TripSidebarLeft.tsx` et `KitSidebarRight.tsx` vérifiés**. Elles constituent le vocabulaire imposé. Aucune variante n'est admise.

Conteneur de colonne gauche :
```
h-full max-h-full w-full flex-1 flex flex-col justify-between glass
rounded-[var(--lkv-radius-card)] p-3.5 text-[var(--lkv-text-primary)]
font-sans overflow-hidden border border-white/40 shadow-sm select-none
```

Item de navigation, base puis états :
```
base     w-full px-3 py-2.5 rounded-[var(--lkv-radius-md)] font-bold text-xs
         transition-all flex items-center justify-between group cursor-pointer border
actif    bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm
inactif  bg-white/80 hover:bg-white text-[var(--lkv-text-primary)] border-white/80 shadow-2xs
```

Sur-titre (eyebrow) :
```
text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]
```

Compteur dans un item :
```
actif    text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-white/20 text-white
inactif  text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-black/5 text-[var(--lkv-text-secondary)]
```

Pied de colonne :
```
text-[8.5px] font-mono text-[var(--lkv-text-secondary)] tracking-wider uppercase
```

Conteneur de colonne droite (`KitSidebarRight`) :
```
w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans
```
avec cartes `GlassCard` en `p-3.5 space-y-2.5`.

Cockpit trois colonnes (`CountryDetailClient`) :
```
pt-14 sm:pt-[62px] pb-4 px-4 sm:px-6 lg:px-8 max-w-[1680px] w-full mx-auto
flex items-start gap-5 h-full
colonne gauche  w-[260px] shrink-0 h-full overflow-hidden
centre          flex-1 h-full overflow-y-auto no-scrollbar space-y-4 px-1 pb-6
colonne droite  w-[300px] shrink-0 h-full overflow-hidden
racine          min-h-screen md:h-dvh md:overflow-hidden text-[#17402C] … font-sans relative
```

⚠️ **Incohérence détectée** : la colonne gauche utilise `no-scrollbar`, la colonne droite `custom-scrollbar`. Deux traitements de barre de défilement dans le même cockpit. Arbitrage en Y0.3.

⚠️ **Violation détectée** : la racine de `CountryDetailClient` code en dur `text-[#17402C]` au lieu de `text-[var(--lkv-text-primary)]`. `/pays` n'est pas dans `VOYAGE_SURFACES`, le garde-fou ne l'attrape pas. À corriger en Y3.5.

## 0.8 Garde-fous existants

✅ `tests/design/x-d70-*.spec.ts` : 7 règles × 9 surfaces = 63 assertions. Règles : classes froides (`zinc|gray|slate|amber|emerald|blue|red|orange`), hex hors allowlist (`#ffffff|#fff|#000000|#000`), `rounded-[Npx]`, `shadow-[…]`, dialogues natifs (`alert|confirm|prompt`), `min-h-[0-43px]`, contrôles `<select>`/`<input>` sans `className`.

✅ `tests/design/x6-accessibility.spec.ts` : tokens réels `#17402C`, `#5B7F55`, `#A8443A`, `#C89A3B`, `#4B6B7C`, `#6B7568`, double assertion `>= 3.0 && < 4.5` documentant WCAG 1.4.11 pour le sauge, plus `--lkv-warning-dark: #8C6418`.

✅ `tests/visual/` : `pays-visual.spec.ts`, `voyage-slug-visual.spec.ts`, six `voyages-*.spec.ts`. Protocole par spec : `localStorage` de consentement, `reducedMotion: 'reduce'`, attente `domcontentloaded`, sélecteur `main` (15 s), disparition du spinner (10 s), `document.fonts.ready`, pause 1 200 ms, `toHaveScreenshot` avec `threshold: 0.02`, `maxDiffPixels: 300`, masques `canvas` et `img`.

⚠️ **Faiblesse du protocole visuel** : les masques `canvas` et `img` aveuglent le test sur le globe, les cartes et toutes les photos. Un test « vert » ne prouve rien sur ces zones. Et rien ne gèle l'horloge : tout compteur `J-N` rend les captures non déterministes d'un jour à l'autre. Les deux points sont traités en Y0.5.

✅ Trois violations X-D70 confirmées, hors périmètre du garde-fou actuel :
- `TripSyncStatusIndicator.tsx` — `bg-stone-100/90`, `text-stone-700`, `border-stone-200/80`, `text-stone-500`, `bg-amber-50`, `text-amber-800`, `border-amber-200/80`, `bg-amber-100/80`, `text-amber-600`, `bg-amber-500`, `focus:ring-amber-500/30`, `bg-emerald-50`, `text-emerald-800`, `border-emerald-200/80`, `text-emerald-600`, `bg-stone-50/80`.
- `ActiveTripBanner.tsx` — `bg-emerald-400`, `bg-emerald-500`, plus `min-h-[32px]` et `min-w-[32px]` (sous le seuil 44 px, donc violation de la règle 6 également).
- `ai-configurator/page.tsx` — `#17402C` et `#5A7064` en dur, pas d'`AppShellDesktop`.

`TripOfflineBar.tsx` utilise `text-forest-900`, `bg-sage-50`, `border-sage-200`, `text-forest-800`, `text-lkv-secondary`, `text-lkv-primary` : ce sont des alias Tailwind du projet, pas des classes froides, mais ils contournent les variables CSS. À normaliser.

---

# PARTIE 1 — DOCTRINE PRODUIT ET UX

## 1.1 Le problème réel

L'utilisateur dispose aujourd'hui de quatre destinations pour préparer un seul voyage. Il va sur `/voyages/[slug]` pour voir son expédition, sur `/materiel/kits` pour composer son sac, sur `/ai-configurator` pour obtenir des recommandations, sur `/groupes/[groupId]` pour gérer ses compagnons. Chacune de ces destinations a sa propre navigation, son propre en-tête, sa propre logique de retour. Le coût cognitif n'est pas dans chaque page prise isolément — elles sont correctes — il est dans le fait que **l'utilisateur doit tenir une carte mentale à quatre entrées pour un objet unique dans sa tête : son voyage**.

Le symptôme mesurable est la navigation en triangle constatée dans le code : `KitSidebarLeft` propose « Planificateur » et « Export PDF » ; `ItinerarySidebarLeft` propose « Kit & Équipement » et « Export PDF » ; les deux proposent « Retour au cockpit ». Trois chemins vers le même endroit, aucune hiérarchie stable, et une sidebar dont le contenu change à chaque route. C'est l'inverse de la constance.

## 1.2 Le parti pris : hub-and-spoke autour d'un objet

La réponse n'est pas de fusionner les quatre modules en une page géante. C'est de fusionner **autour d'un seul objet** — le voyage — en appliquant un hub-and-spoke strict.

Le voyage devient le hub. Toutes les activités de préparation, de conduite et de bilan sont des rayons de ce hub, accessibles depuis une navigation unique et invariante. Les modules cessent d'être des destinations concurrentes et deviennent des **facettes** du voyage.

La séparation qui doit survivre est celle que LighterPack a validée dans le domaine : le *gear closet* n'est pas la *pack list*. `/materiel` est un stock permanent, avec suivi de disponibilité, alertes et historique, réparti sur sept sous-routes (`inventaire`, `kits`, `preparation`, `depart/[id]`, `disponibilite`, `alertes`, `forget`). Le kit d'un voyage est une sélection éphémère dans ce stock, matérialisée par `TripItem.inventory_item_id`. **Fusionner les données détruirait le suivi de stock et orphelinerait les sept sous-routes.** On fusionne donc les *parcours*, pas les *entités*.

## 1.3 L'adaptation au besoin : le profil de voyage

L'exigence « la page s'adapte s'il s'agit d'un voyage de groupe ou solo, d'un long voyage ou d'une simple randonnée » se traduit techniquement par un **profil dérivé**, calculé sans aucune donnée nouvelle, à partir de ce que `Trip` contient déjà.

Le principe UX est la *progressive disclosure* appliquée aux données et non à l'interface. Une section inutile pour un voyage donné **n'existe pas** pour ce voyage : elle n'est pas grisée, elle n'est pas cachée derrière un accordéon « Avancé », elle est absente. Mais — et c'est la contrepartie non négociable — **aucune section n'est jamais verrouillée** : un panneau « Ajouter une section » permet de l'activer en un geste, et ce choix est mémorisé dans `Trip.metadata`.

Concrètement, une randonnée à la journée en solo affiche trois sections. Une expédition de trois semaines en groupe en affiche onze, dont la répartition des dépenses et les rôles collaborateurs. La grammaire visuelle est identique, la densité change.

## 1.4 Le changement rapide de voyage

L'exigence « les différents voyages doivent être sélectionnables et visionnables très facilement et rapidement » se résout par un **sélecteur persistant dans l'en-tête**, présent sur toutes les surfaces du hub, alimenté par `ActiveTripContext` qui existe déjà (`lkdv_active_trip` en localStorage, `setActiveTripAction` côté serveur, `isCurrentTripActive(tripId)`).

`cmdk` étant déjà installé, le sélecteur est une palette de commandes : ouverture au clic ou par raccourci, recherche au clavier, filtrage par activité et par statut, et navigation à la flèche. Sur mobile, le même composant s'affiche en `GlassSheet` plein écran avec les mêmes données. Le voyage actif étant persisté localement **et** côté serveur, il survit au rechargement et au changement d'appareil.

Ce sélecteur remplace `ActiveTripBanner`, qui est une bande pleine largeur poussant tout le contenu vers le bas, se masquant elle-même sur la page du voyage, et purement informative. Même information, zéro décalage de mise en page, et devenue actionnable.

## 1.5 App-first — ce que ça implique réellement

Capacitor 8 est installé avec treize plugins. « App-first » signifie donc que **la cible de conception est l'application native sur un iPhone 14 Pro en 430 × 932**, et que le desktop est la déclinaison élargie, pas l'inverse.

Six conséquences non négociables découlent de ce choix. Les zones sûres `env(safe-area-inset-*)` sont respectées via `AppShell` ou `MobilePageShell`, jamais à la main. Le retour matériel Android est intercepté via `@capacitor/app` et suit la hiérarchie du hub, pas l'historique du navigateur. L'état réseau vient de `@capacitor/network` en natif et de `navigator.onLine` en web, derrière une abstraction unique. Le retour haptique passe par `useHapticFeedback()` sur toute action destructive ou validante. Les cibles tactiles font au minimum 44 px, mesurées, pas déclarées. Et le mode hors-ligne n'est pas un bandeau d'avertissement mais un mode de fonctionnement complet, `dexie` étant présent pour ça.

## 1.6 Ce qui est hors périmètre

Aucune migration de schéma Supabase. Aucune modification de `/materiel/*`, `/compte`, `/pays/*` autre que la correction de violations de tokens. Aucune refonte de la boutique ni de Stripe. Aucune fonctionnalité nouvelle non listée en Partie 4 — en particulier, pas de collaboration temps réel, pas de notifications push nouvelles, pas de traduction. `BouteilleALaMer.tsx` (41 553 o) n'est pas touché.

---

# PARTIE 2 — ARCHITECTURE CIBLE

## 2.1 La clé de voûte : un layout, N pages

L'erreur à ne pas commettre serait de construire un composant « hub » qui gère l'état des sections en local et masque les URL. On perdrait le partage de lien, le lien profond, le bouton retour et le référencement.

La solution native Next.js 15 App Router est un **layout de segment** :

```
src/app/voyages/[slug]/layout.tsx        ← charge le voyage, calcule le profil,
                                            monte AppShellDesktop + les deux colonnes
src/app/voyages/[slug]/page.tsx          ← section « overview »
src/app/voyages/[slug]/itineraire/page.tsx
src/app/voyages/[slug]/kit/page.tsx
src/app/voyages/[slug]/equipage/page.tsx
src/app/voyages/[slug]/budget/page.tsx
src/app/voyages/[slug]/documents/page.tsx
src/app/voyages/[slug]/checklist/page.tsx
src/app/voyages/[slug]/securite/page.tsx      ← NOUVEAU
src/app/voyages/[slug]/journal/page.tsx       ← NOUVEAU
src/app/voyages/[slug]/export/page.tsx
```

Cette structure **supprime structurellement la duplication de sidebars** : il n'y a plus qu'un seul endroit où une colonne gauche est montée. `KitSidebarLeft` et `ItinerarySidebarLeft` ne sont pas « refactorés », ils deviennent impossibles. C'est la différence entre une convention et une contrainte.

Elle apporte trois bénéfices supplémentaires. Le layout ne se remonte pas lors d'une navigation entre sections, donc le changement de section est instantané et les colonnes ne clignotent pas. Chaque section devient un point de découpage naturel pour le chargement différé. Et chaque section a son `loading.tsx` et son `error.tsx`, donc une erreur dans le budget ne casse pas l'itinéraire.

## 2.2 Composants — créations, fusions, suppressions

**Créations.**

`src/features/trips/engine/tripProfileEngine.ts` — fonction pure `deriveTripProfile(trip: TripFull): TripProfile`, sur le modèle de `temporalPhaseEngine.ts`. Zéro dépendance React, testable en isolation.

`src/features/trips/registry/tripSectionRegistry.ts` — table unique associant à chaque section son identifiant, son libellé, son segment d'URL, son icône, ses phases d'affichage, ses profils d'affichage, sa permission requise et son sélecteur de compteur. **Source unique de la navigation** : la sidebar, le fil d'Ariane, le sélecteur mobile et les tests la lisent tous.

`src/features/trips/registry/tripWidgetRegistry.ts` — même principe pour la colonne droite : identifiant, composant, phases, profils, priorité d'affichage, hauteur estimée.

`src/features/trips/components/TripSidebarRight.tsx` — hôte générique de widgets, sans en-tête propre, qui lit le registre et compose.

`src/features/trips/components/TripNetworkStatus.tsx` — statut réseau unifié, monté une seule fois dans l'en-tête du shell.

`src/features/trips/components/ActiveTripSwitcher.tsx` — sélecteur `cmdk` desktop + `GlassSheet` mobile.

`src/features/trips/components/TripSectionPicker.tsx` — panneau « Ajouter une section », garantie que rien n'est verrouillé.

`src/features/trips/components/widgets/` — un fichier par widget (§4.3).

`src/app/voyages/[slug]/layout.tsx`, plus `securite/` et `journal/`.

**Fusions et suppressions.**

| Supprimé | Remplacé par | Gain |
|---|---|---|
| `KitSidebarLeft.tsx` | `TripSidebarLeft` via layout | 2 657 o |
| `ItinerarySidebarLeft.tsx` | `TripSidebarLeft` via layout | 2 679 o |
| `ActiveTripBanner.tsx` | `ActiveTripSwitcher` | 2 373 o |
| `TripOfflineBar.tsx` (partie statut) | `TripNetworkStatus` | ~2 400 o |
| `KitSidebarRight.tsx` | widgets `kit-balance` + `trip-context` | 3 235 o → widgets |
| `ItinerarySidebarRight.tsx` | widgets `next-step` + `itinerary-stats` | 2 285 o → widgets |
| `ConfiguratorWizard.tsx` | rien (code mort ❓) | 49 569 o si confirmé |
| `TripItineraryTab.tsx` ou `ItineraryPlannerClient.tsx` | l'autre ❓ | 13 533 o ou 17 520 o |
| `PersistentMetricsBar` | widgets colonne droite ❓ | ⚠️ à mesurer |
| `ResumeActiveTripCard.tsx` | ❓ possiblement `ActiveTripSwitcher` | 3 865 o |

Économie plancher confirmée : **13 229 o**. Économie plafond si les quatre arbitrages tranchent dans le sens de la suppression : **environ 79 000 o de source**, sans compter la réduction de surface de bug.

## 2.3 Le type `TripProfile`

```ts
export type TripScale = 'day' | 'short' | 'long' | 'expedition';
export type TripParty = 'solo' | 'duo' | 'group';
export type TripAutonomy = 'serviced' | 'semi' | 'autonomous';

export interface TripProfile {
  scale: TripScale;          // day ≤1j | short 2-4j | long 5-14j | expedition >14j
  party: TripParty;          // solo | duo (2) | group (≥3)
  autonomy: TripAutonomy;    // dérivé de primary_activity + difficulty
  activity: TripActivityType;
  hasDates: boolean;
  hasBudget: boolean;
  isCollaborative: boolean;  // group_id != null || collaborators.length > 0
  sections: TripSectionId[];
  widgets: TripWidgetId[];
  density: 'compact' | 'comfortable';
  reason: Record<TripSectionId, string>;  // traçabilité de chaque décision
}
```

Le champ `reason` est délibéré : chaque section incluse ou exclue porte la raison de sa présence. C'est ce qui rend le moteur débogable et testable, et ce qui permet d'expliquer à l'utilisateur pourquoi son écran est ce qu'il est.

## 2.4 Extension de `ActiveTripContext`

Le contexte existe et expose `activeTrip`, `clearActiveTrip`, `isPending`. Il faut y ajouter la liste des voyages de l'utilisateur pour alimenter le sélecteur sans nouvelle requête à chaque ouverture, la fonction `setActiveTrip(slug)`, la dernière section visitée par voyage (mémorisée, pour que revenir sur un voyage rouvre là où on était), et un cache `react-query` avec `staleTime` raisonnable.

## 2.5 Ce que devient chaque module fusionné

**Le configurateur.** Perd sa route publique `/ai-configurator` en tant que destination de préparation. `KitConfiguratorWizard` devient un panneau invocable depuis la section `kit`, préchargé avec le profil du voyage — activité, échelle, destination, altitude maximale issue des `steps`. Les types `TripKitAnalysis` et `ContextualGearRecommendation` déjà écrits sont exactement le contrat de ce panneau. La route est conservée en redirection ou en mode « découverte sans voyage », mais elle ne pose plus les questions dont la réponse est déjà connue. Bénéfice collatéral : la correction des `#17402C` et `#5A7064` en dur.

**Le matériel.** Inchangé dans ses sept sous-routes et conservé comme **source canonique du visuel** au sens de `DESIGN_SYSTEM.md`. Le lien vers le voyage se fait par `inventory_item_id`. Le sélecteur d'objets dans la section `kit` du voyage lit le stock et écrit des `TripItem` — jamais l'inverse.

**Les groupes.** `/groupes` conserve sa liste (⚠️ `page.tsx` à 39 935 o, à auditer) mais `/groupes/[groupId]` cesse d'être une destination de planification. Quand un groupe a un voyage, le bouton principal entre dans le voyage. La gestion des rôles et invitations devient la section `equipage` du hub, alimentée par `TripCollaborator` et `TripPermissions.canInvite`.

**Les voyages.** Deviennent le hub. `/voyages` reste la liste, enrichie du sélecteur et d'un filtrage par profil.

---

# PARTIE 3 — REGISTRE DES DOUBLONS

Chaque ligne est un doublon **constaté dans le code**, avec sa décision et sa preuve de résolution.

## 3.1 Doublon A — sidebars gauches quasi identiques

`KitSidebarLeft.tsx` (2 657 o) et `ItinerarySidebarLeft.tsx` (2 679 o) diffèrent de trois mots : l'icône (`Package` vs `Navigation`), le sur-titre (`Kit & Sac a dos` vs `Planificateur`) et le libellé de pied (`LKDV Kit Contextuel` vs `LKDV Planificateur d'Itineraire`). Structure, classes, `GlassSubCard`, bloc « Accès rapide », lien de retour : identiques.

Décision : **suppression des deux**. Le layout de segment monte `TripSidebarLeft`, qui affiche la navigation complète à onze sections au lieu de deux liens arbitraires. Preuve : les deux fichiers absents de l'arbre, et zéro import résiduel (`grep -r "KitSidebarLeft\|ItinerarySidebarLeft" src/` vide).

## 3.2 Doublon B — statut réseau en trois exemplaires

`TripOfflineBar` affiche « Connecté / Hors-ligne » plus « Garder hors-ligne ». `TripSyncStatusIndicator` affiche « À jour / N en attente / Hors-ligne (N) » avec synchronisation manuelle. `ActiveTripBanner` a son propre point pulsant. Sur perte de réseau, l'utilisateur peut voir **deux messages hors-ligne différents, à deux endroits, avec deux formulations**.

Décision : `TripSyncStatusIndicator` est conservé et renommé `TripNetworkStatus` — c'est le plus riche, il gère la file et la synchro manuelle. Il est monté **une seule fois**, dans l'en-tête du shell, donc identique sur les onze surfaces. `TripOfflineBar` est réduit à sa seule fonction non dupliquée, le bouton « Garder hors-ligne », qui devient le widget `offline-toggle` de la colonne droite. Le point pulsant du banner disparaît avec le banner. Les seize classes froides de `TripSyncStatusIndicator` sont tokenisées au passage.

Preuve : `grep -c "navigator.onLine" src/` = 1 seul emplacement dans une abstraction unique ; Y-D80 règle 8 verte.

## 3.3 Doublon C — deux en-têtes de voyage

`TripCompactHeader` (2 747 o) et `TripHero` (⚠️ 5 825 o) affichent tous deux titre et badges statut/activité/difficulté. Le compact ajoute trois cartes de 60-70 px : phase, `J-N`, code pays.

Décision : `TripHero` **uniquement** sur `overview`. `TripCompactHeader` sur toutes les autres sections. Jamais les deux montés simultanément. Les trois cartes du compact migrent en colonne droite sous forme de widgets — un en-tête n'est pas l'endroit pour des métriques, et la contrainte X4 « trois informations maximum en tête » est ainsi respectée mécaniquement.

Preuve : test Y-D80 règle 9, un seul `<h1>` par surface, et `TripHero` importé par exactement un fichier.

## 3.4 Doublon D — banner contre sélecteur

Traité en §1.4. `ActiveTripBanner` supprimé.

## 3.5 Doublon E — deux itinéraires ❓

`TripItineraryTab.tsx` (⚠️ 13 533 o) et `ItineraryPlannerClient.tsx` (⚠️ 17 520 o) : 31 ko sur la même fonction. Arbitrage obligatoire en Y0.2, avec diff fonctionnel écrit. Hypothèse de travail : conserver le planner, qui a une route dédiée déjà tokenisée et des composants satellites (`StepCard`, `MoveStepModal`), et réduire l'onglet à un lecteur en lecture seule ou le supprimer.

## 3.6 Doublon F — barres persistantes mobiles ❓

`PersistentMetricsBar` contre `MobileNavWrapper`. Deux barres fixes en bas d'un écran de 932 px consomment environ 15 % de la hauteur utile. Décision proposée : conserver `MobileNavWrapper` (navigation, primaire) et supprimer la barre de métriques, dont les chiffres remontent en colonne droite sur desktop et dans un `GlassSheet` tirable sur mobile. C'est la réserve X7, ouverte depuis le chantier X.

## 3.7 Doublon G — reprise du voyage actif ❓

`ResumeActiveTripCard.tsx` (3 865 o) recouvre probablement la fonction du sélecteur. À vérifier en Y0.2 : si sa seule fonction est « reprendre le voyage actif », le sélecteur l'absorbe.

## 3.8 Doublon H — barres de défilement

`no-scrollbar` en colonne gauche, `custom-scrollbar` en colonne droite. Arbitrage Y0.3 : une seule classe pour tout le cockpit, alignée sur ce que fait `/materiel`.

---

# PARTIE 4 — SPÉCIFICATION DE POSITIONNEMENT

## 4.1 Les quatre zones invariantes

L'invariance est le cœur de la qualité perçue. Une zone donnée contient **toujours le même type d'objet**, sur les onze surfaces, sur les deux plateformes.

**L'en-tête** contient l'identité et l'état global : le sélecteur de voyage actif, le statut réseau, l'action de partage. Rien de contextuel à la section. Hauteur `pt-14 sm:pt-[62px]`, comme `/pays`.

**La colonne gauche (260 px)** contient exclusivement de la **navigation** : fil d'Ariane vers `/voyages`, carte d'identité du voyage (titre, phase, pilules statut et pays), bascule « Activer », partage, puis la navigation à onze sections avec compteurs, puis le déclencheur « Ajouter une section », puis le pied. Aucune métrique, aucune alerte, aucune donnée qui change sans action de l'utilisateur.

**Le centre (flex-1)** contient le **travail en cours** : `TripHero` sur l'aperçu ou `TripCompactHeader` ailleurs, puis la vue de section. Trois informations de synthèse maximum en tête. Titre en police d'affichage, étiquettes en mono `9.5px uppercase tracking-widest`.

**La colonne droite (300 px)** contient le **contexte non navigable** : widgets sans en-têtes de section, sur le modèle de `PaysRightSidebar`. Compte à rebours, bilan du sac, prochaine étape, alertes, action principale de la section, carte pays. Ordonnés par priorité décroissante, filtrés par le profil.

Sur mobile, la colonne gauche devient un `GlassSheet` déclenché depuis l'en-tête, la colonne droite devient une bande de widgets défilante sous l'en-tête de section ou un `GlassSheet` tirable depuis le bas, et le centre occupe toute la largeur.

## 4.2 Les onze sections

| # | ID | Segment | Libellé | Phases | Permission | Compteur | Statut |
|---|---|---|---|---|---|---|---|
| 1 | `overview` | *(racine)* | Aperçu | prepare, live, recount | — | — | ✅ existe |
| 2 | `itinerary` | `itineraire` | Itinéraire | prepare, live | — | `steps.length` | ✅ existe |
| 3 | `gear` | `kit` | Équipement | prepare | — | `items.length` | ✅ existe |
| 4 | `team` | `equipage` | Équipage | prepare, live | — | `collaborators+1` | ✅ existe |
| 5 | `budget` | `budget` | Budget | prepare, recount | `canManageBudget` | `expenses.length` | ✅ existe |
| 6 | `docs` | `documents` | Documents | prepare, live | `canViewDocuments` | `documents.length` | ✅ existe |
| 7 | `checklist` | `checklist` | Checklist départ | prepare | — | non cochés | ✅ existe |
| 8 | `safety` | `securite` | Sécurité | prepare, live | — | checkpoints en attente | 🆕 à créer |
| 9 | `journal` | `journal` | Journal | live, recount | — | `notes.length` | 🆕 à créer |
| 10 | `map` | `carte` | Carte | prepare, live | — | `pois.length` | ❓ à décider |
| 11 | `export` | `export` | Export | prepare, recount | — | — | ✅ existe |

Note sur la section 5 : `TripSidebarLeft` filtre actuellement `docs` par `canViewDocuments` mais **pas** `budget` par `canManageBudget`. Incohérence de permission à corriger en Y2.3.

Note sur la section 10 : `pois` existe dans le modèle et trois moteurs de carte sont installés. Soit la carte est une section, soit c'est un mode d'affichage de l'itinéraire. La seconde option est plus simple et évite un quatrième moteur de carte. Arbitrage Y0.2.

## 4.3 Les widgets de colonne droite

| ID | Contenu | Phases | Profils | Priorité | Source |
|---|---|---|---|---|---|
| `countdown` | `J-N` / Aujourd'hui / Jour N | prepare, live | `hasDates` | 100 | `start_date` |
| `primary-action` | CTA de la section active | toutes | toutes | 95 | registre section |
| `alerts` | Alertes bloquantes | toutes | toutes | 90 | agrégat |
| `next-step` | Prochaine étape, transport, distance | live | `steps>0` | 85 | `steps` |
| `safety-next` | Prochain point de contrôle + appel | prepare, live | `autonomy≠serviced` | 84 | `safety_checkpoints` |
| `kit-balance` | Poids, emballés, % , barre | prepare | `items>0` | 80 | `useKitCounters` |
| `budget-burn` | Dépensé / estimé, par tête si groupe | prepare, recount | `hasBudget` | 75 | `expenses` |
| `group-presence` | Avatars, rôles, invitation | prepare, live | `party≠solo` | 70 | `collaborators` |
| `trip-context` | Altitude max, durée, difficulté | prepare | `scale≠day` | 65 | `TripKitAnalysis` |
| `country-card` | Drapeau, lien `/pays/[code]` | prepare | `country_code` | 60 | ✨ unification |
| `docs-expiry` | Documents expirant avant départ | prepare | `documents>0` | 58 | `expires_at` |
| `offline-toggle` | « Garder hors-ligne » + état | toutes | toutes | 20 | ex-`TripOfflineBar` |

Le widget `country-card` est le point d'unification avec `/pays` : depuis son voyage, l'utilisateur atteint la fiche pays en un clic, et la fiche pays partage déjà le même cockpit.

Contrainte de hauteur : la somme des hauteurs estimées des widgets d'un profil ne doit pas dépasser deux fois la hauteur de la fenêtre en 1440 × 900. Au-delà, les widgets de priorité inférieure à 60 basculent dans un replié « Plus de détails ». Vérifié par test.

## 4.4 Matrice profil → sections

Sections affichées par défaut selon `scale` et `party`. `O` = affiché, `·` = masqué mais activable.

| Section | day/solo | day/group | short/solo | short/group | long/solo | long/group | exped/solo | exped/group |
|---|---|---|---|---|---|---|---|---|
| overview | O | O | O | O | O | O | O | O |
| itinerary | O | O | O | O | O | O | O | O |
| gear | O | O | O | O | O | O | O | O |
| team | · | O | · | O | · | O | · | O |
| budget | · | · | · | O | O | O | O | O |
| docs | · | · | · | · | O | O | O | O |
| checklist | · | O | O | O | O | O | O | O |
| safety | O | O | O | O | O | O | O | O |
| journal | · | · | · | · | O | O | O | O |
| export | · | O | O | O | O | O | O | O |

`safety` est toujours affichée : c'est un choix de sécurité assumé, y compris pour une randonnée d'une journée en solo — c'est précisément le cas où un point de contrôle sauve une vie.

Modulations par activité : `roadtrip` force `budget` (carburant, péages) ; `bivouac` et `bushcraft` forcent `trip-context` et élèvent `safety-next` en priorité 90 ; `cultural` masque `trip-context` (altitude sans objet) ; `mixed` prend l'union des sections de son échelle.

Densité : `compact` si `scale = day`, `comfortable` sinon. Affecte les espacements verticaux, jamais les tailles de police ni les cibles tactiles.

---

# PARTIE 5 — STRATÉGIE DE TEST

## 5.1 Les six niveaux

**Niveau 1, unitaire pur (Vitest).** `tripProfileEngine` et les deux registres. Aucune dépendance React, aucun DOM. Cible : les huit combinaisons de la matrice §4.4, plus les sept activités, plus les cas limites (pas de dates, dates inversées, `end < start`, `group_id` présent mais zéro collaborateur, permissions toutes fausses). Environ 60 tests. **Écrits avant le code** (TDD, skill `test-driven-development`).

**Niveau 2, garde-fou statique (Vitest).** `Y-D80`, extension de `X-D70`. Détail en §5.2.

**Niveau 3, contraste (Vitest).** `x6-accessibility.spec.ts` étendu aux nouvelles paires introduites par les widgets. Le sauge `#5B7F55` sur `#FAF8F5` reste à environ 3,5:1 — sous AA pour du texte normal. Règle : sauge réservé aux textes ≥ 18,66 px gras, aux éléments non textuels (WCAG 1.4.11) et aux icônes ; sinon `--lkv-text-secondary` `#6B7568` ou `--lkv-warning-dark` `#8C6418`.

**Niveau 4, accessibilité dynamique (Playwright + axe).** `@axe-core/playwright` est installé et non utilisé. Un scan par surface × 2 viewports = 22 scans. Zéro violation `critical` ou `serious` toléré. Un script `test:a11y` est à créer.

**Niveau 5, régression visuelle (Playwright).** Détail en §5.3.

**Niveau 6, parcours et natif (Playwright + Capacitor).** Cinq parcours de bout en bout en §5.4, plus un test de fumée natif.

## 5.2 Garde-fou Y-D80

Extension de X-D70. Le périmètre passe de 9 fichiers-surfaces à **tout `src/features/trips/**`, `src/app/voyages/**`, `src/app/groupes/**`, `src/app/ai-configurator/**`** — c'est ce qui a permis à `TripSyncStatusIndicator` d'échapper au garde-fou.

Les sept règles X-D70 sont conservées à l'identique. Cinq règles s'ajoutent.

Règle 8, unicité du statut réseau : au plus une occurrence de `navigator.onLine` et de `@capacitor/network` dans tout `src/features/trips/`, et elle doit être dans `TripNetworkStatus.tsx` ou son abstraction.

Règle 9, unicité du titre : au plus un `<h1` par fichier de page ou de section.

Règle 10, pas de sidebar hors layout : aucun `<aside` dans `src/app/voyages/**` en dehors de `layout.tsx`, et aucun dans `src/features/trips/components/` sauf `TripSidebarLeft.tsx` et `TripSidebarRight.tsx`.

Règle 11, pas de route en dur : aucune chaîne littérale `/voyages/` hors du registre de sections et des tests. Les liens passent par un constructeur d'URL typé.

Règle 12, pas d'impression native : aucun `window.print`. `X-D70` ne couvrait que `alert|confirm|prompt`, et `PaysLeftSidebar` utilise `onPrint={() => window.print()}`. L'export doit passer par une action dédiée.

Volume attendu : 12 règles × environ 40 fichiers, soit plusieurs centaines d'assertions. Le test doit reporter **fichier, ligne et extrait** pour chaque violation, sinon il est inexploitable en autonomie.

## 5.3 Protocole de capture d'écran

C'est l'exigence « faire des captures d'écran pour visualiser et améliorer ». Elle est prise au sérieux : les captures ne sont pas une preuve *a posteriori*, elles sont **l'outil de conception**.

**Déterminisme.** Trois sources de non-déterminisme doivent être neutralisées.

Le temps, d'abord : tout `J-N` change chaque jour. Playwright 1.51 fournit l'API horloge. Chaque spec commence par
```ts
await page.clock.setFixedTime(new Date('2026-06-01T09:00:00Z'));
```
avant `goto`. Les données de démonstration sont datées en conséquence.

Les données, ensuite : `scripts/seed/seed_y_profiles.mjs` crée **huit voyages à slugs fixes** couvrant la matrice §4.4, avec dates, objets, dépenses, documents, points de contrôle et notes figés. Slugs : `y-day-solo`, `y-day-group`, `y-short-solo`, `y-short-group`, `y-long-solo`, `y-long-group`, `y-exped-solo`, `y-exped-group`.

Le rendu, enfin : le protocole existant est conservé (`reducedMotion: 'reduce'`, `document.fonts.ready`, disparition du spinner, pause 1 200 ms) et **les masques sont resserrés**. Masquer tous les `canvas` et tous les `img` aveugle le test sur les cartes, le globe et les photos. Nouveau protocole : masquer par sélecteur nommé (`[data-visual-mask]`) posé explicitement sur les seuls éléments réellement non déterministes — globe `three`, tuiles de carte distantes — et remplacer les images de contenu par des images fixes locales en mode test. Chaque masque restant est justifié en commentaire.

**Volume.** 11 surfaces × 2 viewports × 3 profils représentatifs (`y-day-solo`, `y-long-group`, `y-exped-solo`) = **66 captures de référence**. Plus 8 captures d'états particuliers : hors-ligne, section vide, permission refusée, sélecteur ouvert, `GlassSheet` mobile ouvert, chargement, erreur, panneau configurateur. Total **74**.

**Planche de contact.** `scripts/visual/contact-sheet.mjs` génère un `docs/visual/contact-sheet.html` assemblant les 74 PNG en grille, groupés par surface, avec libellé de viewport et de profil. Servi par `brainstorming/scripts/server.cjs` (déjà présent, 25 693 o) pour revue. **C'est l'artefact de revue de fin de phase** : l'agent le régénère à chaque fin de sous-phase de la Partie 6 et l'inspecte avant de déclarer la sous-phase terminée. Skills `apple-ui-designer` et `interaction-design` sont appliquées à la lecture de cette planche, pas à la lecture du code.

**Tolérances.** `threshold: 0.02` et `maxDiffPixels: 300` sont conservés pour les surfaces existantes. Pour les surfaces nouvelles, la première exécution crée la référence après **inspection visuelle explicite** — jamais `--update-snapshots` en aveugle. Toute mise à jour de référence est un commit séparé, `test(visual): rebase références …`, avec justification.

## 5.4 Parcours de bout en bout

Cinq parcours, exécutés sur les deux viewports.

Le premier, création et premier kit : `/voyages` → « Nouveau » → wizard → hub → section kit → panneau configurateur → import de trois objets depuis l'inventaire → vérification du poids en colonne droite.

Le deuxième, changement rapide de voyage : hub du voyage A → sélecteur → recherche au clavier → voyage B → vérification que la section visitée est restaurée et que le contexte serveur est à jour.

Le troisième, adaptation du profil : ouverture de `y-day-solo` (trois sections attendues) puis de `y-exped-group` (dix sections attendues) → assertion sur le nombre d'items de navigation → activation manuelle d'une section masquée → vérification de la persistance après rechargement.

Le quatrième, hors-ligne : « Garder hors-ligne » → coupure réseau → navigation dans trois sections → modification d'un objet → retour du réseau → vidage de la file → assertion d'un **unique** indicateur réseau à l'écran à chaque instant.

Le cinquième, permissions : session `viewer` → assertion que `budget` et `docs` sont absents et que les mutations sont refusées **côté serveur** (pas seulement masquées).

## 5.5 Test de fumée natif

Après `npm run mobile:build`, ouverture Android, vérification en quatre points : les zones sûres ne recouvrent pas le contenu en haut ni en bas ; le bouton retour matériel remonte la hiérarchie du hub et ne quitte pas l'app depuis une section ; le retour haptique se déclenche sur les actions validantes et destructives ; `@capacitor/network` alimente bien `TripNetworkStatus` en natif. ⚠️ Cette étape peut nécessiter un environnement que l'agent n'a pas ; si c'est le cas, elle est consignée comme **non exécutée** dans le rapport, jamais comme « validée ».

## 5.6 Les six portes

Aucune sous-phase n'est terminée sans les portes qui la concernent.

| Porte | Commande | Critère |
|---|---|---|
| G1 Types | `npm run type-check` | exit 0, zéro erreur |
| G2 Unitaires | `npm test` | exit 0, zéro échec, zéro `skip`, compteur ≥ référence |
| G3 Statique | `npm test -- y-d80` | 12 règles vertes |
| G4 Build | `npm run build` | exit 0, **sans `.env.local`** |
| G5 Visuel | `npm run test:visual` | zéro diff hors masques nommés + planche inspectée |
| G6 A11y | `npm run test:a11y` | zéro `critical`, zéro `serious` |

Règle du compteur : le nombre de tests ne descend **jamais**. Si une suppression de fichier retire des tests, le nombre retiré est déclaré explicitement dans le message de commit avec sa justification.

---

# PARTIE 6 — PHASES ET SOUS-PHASES

Format de chaque sous-phase : objectif, skills, fichiers, actions, portes, preuves, retour arrière.

---

## Y0 — FONDATIONS ET ARBITRAGES

*Estimation 4-6 h. Bloquante en totalité. Aucune ligne de code produit avant Y0.8.*

Cette phase existe pour une raison précise : un agent en autonomie totale qui rencontre une ambiguïté **invente une réponse**, et le résultat n'apparaît qu'à la recette. Y0 élimine les ambiguïtés à l'avance.

### Y0.0 — Relevé de l'état réel

**Objectif.** Remplacer toutes les valeurs ⚠️ et ❓ de la Partie 0 par des faits.

**Skills.** `verification-before-completion`, `lkdv-development`, `using-superpowers`.

**Actions.** Lire intégralement `AGENTS.md`, `CLAUDE.md` (30 971 o), `DESIGN_SYSTEM.md`, `HANDOFF_AGENT.md`, `docs/DESIGN_TRUTH.md` — dans cet ordre, avant tout. Lister `.agents/skills/` au premier niveau et confronter à §0.3 ; consigner les absences. Régénérer l'inventaire complet de `src/features/trips/`, `src/components/`, `src/app/voyages/`, `src/app/materiel/`, `src/app/groupes/`, `src/app/ai-configurator/` avec tailles réelles. Exécuter les six portes sur `ce605ac0` pour établir les **références de départ** : nombre de tests, nombre de fichiers de test, temps de build, taille des bundles par route. Vérifier `scripts/verify/ci_invariants.mjs` et ce qu'il contrôle.

**Preuves.** `docs/Y_INVENTORY.md` commité, contenant l'arbre complet avec tailles, la liste des skills confirmées, et un tableau « références de départ » avec les six sorties de commande horodatées.

**Retour arrière.** Sans objet, lecture seule.

### Y0.1 — Fusionner PR #31

**Objectif.** Ramener `main` au niveau de X avant de commencer Y.

**Skills.** `finishing-a-development-branch`, `github-workflow`, `requesting-code-review`.

**Justification.** Trois PR potentiellement empilées sur les mêmes fichiers — #30 (chantier U), #31 (chantier X), et Y — c'est le chemin le plus court vers un conflit ingérable.

**Actions.** Corriger le corps de PR #31 : polices réelles `Manrope`, `DM Sans`, `IBM Plex Mono`, `Instrument Serif` ; rayons réels 6/10/14/20/26/28/32 px ; `--lkv-primary-hover` réel `#1A422D` ; ne citer que les fichiers de `tests/visual/` réellement présents ; reformuler la conclusion visuelle en « aucune régression hors zones masquées, tolérance 300 px ». Statuer sur PR #30 : fusionner, fermer ou rebaser, avec justification écrite. Exécuter les six portes sur la branche X. Fusionner #31. Créer `chantier/y-hub-voyage` depuis le nouveau `main`.

**Portes.** G1 à G6 sur X avant fusion.

**Preuves.** `GET /pulls/31` → `"merged": true` avec `merge_commit_sha` ; nouveau SHA de `main` ; `GET /branches/chantier%2Fy-hub-voyage` → 200 avec ce SHA comme ancêtre.

**Retour arrière.** `git revert` du commit de fusion ; la branche X reste intacte.

### Y0.2 — Trancher les quatre arbitrages ouverts

**Objectif.** Zéro `❓` restant.

**Skills.** `systematic-debugging`, `root-cause-tracing`, `code-quality`, `brainstorming`.

**Actions.** Pour chacun des quatre points, produire un diff fonctionnel écrit — quelles fonctionnalités uniques à chaque option, quels imports, quels tests couvrent quoi — puis décider.

*Arbitrage 1, itinéraire.* Diff `TripItineraryTab` / `ItineraryPlannerClient`. Décision par défaut : garder le planner.

*Arbitrage 2, `ConfiguratorWizard.tsx`.* `grep -rn "ConfiguratorWizard" src/ tests/ scripts/` en excluant `KitConfiguratorWizard`. Si zéro import hors définition : suppression, 49 569 o. **La sortie du grep est collée dans le message de commit** — pas résumée.

*Arbitrage 3, barres mobiles.* Mesurer la hauteur cumulée de `PersistentMetricsBar` + `MobileNavWrapper` sur 430 × 932 par capture, puis décider. Décision par défaut : garder `MobileNavWrapper`.

*Arbitrage 4, `ResumeActiveTripCard`.* Recenser ses usages et son contenu ; si redondant avec le sélecteur, suppression.

Plus deux arbitrages secondaires : la carte comme section ou comme mode de l'itinéraire (défaut : mode) ; `no-scrollbar` contre `custom-scrollbar` (défaut : ce que fait `/materiel`).

**Preuves.** `docs/Y_DECISIONS.md` avec, par arbitrage : options, diff fonctionnel, décision, justification, alternative écartée et pourquoi, sortie de commande à l'appui.

### Y0.3 — Spécification de positionnement

**Objectif.** Figer la Partie 4 en spécification opposable.

**Skills.** `writing-plans`, `apple-ui-designer`, `interaction-design`, `ux-mobile`.

**Actions.** Écrire `docs/Y_HUB_SPEC.md` : les quatre zones, les onze sections avec segments et conditions, les douze widgets avec priorités et hauteurs estimées, la matrice profil × section complète, les recettes de classes de §0.7 en annexe copiable, la déclinaison mobile de chaque zone, les durées et courbes d'animation issues de `liquid-glass.css` (`--dur-xfast 120ms`, `--dur-fast 180ms`, `--dur-med 280ms`, `--dur-slow 420ms`, `--ease-glass cubic-bezier(0.22,1,0.36,1)`), les z-index tokenisés (`--z-sticky 20`, `--z-drawer 40`, `--z-sheet 50`, `--z-toast 70`), et la gestion de `prefers-reduced-motion` et `prefers-reduced-transparency`.

**Preuves.** Le fichier commité, avec pour chaque valeur numérique la référence du fichier source d'où elle vient.

### Y0.4 — Données de démonstration déterministes

**Objectif.** Huit voyages à slugs fixes couvrant la matrice.

**Skills.** `lkdv-development`.

**Actions.** Écrire `scripts/seed/seed_y_profiles.mjs` sur le modèle de `seed_massive_demo.mjs`. Dates ancrées autour du 01/06/2026 pour que l'horloge figée produise des `J-N` stables. Chaque voyage porte des `steps`, `items`, `expenses`, `documents`, `safety_checkpoints`, `notes` en quantité cohérente avec son profil. Idempotent : réexécutable sans doublon. Ajouter `seed:y` à `package.json`.

**Preuves.** Sortie du script ; requête de vérification listant les huit slugs avec leurs compteurs.

### Y0.5 — Outillage de capture

**Objectif.** Rendre les captures déterministes et revoyables.

**Skills.** `verification-before-completion`, `apple-ui-designer`.

**Actions.** Créer `tests/visual/_helpers/prepareVisualPage.ts` factorisant le protocole : horloge figée au 01/06/2026 09:00 UTC, consentement en `localStorage`, `reducedMotion`, attentes, masques **nommés uniquement**. Remplacer les masques `canvas`/`img` génériques par `[data-visual-mask]` et poser l'attribut sur les seuls éléments justifiés. Créer `scripts/visual/contact-sheet.mjs` et le script `visual:sheet`. Créer `tests/a11y/` avec `@axe-core/playwright`, un scan par surface × viewport, et le script `test:a11y`. Ajouter le projet `ipad-portrait` (834 × 1194) à `playwright.visual.config.ts` — la tablette est le point de rupture entre mobile et cockpit, et rien ne la couvre aujourd'hui.

**Portes.** G5 verte sur les surfaces existantes après changement de masques — un diff ici signifie que les masques cachaient une régression réelle, et c'est une information, pas un échec.

**Preuves.** Planche de contact générée pour l'état de départ, commitée dans `docs/visual/`. **C'est la référence « avant » de tout le chantier.**

### Y0.6 — Intégration continue

**Objectif.** Rendre les portes exécutables automatiquement, à défaut d'être opposables.

**Skills.** `github-workflow`.

**Actions.** Créer ou étendre `.github/workflows/` avec un job exécutant G1 à G4 et G6 sur chaque poussée de `chantier/y-hub-voyage`, plus G5 en artefact téléchargeable. Documenter dans `docs/Y_DECISIONS.md` que la protection de branche est désactivée et qu'elle **doit** être activée manuellement côté réglages — action hors périmètre agent, à signaler explicitement dans le rapport final.

**Preuves.** Fichier de workflow commité ; un run vert visible sur la branche.

### Y0.7 — Sécurité, état des lieux

**Objectif.** Cartographier les risques avant de déplacer du code qui touche aux documents et aux partages.

**Skills.** `code-quality`, `systematic-debugging`.

**Actions.** Vérifier qu'aucune clé `service_role` n'est atteignable côté client (`grep` sur `src/` pour les variables sans préfixe `NEXT_PUBLIC_` utilisées dans des composants clients). Auditer `tripOfflineStorage.ts` : quelles données sont écrites en clair, et notamment si `TripDocument.file_url` ou des données de collaborateurs y atterrissent — sur un appareil partagé, c'est une fuite. Vérifier que les mutations passent toutes par des server actions avec contrôle de permission **côté serveur**, `TripPermissions` n'étant qu'un affichage. Vérifier le traitement de `share_token` : pas de journalisation, pas d'exposition en clair dans une URL indexable, révocation possible. Vérifier que `visibility: public` n'expose ni `documents`, ni `expenses`, ni identités de collaborateurs.

**Preuves.** `docs/Y_SECURITY.md` : chaque point vérifié, la commande ou le fichier à l'appui, le verdict. Tout risque confirmé devient une sous-phase de Y8.3 avec sa correction.

### Y0.8 — Décision « aller / ne pas aller »

**Objectif.** Point de non-retour explicite.

**Actions.** Vérifier que Y0.0 à Y0.7 sont tous terminés avec leurs preuves. Si un seul `❓` subsiste, **arrêt** et consignation. Sinon, poser le tag `y0-done` et démarrer Y1.

**Preuves.** Le tag et une entrée dans `MISSION_LOG.md`.

---

## Y1 — MOTEUR DE PROFIL ET REGISTRES

*Estimation 4-6 h. Logique pure, zéro interface. TDD strict.*

Cette phase est la seule qui produit du code sans aucun rendu. C'est délibéré : la logique d'adaptation est le cœur du produit et doit être prouvée avant d'être branchée. Une erreur ici se manifesterait comme un bug d'interface indéboguable.

### Y1.1 — Tests du moteur de profil, avant le code

**Skills.** `test-driven-development`, `testing-anti-patterns`.

**Actions.** Écrire `tests/features/trips/tripProfileEngine.spec.ts` : les huit combinaisons de la matrice, les quatre échelles avec leurs bornes exactes (1 / 2-4 / 5-14 / >14 jours) y compris les valeurs frontières 1, 2, 4, 5, 14, 15, les trois partys, les sept activités avec leurs modulations, et les cas limites — `start_date` absente, `end_date` absente, les deux absentes, `end < start`, `group_id` présent sans collaborateur, `collaborators` non vide sans `group_id`, toutes permissions fausses, `status: cancelled`. Chaque test assert **la liste ordonnée de sections, la liste ordonnée de widgets, et le contenu de `reason`**. Attendu : environ 60 tests, tous rouges.

**Portes.** G2 rouge attendu, avec le nombre exact d'échecs consigné.

**Preuves.** Sortie de `npm test` montrant les 60 échecs.

### Y1.2 — Implémentation du moteur

**Skills.** `test-driven-development`, `code-quality`.

**Actions.** Écrire `src/features/trips/engine/tripProfileEngine.ts` et le type `TripProfile` dans `trip.types.ts`. Fonction pure, aucun import React, aucun accès à `window`, aucune date « maintenant » lue en interne — l'horloge est **injectée en paramètre**, faute de quoi les tests seraient non déterministes et les captures aussi.

**Portes.** G1, G2 (60/60 verts), G3.

**Preuves.** Sortie de `npm test` avec le compteur avant/après.

### Y1.3 — Registre des sections

**Actions.** `src/features/trips/registry/tripSectionRegistry.ts` : les onze entrées de §4.2 avec identifiant, libellé, segment, icône, phases, condition de profil, permission, sélecteur de compteur. Plus un constructeur d'URL typé `tripSectionHref(slug, sectionId)` — c'est lui qui rend la règle 11 de Y-D80 satisfiable. Tests : cohérence des segments avec les dossiers réels, unicité des identifiants, aucune section sans libellé.

**Portes.** G1, G2, G3.

### Y1.4 — Registre des widgets

**Actions.** `tripWidgetRegistry.ts` : les douze entrées de §4.3. Tests : unicité, priorités distinctes, somme des hauteurs estimées sous la limite de §4.3 pour chacun des huit profils.

**Portes.** G1, G2, G3.

### Y1.5 — Garde-fou Y-D80

**Skills.** `code-quality`, `verification-before-completion`.

**Actions.** Écrire `tests/design/y-d80-guard.spec.ts` selon §5.2 : périmètre élargi par parcours de répertoire, sept règles reprises, cinq ajoutées, report fichier + ligne + extrait. **Le test va échouer** sur les violations connues (`TripSyncStatusIndicator`, `ActiveTripBanner`, `ai-configurator/page.tsx`, `window.print`) — c'est le but. Les violations sont inventoriées dans `docs/Y_VIOLATIONS.md` avec, pour chacune, la sous-phase de Y3 qui la corrige.

**Portes.** G1 ; G3 rouge attendu et documenté.

**Preuves.** `docs/Y_VIOLATIONS.md` avec le décompte exact par règle et par fichier.

### Y1.6 — Fin de phase

**Actions.** Tag `y1-done`. Mettre à jour `MISSION_LOG.md`. Commit `test(y1): moteur de profil et registres, 60 tests verts`.

---

## Y2 — LAYOUT UNIQUE

*Estimation 6-8 h. La phase la plus risquée : elle touche la structure de toutes les surfaces voyage.*

### Y2.1 — `TripSidebarRight` générique

**Skills.** `apple-ui-designer`, `interaction-design`.

**Actions.** Créer le composant hôte, qui lit `tripWidgetRegistry`, filtre par phase et profil, ordonne par priorité, et replie au-delà de la limite de hauteur. Conteneur : la recette exacte de §0.7, avec la classe de défilement tranchée en Y0.2. Aucun widget implémenté à ce stade — deux widgets de démonstration suffisent à valider la composition.

**Portes.** G1, G2, G3, G4.

### Y2.2 — Le layout de segment

**Skills.** `nextjs-performance`, `lkdv-development`.

**Actions.** Créer `src/app/voyages/[slug]/layout.tsx`. Il charge le voyage une seule fois côté serveur, calcule la phase et le profil, monte `AppShellDesktop` avec `sidebarLeft`, `sidebarRight`, `children` sur desktop et `AppShell` ou `MobilePageShell` sur mobile, monte `TripNetworkStatus` et `ActiveTripSwitcher` dans l'en-tête (versions provisoires), et gère `not-found` si le slug est inconnu. Ajouter `loading.tsx` et `error.tsx` au niveau du segment.

Point d'attention : le layout ne doit **pas** recharger `TripFull` à chaque navigation de section. Vérifier que les sections consomment le contexte plutôt que de refaire la requête, et mesurer.

**Portes.** G1, G2, G3, G4, G5.

**Preuves.** Capture avant/après sur `/voyages/y-long-group` aux deux viewports ; mesure du temps de navigation entre deux sections.

**Retour arrière.** Le layout est un fichier ajouté ; sa suppression restaure l'état antérieur. Commit isolé.

### Y2.3 — `TripSidebarLeft` unifiée

**Actions.** Refondre le composant pour qu'il lise `tripSectionRegistry` au lieu de sa liste interne, passe de sept à onze sections, navigue par `<Link>` et `tripSectionHref` au lieu de `onSectionChange`, dérive l'état actif de `usePathname()`, applique **toutes** les permissions — correction de l'incohérence `budget` / `canManageBudget` relevée en §4.2 — et intègre le déclencheur du `TripSectionPicker`. Les recettes de classes de §0.7 sont conservées **au caractère près** : c'est la garantie de non-régression visuelle.

**Portes.** G1, G2, G3, G4, G5, G6.

**Preuves.** Diff visuel sur la sidebar attendu à zéro pixel sur les sept sections existantes ; les quatre nouvelles apparaissent selon le profil.

### Y2.4 — `TripSectionPicker`

**Actions.** Panneau d'activation des sections masquées, en `GlassSheet`, persistant le choix dans `Trip.metadata` via une server action. Chaque section masquée y apparaît avec sa `reason` issue du profil — l'utilisateur comprend pourquoi elle était absente.

**Portes.** G1 à G6.

### Y2.5 — Migration de `page.tsx` vers le layout

**Actions.** `TripDetailClient.tsx` perd sa gestion de shell et de sidebars, ne garde que la vue `overview`. `TripHero` y reste ; `TripCompactHeader` en est retiré.

**Portes.** G1 à G6, plus le parcours 3 de §5.4.

### Y2.6 — Fin de phase

Tag `y2-done`. Planche de contact régénérée et inspectée. Entrée `MISSION_LOG.md`.

---

## Y3 — DÉDOUBLONNAGE

*Estimation 5-7 h. Sept sous-phases, une par doublon. Chacune est un commit isolé, revenable indépendamment.*

### Y3.1 — Suppression des deux sidebars gauches

**Actions.** Supprimer `KitSidebarLeft.tsx` et `ItinerarySidebarLeft.tsx`. Migrer `/kit` et `/itineraire` sous le layout. Retirer tous les imports.

**Preuves.** `grep -r "KitSidebarLeft\|ItinerarySidebarLeft" src/` vide, sortie collée dans le commit. Diff visuel des deux surfaces inspecté et justifié — il y aura un diff, puisque la navigation passe de deux liens à onze sections ; c'est attendu et la nouvelle référence est posée après inspection.

### Y3.2 — Unification du statut réseau

**Actions.** Renommer `TripSyncStatusIndicator` → `TripNetworkStatus`, tokeniser ses seize classes froides, créer l'abstraction réseau unique (`navigator.onLine` en web, `@capacitor/network` en natif), monter le composant une seule fois dans l'en-tête du layout, réduire `TripOfflineBar` au widget `offline-toggle`.

**Portes.** G1 à G6, plus le parcours 4 de §5.4 avec son assertion d'unicité.

**Preuves.** Y-D80 règle 8 verte ; capture en mode hors-ligne montrant **un seul** indicateur.

### Y3.3 — `ActiveTripSwitcher`

**Actions.** Créer le sélecteur avec `cmdk` sur desktop et `GlassSheet` sur mobile ; recherche, filtres activité et statut, navigation clavier complète, restauration de la dernière section visitée. Étendre `ActiveTripContext` selon §2.4. Supprimer `ActiveTripBanner.tsx`. Résoudre le sort de `ResumeActiveTripCard` selon Y0.2.

**Portes.** G1 à G6, plus le parcours 2.

**Preuves.** Capture du sélecteur ouvert aux deux viewports ; scan axe sur le sélecteur ouvert, zéro violation ; navigation clavier vérifiée.

### Y3.4 — Arbitrage des en-têtes

**Actions.** Appliquer §3.3 : `TripHero` sur `overview` seulement, `TripCompactHeader` ailleurs, les trois cartes du compact migrées en widgets.

**Portes.** G1 à G6. Y-D80 règle 9 verte.

### Y3.5 — Correction des violations résiduelles

**Actions.** Traiter tout `docs/Y_VIOLATIONS.md` : `ai-configurator/page.tsx` (`#17402C`, `#5A7064`, absence d'`AppShellDesktop`), `CountryDetailClient.tsx` (`text-[#17402C]` en dur), les `min-h-[32px]`/`min-w-[32px]` sous le seuil, `window.print()` de `PaysLeftSidebar` remplacé par une action d'export dédiée.

**Portes.** G1 à G6. **Y-D80 douze règles vertes** — c'est le jalon de la phase.

**Preuves.** Sortie complète de Y-D80.

### Y3.6 — Suppression du code mort

**Actions.** Selon Y0.2 : `ConfiguratorWizard.tsx`, l'un des deux itinéraires, `PersistentMetricsBar`, `ResumeActiveTripCard`. Chaque suppression est un commit distinct portant la sortie du grep qui la justifie.

**Portes.** G1 à G6. Si des tests disparaissent, le nombre est déclaré.

**Preuves.** Total d'octets supprimés, mesuré.

### Y3.7 — Fin de phase

Tag `y3-done`. Planche de contact. `MISSION_LOG.md`.

---

## Y4 — LES ONZE SECTIONS

*Estimation 12-16 h. Une sous-phase par section. Parallélisable après Y2.*

**Note sur la parallélisation.** La skill `dispatching-parallel-agents` est applicable ici, mais **seulement sur les fichiers de section terminaux**. Le layout, les registres et les sidebars sont hors périmètre parallèle : deux agents écrivant dans `layout.tsx` produisent un conflit garanti. Découpage recommandé : trois agents en parallèle sur trois groupes de sections indépendantes, chacun dans son worktree, avec une porte de convergence après chaque groupe.

Chaque sous-phase suit le même patron : migrer la vue sous le layout, retirer tout shell local, brancher les widgets de la colonne droite, appliquer les recettes de classes, `TripCompactHeader` en tête, vider les états vides avec `EmptyState`, vérifier les permissions côté serveur, puis G1 à G6 et capture inspectée.

### Y4.1 — `overview`

Widgets : `countdown`, `alerts`, `primary-action`, `country-card`. `TripHero` conservé. Trois informations de synthèse maximum.

### Y4.2 — `itinerary`

Vue retenue en Y0.2. Widgets : `next-step`, `itinerary-stats`, `primary-action`. Import dynamique du moteur de carte. La carte est un mode d'affichage, non une section, sauf décision contraire.

### Y4.3 — `gear`

Widgets : `kit-balance`, `trip-context`, `primary-action`. **Point d'intégration du configurateur** : le déclencheur du panneau est ici. Sélecteur d'objets lisant `/materiel` par `inventory_item_id`.

### Y4.4 — `team`

Nouvelle section d'interface pour des données existantes (`TripCollaborator`). Widgets : `group-presence`, `primary-action` (inviter, sous `canInvite`). Absorbe la fonction planification de `/groupes/[groupId]`.

### Y4.5 — `budget`

`TripBudgetView` (18 427 o) migrée. Widgets : `budget-burn`, `primary-action`. Répartition par tête si `party ≠ solo` — c'est la valeur ajoutée du profil groupe.

### Y4.6 — `docs`

Widgets : `docs-expiry`, `primary-action`. **Sensible** : `file_url`, expiration, permission `canViewDocuments` vérifiée côté serveur. Croise Y0.7.

### Y4.7 — `checklist`

`TripChecklistView` (13 199 o) migrée. Widget : `primary-action`. Générée depuis le profil : une checklist de randonnée d'une journée n'est pas celle d'une expédition.

### Y4.8 — `safety` 🆕

**Section nouvelle.** Données `TripSafetyCheckpoint` existantes, jamais exposées. Liste chronologique, statuts (`pending`, `checked`, `missed`, `alert_sent`), pointage, contact d'urgence appelable en un geste. Widget `safety-next`. Fonctionne hors-ligne — c'est la section où ça compte le plus.

### Y4.9 — `journal` 🆕

**Section nouvelle.** Données `TripNote` existantes. Notes par jour, épinglage, auteur. Phases `live` et `recount`.

### Y4.10 — `export`

`ExportClientView` (12 684 o) migrée. Remplacer `window.print()` par une action dédiée. Vérifier qu'un export public ne fuite ni documents, ni dépenses, ni identités.

### Y4.11 — Convergence

Les onze sections sous le layout. Planche de contact complète : 66 captures. Tag `y4-done`.

---

## Y5 — NAVIGATION GLOBALE

*Estimation 4-5 h.*

### Y5.1 — Liste `/voyages` enrichie

Sélecteur intégré, filtrage par profil en plus des filtres actuels (recherche, statut, difficulté, activité), `TripCard` affichant le profil dérivé. `IOSSegmentedControl` conservé pour public/personnel.

### Y5.2 — Mémoire de section

Dernière section visitée par voyage, persistée. Revenir sur un voyage rouvre là où on était.

### Y5.3 — Navigation mobile

`MobileNavWrapper` aligné sur le hub. `GlassSheet` de sections. Gestes : tout geste a un bouton visible ≥ 44 px en équivalent et un accès clavier. `useHapticFeedback()` sur les transitions de section.

### Y5.4 — Retour matériel Android

`@capacitor/app` intercepte le retour et remonte la hiérarchie du hub : section → aperçu → liste → sortie. Jamais de sortie d'app depuis une section.

**Portes.** G1 à G6, parcours 2 et 3, test de fumée natif si l'environnement le permet.

---

## Y6 — FUSION DES MODULES

*Estimation 5-7 h.*

### Y6.1 — Configurateur en panneau

`KitConfiguratorWizard` (37 338 o) invocable depuis `gear`, préchargé avec activité, échelle, destination, altitude maximale. `TripKitAnalysis` et `ContextualGearRecommendation` comme contrat. Aucune question dont la réponse est déjà dans le voyage.

### Y6.2 — Route configurateur

`/ai-configurator` conservée en mode découverte sans voyage, ou redirigée. Violations de tokens corrigées si ce n'est pas déjà fait en Y3.5.

### Y6.3 — Pont matériel

Sélecteur d'inventaire dans `gear`, écrivant des `TripItem` avec `inventory_item_id`. **Le stock n'est jamais consommé ni modifié par le voyage** — seulement référencé. Vérifier que les sept sous-routes de `/materiel` restent intactes.

### Y6.4 — Pont groupes

`/groupes` conservé en liste ; `/groupes/[groupId]` renvoyant vers le voyage quand il en existe un ; audit de `page.tsx` (39 935 o).

### Y6.5 — Pont pays

Widget `country-card` reliant le voyage à `/pays/[code]`. Boucle d'unification fermée : les deux surfaces partagent le même cockpit.

---

## Y7 — APP-FIRST

*Estimation 4-6 h. Skills `claude-android-skill`, `ux-mobile`, `interaction-design`.*

### Y7.1 — Zones sûres

`env(safe-area-inset-*)` vérifié sur les onze surfaces, en portrait et paysage, via `AppShell` / `MobilePageShell` exclusivement. Preuve par capture.

### Y7.2 — Cibles tactiles

Mesure réelle par Playwright de **toutes** les cibles interactives des onze surfaces. Aucune sous 44 px. Y-D80 règle 6 ne détecte que les `min-h-[…]` littéraux ; la mesure runtime attrape le reste.

### Y7.3 — Haptique

`useHapticFeedback()` sur validation, suppression, pointage de sécurité, changement de section. Respect de `prefers-reduced-motion`.

### Y7.4 — Hors-ligne complet

Migration ou consolidation vers `dexie` selon l'audit Y0.7. Les onze sections consultables hors-ligne. File de synchronisation avec résolution de conflit documentée. **Documents exclus du cache local** si l'audit a confirmé le risque.

### Y7.5 — Barre d'état et splash

`@capacitor/status-bar` accordé aux tokens. `splash-screen` cohérent.

**Portes.** G1 à G6, parcours 4, test de fumée natif.

---

## Y8 — QUALITÉ

*Estimation 6-8 h.*

### Y8.1 — Accessibilité

`test:a11y` vert sur 11 surfaces × 3 viewports. Focus visible partout. `aria-live` sur les données hydratées. Un seul `h1` par écran. Contraste ≥ 4,5:1 pour tout texte normal — et si une paire échoue, **réduire la translucidité, jamais assombrir le texte**, règle héritée de X6. Navigation clavier complète du hub, sélecteur inclus.

### Y8.2 — Performance

Skill `nextjs-performance`. Import dynamique de `three`, `react-globe.gl`, `maplibre-gl`, `leaflet`, `recharts` — cinq bibliothèques lourdes. Audit des cinq gros fichiers : `blueprintRegistry.ts` (46 887 o), `PaysPratiqueView.tsx` (40 910 o), `groupes/page.tsx` (39 935 o), `BouteilleALaMer.tsx` (41 553 o), `MobileCountryDetailView.tsx` (28 188 o). Budgets : JS par route < 250 ko gzip, LCP < 2,5 s en 4G simulée, navigation entre sections < 200 ms. Virtualisation via `@tanstack/react-virtual` sur les listes de plus de cinquante entrées.

**Preuves.** Tableau avant/après par route, mesuré.

### Y8.3 — Sécurité

Corriger chaque risque confirmé en Y0.7. Vérifier que chaque mutation contrôle la permission côté serveur. Tester le parcours 5. Vérifier `share_token`. Vérifier qu'un voyage `public` n'expose rien de privé.

### Y8.4 — Revue de code

Skills `requesting-code-review` puis `receiving-code-review`. Revue complète du diff `main…chantier/y-hub-voyage`. Chaque remarque traitée ou justifiée par écrit.

---

## Y9 — RECETTE ET FUSION

*Estimation 3-4 h.*

### Y9.1 — Exécution intégrale des portes

Les six portes, sans `.env.local` pour G4, zéro test ignoré, compteur supérieur ou égal à la référence de Y0.0. Les cinq parcours. Le test natif ou sa mention explicite de non-exécution.

### Y9.2 — Planche de contact finale

74 captures, régénérées, inspectées une à une. Comparaison avec la planche « avant » de Y0.5. Toute différence non intentionnelle est un défaut, pas une évolution.

### Y9.3 — Rapport `docs/Y_REPORT.md`

Modèle imposé en §12.

### Y9.4 — Pull request

Corps de PR généré depuis le rapport, **avec les valeurs réellement commitées** — c'est l'erreur exacte commise sur les PR #30 et #31, et elle ne doit pas se reproduire. Skill `finishing-a-development-branch`.

### Y9.5 — Fusion

Après revue. `main` avance. Vérification du SHA final par appel API.

---

# PARTIE 7 — PROTOCOLE D'AUTONOMIE

## 7.1 Boucle d'exécution

Pour chaque sous-phase, invariablement : relire le bloc de la sous-phase dans ce document ; relire les fichiers concernés **dans leur état actuel** et non de mémoire ; écrire ou modifier ; exécuter les portes déclarées ; si une porte échoue, corriger et réexécuter, au maximum deux fois, puis arrêt ; régénérer et inspecter les captures concernées ; commiter avec la convention §7.3 ; consigner dans `MISSION_LOG.md` ; passer à la suivante.

## 7.2 Interdits absolus

Ne jamais pousser sur `main`. Ne jamais utiliser `--update-snapshots` sans inspection préalable des diffs. Ne jamais ignorer, commenter ou marquer `skip` un test qui échoue. Ne jamais réduire le nombre de tests sans déclaration explicite. Ne jamais modifier une valeur de token sans passer par `docs/DESIGN_TRUTH.md`. Ne jamais introduire de dépendance nouvelle sans justification écrite. Ne jamais toucher au schéma Supabase. Ne jamais recopier un chiffre de ce document dans un rapport sans l'avoir revérifié. Ne jamais écrire « validé » pour une étape non exécutée.

## 7.3 Convention de commit

```
<type>(<phase>): <description à l'impératif>

<corps : ce qui change et pourquoi>

Portes : G1 ✅ G2 ✅ (867/867) G3 ✅ (12/12) G4 ✅ G5 ✅ G6 ✅
Preuves : <sorties, chemins de captures>
```

Types : `feat`, `fix`, `refactor`, `test`, `docs`, `perf`, `chore`. Phase : `y0` à `y9`. Un commit par sous-phase, jamais de commit fourre-tout.

## 7.4 Conditions d'arrêt

L'agent s'arrête, écrit dans `docs/Y_BLOCKERS.md` et **poursuit sur la sous-phase indépendante suivante s'il en existe une**, dans les cas suivant : une migration de schéma s'avère nécessaire ; un contraste échoue et aucune des deux solutions autorisées ne le résout ; un diff visuel apparaît sur `/pays`, `/materiel` ou `/compte`, qui sont hors périmètre ; le nombre de tests baisse sans explication ; une porte échoue trois fois de suite ; ce document est ambigu ou contredit par le code ; une décision de Y0.2 s'avère fausse à l'usage ; un risque de sécurité non anticipé apparaît ; une dépendance nouvelle semble nécessaire.

Format d'un blocage : sous-phase, ce qui a été tenté, sortie exacte de l'erreur, hypothèses écartées, décision requise, et impact sur la suite du plan.

## 7.5 Placement des skills — récapitulatif

| Phase | Skills |
|---|---|
| Y0 | `verification-before-completion`, `lkdv-development`, `using-superpowers`, `finishing-a-development-branch`, `github-workflow`, `systematic-debugging`, `root-cause-tracing`, `code-quality`, `brainstorming`, `writing-plans`, `apple-ui-designer`, `interaction-design`, `ux-mobile` |
| Y1 | `test-driven-development`, `testing-anti-patterns`, `code-quality`, `verification-before-completion` |
| Y2 | `apple-ui-designer`, `interaction-design`, `nextjs-performance`, `lkdv-development`, `executing-plans` |
| Y3 | `systematic-debugging`, `code-quality`, `root-cause-tracing`, `verification-before-completion` |
| Y4 | `dispatching-parallel-agents`, `subagent-driven-development`, `apple-ui-designer`, `interaction-design`, `lkdv-development` |
| Y5 | `ux-mobile`, `interaction-design`, `claude-android-skill` |
| Y6 | `lkdv-development`, `code-quality`, `ai-engineering-toolkit` |
| Y7 | `claude-android-skill`, `ux-mobile`, `interaction-design`, `apple-ui-designer` |
| Y8 | `nextjs-performance`, `code-quality`, `requesting-code-review`, `receiving-code-review`, `claude-seo` |
| Y9 | `verification-before-completion`, `finishing-a-development-branch`, `github-workflow` |

`verification-before-completion` est active **en permanence**, pas seulement en Y9.

---

# PARTIE 8 — REGISTRE DES RISQUES

| # | Risque | Prob. | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Conflit entre PR #30, #31 et Y | Élevée | Élevé | Y0.1 bloquant, fusion avant démarrage |
| R2 | Branche non protégée, code cassé poussé | Élevée | Élevé | Y0.6 + discipline §7.2 + activation manuelle signalée |
| R3 | Régression visuelle masquée par `canvas`/`img` | Élevée | Moyen | Y0.5, masques nommés uniquement |
| R4 | Captures non déterministes (`J-N`) | Certaine | Moyen | Horloge figée + slugs fixes |
| R5 | Layout de segment recharge les données | Moyenne | Moyen | Mesure en Y2.2, contexte plutôt que requête |
| R6 | Sauge sous AA sur les nouveaux widgets | Moyenne | Moyen | Règle X6 réappliquée, G6 sur chaque sous-phase |
| R7 | Fuite de documents dans le cache hors-ligne | Moyenne | **Critique** | Y0.7 audit, Y8.3 correction |
| R8 | Trois moteurs de carte, poids de bundle | Certaine | Moyen | Y8.2, imports dynamiques |
| R9 | Deux barres persistantes mobiles | Certaine | Moyen | Y0.2 arbitrage 3 |
| R10 | Suppression d'un fichier vivant cru mort | Faible | Élevé | Grep collé dans le commit, commit isolé revenable |
| R11 | Agents parallèles en conflit sur le layout | Moyenne | Élevé | Parallélisme limité aux sections terminales |
| R12 | Permissions vérifiées seulement à l'affichage | Moyenne | **Critique** | Y0.7 + parcours 5 |
| R13 | Test natif non exécutable | Élevée | Faible | Mention explicite de non-exécution |
| R14 | Skill référencée absente | Moyenne | Faible | Y0.0 confirme, consigne, poursuit |
| R15 | Le profil masque une section dont l'utilisateur a besoin | Moyenne | Moyen | `TripSectionPicker`, rien n'est verrouillé |

---

# PARTIE 9 — MODÈLE DU RAPPORT FINAL

`docs/Y_REPORT.md` doit contenir, dans cet ordre, sans exception ni reformulation.

L'identité du chantier : SHA de départ, SHA final, numéro de PR, dates.

Les décisions arbitrées, reprises de `docs/Y_DECISIONS.md`, avec pour chacune l'option retenue et l'option écartée.

Le bilan des suppressions : chaque fichier supprimé, sa taille, la preuve de son inutilisation, le total d'octets.

L'état des douze règles Y-D80 : nombre de fichiers scannés, nombre d'assertions, résultat par règle.

Les mesures de contraste : chaque paire testée, son ratio mesuré, son verdict, et pour le sauge la règle d'usage retenue.

Le bilan visuel : nombre de captures, liste des masques restants **avec justification de chacun**, diffs constatés et leur statut, chemin de la planche de contact finale et de la planche initiale.

Le bilan d'accessibilité : surfaces scannées, viewports, violations par gravité.

Le bilan de performance : tableau avant/après par route, LCP mesuré, temps de navigation entre sections.

Le bilan de sécurité : chaque point de Y0.7, son verdict, sa correction éventuelle.

Les parcours : les cinq, avec leur résultat sur chaque viewport.

Le natif : exécuté ou **non exécuté**, sans ambiguïté.

Les compteurs : nombre de tests au départ, à l'arrivée, nombre de fichiers de test, tests retirés et pourquoi.

Les sorties brutes des six portes, horodatées.

Ce qui reste ouvert : blocages non résolus, dette assumée, et l'action manuelle d'activation de la protection de branche.

---

# ANNEXE A — TOKENS DE RÉFÉRENCE

⚠️ Valeurs relevées le 07/09/2026 sur `chantier/x-design-unique`. **`docs/DESIGN_TRUTH.md` prime en cas de divergence.** Y0.0 revérifie.

| Token | Valeur | Usage |
|---|---|---|
| `--lkv-primary` | `#17402C` | Forest Deep, pilule active, texte principal |
| `--lkv-primary-hover` | `#1A422D` | Survol (⚠️ `#123323` obsolète en circulation) |
| `--lkv-primary-soft` | `#365233` | Aplats doux |
| `--lkv-accent` / secondary | `#5B7F55` | Sage — **jamais pour du texte normal** |
| `--lkv-surface` | `#FBFAF6` | Crème papier, surface de verre |
| `--lkv-background` | `#FAF8F5` | Fond desktop |
| `--lkv-text-primary` | `#17402C` | Texte |
| `--lkv-text-secondary` | `#6B7568` | Texte secondaire, sur-titres |
| `--lkv-success` | `#5B7F55` | Succès |
| `--lkv-warning` | `#C89A3B` | Avertissement (non textuel) |
| `--lkv-warning-dark` | `#8C6418` | Avertissement textuel accessible |
| `--lkv-danger` | `#A8443A` | Danger |
| `--lkv-info` | `#4B6B7C` | Information |
| Rayons | 6 / 10 / 14 / 20 / 26 / 28 / 32 px + `full` | Via `var(--lkv-radius-*)` |
| `--lkv-touch-min` | 44 px | Cible tactile minimale |
| Durées | 120 / 180 / 280 / 420 ms | `--dur-xfast` → `--dur-slow` |
| Courbe | `cubic-bezier(0.22,1,0.36,1)` | `--ease-glass` |
| Z-index | 20 / 40 / 50 / 70 | sticky / drawer / sheet / toast |
| Polices | Manrope, DM Sans, IBM Plex Mono, Instrument Serif | Celles chargées par `layout.tsx` |

Hex autorisés en dur : `#ffffff`, `#fff`, `#000000`, `#000`. Aucun autre.

---

# ANNEXE B — COMMANDES

```bash
# Portes
npm run type-check                 # G1
npm test                           # G2
npm test -- y-d80                  # G3
npm run build                      # G4 — sans .env.local
npm run test:visual                # G5
npm run test:a11y                  # G6 — à créer en Y0.5

# Captures
npm run test:visual                # exécute
npm run test:visual:update         # JAMAIS sans inspection préalable
npm run visual:sheet               # planche de contact — à créer

# Données
npm run seed:y                     # 8 voyages déterministes — à créer

# Natif
npm run mobile:build
npm run mobile:open:android
npm run mobile:open:ios

# Divers
npm run lint:fix
npm run format
npm run verify:invariants
npm run dev                        # port 4000, aligné sur Playwright
```

---

# ANNEXE C — BUDGET ET SÉQUENCE

| Phase | Estimation | Bloquante | Parallélisable |
|---|---|---|---|
| Y0 | 4-6 h | Oui, totalement | Non |
| Y1 | 4-6 h | Oui | Non |
| Y2 | 6-8 h | Oui | Non |
| Y3 | 5-7 h | Partiellement | Partiellement |
| Y4 | 12-16 h | Non | Oui, sections terminales |
| Y5 | 4-5 h | Non | Non |
| Y6 | 5-7 h | Non | Partiellement |
| Y7 | 4-6 h | Non | Non |
| Y8 | 6-8 h | Non | Partiellement |
| Y9 | 3-4 h | Oui | Non |
| **Total** | **53-73 h** | | |

Séquence obligatoire : Y0 → Y1 → Y2 → Y3 → Y4 → (Y5, Y6, Y7 en parallèle possible) → Y8 → Y9.

Tags de retour arrière : `y0-done` à `y8-done`, posés en fin de chaque phase.

---

*Fin du document. Toute modification passe par un commit `docs(y*): …` avec justification.*

---

Deux remarques en dehors du document.

La première est le point le plus important que j'aie trouvé aujourd'hui : **la branche n'est pas protégée**. Tu demandes « aucun bug » avec un agent en autonomie totale, et le dépôt n'a actuellement aucun moyen d'empêcher un push cassé. Y0.6 installe le workflow, mais l'activation de la protection de branche est un réglage manuel côté GitHub que je ne peux pas faire à ta place. C'est trente secondes de ton temps et ça transforme toutes les portes de ce plan en garanties réelles au lieu de promesses.

La seconde : Y0 est bloquante en totalité et représente 4 à 6 heures avant la première ligne de code. C'est volontaire. Les quatre `❓` non tranchés — itinéraire, configurateur mort, barres mobiles, `ResumeActiveTripCard` — sont exactement le type d'ambiguïté qu'un agent autonome comble par invention, et que tu découvrirais à la recette.