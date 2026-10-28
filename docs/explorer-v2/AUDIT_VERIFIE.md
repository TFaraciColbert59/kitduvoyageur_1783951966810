# AUDIT_VERIFIE · Explorer v2

Revérification des chiffres de `01_AUDIT.md §3` sur la base active
`icxyvwzfjbflcbqukpfz` (Postgres 17.6.1, eu-west-3), le 2026-10-28 à 09:47 UTC,
via MCP Supabase `execute_sql`.

`list_projects` → un seul projet : `icxyvwzfjbflcbqukpfz` (`lekitduvoyageur2`,
`ACTIVE_HEALTHY`). Le projet fantôme `lwrmuggefbmboikjgudc` n'apparaît pas et
n'est jamais contacté.

## 1. Comptages réels

| Table | Audit 27/10 | Vérifié 28/10 | Écart |
|---|---|---|---|
| `countries_geo` | 246 | **246** | — |
| `countries_geo` sans géométrie | 80 | **80** | — |
| `admin_regions_geo` | 49 617 | **49 617** | — |
| `admin_regions_geo` sans géométrie | 49 617 | **49 617** | — |
| `geo_pois` | 112 400 | **112 400** | — |
| `hiking_routes` | 1 181 | **1 181** | — |
| `trail_segments` | 0 | **0** | — |
| `trail_pois` | 1 811 | **1 811** | — |
| `terrain_reports` | 0 | **0** | — |
| `hike_sessions` | 136 | **136** | — |
| `sos_alerts` | 0 | **0** | — |
| `activity_catalog` | 43 | **43** | — |
| `carnets` | 82 | **82** | — |
| `user_follows` | 1 027 | **1 031** | +4 (base vivante) |
| `trips` | — | **729** | nouveau chiffre |

Sortie brute (extrait) :

```
activity_catalog 43 · admin_regions_geo 49617 · carnets 82 · countries_geo 246
countries_geo_null_geom 80 · geo_pois 112400 · hike_sessions 136 · hiking_routes 1181
sos_alerts 0 · terrain_reports 0 · trail_pois 1811 · trail_segments 0 · trips 729 · user_follows 1031
```

## 2. Écarts découverts pendant la revérification (non présents dans l'audit)

1. **`admin_regions_geo` n'a aucune région française.** Répartition réelle :
   BR 5 597 · RO 3 223 · US 3 194 · RU 2 731 · MX 2 503 · CA 1 654 · JP 1 237 …
   `country_iso_a2 = 'FR'` → **0 ligne**. L'écran « Région · Auvergne-Rhône-Alpes »
   n'a donc aucune source en base. Contournement : géométries Natural Earth
   1:10m servies en statique (`public/data/explorer-v2/regions/FR.geojson`,
   101 unités, 18 groupes) — voir `DECISIONS.md#2`.
2. **`geo_pois` a 0 politique RLS** : lecture refusée au rôle `anon`
   (`permission denied for table geo_pois`). Corrigé par migration
   (`geo_pois_public_read`).
3. **`geo_pois.subtype` était contraint à 6 valeurs** (aucun `peak`,
   `viewpoint`, `saddle`, `parking`, `bus_stop`). Contrainte étendue à 13 valeurs.
4. **`countries_geo.population` est NULL sur 100 % des lignes** → tout affichage
   de population est masqué (règle « zéro donnée inventée »).
5. **`countries_geo.phone_code` est NULL sur FR**, non nul sur d'autres pays →
   l'indicatif n'est affiché que s'il existe.
6. **`hiking_routes.geom`** (et non `geometry`) : les RPC doivent utiliser `geom`.
7. `admin_regions_geo` : 100 % des géométries NULL → aucun `regionName` ne peut
   être calculé côté serveur ; le nom de région affiché vient des polygones
   Natural Earth côté client (`findRegionAt`).

## 3. Latences mesurées (BDD réelle, REST PostgREST, clé anon)

| RPC | Requête | Temps |
|---|---|---|
| `explorer_pois` | bbox Chamonix 0,05° | **115 ms** |
| `explorer_routes` | bbox Chamonix 0,11° | **286 ms** |
| `explorer_place` | Chamonix | **643 ms** (à froid) |
| `explorer_place` | Chamonix | **172–210 ms** (appels suivants) |

`explorer_place` a été réécrite après un premier essai à **3 113 ms**
(`statement timeout`) : le comptage d'itinéraires faisait un `ST_Intersects`
sur un buffer géographique de 12 km. Remplacé par un test d'emprise (`&&`) sur
index GIST — `hiking_routes_geom_gix`, `admin_regions_geo_geom_gix`.

## 4. Migration appliquée

`supabase/migrations/20261101_explorer_v2_data.sql` + `20261102_explorer_v2_routes.sql`,
appliquées sur la base active via l'API Management (DDL, transaction unique).
Vérifications post-application :

```
geo_pois_policies 1 · activity_sessions 1 · activity_points 1 · country_practical 1
osm_poi_cache 1 · flag_v2 false · escalade_voie 1 · sport_map 9 · sos_cols 6
```

Import Overpass ciblé (Alpes, bbox 45.82–46.05 / 6.75–7.00) :
**522 repères nommés** insérés dans `geo_pois` (260 `peak`, 93 `viewpoint`,
85 `saddle`, 170 `bus_stop`, 24 `parking`), dont Le Brévent, l'Aiguille du Midi,
le Mont Blanc du Tacul. Source ODbL, seed versionné :
`supabase/seeds/explorer_v2_pois_alpes.sql`.
