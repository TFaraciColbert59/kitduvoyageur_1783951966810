# Audit SQL / PostGIS — lecture seule (31/10/2026)

Projet : `lekitduvoyageur2` (`icxyvwzfjbflcbqukpfz`, Postgres 17.6, eu-west-3).
**Toutes les requêtes de ce document sont des SELECT.** Aucune migration n'a été
appliquée, aucune donnée modifiée, aucun `EXPLAIN ANALYZE` sur un RPC lourd.

## 1. RPC appelés par l'Explorer — coût réel

Source : `extensions.pg_stat_statements` (compteurs cumulés depuis le dernier
redémarrage). p95 ≈ `mean + 1.645 × stddev` : c'est une **approximation**
gaussienne, pas un percentile mesuré — à remplacer par un histogramme si le
besoin de précision devient un critère de décision.

| RPC | appels | moyenne | écart-type | p95 approx. | total cumulé |
|---|---:|---:|---:|---:|---:|
| `trails_in_viewport` (viewport Explorer) | 8 994 | 159,8 ms | 278 ms | ~617 ms | **1 437 s** |
| `trails_in_viewport` (variante zoom/tolérance) | 7 924 | 86,2 ms | 160 ms | ~350 ms | 683 s |
| `get_trail_pois_bbox` | 4 425 | 87,7 ms | 162 ms | ~355 ms | 388 s |
| `get_trail_pois_bbox` (variante) | 2 574 | 42,3 ms | 94 ms | ~197 ms | 109 s |
| RPC `p_lat/p_lng` (autour d'un point) | 520 | 483,1 ms | — | — | 251 s |
| RPC `p_route_id` | 2 783 | 98,3 ms | — | — | 274 s |
| `hike_sessions` (liste) | 1 796 | 238,3 ms | — | — | 428 s |

Constats actionnables :

1. **Le volume d'appels est le premier levier, pas le SQL.** ~17 000 appels de
   vue carte sur une base de 1 181 randonnées : la RPC coûte 88–160 ms en
   moyenne, mais c'est le nombre d'appels par déplacement de caméra qui pèse.
   Côté code, `src/lib/queries/trails.ts` met déjà en cache mémoire 60 s ; le
   reste du volume vient des routes API appelées par le client à chaque
   viewport (pas de debounce côté requête HTTP).
2. **`SELECT name FROM pg_timezone_names` : 1 700 appels, 939 ms de moyenne,
   1,6 M lignes, 1 597 s cumulées.** Aucune occurrence dans ce dépôt
   (`grep` sur `src/`, `scripts/`, `supabase/`) : ce trafic ne vient pas du
   code applicatif. À identifier côté plateforme (monitoring/pooler) avant toute
   conclusion ; aucune optimisation applicative possible de ce côté.
3. `DELETE FROM users WHERE id = $1` : 62 appels, 549 ms de moyenne. Suppression
   de compte coûteuse (cascades) — hors périmètre de ce chantier, à documenter.

## 2. Index — duplications réelles

Source : `pg_index` + `pg_stat_user_indexes`.

| Table | Index | Définition | `idx_scan` | Taille |
|---|---|---|---:|---:|
| `hiking_routes` | `idx_hiking_routes_geom` | GIST(geom) | 16 669 | 112 kB |
| `hiking_routes` | `hiking_routes_geom_gix` | GIST(geom) — **même colonne** | 4 552 | 72 kB |
| `trips` | `idx_trips_share_token` | btree(share_token) | 0 | 104 kB |
| `trips` | `trips_share_token_key` | **UNIQUE** btree(share_token) | 0 | 104 kB |
| `trips` | `idx_trips_slug` | btree(slug) | 48 207 | 72 kB |
| `trips` | `trips_slug_key` | **UNIQUE** btree(slug) | 56 | 72 kB |

Analyse :

- `hiking_routes` porte **deux index GIST identiques sur `geom`**. Les deux sont
  utilisés (scans différents selon les plans) : en supprimer un est probablement
  sûr, mais ce n'est **pas prouvé sans`EXPLAIN` sur staging** ni sans vérifier
  les contraintes. **Décision : conserver, documenter, ne rien supprimer.**
- `trips.share_token` et `trips.slug` ont chacun un index simple **doublonné par
  un index unique** sur la même colonne. L'index unique suffit à toute recherche
  d'égalité : le btree simple est redondant. Suppression = gain modeste
  (176 kB) mais écritures de `trips` allégées. **Proposition uniquement** :
  voir §4, non appliquée, à valider sur staging (les index uniques peuvent être
  utilisés par des contraintes : vérifier `pg_constraint` avant).
- `idx_hiking_routes_ref` et `idx_hiking_routes_network` ont `idx_scan = 0` :
  **ce n'est pas une preuve de non-usage** (statistiques remises à zéro au
  redémarrage, requêtes préparées). Conserver.

## 3. Volumétrie et bloat

| Table | lignes vivantes | mortes | % mort | dernière autovacuum | taille totale |
|---|---:|---:|---:|---|---:|
| `geo_places` | 362 840 | 0 | 0 % | 08/10 | 77 MB |
| `admin_regions_geo` | 0 | 0 | — | jamais | 41 MB |
| `geo_pois` | 112 720 | 3 | 0 % | 17/10 | 25 MB |
| `hub_telemetry` | 35 900 | 2 100 | 5,5 % | 29/10 | 14 MB |
| `trips` | 525 | 11 | 2,1 % | 30/10 | 9,5 MB |
| `hiking_routes` | 1 181 | 24 | 2,0 % | 21/10 | 7,3 MB |

Pas de bloat critique. `admin_regions_geo` (41 MB, 0 ligne vivante) mérite une
vérification fonctionnelle (table de référence peut-être vide par conception) :
**ne rien toucher sans preuve d'usage** (elle est peut-être alimentée par un job).

## 4. Proposition non appliquée — index doublons `trips`

```sql
-- À exécuter UNIQUEMENT sur staging après vérification :
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conrelid = 'public.trips'::regclass;
-- puis vérifier qu'aucune contrainte ne dépend des index simples.
BEGIN;
DROP INDEX IF EXISTS public.idx_trips_share_token;  -- couvert par trips_share_token_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_trips_slug;         -- couvert par trips_slug_key (UNIQUE)
COMMIT;
```

Rollback :

```sql
CREATE INDEX IF NOT EXISTS idx_trips_share_token ON public.trips USING btree (share_token);
CREATE INDEX IF NOT EXISTS idx_trips_slug ON public.trips USING btree (slug);
```

Gain attendu : ~176 kB et deux écritures d'index en moins par `INSERT/UPDATE` sur
`trips`. **Non appliqué dans ce chantier** (aucune mutation de production
autorisée). Aucun fichier de migration n'a été ajouté dans
`supabase/migrations/` : une suppression d'index n'est pas une migration
additive, elle doit passer par une validation staging explicite.

## 5. Ce qui n'a pas été fait (et pourquoi)

- **Pas de `EXPLAIN ANALYZE`** sur `trails_in_viewport` : charge réelle sur la
  base de production, interdite par le contrat.
- **Pas de p95 mesuré** : `pg_stat_statements` ne fournit que moyenne et
  écart-type ; le p95 ci-dessus est une approximation.
- **Pas de test RLS multi-comptes** : nécessite deux comptes de test et une base
  de staging autorisée (non disponible dans cet environnement) → `BLOCKED`.
- **Pas de modification d'index** : voir §4, proposition livrée sans exécution.
