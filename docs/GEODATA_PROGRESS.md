# GEODATA_PROGRESS.md — Base Géographique Mondiale LKDV

## 📊 Status global
- **Phase actuelle** : Phase 2 — Architecture BDD & modélisation
- **Pourcentage global** : 35%
- **Dernière action** : Phase 2 livrée (schéma GeoNames consolidé, seed 197 pays corrigé, types TS, helpers Supabase, script d'import réécrit en upsert/batching, lint Globe corrigé).
- **Prochaine action** : Phase 3 — Migrations Supabase & PostGIS (appliquer les 3 migrations via le SQL Editor Supabase).
- **Blocage éventuel** : Aucun (application des migrations = manuelle via SQL Editor, pas de CLI Supabase).

---

## 📑 PHASES DE SUIVI

- [x] **0. Initialisation & Fichier de Suivi** *(100%)*
- [x] **1. Audit Complet** *(100%)*
  - [x] Git & Arborescence du projet
  - [x] Supabase / PostGIS (tables, extensions, RLS, indexes)
  - [x] Modèle géographique existant & données OSM/sentiers
  - [x] Pages /pays & /pays/[code] actuelles
- [x] **2. Architecture BDD & Modélisation** *(85%)*
- [ ] **3. Migrations Supabase & PostGIS** *(0%)*
- [ ] **4. Pipeline d'Importation GeoNames** *(0%)*
- [ ] **5. Importation Progressive & Normalisation** *(0%)*
- [ ] **6. Hiérarchie Administrative & Spatial Indexing** *(0%)*
- [ ] **7. Moteur de Recherche Géographique Mondiale** *(0%)*
- [ ] **8. Services / APIs Backend & Client** *(0%)*
- [ ] **9. Connexion Globe 3D Earth (`/pays`)** *(0%)*
- [ ] **10. Intégration Dynamique Page Pays (`/pays/[code]`)** *(0%)*
- [ ] **11. Performance & Sécurité (RLS, Trgm, GiST)** *(0%)*
- [ ] **12. Tests & non-régression** *(0%)*
- [ ] **13. Documentation complète & Rapport final** *(0%)*

---

## 📝 JOURNAL DES DÉCISIONS TECHNIQUES & ACTIONS

### 2026-08-11
- **Création du suivi** : `docs/GEODATA_PROGRESS.md` initialisé.
- **Audit Git** : Branche `main`, modifications isolées dans `src/app/pays/` préservées.

### 2026-08-11 — Synthèse Audit Phase 1 (terminée)
- **Supabase / PostGIS** : extension `postgis` activée ; tables `countries_geo`, `admin_regions_geo`, `places_geo`, `place_names_geo` créées (index GiST/GIN uniquement) — **aucune donnée peuplée, pas de RLS, pas de triggers**, aucun branchement frontend.
- **Import GeoNames** (`scripts/import_geonames.ts`) : n'importe que pays + admin1 (pas de places, alt names, ni géométrie), pas d'upsert ; `importAdminRegions` fait un `.single()` par ligne (N+1, perf médiocre) ; aucun fichier de données dans le repo ; import jamais exécuté. `src/lib/geodata.ts` référence des types absents de `src/lib/supabase/types.ts` et utilise `NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""`.
- **OSM / sentiers** : historique de migrations chahuté ; `trails`/`hiking_trails` (seed factice) supprimés, remplacés par les vraies tables `trail_segments`, `hiking_routes` (1 169 routes réelles), `trail_metadata`, `trail_scores` — mais **jamais peuplées via osm2pgsql** ; vue `explore_trails` reconstruite sur `hiking_routes` (PostGIS `ST_AsGeoJSON`). Migration clé `20260810000000_explore_trails_no_synthetic.sql` (zéro mock) **non poussée**. Fonctions PostGIS présentes : `get_route_deviation`, `get_nearby_named_pois`. Stubs désactivés : `src/lib/overpass.ts` et `supabase/functions/fetch-osm-trails`.
- **Pages `/pays`** : refonte (commit `72bf3a4`) sur `src/app/pays/page.tsx` et `src/app/pays/[code]/page.tsx` via `CountryPageClient` + `styles/{tokens,shop,earth}.css` ; basée sur `src/lib/countries.ts` statique — **aucune connexion aux tables geo**. L'API `src/app/api/pays/[code]/route.ts` ne supprime plus/expire le cache.
- **Sécurité (P1)** : URL Supabase + **clé anon en dur** dans scripts suivis (`check_remote_tables.mjs`, `audit_club_backend.mjs`, `inspect_working_tables.mjs`, fallbacks `scripts/test_track_slicing.ts`, `test_supabase_connection.mjs`, `test_navigation_v2.ts`) → **faire tourner la clé / passer en `.env`**. Politiques anon INSERT/UPDATE permissives sur `trails`/`outdoor_points` (`20260716130000`, supersédées par les drops).
- **Prochaine phase** : **Phase 2 — Architecture BDD & modélisation** (consolidation du modèle géographique GeoNames).


### 2026-08-11 — Phase 2 : Architecture BDD & Modélisation (livrée, 85 %)
- **Migration schéma** `supabase/migrations/20260811000000_geodata_phase2_schema.sql` : types énumérés (`geo_feature_class`, `geo_feature_code`, `geo_country_geometry_source`), colonnes alignées GeoNames (`geoname_id`, `iso_a3`, `iso_numeric`, `fips_code`, `tld`, `phone_code`, `currency_code`, `languages`, `neighbours`, `area_km2`, `name_ascii`, `name_en`, `geometry_source`, `is_sovereign`, `admin_code_full`, `admin_parent_id`, `population_rank`, `is_capital`, `is_major_city`, flags `alternate_name_id`, `is_short_name`, `is_colloquial`, `is_historic`…), index GiST/GIN/trigramme, RLS lecture publique `anon`/`authenticated` + écriture `service_role`, triggers `updated_at`, droits PostgREST.
- **Géométrie (décision)** : la colonne `geometry` de `countries_geo` passe de `POLYGON` à `GEOMETRY(GEOMETRY, 4326)` (CAST explicite) — le référentiel mélange POINT (capitales GeoNames, seed) et POLYGON (contours Natural Earth 1:50m en Phase 6). L'index GiST `idx_countries_geo_geom` existant couvre les requêtes spatiales.
- **Seed** `supabase/migrations/20260812000000_geodata_phase2_seed_natural_earth.sql` : 197 codes ISO A2 uniques vérifiés (aucun doublon, 612/612 parenthèses, `;` terminal), capitales GeoNames réelles (POINT, zéro mock), rejouable (`ON CONFLICT DO UPDATE`, `DROP INDEX IF EXISTS` avant recréation de l'index trigramme). Commentaire d'en-tête corrigé (197, plus 195).
- **Types TS** `src/lib/supabase/types.ts` : `GeoFeatureClass`, `GeoFeatureCode`, `GeoCountryGeometrySource`, `CountryGeo`, `AdminRegionGeo`, `PlaceGeo`, `PlaceNameGeo` (géométrie `unknown`, cohérent avec l'API PostgREST).
- **Helpers** `src/lib/geodata.ts` : réécrit sans secret en dur (`createClient()` seul), `fetchCountries`, `fetchCountryByIso` (`.maybeSingle`), `fetchAdminRegions`, `fetchPlaces`, `fetchPlaceNames` — lecture publique prête pour les pages /pays.
- **Script d'import** `scripts/import_geonames.ts` : réécrit en upsert + batching (`--countries/--admin1/--places/--altnames`), résolution `country_id` par lots `.in("iso_a2", chunk)` (chunks 200, plus de N+1), lecture env `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- **Lint** : `src/components/pays/CountryGlobe.tsx` corrigé (`true &&` supprimé devant `<Globe`) ; `npx tsc --noEmit` **vert (exit 0)**.
- **Lint `/pays` — non-régression** : les 2 erreurs `react-hooks/rules-of-hooks` (lignes 290/292) ne viennent **pas** de `src/app/pays/page.tsx` (AST vérifié : 5 `useState` + 2 `useCallback`, zéro hook conditionnel) mais de `src/app/preparer-randonnee/PreparationClient.tsx` (fichier préexistant, hors périmètre Phase 2). Ancien fichier `src/app/pays/page.old.tsx` (version pré-refonte avec hooks conditionnels réels) supprimé — il n'était référencé nulle part et faussait le lint.
- **Reste Phase 2** (~15 %) : application des migrations (Phase 3), review finale des index trigramme `unaccent_lower`, branchage frontend (Phases 9-10).
- **Sécurité P1 (rappel, hors Phase 2)** : URL Supabase + clé anon en dur dans certains scripts de suivi / fallbacks (`check_remote_tables.mjs`, `audit_club_backend.mjs`, `inspect_working_tables.mjs`, `scripts/test_track_slicing.ts`, `test_supabase_connection.mjs`, `test_navigation_v2.ts`) → faire tourner la clé / passer en `.env`.

### 2026-08-11 — Prochaine action (Phase 3)
- **Phase 3 — Migrations Supabase & PostGIS** : appliquer via SQL Editor Supabase, dans l'ordre :
  1. `supabase/migrations/20260810000000_explore_trails_no_synthetic.sql` (vue `explore_trails` réelle, zéro mock — héritage Phase 1, non poussée),
  2. `supabase/migrations/20260811000000_geodata_phase2_schema.sql`,
  3. `supabase/migrations/20260812000000_geodata_phase2_seed_natural_earth.sql`.
- Puis vérifier : `countries_geo` peuplé (197), RLS lecture publique OK (`anon` SELECT), `geometry` géométries mixtes acceptées, index trigramme fonctionnels.
- **Blocage** : aucune CLI Supabase détectée dans le repo — application manuelle via SQL Editor (action humaine, à documenter dans le journal au moment de l'exécution).
