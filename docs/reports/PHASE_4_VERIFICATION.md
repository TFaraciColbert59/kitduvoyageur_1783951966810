# PHASE 4 — Vérification (brouillon)

**Date :** 2026-09-12
**Branche :** `feat/phase4-coverage` (base `0a5d861e`)
**Commits :** `a9bc6a29` (BDD), `b6a869cf` (pipeline + offres), `704bf11d` (matrice)
**Décision :** `INSUFFICIENT_DATA` — aucune donnée géographique sous licence n'est disponible ; la structure, le pipeline et les garde-fous sont livrés et testés, aucune région n'est déclarée couverte.

---

## 1. Périmètre vérifié

| Livrable | État | Preuve |
| --- | --- | --- |
| Modèle de couverture versionné (régions, datasets, événements) | Livré | `supabase/migrations/20260911560000_phase4_coverage.sql` |
| Registre de licences + refus d'import sans licence | Livré | trigger `coverage_guard_dataset_license` ; pgTAP 10-15 |
| Jamais `covered` sans licence/seuils/20 échantillons | Livré | trigger `coverage_guard_region_status` ; pgTAP 16-27 |
| Rollback de dataset (version conservée/promouvable) | Livré | `coverage_rollback_region` / `coverage_promote_dataset` ; pgTAP 32-45 |
| RLS lecture publique seulement pour `covered` | Livré | pgTAP 47-53 |
| Pipeline 11 étapes exécutable en dry-run sans réseau | Livré | `scripts/coverage/` ; 70 tests ; CLI vérifiée |
| Séparation POI / offre / affiliation / prix horodaté | Livré | migration `20260911561000_phase4_poi_offers.sql`, vue `poi_offers_served`, `has_affiliate_link` ; pgTAP 54-58 ; `offersFreshness.ts` |
| GPX zones non couvertes + gate navigation | Vérifié (aucun changement nécessaire) | `tests/coverage/gpxUncovered.spec.ts` |
| Matrice de couverture honnête générable | Livré | `docs/coverage/COVERAGE_MATRIX.md` + `npm run coverage:matrix` |
| Feature flag publication désactivé par défaut | Livré | `coverage_publication_enabled = false` (migration) ; pgTAP 4 |

## 2. Audit de l'existant (condensé)

- **Randonnées** : `hiking_routes` (id bigint, geom MultiLineString 4326, `region` ajoutée par 20260903020000), `trail_segments` (LineString 4326, unique `osm_id`), `trail_metadata` (stand-in replay). Gate Phase 3 `phase3_route_navigable(bigint)` et recherche bornée `phase3_search_navigable_routes` (≤ 3) inchangés.
- **POI réels trouvés** : `trail_pois` (stand-in replay, `geom Point`), `outdoor_points`, `map_refuges`, `map_summits`, `map_water_points`, `trip_pois` ; requêtes `get_route_pois`, `get_nearby_named_pois`, `getPois` (viewport, LOD). Aucune table POI inventée ; aucune donnée insérée.
- **Référentiels** : `countries_geo` (FK iso_a2 utilisée pour interdire une couverture sur un pays absent), `admin_regions_geo` (FK optionnelle région).
- **Feature flags** : `feature_flags` (hub/A3/A11), lecture `current_feature_flags()`, écriture service. Flag Phase 4 ajouté désactivé.
- **Affiliation** : `affiliate_partners/programs/offers/links/clicks/conversions`, `affiliate_offers` (prix/dispo/validité) — pas d'horodatage de vérification ni de drapeau de lien exposé avant Phase 4.
- **Candidats A13** : `a13_segment_geometries`, `a13_append_plan_version`, `a13_materialize_candidate` — non modifiés.
- **GPX** : `parseTripGpx` + `importGpxToTripAction` insèrent dans `trip_steps`, jamais dans `hiking_routes` ⇒ la navigation reste fermée sans géométrie BDD navigable (`decideHikingNavigation`).

## 3. Commandes et résultats bruts

| Commande | Résultat |
| --- | --- |
| `npm run type-check` | exit 0 (0 erreur) |
| `npm run lint` | exit 0 (0 erreur ; warnings préexistants hors périmètre) |
| `npm run test` | 318 fichiers passés, 4 skipped ; **2259 tests passés / 27 skipped, 0 échec** |
| `npx vitest run tests/coverage` | **9 fichiers, 70 tests, 0 échec** |
| `npx supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` | **Files=20, Tests=438, PASS** (dont `phase4_coverage.test.sql` : 58 assertions) |
| `npm run verify:invariants` | SUCCÈS (aucune .env, aucun secret en dur) |
| CLI pipeline dry-run (fixtures) | 11 étapes exécutées, publication refusée (flag désactivé) — exit 1 attendu |
| CLI matrice | `docs/coverage/COVERAGE_MATRIX.md` régénérée (8 cibles, 0 `covered`) |

## 4. Modèle POI / offres / affiliation livré

- **POI géographique** : inchangé (eau/refuges/abris/secours/restrictions classés par `classifyOsmTags`, un tag inconnu est rejeté, jamais rangé d'office).
- **Offre commerciale** : `affiliate_offers` + horodatages `price_checked_at` / `availability_checked_at`, `expires_at`, contraintes `NOT VALID` (historique préservé).
- **Affiliation** : `link_id` (nullable) vers `affiliate_links` ; vue `poi_offers_served` (SECURITY INVOKER) expose `has_affiliate_link` (lien réel **et actif**), jamais déduit par défaut.
- **Prix/dispo horodatés** : un prix sans horodatage n'est jamais servi (`priceState = missing_timestamp`, prix `null`) ; une offre expirée est signalée, pas supprimée.

## 5. Snapshots visuels

**Aucun** — aucune UI n'a été modifiée (les livrables Phase 4 sont BDD, scripts et documentation). Aucune baseline à régénérer.

## 6. Blocages et limites (honnêteté)

- **`INSUFFICIENT_DATA`** : aucune donnée géographique sous licence n'est fournie. Aucun dataset n'est importé, `docs/coverage/coverage-input.json` est vide, la matrice ne contient que des `not_covered`.
- **Licences** : le contrat/licence des données est une décision humaine ; aucune licence n'est enregistrée par cette phase (le trigger refusera tout import sans licence).
- **Seuils** : aucune valeur par défaut inventée ; un humain doit les fournir (`thresholds.json`) ; le pipeline refuse de valider sans eux.
- **Activation** : le flag `coverage_publication_enabled` est **désactivé** ; aucun agent ne l'active.
- **Environnement** : vérifications exécutées en local (Supabase Docker + vitest). Aucune écriture production, aucun secret, aucun accès distant.
- **`countries_geo` local** ne contient que `FR` : les cibles IS/MA/IT/NP ne pourront être importées qu'après chargement réel de leur référentiel (le FK l'exige). C'est volontaire.
