# Référentiel géographique local — plan chiffré (P1.1)

> À valider par Tony **avant toute migration**. Mesures prises le 7 octobre 2026 (soir)
> sur la base de production `icxyvwzfjbflcbqukpfz`. Les volumes à importer sont des
> **estimations** (ordre de grandeur), à remesurer au premier import.

## 1. Mesuré

| Mesure | Valeur |
|---|---|
| Offre Supabase | **Gratuite** : base limitée à **500 Mo** |
| Taille de la base | **423 Mo (85 %)**. Au-delà de 500 Mo, Supabase passe la base en lecture seule : l'app n'écrit plus rien |
| `places_geo` (lieux habités GeoNames) | 592 816 lignes, **294 Mo** (122 Mo de données, **172 Mo d'index**) |
| Couverture de `places_geo` | Import du 11 août interrompu : complet pour une partie des pays (Suisse 13 200, Chine 85 112), villes principales seulement ailleurs (**France 692**, Italie 661, Allemagne 1 139, États-Unis 3 409) |
| Qui lit `places_geo` | Les pages Pays seulement (`fetchPlacesByCountry`). **Le Compas ne s'en sert pas** |
| Index de `places_geo` jamais lus | géométrie 25 Mo, trigramme 24 Mo, nom 22 Mo, `idx_places_geo_geoname_id` 22 Mo (**doublon exact** de la clé unique `places_geo_geoname_id_key`), admin1/admin2 12 Mo |
| `admin_regions_geo` | 51 414 régions, 48 Mo (dont 32 Mo d'index) |
| `hiking_routes` | 1 171 parcours, 4,6 Mo, presque tous dans le Nord |
| `trail_pois` / `places` | 1 811 / 42 lignes |
| Caches du Compas | `geo_cache` 2 192 lignes (3,5 Mo), `route_cache` 118 (4,2 Mo) |

## 2. Ce qui manque au Compas (défauts vus en ligne le 7 octobre)

| Donnée | Défaut qu'elle corrige | Source |
|---|---|---|
| Villages et villes, avec population et altitude | Base au hasard dans un grand massif (Dolomites → Brugnàch), traversée bloquée, 45 % de lieux d'étape introuvables (audit) | GeoNames (`cities500` + chefs-lieux ; tous les lieux habités pour la France et les pays alpins) |
| Massifs, parcs, régions naturelles, avec emprise | « Chartreuse » lu comme un quartier de Toulouse ; « Jura » réduit au Parc du Haut-Jura | GeoNames (classes T, L) + OSM `boundary=national_park/protected_area` (emprise rectangulaire seulement) |
| Refuges et cabanes | Nuits en refuge sans prix, cabanes sans nom (« shanty ») | OSM `tourism=alpine_hut/wilderness_hut` |
| Sites d'escalade, stations de ski | Kalymnos : Vathýs au lieu de Masouri ; Dolomites via ferrata sans vraie base | OSM `climbing=crag/area`, `landuse=winter_sports` |
| Rivières navigables (tracé simplifié) | Canoë sur la Dordogne : Sarlat → Périgueux → Sarlat, pas une descente | OSM `waterway=river` avec `canoe=*` / `whitewater=*` |
| Grands itinéraires (GR, TMB, Kungsleden…) | GR34 cherché comme un lieu (étapes dans l'Indre) ; itinéraire d'un pays encore nommé par l'IA (Patagonie : 8 lieux introuvables) | OSM `route=hiking`, réseaux `iwn`/`nwn` (tracé simplifié) |

## 3. Volumes et espace (estimations)

Une table compacte (points : ~300 octets par ligne avec 3 index ; lignes simplifiées à
~300 points : ~5 ko par ligne).

| Lot | Lignes | Espace |
|---|---|---|
| Lieux habités (`cities500` monde, ~200 000 d'après GeoNames ; tous les lieux habités pour la France et les pays alpins) | ~250 000 | ~75 Mo |
| Massifs, parcs, régions naturelles (emprise rectangulaire) | ~30 000 | ~10 Mo |
| Refuges et cabanes | ~40 000 | ~12 Mo |
| Escalade et ski | ~60 000 | ~18 Mo |
| Rivières navigables (Europe) | ~3 000 | ~15 Mo |
| Grands itinéraires internationaux et nationaux | ~8 000 | ~40 Mo |
| **Total** | **~390 000** | **~170 Mo** |

| Espace de la base | Mo | Part des 500 Mo |
|---|---|---|
| Aujourd'hui | 423 | 85 % |
| Après suppression de l'index doublon | ~401 | 80 % |
| Après import du référentiel compact (avant retrait de `places_geo`) | ~570 | **dépasse** : retirer d'abord |
| Référentiel compact + retrait de `places_geo` (pages Pays branchées dessus) | **~300** | **60 %** |

Option Pro (25 $ par mois, 8 Go inclus) : tous les lieux habités du monde (~4,7 millions,
~1,4 Go) deviendraient possibles. Pas nécessaire pour les défauts ci-dessus.

## 4. Mise à jour

- **GeoNames** (CC BY 4.0, dumps quotidiens) : réimport mensuel des fichiers par
  script (`scripts/geo/import_geonames.ts` existe, upsert idempotent sur `geoname_id`).
- **OpenStreetMap** (ODbL) : extraction Overpass par pays et par lot, mensuelle, lancée
  hors Vercel (poste local ou GitHub Actions), upsert sur l'identifiant OSM ; un lieu
  absent de deux extractions de suite est retiré. Attribution « © OpenStreetMap » déjà
  affichée ; la base dérivée n'est pas publiée telle quelle.
- La carte en ligne (Photon, Overpass, Geoapify) reste le secours et le détail fin
  (hameaux d'une petite zone), derrière le cache partagé.

## 5. Ordre proposé (chaque étape réversible)

1. **Migration 1** : supprimer `idx_places_geo_geoname_id` (doublon, jamais lu) : −22 Mo, aucun effet.
2. **Migration 2** : table compacte `geo_places` (source, identifiant source, nom, nom
   français, nature, pays, région, latitude, longitude, altitude, population, rang,
   emprise, date de mise à jour) + 3 index ; lecture publique, écriture `service_role`.
3. **Import 1** : lieux habités. Brancher `lookupAreaPlaces` sur la table d'abord,
   Photon / Overpass en secours.
4. Pages Pays branchées sur `geo_places`, puis **retrait de `places_geo`** (−294 Mo).
5. **Import 2** : massifs et parcs, refuges, escalade, ski.
6. **Import 3** : rivières navigables et grands itinéraires (descente en canoë,
   itinéraire d'un pays sans noms de l'IA).

## 6. Décisions

1. **Offre gratuite retenue** (Tony, 8 octobre) : référentiel compact, ~300 Mo au final ;
   pas de passage en Pro.

2. **Feu vert** par le mandat de Tony (8 octobre, carte blanche) pour les étapes 1 à 3.

### Où on en est (8 octobre, midi)

- `places_geo` relu : l'import du 11 août s'est arrêté dans l'ordre alphabétique après les
  pays en A–C (Chine 85 112 lieux, Brésil 72 391), et **aucun lieu n'a de région**
  (`admin_region_id` nul sur les 592 816 lignes). `fetchPlaces` (lecture par région des
  pages Pays) ne trouve donc rien ; seule la lecture par pays sert.
- Migration 1 élargie à **9 index jamais lus ou en double** (−70 Mo environ, mesurés dans
  `pg_stat_user_indexes`) : `places_geo` (`geoname_id` en double, plein texte, admin1,
  admin2, pays seul couvert par pays + population), `admin_regions_geo` (`geoname_id` en
  double, plein texte, `admin_code`), `countries_geo` (`geoname_id` en double). Gardés :
  géométrie (future recherche spatiale du Compas), trigrammes (12 lectures).
- **Faite le 8 octobre** (Tony, SQL Editor ; migration `20261008162452`) : base de
  **424 à 353 Mo**.
- **Budget 0 € (Tony, 8 octobre)** : suite dans `PLAN-100.md`, phase 3 (`geo_places`,
  import par GitHub Actions, retrait de `places_geo`).
