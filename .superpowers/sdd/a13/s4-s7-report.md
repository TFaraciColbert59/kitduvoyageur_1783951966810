# A13 (S4 + S7) — Sources vivantes dans le plan & Terrain Live sur la carte

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`). Plan source :
`docs/superpowers/plans/a13-l3-produit-bout-en-bout.md` (flux S4 et S7). Environnement :
Supabase local (`.env.local` = projet de test), flags de domaine **OFF**, aucun secret
commité, aucune écriture prod, aucune migration DDL ajoutée (les sources S4 s'appuient
sur les RPC existantes `a5_terrain_reports_near` et `get_trail_pois_bbox`).

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `ac0cbf03` | `feat(ai): A13 S4 sources vivantes (Terrain Live route, POI OSM eau/refuges, warnings explicites)` | serveur + route generate + tests |
| `2a78693c` | `fix(ai): A13 S4 avertissement explicite en cas de lecture Terrain Live partielle` | warning `terrain_live_partial` + test |
| `94ffcd6c` | `feat(ui): A13 S7 Terrain Live monte sur la carte cockpit (couche, panneau, signalement 3 gestes, flag serveur)` | UI + montage + tests |
| ce commit | `docs(a13): rapport S4 sources vivantes et S7 terrain live carte` | ce rapport |

## A. S4 — Sources vivantes (`server/liveSources.ts`)

- `liveConditions` : la section météo officielle existante (Open-Meteo, adaptateur
  A11) est fusionnée avec les signalements **réels** Terrain Live lus via
  `a5_terrain_reports_near` autour de la route :
  - points route échantillonnés `≤ 5` (premier/dernier + points réguliers, bornés),
  - rayon `3 000 m` borné `[250 m ; 5 000 m]`,
  - dédoublonnage par `id` (un signalement vu de plusieurs points ne compte qu'une fois),
  - provenance `community` (`sourceRef: a5_terrain_reports_near`) et, si présents,
    `official` (`terrain_reports:official`) ; la provenance météo officielle d'origine
    reste en tête. La valeur météo réelle est recopiée sans recalcul (forme d'origine
    préservée : `days`, `current`, `fetchedAt`), les signalements sont ajoutés sous
    `value.terrainReports` — aucune donnée inventée.
  - Échec total ⇒ warning `terrain_live_unavailable` ; échec partiel ⇒ warning informatif
    `terrain_live_partial` (seuls les signalements réellement reçus sont inclus).
- `foodAndWater` : points d'eau et refuges réels de `trail_pois` via
  `get_trail_pois_bbox` sur la bbox de route élargie (`±0,001°`) ; filtrage strict des
  catégories eau/refuges, potabilité OSM (`drinking_water`), altitude `ele` ; provenance
  `official` (`sourceRef: osm:trail_pois`). Absence (bbox sans POI ou lecture en échec)
  ⇒ warning `food_water_no_source` ; hors route, la section calculée reste inchangée.
- `regulations` / `documents` : aucune source déterministe dans le dépôt (vérifié) ⇒
  sections `null` + avertissements existants des adaptateurs (`regulations_no_deterministic_source`,
  `documents_no_deterministic_source`), réexportés par `liveSources` pour une surface
  unique.
- Branchement : `generateAdventure` accepte `liveSourcesClient` (client injecté : aucune
  dépendance Supabase dans la logique) et expose `liveSourceWarnings` (optionnel,
  rétro-compatible avec les résultats simulés). `POST /api/adventure/generate` injecte
  `createSupabaseLiveSourcesClient(supabase)` : réutilisation stricte des modules
  serveur A5/A1 existants, zéro requête ad hoc, zéro identité exposée.

### Tests `TEST-A13-SRC-01..05`

`tests/adventure-intelligence/live-sources.spec.ts` (client factice, 5 tests) :
fusion météo + Terrain Live avec provenances réelles (01) ; échantillonnage borné,
rayon borné, dédoublonnage, échecs partiel/total (02) ; POI eau/refuges sur bbox élargie,
provenance OSM, exclusion des POI hors périmètre (03) ; absence ⇒ `null` + warnings
dédiés (04) ; intégration `generateAdventure` avec/sans coordonnées (05).

## B. S7 — Terrain Live monté sur la carte du cockpit

- `TerrainLiveLayer` (existant) devient bi-mode : avec la prop `map` (carte Leaflet
  native existante, `ExplorerMap`), les marqueurs sont dessinés impérativement (mêmes
  couleurs/labels, sélection au clic via `terrainMarkerSpec`) ; sans `map`, le rendu
  react-leaflet déclaratif passe par `TerrainLiveReactMarkers` chargé en `ssr:false`
  (Leaflet n'est jamais évalué côté serveur — build 273 pages OK).
- `ExplorerMap` et `DesktopMapOverlay` acceptent `terrainReports` /
  `onTerrainReportSelect` ; la carte de la randonnée active monte donc la couche.
- Données : `useTerrainReports` gagne `enabled` (flag `terrain_live`) ; OFF ou position
  absente ⇒ aucune requête, liste vidée (« rien »). Une seule source de données par
  cockpit (carte + panneau partagent le même état).
- Cockpit : `TerrainLiveCockpitControl` (bouton flottant 44 px + bottom sheet iOS) avec
  liste verticale (`TerrainReportsList`), confirmations via `TerrainReportCard` branchées
  sur `POST /api/terrain/reports/[id]/confirm`, et création en 3 gestes
  (`QuickReportSheet`) branchée sur `POST /api/terrain/reports`. Aucune identité envoyée
  (session serveur uniquement), réponses 401/404/409/422/429/503 traduites en messages
  explicites sans dialogue natif.
- Flag : `src/app/randonnee-active/page.tsx` devient serveur et résout `terrain_live`
  une fois par requête (`currentAdventureFeatureFlags`, fail-safe OFF) puis le passe au
  cockpit client. Aucun flag activé, aucune modification de `src/app/hub/[section]/page.tsx`.
- UI : tokens `--lkv-*`, cibles ≥ 44 px, safe-area respectée, `prefers-reduced-motion`
  honoré (framer-motion conditionnel), zéro orange, rayons/ombres système (garde-fou
  U-D62), états vide/chargement/erreur, ARIA (`role="dialog"`, `aria-live`).

### Tests `TEST-A13-MAP-01..04`

`tests/adventure-intelligence/terrain-map-mount.spec.ts` (9 tests logique, pas de DOM) :
marqueurs déterministes et coordonnées valides uniquement, zéro orange (01) ; garde
flag/position et bornes de rayon (02) ; confirmation (URL, corps, 200/404/409/429,
réseau) (03) ; création 3 gestes (corps sans identité, 201 fusion 200, 422) (04).
Garden design `tests/design/unification.spec.ts` : 5/5 vert.

## C. Preuves d'exécution (état final)

| Vérification | Résultat |
| --- | --- |
| `npx vitest run tests/adventure-intelligence/live-sources.spec.ts` | 5 passed |
| `npx vitest run tests/adventure-intelligence/terrain-map-mount.spec.ts` | 4 passed |
| `npx vitest run tests/adventure-intelligence tests/design/unification.spec.ts` | 75 fichiers / 451 tests passed |
| `npm run test` (état final `94ffcd6c`) | `274 passed | 1 skipped`, `1967 passed | 6 skipped` |
| `npx vitest run tests/adventure-intelligence/live-sources.spec.ts` (post `2a78693c`) | 5 passed |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 (warnings préexistants uniquement) |
| `npm run verify:invariants` | SUCCÈS (dont 1 190 noms d'icônes résolus) |
| `npm run build` | exit 0, compilation 30,3 s, 273 pages statiques générées |
| pgTAP | aucune migration ajoutée ⇒ suite inchangée (0 `not ok`) |

TDD : les tests `TEST-A13-SRC-*` et `TEST-A13-MAP-*` ont été écrits avant leurs modules
d'implémentation (imports inexistants à l'écriture). Le premier passage post-implémentation
a révélé une assertion de test erronée (warning `live_conditions_no_source` attendu absent),
corrigée côté test avant le GREEN — aucune implémentation n'a été ajustée pour faire
passer un test.

## D. Écarts / points d'attention

- **S4 Terrain Live non gaté par le flag `terrain_live`** : la lecture est serveur
  (RPC publique sans identité) et enrichit le plan à la génération. Un gating par flag
  peut être ajouté d'une ligne si le produit le souhaite ; les surfaces A5 (API
  conditions/reports) restent, elles, gatées.
- **Forme de `liveConditions` fusionnée** : la valeur météo réelle est recopiée telle
  quelle (compatibilité `days`/`current`) et les signalements sont ajoutés sous
  `value.terrainReports`. Sans signalement, la section météo d'origine est renvoyée
  inchangée.
- **Réglementation/documents** restent volontairement `null` : aucune source
  déterministe trouvée dans le dépôt ; warnings dédiés déjà portés par les adaptateurs.
- **Carte** : le chemin react-leaflet déclaratif est conservé mais chargé dynamiquement
  `ssr:false` (Leaflet accède à `window`/`document` à l'import). Le mode natif
  `ExplorerMap` n'ajoute aucun second moteur de carte.
- **Tests composants** : pas de renderer DOM dans le projet ; `TEST-A13-MAP-*` couvrent
  la logique pure (marqueurs, gating, API) et le montage est vérifié par type-check +
  build. Playwright/E2E a11y complets restent au flux S9 (non requis ici).
- **Mode dégradé partiel** : un échec de lecture sur une partie des points route produit
  un warning `terrain_live_partial` (info) ; les signalements reçus restent affichés,
  aucun n'est extrapolé.
- Une exécution complète intermédiaire du 11/09 a montré 1 échec transitoire sur un test
  connecteur dépendant du réseau (hors S4/S7) ; deux ré-exécutions complètes
  consécutives sont vertes.
- Aucune donnée personnelle n'est transportée : les POI et signalements utilisés sont
  des vues publiques (jamais `reporter_id`), et les alertes UI ne montrent aucune identité.
