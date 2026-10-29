# 05 · Données, API gratuites, migrations, sécurité

## 1. Règle absolue
Aucune donnée inventée. Chaque champ affiché = une source ci-dessous. Si la source est vide pour ce lieu : masquer le bloc et afficher l’état vide prévu (« Personne n’a encore signalé… »). Les chiffres de la maquette sont des exemples.

## 2. Sources gratuites (budget 0 €)
| Besoin | Source | Conditions |
|---|---|---|
| Fond de carte vecteur | OpenFreeMap (déjà utilisé) | gratuit, sans clé, attribution OSM |
| Relief | AWS Terrain Tiles terrarium (déjà utilisé) | open data, attribution |
| Satellite (calque) | Esri World Imagery **non** (licence) → utiliser Sentinel-2 cloudless EOX millésime 2016 (seul millésime CC BY 4.0, usage commercial permis) ; sinon retirer l’option | consigner |
| Pays, frontières | Natural Earth 1:50m/1:110m | domaine public |
| Régions niv. 1 | Natural Earth admin-1 (simplifié, `ST_SimplifyPreserveTopology`) | domaine public |
| Sommets, belvédères, cols, parkings, arrêts | OSM via Overpass, import par tuiles hors pic (services `features/explorer-osm`) | ODbL, attribution, ≤ 1 req/s |
| Météo mondiale | MET Norway Locationforecast 2.0 | gratuit, User-Agent identifié, cache ≥ 30 min, attribution |
| Avalanche (France) | Météo-France BERA (clé gratuite) | sinon masqué |
| Débit rivière (France) | Hub’Eau hydrométrie | gratuit |
| Soleil, lumière | `suncalc` (MIT), local | — |
| Urgences, prises, conduite | Wikidata (CC0) : numéro d’urgence P2852, type de prise P2853, sens de circulation P1622, import SPARQL une fois par mois | valeur absente → masquée |
| Recherche lieux | BDD (pays, régions, POI, itinéraires) puis Photon (komoot) en repli | usage raisonnable, cache |
| Langage naturel | OpenRouter modèle gratuit (si `OPENROUTER_API_KEY`) via appel de fonctions vers des filtres, sinon analyseur de règles | jamais de texte inventé : la réponse = résultats BDD |

## 3. Migrations à créer (`supabase/migrations/2026110x_explorer_v2_*.sql`)
1. **Géométries** : `countries_geo.geometry` pour les 80 manquants ; `admin_regions_geo.geometry` niveau 1 (MultiPolygon 4326 simplifié) + index GIST ; colonne `geom_simplified` pour l’affichage.
2. **`country_practical`** (`iso_a2` PK, `emergency_numbers jsonb`, `plug_types text[]`, `driving_side`, `units` metric|imperial, `source`, `license`, `updated_at`), RLS lecture publique.
3. **POI** : étendre `geo_pois.subtype` (peak, viewpoint, saddle, parking, trailhead, bus_stop, train_station) avec `ele_m`, `prominence_m`, index GIST sur `(lon,lat)` en géographie si absent ; RPC `explorer_pois(bbox, z, kinds[], user_lat, user_lng)` qui renvoie déjà triés par priorité (§1 de 04_CARTE) et limités à 400.
4. **`activity_sessions`** (`id`, `user_id`, `sport` → `activity_catalog.slug`, `route_id`, `status` live|paused|finished|abandoned, `started_at`, `ended_at` null, `distance_m`, `elev_gain_m`, `moving_s`, `share_level` none|followers|group, `last_lat/lng` arrondis, `updated_at`) + **`activity_points`** (`session_id`, `t`, `lat`, `lng`, `ele`, `acc`, `speed`) partitionnée par mois ou purgée à 30 j après résumé ; RPC `finish_activity_session(id)` qui écrit le résumé dans `hike_sessions` (compatibilité).
5. **`sos_alerts`** : ajouter `accuracy_m`, `battery`, `session_id`, `country_iso_a2`, `cancelled_at`, `resolved_at`, statut enum.
6. **`activity_catalog`** : ajouter `escalade-voie` (famille montagne) ; table de mapping 9 sports UI → slugs (§4).
7. **Flag** `explorer_v2_enabled` dans `feature_flags` (0 % puis 100 % en phase 10).
8. **RPC** `explorer_place(lat,lng)` : compteurs réels (itinéraires, eau, refuges, signalements actifs, membres passés), nom du lieu (admin niv. 2 le plus proche).
Chaque migration : `begin; … commit;`, idempotente (`if not exists`), testée en local puis appliquée sur `icxyvwzfjbflcbqukpfz`, vérifiée par `information_schema`/`pg_policies`, consignée.

## 4. Sports UI → `activity_catalog`
course→`course-5k` · rando→`rando-journee` · vélo→`velo-route` · kayak→`canoe-journee` (mer : `kayak-sea`) · trail→`trail-10k` · ski de rando→`ski-randonnee` · escalade→`escalade-voie` (à créer) · famille→`rando-famille` · bivouac→`bivouac-1n`.

## 5. RLS (toute nouvelle table)
- `activity_sessions` : le propriétaire lit/écrit ; les abonnés mutuels lisent si `share_level='followers'` et `status='live'` ; le groupe lit si `share_level='group'` (via `travel_groups`) ; jamais de lecture anonyme.
- `activity_points` : propriétaire uniquement ; position publique dérivée arrondie.
- `sos_alerts` : insertion propriétaire, lecture propriétaire + contacts d’urgence (`depart_participants.is_emergency_contact`).
- `country_practical`, géométries : lecture publique, écriture service uniquement.
Preuve : `.agents/test_rls_intrusion.mjs` étendu (lecture croisée d’un autre utilisateur = refus).

## 6. Recherche en langage naturel (sans dépense)
Analyseur déterministe en premier : extrait type (eau, lac, refuge, sommet, rando), contraintes (« à moins de 2 h » → isochrone worker, « facile », « en famille », « ce week-end » → météo), lieu (« autour de moi » ou nom). Le modèle gratuit, s’il est disponible, ne fait que remplir le même objet de filtres (schéma Zod). Les résultats viennent toujours de la BDD.

## 7. Hors-ligne
Zone = bbox affichée, tuiles z10–15 (fond + DEM) plafonnées à 2 000, itinéraires et POI de la zone en IndexedDB, taille affichée avant téléchargement, purge manuelle. Respect des conditions OpenFreeMap (consigner la vérification). Écritures hors ligne (signalements, points) mises en file dans `offline_sync_operations` avec clé d’idempotence.
