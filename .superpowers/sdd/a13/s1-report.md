# A13 (S1) — ETA réelle bout-en-bout

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`), base
locale `supabase_db_ai-finalization` (`postgresql://…@127.0.0.1:54322/postgres`).
Plan source : `docs/superpowers/plans/a13-l3-produit-bout-en-bout.md` (flux S1).
Périmètre : migration additive, `server/routePrediction.ts`, intégration
`generateAdventure`/API generate, tests vitest `TEST-A13-ROUTE-01..08`, pgTAP
`a13_segment_geometries`. Aucun flag modifié, aucun secret, codes/messages en
français.

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `93e92b50` | `feat(db): A13 RPC a13_segment_geometries (geometries segments OSM bornees, lecture seule)` | migration + pgTAP |
| `390c2d93` | `feat(ai): S1 ETA reelle bout-en-bout (map-matching route, profil consent-gated, persistance a13-v1)` | routePrediction + intégration + tests |
| ce commit | `docs(a13): rapport S1 ETA reelle bout-en-bout` | ce rapport |

## A. DDL — `a13_segment_geometries` (`93e92b50`)

Fichier : `supabase/migrations/20260911420000_a13_segment_geometry.sql`.
Signature : `public.a13_segment_geometries(p_ids bigint[])` →
`(id bigint, geojson jsonb, surface text, sac_scale text, highway text)`.

- `STABLE` + `SECURITY INVOKER` + `SET search_path = public, pg_temp` :
  lecture OSM publique (RLS de `trail_segments` appliquée), **aucune écriture
  possible** (volatilité stable).
- Filtre strict `ts.id = ANY(COALESCE(p_ids, '{}'))`, ordre stable par id,
  `ST_AsGeoJSON(ts.geom)::jsonb` (aucune donnée inventée : tags absents NULL).
- Borne explicite : `cardinality(p_ids) > 500` ⇒
  `RAISE EXCEPTION 'a13_segment_geometries: 500 ids maximum par appel (reçu %)`
  (jamais de troncature silencieuse).
- Grants lecture : `anon`, `authenticated`, `service_role` (guard role `anon`
  pour le replay), `PUBLIC` révoqué.
- `CREATE OR REPLACE` + grants idempotents : migration additive rejouable.

## B. Pipeline `server/routePrediction.ts` (`390c2d93`)

Client injecté (`RoutePredictionClient`), `server-only`, aucun accès réseau
direct : `matchTrackCandidates`, `getSegmentGeometries`, `hasActiveConsent`,
`getCurrentProfile`, `persistPredictions`.

1. Consentement `personal_performance` vérifié **avant** toute lecture de
   profil (fail-safe : erreur = refus) ; sans consentement, profil jamais lu
   (`personal_profile_unavailable`) et allure standard explicite.
2. Polyline nettoyée/bornée (`MAX_ROUTE_POLYLINE_POINTS = 5000`, avertissement
   `route_geometry_truncated`), timestamps synthétiques (le map-matching A2 ne
   consomme que l'ordre pour le cap).
3. `a2_match_track_candidates` (batch, `MATCH_DEFAULTS.maxDistanceM = 35`) →
   `matchTrackToSegments` → segments retenus dédupliqués.
4. `a13_segment_geometries` par lots de `MAX_SEGMENT_IDS_PER_CALL = 500` →
   `computeSegmentFeatures` (A2) ; segments sans géométrie exploitable ignorés
   (`segment_geometry_missing`).
5. `predictSegment` par segment (allure via `resolvePace`, fatigue cumulée
   identique à `predictRoute`) + `predictRoute` × 3 stratégies → `RoutePrediction`
   complètes (`userId`/`planId`), `segmentsCritical` = top-3 difficulté,
   `stepSources` (allure `profile`/`generic`/`standard`, provenance
   `measured`/`computed`, source géométrie).
6. Persistance `persist_adventure_predictions` (A10) :
   `model_version = a13-v1`, `context_hash = route_map_matched`. Les
   pseudo-segments uniformes (ids 1..n) ne sont **jamais** persistés.
7. Fallback documenté `uniform_from_blueprint` (route absente/invalide/sans
   segment mappé) : segmentation explicite, provenance
   `computed / a13:uniform_from_blueprint`, avertissement
   `route_geometry_missing` (severity warning) — jamais silencieux.

## C. Intégration `generateAdventure` + API (`390c2d93`)

- `AdventureGenerationInput.coordinates` accepte désormais un point unique
  (météo A11, premier point de la polyline si besoin) **ou** une polyline ≥ 2
  points (`{lat,lng}[]`) qui active l'ETA réelle. API generate : union Zod bornée
  `MAX_ROUTE_POLYLINE_POINTS`.
- Deps : `routePredictionClient` optionnel. Présent ⇒ `buildRoutePrediction`
  remplace `sections.paceStrategies` (P50/P90, `segmentsCritical`,
  `stepSources`, provenance `measured` si profil réel / `computed` sinon) avant
  la construction du plan, puis `persistRoutePredictions` après
  `create_adventure_plan_bundle` (FK `plan_id` respectée). Absent ⇒ flux A10
  `uniform_from_blueprint` inchangé.
- Un échec du moteur réel ne bloque jamais le plan : repli uniforme + log.
- `createSupabaseRoutePredictionClient(supabase)` branche les RPC réelles
  (`a2_match_track_candidates`, `a13_segment_geometries`, `has_active_consent`,
  profil via `getStoredPerformanceProfile`, `persist_adventure_predictions`).
- `FALLBACK_WARNING_CODES` gagne `personal_profile_unavailable` et
  `route_geometry_missing` (replis documentés comptés dans
  `adventure_engine_runs.fallback_count`).

## D. Preuves TDD / TAP

TDD strict RED → GREEN :

| Étape | Preuve |
| --- | --- |
| RED pgTAP | `ERROR: function public.a13_segment_geometries(bigint[]) does not exist` — `Failed 18/18 subtests` |
| GREEN pgTAP (fichier seul) | `All tests successful. Files=1, Tests=18` |
| RED vitest | `Cannot find package '@/features/adventure-intelligence/server/routePrediction'` |
| GREEN vitest (fichier seul) | `Tests 8 passed` (`TEST-A13-ROUTE-01..08`) |
| Suite pgTAP complète | `npx supabase test db --db-url …` → `All tests successful. Files=11, Tests=169. Result: PASS` (0 `not ok`) |
| Suite vitest complète | `npm run test` → `Test Files 264 passed | 1 skipped (265)` ; `Tests 1907 passed | 6 skipped (1913)` |
| Static | `npm run type-check` exit 0 ; `npm run lint` exit 0 (aucun signal sur les fichiers touchés) |

Couverture pgTAP `a13_segment_geometries` : géométrie/tags fixture, filtrage
`= ANY`, ids inconnus vides, entrée vide/NULL, borne 500 inclusive, 501 refusé
(message exact), `STABLE` + `SECURITY INVOKER`, grants anon/authenticated/
service_role, lecture anon OK, écriture anon refusée (42501).

Couverture vitest : `TEST-A13-ROUTE-01` matching→features→prédictions,
`02` consentement requis pour le profil, `03` persistance `a13-v1` (plan_id
surchargeable), `04` fallback explicite sans route (+ non-persistance des
pseudo-segments), `05` bornes 500 ids par appel, `06` idempotence par modèle,
`07` intégration `generateAdventure` (polyline ⇒ `map_matched` + persistance
a13), `08` intégration sans polyline (repli explicite persisté).

## E. Écarts / points d'attention

- **Altitude absente** : `trail_segments.geom` est 2D, donc les features A2 des
  segments retenus ont D+/D- = 0. L'ETA réelle est géométrique (distance,
  technicité, surface) mais **pas encore dénivelée** — aucune valeur inventée.
  À brancher via une source d'altitude de segment (S4/S5) avant d'en tirer des
  ETA de montagne fines.
- Les objets `RoutePrediction` de `sections.paceStrategies` conservent le
  `modelVersion` du moteur A3 (`a3-v1`) ; la version de **pipeline/persistance**
  est `a13-v1` (lignes RPC + `result.modelVersion`). Ce distingue version
  moteur et version d'orchestration.
- Le repli produit par un client injecté persiste des lignes route `a13-v1`
  (pas de lignes segment) ; le chemin A10 historique reste actif quand aucun
  client n'est injecté (rétrocompatibilité des appels internes).
- Migration appliquée à la base **locale** uniquement (`supabase migration up
  --db-url`), pas de push distant (contrainte de mission).
- Restes S1 : échantillonnage/réduction de polyline en amont (borne 5000 +
  troncature avertie en attendant), et dénivelé réel (voir ci-dessus).
