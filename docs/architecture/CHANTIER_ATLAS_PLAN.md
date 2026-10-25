# CHANTIER ATLAS — Plan d'implémentation

> **Pour les agents exécutants :** sous-skill requis — `subagent-driven-development` (ou `executing-plans`). Les étapes sont cochables (`- [ ]`).
> **Spec de référence :** `CHANTIER_ATLAS.md` (document autonome, fait foi). Ce plan l'opérationnalise sans élargir le scope.

**Goal :** remplacer les moteurs cartographiques Leaflet (`/carte-interactive`, moteur de `/explorer`) et `react-globe.gl` (`/pays`) par un unique canvas MapLibre GL à projection globe — zoom local sur les randonnées → dézoom continu → globe — avec couche de données PostGIS indexée, design Liquid Glass et rollout par feature flag.

**Architecture :** `maplibre-gl@^6.4.1` (déjà installé, jamais importé), projection `globe`, 4 paliers de rendu (Local z14-18 → RPC `trails_in_viewport` ; Région z8-13 → matview geohash ; Continent z4-7 → matview densité pays ; Monde z0-3 → GeoJSON 110m statique). Le moteur est monté dans `/explorer` (shell Aventures existant : filtres, liste, `TrailDetailPanel`, React Query par bbox) derrière un switch interne puis le flag `explorer_unified_map_enabled`. Les pages `/carte-interactive` et `/pays` restent intactes et fonctionnelles jusqu'à la Phase 8.

**Tech Stack :** Next.js 15.5.25 App Router, React 19, TypeScript 5, TanStack Query 5, MapLibre GL 6, Supabase/PostGIS (Supabase CLI 2.109.1), Tailwind 3 + Liquid Glass (`src/styles/liquid-glass.css`), Vitest 4, Playwright 1.51.

**Spec :** `CHANTIER_ATLAS.md` (+ `docs/architecture/CHANTIER_ATLAS_PLAN.md`, ce fichier).

---

## Contraintes globales (ATLAS-R1..R12 + constats vérifiés Phase 0)

- **ATLAS-R1** : aucune table/colonne/fonction/route inventée — toute création via migration explicite `supabase/migrations/YYYYMMDDHHMMSS_nom.sql`, additive et idempotente.
- **ATLAS-R2** : toute requête géo via `ST_Intersects`/`ST_DWithin` sur colonne indexée GIST (`hiking_routes.geom`, index `idx_hiking_routes_geom`). Jamais de filtre sur `explore_trails.start_lat/start_lng`.
- **ATLAS-R3** : couleurs uniquement depuis `docs/Design-tokens.md` ; `#E4501C` = 0 occurrence (grep Phase 6).
- **ATLAS-R4** : mobile-first, skills `ux-mobile` + `apple-ui-designer` + `interaction-design` pour tout layout/transition.
- **ATLAS-R5** : First Load JS ≤ 170 Ko, LCP ≤ 2.0 s mobile sur la page explorateur — mesuré et collé brut, jamais estimé.
- **ATLAS-R6** : RLS explicite vérifiée (`pg_policies` brut) sur toute table lue.
- **ATLAS-R7** : un test rouge avant chaque correctif, vert après.
- **ATLAS-R8** : rapports = sorties brutes terminal uniquement.
- **ATLAS-R9** : aucun fallback fictif ; donnée absente = `—`.
- **ATLAS-R10** : `/carte-interactive` et `/pays` fonctionnelles jusqu'à la Phase 8.
- **ATLAS-R11** : jamais de merge direct sur `main` sans branche de phase (gh absent → merge `--no-ff` local + push, décision utilisateur).
- **ATLAS-R12** : `BouteilleALaMer.tsx`, `PaysCarnetsList.tsx`, `PaysClubsList.tsx` intouchés.
- **Projet Supabase prod** : `icxyvwzfjbflcbqukpfz` uniquement (lié, à jour) ; **jamais** `lwrmuggefbmboikjgudc`.
- **Écarts actés Phase 0** : pas de MCP Supabase → Supabase CLI + RPC debug temporaires ; skills déjà découvertes nativement (pas de copie) ; agents à copier ont été copiés/convertis dans `.opencode/agent/` ; `gh` absent → merge local `--no-ff` ; Leaflet conservé (11 consommateurs hors périmètre) ; `react-globe.gl`/`three` retirés en Phase 5 après remplacement de `CountryGlobe` par un globe MapLibre compatible props.

---

## Phase 0 — Amorçage

**Livrable :** outillage vérifié, branche `chantier/atlas-0-fondations`, ce plan écrit, rapport.

- [x] Branche `chantier/atlas-0-fondations` créée.
- [x] `scripts/atlas/install-opencode-agents.mjs` créé et exécuté → `.opencode/agent/` : `architect`, `security-reviewer`, `database-reviewer`, `performance-optimizer`, `code-reviewer`, `silent-failure-hunter`, `a11y-architect`, `pays-conformite-lg`.
- [x] Agents chantier créés : `atlas-data-layer.md`, `atlas-globe-engine.md`, `atlas-conformite-lg.md`.
- [x] `opencode.json` : `"instructions": ["AGENTS.md"]` ajouté, plugin omniroute inchangé.
- [x] Preuve : `opencode agent list` → 11 sous-agents découverts (voir MISSION_LOG).
- [x] Écarts documentés (MISSION_LOG, entrée Phase 0).
- [ ] Commit + merge `--no-ff` dans `main`.

---

## Phase 1 — Vérité base de données

**Skills :** `supabase-postgis`, `map-geospatial`, `security-audit`. **Branche :** `chantier/atlas-1-data-layer`.

### Task 1.1 — Migration observabilité temporaire

**Fichiers :** créer `supabase/migrations/20260912000000_atlas_debug_observability.sql`.

- [ ] Créer `atlas_debug_explain(p_query text) RETURNS SETOF text` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO service_role`) exécutant `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`.
- [ ] Créer `atlas_debug_policies()` retournant `schemaname, tablename, policyname, roles, cmd, qual` depuis `pg_policies` pour `hiking_routes`, `trail_metadata`, `trail_scores` (service_role uniquement).
- [ ] `supabase db push --linked` (projet `icxyvwzfjbflcbqukpfz`).
- [ ] Script `scripts/atlas/capture-phase1-proof.mjs` : appelle les deux RPC via `SUPABASE_SERVICE_ROLE_KEY` et imprime brut.

### Task 1.2 — Migration data layer

**Fichiers :** créer `supabase/migrations/20260912010000_atlas_trails_viewport.sql`.

- [ ] Index expression : `CREATE INDEX IF NOT EXISTS idx_hiking_routes_startpoint ON public.hiking_routes USING gist ((ST_StartPoint(ST_GeometryN(geom, 1))));`
- [ ] RPC `trails_in_viewport` (`SECURITY INVOKER`, `STABLE`, `SET search_path = public, pg_temp`) :

```sql
CREATE OR REPLACE FUNCTION public.trails_in_viewport(
  p_min_lng double precision, p_min_lat double precision,
  p_max_lng double precision, p_max_lat double precision,
  p_zoom smallint DEFAULT 14,
  p_simplify_tolerance double precision DEFAULT 0,
  p_min_dist double precision DEFAULT 2.0,
  p_max_dist double precision DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_include_short boolean DEFAULT false,
  p_limit integer DEFAULT 300
) RETURNS TABLE (
  id text, name text, start_lat double precision, start_lng double precision,
  distance_km numeric, duration_hours numeric, difficulty text, elevation_gain integer,
  adventure_score numeric, nature_score numeric, panorama_score numeric,
  ref text, network text, terrain_type text, family_friendly boolean, season text,
  ai_description text, geometry jsonb
)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH env AS (
    SELECT ST_MakeEnvelope(
      GREATEST(p_min_lng, -180), GREATEST(p_min_lat, -85),
      LEAST(p_max_lng, 180), LEAST(p_max_lat, 85), 4326) AS box
  ),
  bounds AS (
    SELECT LEAST(GREATEST(p_limit, 1), 300) AS lim,
      CASE WHEN p_zoom >= 14 THEN 0.00015
           WHEN p_zoom >= 11 THEN 0.0006
           WHEN p_zoom >= 8  THEN 0.0025
           WHEN p_zoom >= 4  THEN 0.012
           ELSE 0.05 END AS default_tol
  )
  SELECT r.id::text, r.name,
    ST_Y(ST_StartPoint(ST_GeometryN(r.geom, 1))) AS start_lat,
    ST_X(ST_StartPoint(ST_GeometryN(r.geom, 1))) AS start_lng,
    r.distance_km, m.duration_hours, m.difficulty, m.elevation_gain,
    s.adventure_score, s.nature_score, s.panorama_score,
    r.ref, r.network, m.terrain_type, m.family_friendly, m.season, m.ai_description,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(
      r.geom, GREATEST(p_simplify_tolerance, bounds.default_tol)))::jsonb AS geometry
  FROM public.hiking_routes r
  CROSS JOIN env CROSS JOIN bounds
  LEFT JOIN public.trail_metadata m ON m.trail_id = r.id
  LEFT JOIN public.trail_scores s ON s.trail_id = r.id
  WHERE r.geom IS NOT NULL
    AND r.geom && env.box
    AND ST_Intersects(r.geom, env.box)
    AND (p_include_short OR COALESCE(r.distance_km, 0) >= p_min_dist)
    AND (p_max_dist IS NULL OR r.distance_km <= p_max_dist)
    AND (p_difficulty IS NULL OR m.difficulty ILIKE p_difficulty)
    AND (p_search IS NULL OR r.name ILIKE '%' || p_search || '%')
  ORDER BY r.distance_km DESC NULLS LAST
  LIMIT (SELECT lim FROM bounds);
$$;
GRANT EXECUTE ON FUNCTION public.trails_in_viewport(double precision,double precision,double precision,double precision,smallint,double precision,double precision,double precision,text,text,boolean,integer) TO anon, authenticated;
```

- [ ] Matviews (colonnes détaillées en Task 1.3) : `country_trail_density`, `trail_density_geohash5`, `country_centroids` + index uniques + `REVOKE ALL` puis `GRANT SELECT TO anon, authenticated`.
- [ ] Fonction `refresh_atlas_density()` : `REFRESH MATERIALIZED VIEW CONCURRENTLY` + fallback `EXCEPTION WHEN OTHERS` (pattern `refresh_kit_conservation`, `20260911360000`), `GRANT EXECUTE TO service_role`.

### Task 1.3 — Matviews (détail)

- [ ] `country_trail_density` : `iso_a2, name, trail_count, total_distance_km, avg_adventure_score, avg_nature_score, avg_panorama_score, centroid_lat, centroid_lng`, `FROM countries_geo c LEFT JOIN hiking_routes r ON ST_Contains(c.geometry, ST_StartPoint(ST_GeometryN(r.geom,1))) LEFT JOIN trail_scores s ...`, `WHERE GeometryType(c.geometry) IN ('POLYGON','MULTIPOLYGON')`, `GROUP BY c.iso_a2, c.name, c.geometry` ; `UNIQUE (iso_a2)`.
- [ ] `country_centroids` : `iso_a2, name, ST_Y/ST_X(ST_Centroid(geometry))` ; `UNIQUE (iso_a2)`.
- [ ] `trail_density_geohash5` : `ST_GeoHash(ST_StartPoint(ST_GeometryN(r.geom,1)), 5) AS geohash, COUNT(*), AVG(distance_km), AVG(adventure_score), centroïde du collect` ; `UNIQUE (geohash)`.

### Task 1.4 — Import polygones pays

**Fichiers :** créer `scripts/atlas/import_country_polygons.mjs` + RPC temporaire `atlas_set_country_geometry(p_iso_a2 text, p_geojson jsonb)` (migration dédiée, service_role only).

- [ ] Lire `public/data/countries-110m.geojson`, résoudre ISO A2 (ordre `ISO_A2 > ISO_A2_EH > WB_A2 > ADM0_A3`, ignorer `-99`/`-3` — portage de `resolveIsoA2` de `CountryGlobe.tsx:20-27`).
- [ ] Mettre à jour `countries_geo.geometry` uniquement si `geometry IS NULL` (ou `--force`), via RPC `ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)`.
- [ ] Rapport : features lues / appariées / mises à jour / non appariées (liste brute, aucune invention).

### Task 1.5 — Cron refresh

**Fichiers :** créer `src/app/api/cron/refresh-atlas-density/route.ts` (calque de `refresh-kit-scores/route.ts` : GET, `Bearer CRON_SECRET`, client service, `rpc('refresh_atlas_density')`).

### Task 1.6 — Migration `getTrails`

**Fichiers :** modifier `src/lib/queries/trails.ts` (+ test `tests/queries/trails-viewport.spec.ts`).

- [ ] Test rouge : `getTrails({minLat,maxLat,minLng,maxLng,zoom})` doit appeler `supabase.rpc('trails_in_viewport', …)` avec les paramètres exacts et mapper la réponse en `MapTrail[]` (contrat identique : mêmes champs, `geojson: null` par défaut) ; cache 60 s et dédup conservés.
- [ ] Vert : remplacer le `.from('explore_trails')` par la RPC ; ajouter `zoom?: number` à `GetTrailsOptions` (défaut 14) ; bbox absente → bbox monde.

### Task 1.7 — Preuves Phase 1

- [ ] `EXPLAIN ANALYZE` (via RPC debug) sur la requête viewport → doit montrer `Index Scan`/`Bitmap Index Scan` sur `idx_hiking_routes_geom` ; coller brut.
- [ ] `atlas_debug_policies()` brut (RLS `hiking_routes`, `trail_metadata`, `trail_scores`).
- [ ] `npx tsc --noEmit`, `npm test` → verts ; `supabase migration list --linked` → toutes appliquées.
- [ ] Migration cleanup `20260912020000_atlas_drop_debug_functions.sql` : `DROP FUNCTION atlas_debug_explain(text)`, `atlas_debug_policies()`, `atlas_set_country_geometry(text, jsonb)` après capture.
- [ ] Commit + merge `main`.

---

## Phase 2 — Moteur cartographique unique

**Skills :** `nextjs-performance`, `apple-ui-designer`, `interaction-design`, `ux-mobile`. **Branche :** `chantier/atlas-2-engine`.

### Task 2.1 — Suppression du code mort

- [ ] Supprimer `src/app/carte-interactive/components/InteractiveMap.tsx` (346 l., `return null`) et `src/app/carte-interactive/components/AdventureGenerator.tsx` (5 l., `return null`). Vérifier `rg "AdventureGenerator|_TrailDetailPanel" src` = 0 avant suppression.

### Task 2.2 — Style et thème

**Fichiers :** créer `src/components/map/engine/mapTheme.ts` + `src/components/map/engine/createMapStyle.ts`.

- [ ] `mapTheme.ts` : constantes palette DS (`#FBFAF6`, `#17402C`, `#5B7F55`, `#A6C1A0`, `#C89A3B`, `#A8443A`, `#4B6B7C`), paliers de zoom (`WORLD_MAX=3`, `CONTINENT_MAX=7`, `REGION_MAX=13`, `LOCAL_MIN=14`), LOD par palier.
- [ ] `createMapStyle.ts` : `StyleSpecification` inline — background stone, sources raster OSM France / Esri Topo / Esri Satellite (URLs déjà utilisées par `InteractiveMap.tsx:274-280`), couche `sky`/atmosphère sage `#A6C1A0`, `projection: { type: 'globe' }`. Aucune URL de glyphs/fonts externes.

### Task 2.3 — Composant unique

**Fichiers :** créer `src/components/map/UnifiedExplorerMap.tsx`, `src/components/map/engine/icons.ts` (images canvas : point sentier, clusters bornés 5/10/25/50/100+).

- [ ] Init `new maplibregl.Map({ container, style, center, zoom, attributionControl: false })`, `map.setProjection({type:'globe'})` (API v6 vérifiée : `setProjection`, `setSky` — `node_modules/maplibre-gl/dist/maplibre-gl.d.ts:9550`), `ResizeObserver`, cleanup `map.remove()`.
- [ ] Interactions de base mobiles : `touchAction: 'none'`, zoom controls glass, recenter, switch de fond (capsule glass), `aria-label` sur chaque contrôle.
- [ ] Couche monde (polygones pays) pour rendre les captures utiles dès la Phase 2.
- [ ] Pas de `prefers-reduced-motion` → désactive auto-rotation/flyTo animés.

### Task 2.4 — Intégration `/explorer` derrière switch interne

- [ ] `src/app/explorer/page.tsx` : lire `searchParams` (`atlas=1`) → passer `unified` à `ExplorerClient` (phase 7 remplacera par le flag).
- [ ] `ExplorerClient.tsx` : si `unified`, monter `UnifiedExplorerMap` à la place d'`ExplorerMap` (dynamic `ssr:false`) sans toucher à la logique liste/filtres/état.
- [ ] Preuves : Playwright captures 390 + 1440 (`tests/visual/atlas-explorer.spec.ts`), `npx tsc --noEmit` = 0, bundle `/explorer` avant/après collé.
- [ ] Commit + merge `main`.

---

## Phase 3 — Palier Local (parité Aventure)

**Skills :** `map-geospatial`, `ux-mobile`, `test-driven-development`. **Branche :** `chantier/atlas-3-local`.

### Task 3.1 — Hook viewport (TDD)

**Fichiers :** créer `src/components/map/hooks/useViewportData.ts`, test `tests/map/useViewportData.spec.ts`.

- [ ] Rouge : debounce 200 ms (fake timers), `AbortController.abort()` sur changement de bbox/zoom et unmount, clé React Query `['atlas-viewport', bbox, zoom]`, limite LOD (`z≥14 → 300`, `8-13 → 150`, `4-7 → 60`), pas de requête en dessous de z4.
- [ ] Vert : implémenter (template `useTerrainReports.ts:41,47,55-57,86` + `ExplorerMap.tsx:227-251` pour le buffer 25 %).
- [ ] `npm test -- tests/map` vert.

### Task 3.2 — Couches sentiers & POI

**Fichiers :** modifier `UnifiedExplorerMap.tsx` + créer `src/components/map/layers/trailsLayer.ts`, `src/components/map/layers/poisLayer.ts`.

- [ ] Source GeoJSON sentiers (`/api/hikes`) : points aux `start_lat/lng`, couleur par difficulté (tokens), clic → `onTrailSelect(id)` ; sélection → `map.fitBounds` sur la géométrie simplifiée de la RPC (option `withGeometry`).
- [ ] Source POI (`/api/pois`) : `cluster: true`, `clusterRadius` responsive, images canvas pour clusters, clic → popup glass (contenu équivalent à `InteractiveMap.tsx:601-619`).
- [ ] Bouton « Rechercher dans cette zone » mobile si déplacement > seuil (pattern `ExplorerClient.tsx:143-162`) — pas d'auto-fetch surprise.

### Task 3.3 — Panneau détail & CTA (réutilisation stricte)

- [ ] `ExplorerClient` ouvre `TrailDetailPanel` existant sur sélection ; CTA existant `/hub/depart?id=none&route=<id>` conservé tel quel ; gestes `useSwipe`/`useDragDismiss` réutilisés pour le panneau mobile.
- [ ] Rien de la logique métier du panneau n'est modifié (ATLAS-R12 / GEL).

### Task 3.4 — Preuves

- [ ] e2e `scripts/e2e/atlas-explorer.spec.ts` : pan/zoom → sélection sentier → panneau visible ; log réseau prouvant `AbortError`/requêtes annulées (capture Playwright events).
- [ ] Captures 390/1440, `npx tsc --noEmit` = 0, `npm test` vert.
- [ ] Commit + merge `main`.

---

## Phase 4 — Paliers Région / Continent / Monde + caméra

**Skills :** `interaction-design` (obligatoire), `map-geospatial`. **Branche :** `chantier/atlas-4-tiers`.

### Task 4.1 — Couches par palier

- [ ] `src/components/map/layers/countriesLayer.ts` : fill polygones (GeoJSON statique), hover/click, sélection pays (contour sage), `onCountrySelect(code)`.
- [ ] `src/components/map/layers/densityLayer.ts` : continent (choroplèthe `country_trail_density`) + région (cercles `trail_density_geohash5`), fades d'opacité par zoom.
- [ ] Seuils : opacités interpolées aux bornes des paliers (`WORLD_MAX`, `CONTINENT_MAX`, `REGION_MAX`).

### Task 4.2 — Chorégraphie caméra

**Fichiers :** créer `src/components/map/engine/camera.ts`.

- [ ] `flyToCountry(centroid, zoom)`, `flyToTrail(bbox)` avec easing natif MapLibre ; `prefers-reduced-motion` → `jumpTo`.
- [ ] Transition dézoom : pas d'animation custom, uniquement `flyTo`/`easeTo` ; durées 200-450 ms.
- [ ] Revue `interaction-design` : checklist (feedback < 100 ms, transform/opacity uniquement, focus visible, 44 px).

### Task 4.3 — `focusPoint` réparé par centroïdes

- [ ] Étendre `Country`/`fetchCountries` (`src/lib/geodata.ts`, `src/lib/countries.ts`) avec `centroid?: { lat, lng }` lu depuis `country_centroids` (ajout non cassant, fallback `getCountryCoordinates` existant).
- [ ] `UnifiedExplorerMap` utilise le centroïde réel pour le centrage pays (world tier).
- [ ] Test unitaire : mapping centroïde → `Country` (vitest).

### Task 4.4 — Sélection pays mobile/desktop

- [ ] Réutiliser `EarthCountrySheet` (mobile) et le pattern carte info desktop (`globe-info-card`) ; clic globe → mêmes handlers que `/pays` ; a11y clavier géré en Phase 5.
- [ ] Preuves : séquence captures local→globe (Playwright), tsc, tests ; commit + merge.

---

## Phase 5 — Nettoyage & durcissement

**Skills/agents :** `security-audit`, `nextjs-performance`, `silent-failure-hunter`, `accessibility`. **Branche :** `chantier/atlas-5-hardening`.

### Task 5.1 — Rate limiting & bbox

- [ ] `/api/hikes` et `/api/pois` : `enforceRateLimit` de `src/lib/rate-limit` (mêmes conventions que les ~15 routes existantes) + plafond serveur bbox via `parseBboxQuery` (`src/lib/geo/bbox.ts`, span max 20°).
- [ ] Tests : `tests/security/atlas-abuse.spec.ts` (429 au dépassement, 400 bbox invalide, clamp signalé `x-lkdv-bbox-clamped`).

### Task 5.2 — Globe MapLibre compatible `/pays` + retrait `react-globe.gl`

- [ ] Créer `src/components/map/UnifiedCountryGlobe.tsx` avec la **même API de props** que `CountryGlobe.tsx:39-51` (`countries, onCountryClick, onCountrySelect?, focusCode?, focusPoint?, fullscreen?, uniform?`) — implémentation MapLibre globe (réutilise `countriesLayer` + `camera`).
- [ ] Remplacer le dynamic import de `CountryGlobe` dans `EarthPageClient.tsx:43-46` et `PaysRightSidebar.tsx:11-14` par `UnifiedCountryGlobe` (mêmes props, zéro autre changement).
- [ ] Retirer `react-globe.gl`, `three`, `@types/three` de `package.json` + `transpilePackages` de `next.config.mjs`; `npm install`.
- [ ] **Leaflet conservé** (11 consommateurs hors périmètre : carnet, hub, groupes, terrain-live…) — écart documenté, migration = chantier séparé.

### Task 5.3 — Audit replis silencieux

- [ ] Lancer l'agent `silent-failure-hunter` sur `src/components/map/**`, `src/lib/queries/trails.ts`, `src/app/api/hikes/**`; corriger tout repli fictif (ATLAS-R9) ; coller le rapport.

### Task 5.4 — Accessibilité

- [ ] Liste clavier alternative pour la sélection pays (pattern liste + `onSelect`), focus trap panneau, contrôles zoom `aria-label` + taille 44 px, test `@axe-core/playwright`.
- [ ] Preuves : bundle avant/après (`npm run build` → First Load JS par route), audit a11y, `tsc`/`lint` 0 ; commit + merge.

---

## Phase 6 — Conformité design & QA multi-perspective

**Agent :** `atlas-conformite-lg`. **Branche :** `chantier/atlas-6-conformite`.

- [ ] Greps bruts : `rg -n "#E4501C|#1C2620|#2D5A3D|#0B1F17|#0F2A22|#08150F|#A8C4A2|#C89A5A|#E4C695" src/components/map src/app/explorer src/app/carte-interactive` → 0.
- [ ] `npx tsc --noEmit` = 0 ; `npm run lint` = 0 ; `npm run build` = 0 (serveur dev arrêté).
- [ ] Playwright 1440 + 390 sur `/explorer` et `/pays` : zéro `pageerror`, globe rendu.
- [ ] Revues multi-perspectives : exécuter les protocoles `/icon-security-review`, `/icon-design-review`, `/icon-programming-review`, `/icon-platform-operations-review`, `/icon-review` (adaptés en `.opencode/command/` depuis `.claude/commands/` faute de harness Claude Code) ; synthèse collée.
- [ ] Commit + merge.

---

## Phase 7 — Rollout mondial progressif

**Branche :** `chantier/atlas-7-rollout`.

- [ ] Migration `20260912030000_atlas_feature_flag.sql` : `INSERT INTO feature_flags (id, enabled, scope) VALUES ('explorer_unified_map_enabled', false, 'global') ON CONFLICT DO NOTHING;`
- [ ] TS : ajouter la clé dans `src/features/hub/server/featureFlags.ts` et `src/features/hub/engine/hubNature.ts` (typés, fail-safe false).
- [ ] `src/app/explorer/page.tsx` : gating serveur (`force-dynamic`, lecture flag, `?atlas=1` conservé pour test interne) — flag off = `ExplorerMap` legacy, flag on = `UnifiedExplorerMap`.
- [ ] Paliers : cohortes via `feature_flag_cohorts` (5 % → 25 %) pour utilisateurs connectés puis 100 % global ; rollback = flag off (pages legacy intactes, ATLAS-R10).
- [ ] Preuves : migration appliquée (`migration list`), captures flag on/off, métriques `scripts/ops/a14_healthcheck.mjs` du palier interne collées.

---

## Phase 8 — Décommissionnement (après 100 % stable)

- [ ] Redirections 308 `/carte-interactive` → `/explorer` et `/pays` (racine) → `/explorer` (les fiches `/pays/[code]` restent).
- [ ] Suppression des composants legacy : `src/components/map/InteractiveMap.tsx`, `src/app/carte-interactive/**`, `src/components/pays/CountryGlobe.tsx`, `src/app/pays/EarthPageClient.tsx` (si plus référencé), styles morts.
- [ ] Décision Leaflet (chantier séparé) : migration des 11 consommateurs restants puis retrait `leaflet`/`leaflet.markercluster`/`react-leaflet`/`@types/leaflet`.
- [ ] Mise à jour nav (`BottomTabBar` onglet Earth) + SEO (sitemap/redirections).
- [ ] Rapport final + tag.

---

## Definition of Done (rappel, doit être prouvée)

- [ ] 4 paliers dans un seul canvas, sans coupure visuelle.
- [ ] `EXPLAIN ANALYZE` prouve l'index GIST.
- [ ] RLS explicite vérifiée.
- [ ] 0 couleur bannie, `tsc`/`lint`/`build` à 0.
- [ ] First Load JS ≤ 170 Ko et LCP ≤ 2.0 s mobile (mesurés).
- [ ] Rate limiting `/api/hikes` et `/api/pois`.
- [ ] Flag `explorer_unified_map_enabled` + rollout documenté, rollback possible.
- [ ] Synthèse Icon Agents sans blocage critique non résolu.
- [ ] Pages legacy supprimées uniquement après 100 % stable.

## Self-review du plan

- Couverture spec : Phases 0-8 ↔ sections 1-7 du chantier ; DoD repris intégralement. Écarts (MCP, gh, Leaflet, CTA mort, MISSION_LOG racine) tracés.
- Placeholders : aucun « TBD » ; SQL et signatures fournis pour la Phase 1 (le reste est spécifié par fichiers + critères, l'exécution produit le code).
- Cohérence des types : `trails_in_viewport` paramètres/colonnes alignés sur `GetTrailsOptions` et `MapTrail` ; `UnifiedCountryGlobe` aligné sur les props réelles de `CountryGlobe` ; flag aligné sur `FeatureFlags`.
