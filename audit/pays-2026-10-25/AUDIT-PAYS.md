# AUDIT — Fiche pays `/pays/[code]`

**Date :** 25 octobre 2026 · **Dépôt :** `/Users/fr168256/lkdv` · **Branche :** `chantier/configurateur-ultime` (HEAD `751f976`) · **Worktree :** unique
**Environnement mesuré :** Next.js 15.5.25 en local (`http://127.0.0.1:4000`), données Supabase réelles `icxyvwzfjbflcbqukpfz` (projet `lekitduvoyageur2`), `.env.local` créé pour l'audit (ignoré par git).
**Viewports :** 430 × 932 (DPR 2), 768 × 1024, 1440 × 900. **Navigateur :** Chromium 1.63.
**Captures :** `audit/pays-2026-10-25/avant/` (28 fichiers PNG + 3 JSON de mesures).

---

## 1. Verdict

1. **La cible de la refonte n'existe pas dans ce dépôt.** La grammaire Compte (`src/design/account/`, tokens `--label` / `--tint` / `--page` / `--sf`, feuille `account-grammar.css`, runtime des filtres liquides, `npm run design:fidelity`) est **absente** : aucun de ces tokens n'est déclaré dans `src/styles/tokens.css`, aucun fichier `src/design/account/*`, aucun script `design:*`. Le déploiement de production ne sert pas non plus cette grammaire.
2. **L'écran actuel n'est pas verrouillé :** `scrollHeight` = **2 332 px** (France) à **4 017 px** (onglet Communauté) pour `innerHeight` 932. Rapport 2,5 à 4,3 écrans.
3. **La matière est l'inverse de la référence :** verre noir `rgba(16,16,16,.34)` + encre blanche + base 17 px, là où la grammaire impose verre clair, encre `#172B24` et base 14 px.
4. **Le contenu éditorial n'existe presque pas :** 246 pays en base, **4 pays** avec blocs éditoriaux (ST, PT, NP, IS), **6** guides pratiques, **0** pour la France. 4 des 8 sections de `/pays/fr` n'affichent qu'un placeholder ou rien. Le design doit être bon **dans le cas vide**, pas malgré lui.
5. **Mobile et desktop sont montés en même temps :** 2 `<h1>`, 29 éléments interactifs visibles, météo/recommandations/Supabase appelés deux fois par visite.

---

## 2. Méthode

- Captures avant aux 3 viewports + 8 sections mobiles + états (chargement, 404, invité).
- `getComputedStyle` + `getBoundingClientRect` sur les parts de l'écran (JSON joints).
- Comptage des requêtes réseau et des états de données réels (Supabase MCP + payloads API).
- Lecture du code de l'écran et de ses composants (inventaire §4).
- Comparaison à la spec mesurée `grammaire-compte.md` (25 octobre 2026, 430 × 932).

**Limite assumée :** la page `/compte` de ce dépôt est l'implémentation **legacy** (verre sombre, barre 60 px, « Connexion requise » en invité) — elle ne peut pas servir de référence mesurable. La seule référence exploitable est la spec mesurée du skill `refonte`, dont les 17 constantes sont reprises ci-dessous comme loi.

---

## 3. Mesures « avant » — 430 × 932, `/pays/fr`

| # | Part | Mesuré | Grammaire (loi) | Écart |
|---|---|---|---|---|
| 1 | Écran verrouillé | `scrollHeight` **2 332** | 932, `overflow: hidden` | **+1 400 px** |
| 2 | Base typo | **17 px**, `#fff`, `normal` | 14 px / −0,14 px / `#172B24` | +3 px, encre inversée |
| 3 | Barre haute | pilule « ← Atlas » **80 × 32** à (16,16) ; 1 seul bouton rond (« Kit IA » 80 × 32) + 1 pilule pays 88 × 26 | (12,6) 406 × 36 ; pilule h **34** ; **3** boutons ronds **38** | y +10, h −2/−6, 1 bouton au lieu de 3 |
| 4 | Carte | aucune : **11 cartes** `.glass` empilées (26 dans le DOM avec le desktop), `r24` | **1** carte (12,48) 406 × **541** r24, scroll interne | structure absente |
| 5 | Identité | hero photo **398 × 224** + grille de 4 stats **90 × 58** r0, libellés 8 px **MAJUSCULES** | header 382 × 68, visuel **66**, **3** stats **101 × 39** r14, libellés 10,5 minuscules | 4 stats, uppercase interdit, rayon 0 |
| 6 | Bio | absente (slogan dans la photo) | 378 × 32,6, 2 lignes max | absent |
| 7 | Anneaux | absents | 5 × **72 × 56**, anneau 44, disque 38 | absent |
| 8 | Grille 3 colonnes | absente (carrousels horizontaux) | 406, gap **3**, tuiles **134** r2 | absent |
| 9 | Sélecteur | absent ; rangée d'onglets pays **430 × 102** au-dessus de la barre | 88 × 30 dans la carte, lentille **41,5 × 25** | absent |
| 10 | Barre basse | items **74 × 60**, icônes + libellés, 5 items | (14,868) 402 × 48, **5** items **80 × 44** | +12 px de haut, +16 px par item |
| 11 | Matière | `radial-gradient` + `rgba(16,16,16,.34)`, `blur(14px) saturate(1.6)` | verre clair §4.2 (blanc .486→.325, `blur(4px) saturate(1.9) brightness(1.07)` + filtre `url(#lf…)`) | matière inverse, pas de filtre liquide |
| 12 | Contenu sous les barres | carte « RECOMMANDÉ POUR VOUS » et « CONTINENT & RÉGION » visibles **sous** la rangée d'onglets (y 830–932) | écran verrouillé : pas de recouvrement possible | lisibilité |

**Défilement par route et par viewport**

| Route | 430 | 768 | 1440 |
|---|---|---|---|
| `/pays/fr` | **2 332** | 1 024 (layout desktop écrasé) | 900 (scroll interne) |
| `/pays/pt` (avec contenu) | **2 776** | — | — |
| `/pays/np` (avec contenu) | **2 869** | — | — |
| `/pays/fr` onglet Communauté | **4 017** | — | — |
| `/compte` (référence du dépôt) | 932 | 1 024 | 900 |

---

## 4. Inventaire

### 4.1 Sections mobiles — contenu réel mesuré (FR, 25/10/2026)

| Section | Ce qui s'affiche vraiment | Ce qui est monté | Donnée |
|---|---|---|---|
| **Aperçu** | « Contenu en préparation pour « Présentation ». » · météo Open-Meteo (15 °C, Pluie, vent 23, UV 0) · « Aucune recommandation disponible pour ce pays pour l'instant. » · fiche d'identité (7 champs) · 4 tuiles « Incontournables en bref » · **2 images cassées / 6** | `SectionBlocks`, `PaysWeatherCard`, `PaysRecommendations`, `PaysHeroOverview` (desktop), `MobileCountryDetailView` | `country_content_blocks` vide pour FR, `/api/pays/FR/weather`, `/api/pays/FR/recommendations` |
| **Incontournables** | placeholder + « SÉLECTION PARTENAIRE · KLOOK — Activités à France » | `PaysRegionsList`, `SectionBlocks`, `DiscoverySection(attractions)`, `KlookCtaBlock` | `/api/pays/FR/regions`, `/api/discovery/search`, `klookAdapter` |
| **Activités** | placeholder + sentiers + Klook | `SectionBlocks`, `PaysTrailsList`, `DiscoverySection(attractions)`, `KlookCtaBlock` | `/api/pays/FR/trails` |
| **Culture** | **titre + placeholder uniquement** | `SectionBlocks` | `country_content_blocks` vide |
| **Gastronomie** | **titre seul** (bloc partenaire muet) | `DiscoverySection(restaurants)` | `discovery.search` renvoie `unconfigured` → rendu `null` |
| **Hébergements** | **titre seul** | `DiscoverySection(hotels)` | idem |
| **Météo & Pratique** | météo live + fiche d'identité + guide IA | `PaysWeatherCard`, `PaysPratiqueView` (803 lignes), `useCountryPracticalGuide` | `/api/ai/country-guide/FR` → `has_content:false` |
| **Communauté** | bouteille à la mer (2), 3 carnets, 6 clubs — **vraies données** | `BouteilleALaMer` (900 lignes), `PaysClubsList`, `PaysCarnetsList` | `travel_groups`, `carnets`, `clubs`, `public_profiles`, `rpc/group_public_card_stats` |

**Provenance exacte des données affichées**

| Bloc | Source réelle | Volume | Fichier |
|---|---|---|---|
| Géographie (nom, capitale, devise, superficie, fuseau, langues, géométrie) | `countries_geo` | 246 pays | `src/lib/geodata.ts` |
| Éditorial **codé en dur** | `COUNTRY_DETAILS` | **4 pays** : IS, JP, FR, CA | `src/lib/countryDetails.ts:108` |
| Éditorial **en base** | `country_content_blocks` | 45 blocs, 4 pays (ST, PT, NP, IS) — **FR = 0** | idem |
| Guides pratiques IA | `country_practical_guides` | 6 pays — **FR = 0** | idem |
| Images de destinations de secours | 6 URL Unsplash rotation | fallback | `src/lib/countryDetails.ts:1381` |
| Météo | Open-Meteo | temps réel | `/api/pays/[code]/weather` |
| Communauté | `carnets`, `clubs`, `travel_groups`, `public_profiles` | réel | `/api/...` + Supabase REST |
| Partenaires | Klook (statique), Discovery (provider serveur) | `unconfigured` en local | `klookAdapter`, `discoveryService` |

**Volume de données réel (Supabase, 25/10/2026)**

| Table | Lignes | Commentaire |
|---|---|---|
| `countries_geo` | **246** | géométrie, capitale, devise, langues, fuseau, superficie, `sources` |
| `country_content_blocks` | **45** | 4 pays seulement : ST 13, PT 13, NP 13, IS 6 ; **FR = 0** |
| `country_practical_guides` | **6** | colonnes `section`, `content_md`, `degraded`, `stale_after` ; **FR = 0** |

### 4.2 Actions (inventaire DOM à 430, éléments visibles)

| # | Libellé | Action |
|---|---|---|
| 1 | onglet × 8 (`Aperçu … Communauté`) | événement `pays-detail-tab-change` |
| 2 | barre basse × 5 (`Hub`, `Communauté`, `Explorer`, `Messages`, `Compte`) | routes globales |
| 3 | `← Atlas` | `/pays` → **307** `/explorer` |
| 4 | `Kit IA` (haut) | `/prepare?tab=equipement&country=FR` + haptique |
| 5 | 6 chips `Facile/Modéré/Expert`, `Week-end/Semaine/Expédition` | paramètres recommandations |
| 6 | `Destinations`, `Activités (3)` | bascule de section |
| 7 | `Tout voir (5) →` | bascule de section |
| 8 | `✨ Lancer le configurateur IA →` | `/prepare?tab=equipement&country=FR` |
| 9 | Desktop : `Créer mon kit`, `Guide PDF` (`window.print`), nav 8 items, `Explorer tous les pays`, liens carte | desktop uniquement |
| 10 | Sources documentaires (liens externes `↗`) | `country.sources_list` |

### 4.3 Données / API appelées à chaque visite

```
200 /api/pays/FR/weather              200 /api/pays/FR/recommendations
200 /api/pays/FR/regions              200 /api/pays/FR/trails
200 /api/ai/country-guide/FR   ×3     200 /api/discovery/search   ×4
200 /api/badges/unread                401 /api/telemetry/hub
Supabase REST ×2 chacun : travel_groups, clubs, carnets,
public_profiles ×4, rpc/group_public_card_stats
```

Les `×2` viennent du double montage mobile + desktop (§5.3).

### 4.4 États observés

| État | Constat |
|---|---|
| **Vide** | Placeholder générique `Contenu en préparation pour « X ».` (`src/features/pays/components/SectionBlocks.tsx:43`) ; `DiscoverySection` rend `null` sans message ; « Aucune recommandation… » est honnête. |
| **Chargement** | `src/app/pays/[code]/loading.tsx` : squelette générique (hero 50 vh + 4 colonnes) sans rapport avec l'écran final → saut visuel. Capture `etat-chargement-430.png`. |
| **Erreur** | `error.tsx` générique (glass + Réessayer + Accueil), boîte centrée, ne reprend aucune part de l'écran. |
| **404** | Page « Sentier introuvable » correcte, **mais la rangée d'onglets pays et la barre basse restent affichées** (`etat-404-430.png`). |
| **Invité / connecté** | Aucune différence sur la fiche : tout est public. |
| **Carte desktop** | Deux états vus à 1440 : « ⚠ Impossible de charger la carte » (`src/components/map/UnifiedCountryGlobe.tsx:364`) puis carte SVG de secours. |
| **Hors-ligne** | `OfflineBanner` global, pas d'état propre à la fiche. |

### 4.5 Tests existants (à ne pas casser)

26 fichiers de tests touchent `/pays` ou ses composants. Les principaux :

| Fichier | Tests | Couvre |
|---|---|---|
| `tests/features/pays/weather-route.spec.ts` | 4 | `/api/pays/[code]/weather` |
| `tests/features/pays/trails-route.spec.ts` | 5 | `/api/pays/[code]/trails` |
| `tests/features/pays/regions-route.spec.ts` | 4 | `/api/pays/[code]/regions` |
| `tests/features/pays/recommendations-route.spec.ts` | 5 | `/api/pays/[code]/recommendations` |
| `tests/ai/countryGuides.spec.ts` | 13 | guide IA pays |
| `tests/countries_geo.spec.ts` | 6 | référentiel géo |
| `tests/features/discovery/{wiring,render}.spec.*` | — | `DiscoverySection` |
| `tests/trips/chantier-z8.spec.ts` | — | invariants |

Aucun test E2E ne couvre la fiche pays (aucun `tests/e2e/**` ne référence `/pays/`).

---

## 5. Défauts constatés

### P0 — bloquants pour la refonte

| # | Défaut | Preuve |
|---|---|---|
| 1 | **Grammaire cible absente du dépôt** : pas de `src/design/account/`, pas de tokens `--label/--tint/--page/--sf`, pas de `design:fidelity` ni `design:diff`, pas de runtime de filtres liquides | `grep -c "--tint:" src/styles/tokens.css` → 0 ; `ls src/design` → layouts + tokens.ts legacy |
| 2 | **Écran non verrouillé** : 2 332 à 4 017 px | §3 |
| 3 | **Double montage mobile + desktop au même viewport** : 2 `<h1>France`, 29 éléments interactifs visibles, météo/recommandations/guide/Supabase appelés deux fois | `probe.tmp.mjs` |
| 4 | **4 sections sur 8 sans contenu** ; placeholder de développement affiché en production (« Contenu en préparation pour « Culture & Société ». ») | captures `section-culture-430-haut.png`, `section-gastronomie-430-haut.png` |
| 5 | **Carte desktop en erreur** à 1440 (`UnifiedCountryGlobe.tsx:364`) | `pays-fr-1440.png` |
| 5 bis | **Contenu fabriqué** : éditorial France codé en dur dans `countryDetails.ts:108` alors que la base est vide, et 6 images Unsplash génériques utilisées comme photos de destinations (`countryDetails.ts:1381`) — viole la loi « données réelles » | `grep`, `sections-contenu.json` |
| 6 | **Contenu recouvert** par la rangée d'onglets (chips de recommandations, « CONTINENT & RÉGION ») | `section-pratique-430-haut.png` |

### P1 — écarts de grammaire

| # | Défaut | Preuve |
|---|---|---|
| 7 | Matière inversée (verre noir, encre blanche) | §3.11 |
| 8 | Libellés de stats `text-transform: uppercase` à 8 px — **interdit par la grammaire §2** | `statCell` mesuré, captures |
| 9 | 4 stats au lieu de 3 ; pilule `ISO FR · FRA` qui passe sur 2 lignes | `section-pratique-430-haut.png` |
| 10 | Iconographie emoji (`🎒 ⛅ 🌊 ✨`) mêlée au jeu d'icônes | captures |
| 11 | Squelette de chargement sans rapport avec l'écran final | `etat-chargement-430.png` |
| 12 | 2 images cassées sur 6 dans l'onglet Aperçu | `sections-contenu.json` |
| 13 | `/pays` redirige en 307 vers `/explorer` : le lien « Atlas » et le fil d'Ariane JSON-LD pointent une URL qui redirige | `curl -I /pays` |
| 14 | 768 px : layout 3 colonnes écrasé, stats tronquées sur 3 lignes | `pays-fr-768.png` |

### P2 — bruit et dette

| # | Défaut | Preuve |
|---|---|---|
| 15 | 4 appels `/api/discovery/search` alors que le fournisseur est `unconfigured` | §4.3 |
| 16 | 3 appels `/api/ai/country-guide/FR` pour un résultat vide | §4.3 |
| 17 | `401 /api/telemetry/hub` à chaque visite | §4.3 |
| 18 | Bandeau cookies qui recouvre le contenu (global, hors périmètre de la fiche) | toutes les captures |

---

## 6. Ce qui ne doit pas bouger

| Acquis | Contrainte |
|---|---|
| Route `/pays/[code]` + redirects middleware (`/pays/france` → 301 `/pays/fr`) | inchangés |
| `generateMetadata` + JSON-LD `Place` / `WebPage` / `BreadcrumbList` | conservés au caractère près |
| Rendu dynamique (`export const dynamic = 'force-dynamic'`) | conservé |
| 8 sections et leurs clés (`presentation`, `destinations`, … `communaute`) | conservées |
| Sources de données réelles (météo Open-Meteo, Supabase, community, Klook, discovery) | aucune mock, aucun fallback inventé |
| Actions : Atlas, Kit IA, configurateur, PDF, partage, sources, nav 5 | toutes conservées, même si déplacées |
| Tests listés §4.5 | verts à la fin |
| Haptique (`useHapticFeedback`) | conservée |

---

## 7. Contrat de refonte

### 7.1 Intention

Faire de la fiche pays un **écran verrouillé de la grammaire Compte** : une seule carte de 541 px qui contient l'identité du pays et son contenu, un fond photo plein écran, une barre haute de 36 px, une barre basse de 48 px, des drawers pour tout ce qui ne tient pas. Le pays n'est plus une page qui défile : c'est une fiche qu'on tient.

### 7.2 Anatomie cible (430 × 932)

```
.lkdv-account.pays            430×932, overflow hidden, tokens §1, base 14 / −0,14 / #172B24
├─ .bg                        cover du pays, background-size cover, center 30%
├─ .top                       6/12 406×597.1, flex column, gap 4
│  ├─ .ig-top                12/6 406×36 — pilule « ← Atlas » h34 + 3 boutons ronds 38
│  └─ .card.cs.pays          12/48 406×541.1, r24
│     └─ .card-scroll        8/12/56, gap 7, overflow hidden auto
│        ├─ .ig-header       382×68 — drapeau 66 + nom + 3 stats 101×39
│        ├─ .ig-bio          378×32.6 — slogan (600/tint) + « Continent · Région · Fuseau »
│        ├─ .ig-hl-row       8 anneaux (5 visibles, scroll-x) = 8 sections
│        ├─ .ig-grid-wrap    406, gap 3 — tuiles 134 r2 = contenu de la section active
│        └─ .ig-tabs-float   88×30 — bascule Grille | Liste, lentille 41.5×25
├─ .mapzone                  0/597.1 430×334.9 — carte du pays (globe actuel, secours SVG depuis countries_geo.geometry)
└─ .tb                       14/868 402×48 — 5 items 80×44
```

### 7.3 Mapping composant source → primitive cible

| Aujourd'hui | Cible | Note |
|---|---|---|
| `MobileCountryDetailView` (560 l., verre sombre) | `PaysScreen` = composition de primitives | aucune feuille d'écran |
| En-tête photo 398 × 224 + 4 stats | `.ig-header` (visuel 66 + 3 stats) + `.bg` | le hero photo devient le fond |
| `PaysHeroOverview` (desktop) | **supprimé** : son contenu migre en `.ig-bio`, `.ig-grid-wrap` et drawer « Présentation » | aucun contenu perdu |
| Rangée d'onglets `NavigationPlateau` (430 × 102) | `.ig-hl-row` (8 anneaux) + `.ig-tabs` | la barre basse reste la nav d'app |
| Cartes empilées (`glass`) | `.card-scroll` + tuiles / lignes | un seul contenant |
| `PaysLeftSidebar` (desktop) | drawers + barre basse | PDF et Créer mon kit dans le menu de carte |
| `PaysRightSidebar` (desktop) | `.mapzone` + drawer « Pratique » | |
| `SectionBlocks` placeholder | état vide honnête : phrase + action | plus de « Contenu en préparation » |
| `DiscoverySection` muet | état vide explicite ou absence assumée de la tuile | décision §8 |
| `KlookCtaBlock` | tuile partenaire dans la grille + attribution | inchangé fonctionnellement |
| `BouteilleALaMer`, `PaysClubsList`, `PaysCarnetsList` | contenu de la tuile « Communauté » | mêmes requêtes |

### 7.4 Tokens, matière, motion

Reprise **exacte** de `grammaire-compte.md` §1 (tokens), §4 (matière, dont les 7 filtres `url(#lf…)` du runtime), §5 (motions). Aucune couleur littérale hors table. Les 17 constantes de §8 deviennent le contrat de `design:fidelity`.

### 7.5 États

| État | Règle |
|---|---|
| Vide | une phrase + une action, dans le flux de la carte ; jamais de `—` ni de faux compteur |
| Chargement | squelettes aux dimensions des parts (pilule 34, rond 38, visuel 66, ligne 12, tuile 134), shimmer 1,4 s |
| Erreur | même boîte que le contenu remplacé, message + réessayer |
| Invité | mêmes parts ; actions de compte ouvrent la connexion |
| 404 | coquille conservée, sans rangée de sections |
| Carte indisponible | secours statique (contour réel), jamais un cadre vide |

### 7.6 Desktop et tablette

Colonne centrée **430 px max**, carte 541, aucun reflow interne (grammaire §7). Les blocs desktop (nav, carte, table pratique, PDF) sont **relogés** en drawers — rien ne disparaît.

### 7.7 Lots

| Lot | Contenu | Preuve |
|---|---|---|
| 0 | Socle grammaire : `src/design/account/` (tokens, feuille, runtime filtres, primitives) + `design:fidelity` + `design:diff` + banc d'essai | porte verte sur le banc |
| 1 | Coquille verrouillée : `.bg`, `.ig-top`, `.card.cs`, `.mapzone` | captures + `scrollHeight = innerHeight` |
| 2 | En-tête identité : drapeau 66, nom, 3 stats réelles, bio 2 lignes | invariants 8-10 |
| 3 | Anneaux 8 sections + sélecteur Grille/Liste | invariants 11, 13 |
| 4 | Grille 3 colonnes : tuiles par section, états vides honnêtes | invariant 12 |
| 5 | Drawers : fiche d'identité complète, pratique, sources, partage, PDF | boîte 12/48/406×541, capsule 48 |
| 6 | Partenaires (Klook, Discovery) : tuile + attribution, zéro casse si absent | tests discovery |
| 7 | Desktop/tablette : colonne 430, drawers | captures 768 / 1440 |
| 8 | Recette : 8 sections × 3 viewports × états, diff, gate, build, prod | rapport + URL |

### 7.8 Preuves de fin

- `design:fidelity` vert (14 invariants, 17 mesures, ±1 px) sur `/pays/fr`, `/pays/pt`, `/pays/np`.
- `scrollHeight = innerHeight` aux trois viewports.
- Captures avant/après au même viewport + diff ≤ 0,2 % expliqué.
- Chaque bouton cliqué, chaque état vu, 0 mock.
- `type-check && lint && test && build` verts, tests §4.5 inclus.
- Prod vérifiée à l'URL.

---

## 8. Décisions à trancher avant de coder

1. **Socle grammaire** : je porte les primitives depuis la spec mesurée (Lot 0, ~1 écran de travail), ou tu fournis le worktree/commit de la grammaire Compte ?
2. **Desktop** : colonne 430 + drawers (fidèle à la loi) ou 3 colonnes conservées (hors-périmètre) ?
3. **Barre basse** : globale à 48 px (touche toutes les pages) ou la fiche pays garde la barre actuelle à 60 px (écart documenté) ?
4. **Sections sans contenu** (4 sur 8) : tuiles avec état vide + action, ou tuiles masquées tant que le contenu n'existe pas ?

---

## 9. Risques

| Risque | Impact | Parade |
|---|---|---|
| Grammaire portée à la main → dérive de 1-2 px | écran « presque identique » | porte `design:fidelity` + banc d'essai |
| 246 pays, 4 avec contenu | fiche vide par défaut | lot 4 conçu vide d'abord, recette sur FR (vide) et PT/NP (plein) |
| Filtres liquides SVG absents | surfaces plates | runtime `data-lf` + écart documenté sinon |
| Barre basse globale | régression sur tous les écrans | lot séparé, recette app entière |
| Descente desktop → drawers | perte d'accès aux données | mapping §7.3, recette clic par clic |
| Double montage supprimé | régression d'affichage | rendre conditionnel, tester les 3 viewports |

---

## 10. Annexes

`audit/pays-2026-10-25/avant/` :

- `pays-fr-{430,768,1440}.png` + `.json` — captures et mesures
- `section-{presentation,destinations,activites,culture,gastronomie,hebergements,pratique,communaute}-430-{haut,full}.png` — 8 sections
- `desktop-{presentation,pratique,communaute}-1440-full.png`
- `etat-chargement-430.png`, `etat-404-430.png`, `pays-{pt,np}-430.png`
- `inventaire-dom.json` (36 actions, styles calculés), `sections-mesures.json`, `sections-contenu.json` (contenu réel, API)

`ref-compte-430.png` = `/compte` de ce dépôt en invité (legacy, non représentatif de la grammaire).
