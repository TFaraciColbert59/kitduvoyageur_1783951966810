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

### Import 1 fait (8 octobre, soir)

- `geo_places` créée (migration `20261008190319`, sans géométrie PostGIS ni trigrammes) et
  remplie : **367 747 lieux** (cities500 pour 246 pays ; tous les lieux habités de France,
  Suisse, Italie, Autriche), **74 Mo** ; base **428 Mo**. Vercors : 357 lieux en 20 ms.
- Le Compas (`lookupAreaPlaces`) et les pages Pays la lisent d'abord.
- `places_geo` n'est plus lu nulle part (`fetchPlaces` et `fetchPlaceNames`, sans appelant,
  retirés). **Étape 4 à faire par Tony** (suppression, SQL Editor) :
  `drop table public.places_geo;` après vérification des pages Pays en ligne (−232 Mo,
  base vers ~200 Mo).
- **Import reproductible** (base neuve, réimport mensuel) : télécharger `cities500`, `FR`,
  `CH`, `IT`, `AT` depuis download.geonames.org, puis
  `python3 -I scripts/geo/prep_geo_places.py <dossier> geo_places.tsv` et
  `npx tsx scripts/geo/import_geo_places.ts geo_places.tsv` (clé de service dans
  l'environnement ; upsert idempotent sur `geoname_id`).

### Import 3.4 préparé : refuges, cabanes, campings, points d'eau (lot AG, 13 octobre)

**Rien n'est écrit en base** (431 Mo, `places_geo` à retirer d'abord). Prêt, en fichiers :

- `supabase/migrations/20261013090000_geo_pois.sql` (**à ne pas appliquer** avant le retrait de
  `places_geo`) : `geo_pois` (identifiant OSM `n123`/`w456`/`r789`, nature, nom, position, altitude,
  gardé `yes|no|seasonal`, places, eau potable), `geo_pois_coverage` (tuiles importées en entier),
  `geo_pois_around` (lecture autour d'une étape + « zone couverte ? »), `geo_pois_finish_tile` (fin
  d'une tuile : absences comptées, retrait à la deuxième de suite). Validée sur un PostgreSQL local
  (16 assertions pgTAP : `supabase/tests/database/compas_geo_pois.test.sql`). **Lecture réservée à la
  clé de service** (RLS sans politique) : servir au public une base de lieux OSM impose de la proposer
  sous ODbL, ici seul le serveur du Compas la lit. (À noter : `geo_places` a, elle, une lecture
  publique ; à resserrer si l'on veut tenir la règle « pas exposé comme base » de `SERVICES-GRATUITS.md`.)
- `scripts/geo/import_geo_pois.ts` : Overpass private.coffee, **tuile par tuile, une requête à la
  fois** (file commune `src/lib/overpass.ts`), upsert idempotent, une transaction par tuile. **Défaut =
  essai qui n'écrit rien** (`--dry-run`) ; `--apply` écrit et demande `SUPABASE_DB_URL` ; refuse
  d'écrire si la base dépasse `--max-db-mb` (250) ; une tuile coupée ou muette n'écrit rien et n'est
  pas marquée couverte.
- Lecture par le Compas : `referentialPoisAround` (`server/geoPois.ts`) dans `lookupStagePois`,
  derrière l'interrupteur **`COMPAS_GEO_POIS=1`** (éteint par défaut : aucun appel à la base, rien ne
  change). Allumé : une étape dont la boîte est couverte lit refuges, campings et eau dans la table
  et **n'en redemande plus à Overpass** (qui garde restaurants, commerces, soins, transports…) ; une
  zone non importée, une base muette ou une réponse inattendue : Overpass donne tout, comme avant.
- `.github/workflows/geo-pois-monthly.yml` (plan 3.9) : le 5 de chaque mois, 03 h 17 UTC ; **inerte**
  tant que le secret `SUPABASE_DB_URL` ET la variable `GEO_POIS_IMPORT=on` n'existent pas.

**Source choisie : Overpass private.coffee, par tuiles, en série** (trois raisons). (1) Son usage
commercial est écrit (« including commercial use »), c'est déjà le seul serveur du site et la file
unique s'applique telle quelle ; Geofabrik demanderait de télécharger la France entière (environ 4,5 Go)
et un outil `osmium` pour en tirer quelques dizaines de milliers de points. (2) Les tuiles donnent
la notion de « zone importée », dont le Compas a besoin pour savoir quand Overpass reste le
secours. (3) Un massif se mesure en 4 requêtes (Vercors, tuiles de 0,5°), les Alpes tiennent en 72 tuiles de 1° et la France en 176, une fois par mois. Limite
dite : private.coffee est un service bénévole, saturé par moments (voir plus bas) ; le repli, si les
504 durent, est Geofabrik + `osmium tags-filter` (même licence), sans changer la table.

**Ce qui est importé, ce qui est écarté** (rien d'inventé : un champ absent d'OSM reste null) :
`tourism=alpine_hut|wilderness_hut|camp_site`, `amenity=drinking_water`, `amenity=shelter` (formes de
montagne seulement : `basic_hut`, `lean_to`, `weather_shelter`, `rock_shelter` ; sans forme, seulement
avec une altitude ; jamais arrêts de bus, pique-nique, gazebos), `natural=spring` (nommées ou
`drinking_water=yes` seulement). Écartés et comptés : privé (`access=private|no`), abandonné
(`disused`, `abandoned`, `ruins`), **eau dite non potable** (un « point d'eau » proposé à un randonneur
est buvable ou inconnu, jamais déconseillé). Un nom commun (« Refuge ») n'est pas un nom (null, la ligne
reste). « Gardé » n'est lu que dans `staffed`, jamais déduit du type.

**Mesure de place (extrapolation honnête, méthode dite).**
Les comptes viennent de **taginfo Geofabrik** (extraits « France » et « Alps », données du 12 octobre
2026), donc d'OSM entier, sans charger Overpass ; ce sont des **bornes hautes** (avant le retrait des
objets privés, abandonnés, ou en double). Les proportions (nom, altitude, capacité) servent à fabriquer
72 011 lignes d'essai, **mesurées sur un PostgreSQL local** (pas la base de production), insérées par
lots de 1 000 comme l'import : **209 octets par ligne, index compris** (14,3 Mo ; 12,8 Mo après un
`REINDEX`), contre 211 octets par ligne mesurés en production pour `geo_places`.

| Zone (extrait Geofabrik) | refuges + cabanes | campings | eau + sources | abris | lignes (borne haute) | place à 209 o/ligne |
|---|---|---|---|---|---|---|
| Alpes (arc alpin) | 5 779 | 3 275 | 58 856 | ≤ 4 093 | **≤ 72 000** | **≤ 14,4 Mo** (11,5 à 17) |
| France métropolitaine | 1 846 | 9 287 | 31 879 | ≤ 5 576 | **≤ 48 600** | **≤ 9,7 Mo** (7,8 à 11,6) |
| Les deux (la somme compte deux fois les Alpes françaises) | | | | | ≤ 120 600 | ≤ 24 Mo |

Deux choses à retenir : l'**eau est 80 % des lignes** (54 459 points d'eau potable dans les Alpes) ;
et la boîte `alpes` du script est un rectangle (5 à 17° E, 43,5 à 48,5° N), **plus large que l'arc
alpin** : elle contient des plaines (Pô, Bavière), donc plus de lignes que 72 000 (non mesuré). Les
limites : la garde `--max-db-mb` coupe l'écriture au-dessus du plafond, et `REINDEX TABLE geo_pois`
reprend environ 10 %.

**Place** : base à 431 Mo, moins `places_geo` (232 Mo) = environ 199 Mo ; plus 24 Mo au pire pour 3.4
= environ 223 Mo, **sous les 250 Mo** exigés avant les imports 3.3 à 3.7. 3.4 tient dans la marge, mais
elle dépasse la ligne « refuges et cabanes, 12 Mo » du tableau du §3 (qui ne comptait pas les points
d'eau) ; le total prévu (base d'environ 300 Mo) reste sous les 400 Mo visés par le plan 1.1.

**À faire par Tony, dans l'ordre**
1. Supprimer `places_geo` (`drop table public.places_geo;`, SQL Editor) ; vérifier base ≤ 250 Mo.
2. Appliquer `20261013090000_geo_pois.sql` (SQL Editor) ; poser le secret GitHub `SUPABASE_DB_URL`
   (Session pooler, celui des sauvegardes).
3. Prévenir l'opérateur de private.coffee (support@private.coffee) d'un import mensuel en série.
4. Premier essai : Actions › « Refuges et points d'eau » › Run workflow, zone `vercors`, base ≤ 250 ;
   puis zone `alpes`, puis `france`. Contrôler en base : `select subtype, count(*) from geo_pois group by 1`.
5. Poser la variable `GEO_POIS_IMPORT=on` (rejeu mensuel) ; poser `COMPAS_GEO_POIS=1` dans Vercel
   quand la table est remplie. Preuve : une préparation Vercors dont les journaux ne montrent plus
   de requête Overpass pour les refuges.
6. Mentions légales : « © contributeurs OpenStreetMap, ODbL » (déjà affichée) ; la base dérivée n'est pas
   publiée.
