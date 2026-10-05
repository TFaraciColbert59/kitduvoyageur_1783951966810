# Socle Randonnée & Géographie LKDV — Architecture Explorer Mobile & OSM On-Demand

**Version :** 1.0.0  
**Statut :** Validé & Documenté  
**Date :** Octobre 2026  
**Auteurs :** Équipe Architecture LKDV & Antigravity  
**Référence ADR :** [ADR-016 — Identité canonique des randonnées LKDV & Socle géographique](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/docs/adr/ADR-016-canonical-hiking-route-identity.md)

---

## 1. Vision & Objectifs Fondateurs

Le **socle géographique et randonnée commun** de *Le Kit du Voyageur* (LKDV) fournit l'infrastructure unifiée pour la découverte, la consultation, la préparation et le suivi d'itinéraires de randonnée à l'échelle internationale.

Historiquement, LKDV fonctionnait sur une base de données locale Supabase circonscrite à des zones pilotes (1 170 itinéraires dans `hiking_routes`, concentrés sur Chamonix et quelques massifs français).

### Objectifs Clés de l'Architecture
1. **Couverture Internationale à la Demande** : Permettre l'exploration n'importe où sur le globe (Alpes, Pyrénées, Dolomites, Norvège, Japon, États-Unis, etc.) via OpenStreetMap (Overpass API) sans dupliquer l'intégralité de la base mondiale OSM dans Supabase.
2. **Identité Canonique Invariable** : Conserver `hiking_routes.id` (`bigint`) comme identité pivot absolue de tout le produit LKDV (Compas, Randonnée Active, Communauté, Profil, Carnets, Planificateur).
3. **Qualité & Anti-Falsification Géométrique** : Ne jamais inventer de fausse boucle, ne jamais relier deux segments disjoints par une ligne droite artificielle, et déclarer explicitement la qualité du tracé (`complete`, `partial`, `unavailable`, `invalid`).
4. **Matérialisation Idempotente (Tiered Data Strategy)** : Ne persister dans Supabase que les itinéraires effectivement utilisés ou consultés en profondeur par les membres, avec détection automatique des collisions et concurrence PostgreSQL (erreur 23505).
5. **Fluidité Mobile 60 FPS** : Garantir l'absence de freeze sur smartphone lors du pan/pinch/zoom, requêtes débouncées, annulation des requêtes obsolètes (`AbortController`), cache LRU borné et disjoncteur réseau (`CircuitBreaker`).
6. **Conformité Légale ODbL** : Respecter scrupuleusement la licence Open Database License (ODbL) et l'attribution aux contributeurs OpenStreetMap.

---

## 2. Découplage Fondamental des 4 Niveaux d'Identité

Pour éviter les anti-patterns d'identification hybride, LKDV distingue formellement quatre strates d'identités étanches :

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. External Source Identity                                            │
│    provider: 'openstreetmap' | externalId: '2251447'                   │
│    (Sujet aux modifications, scissions ou suppressions par OSM)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Découverte / Normalisation / Validation
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Canonical Route Identity (LKDV)                                     │
│    RouteId (hiking_routes.id = 8451)                                   │
│    Source de vérité officielle : nom, ref, distance, géométrie pivot    │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│ 3. Route Revision                    │   │ 4. Activity / HikeSession   │
│    revision_hash, geometry_hash      │   │    HikeSessionId (uuid)     │
│    source_version, fetched_at        │   │    route_id: 8451           │
│    (Traçabilité des évolutions)      │   │    positions_geojson (GPS!) │
└──────────────────────────────────────┘   └─────────────────────────────┘
```

1. **External Source Identity (`SourceId`)** : Identifiant externe fourni par le tiers (ex. `osm:relation:2251447`). Marqué par un système de types opaques/marqués (`branded types`).
2. **Canonical Route Identity (`RouteId`)** : Clé primaire `hiking_routes.id`. Invariable et souveraine. Si la relation externe est supprimée dans OSM, la route LKDV demeure persistée et référençable, avec un statut adapté.
3. **Route Revision** : Versioning de la trace officielle (empreinte SHA-256 de la géométrie, horodatage de synchronisation).
4. **User Activity Identity (`HikeSessionId`)** : L'expérience vécue par un marcheur (table `hike_sessions`). **Règle absolue :** La trace officielle de la route ne remplace JAMAIS le tracé GPS réel enregistré sur le terrain par l'utilisateur, et vice versa.

---

### 3. Stratégie de Données en 3 Paliers (Tiered Data Lifecycle)

Pour concilier l'exploration mondiale illimitée et la compacité de la base Supabase, le flux suit 3 paliers stricts :

```text
  [ Utilisateur navigue sur la carte (BBOX) ]
                     │
                     ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Palier A : DÉCOUVERTE (Explorer Viewport)                        │
  │ • Requête Overpass légère (tags + bounds + centre calculé)       │
  │ • Contrôle géodésique BBOX (max 400 km², rejet HTTP 400 si >)    │
  │ • Rate-limiting conservateur (6 req/min/IP) + Single-Flight      │
  │ • Cache LRU en mémoire (5 minutes)                               │
  │ • Payload : ExternalRouteSummary[]                               │
  │ • Écriture Supabase : AUCUNE                                     │
  └──────────────────┬───────────────────────────────────────────────┘
                     │ Clic sur un itinéraire dans la liste mobile
                     ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Palier B : CONSULTATION DÉTAILLÉE (Trail Drawer / Sheet)         │
  │ • Requête Overpass détaillée (members relation + ways geometry)  │
  │ • Assemblage géométrique strict (tolérance 2.5m, gaps >2.5m)     │
  │ • Boucles qualifiées (endpoints <2m ou roundtrip=yes explicite)  │
  │ • Statut de complétude (complete vs partial)                     │
  │ • Extraction des POIs géolocalisés (refuges, eau, sommets)       │
  │ • Cache LRU en mémoire (30 minutes)                              │
  │ • Écriture Supabase : AUCUNE                                     │
  └──────────────────┬───────────────────────────────────────────────┘
                     │ Clic sur "Préparer", "Démarrer", "Favoris" ou "Partager"
                     ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Palier C : MATÉRIALISATION CANONIQUE (Idempotente)               │
  │ • Appel POST /api/explorer/osm/materialize                       │
  │ • Schéma relationnel normalisé :                                │
  │   - public.hiking_routes (RouteId pivot, métadonnées centrales) │
  │   - public.hiking_route_sources (UNIQUE(provider, external_id))  │
  │   - public.hiking_route_revisions (UNIQUE(route_id, rev_number)) │
  │ • Gestion collision concurrency (code PostgreSQL 23505)         │
  │ • Enregistrement métadonnées dans trail_metadata (UNIQUE trail_id)│
  │ • Retourne RouteId (bigint) utilisable partout dans LKDV         │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 4. Système de Types & Modèle de Domaine

Les types du domaine sont isolés dans [`src/features/explorer-osm/domain/types.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/features/explorer-osm/domain/types.ts).

### Branded Types
```typescript
export type RouteId = number & { readonly __brand: unique symbol };
export type SourceId = string & { readonly __brand: unique symbol };
export type HikeSessionId = string & { readonly __brand: unique symbol };
```

### Qualité Géométrique & Détection de Boucle
```typescript
export type RouteGeometryQuality = 'complete' | 'partial' | 'unavailable' | 'invalid';
export type LoopDetectionMethod = 'exact_endpoints' | 'source_tag' | 'none';
```

### Rôles des Membres
Les relations de randonnée OSM contiennent des chemins avec des rôles spécifiques. L'assembleur géométrique LKDV ne mélange pas les variantes et les voies principales :
- `main` : Le tracé principal officiel.
- `alternative` : Variante officielle (ex. variante haute du Tour du Mont-Blanc).
- `approach` : Chemin d'approche depuis une gare ou un parking.
- `excursion` : Détour aller-retour vers un belvédère ou un sommet.
- `connection` : Jonction vers un autre itinéraire balisé.

---

## 5. Moteur d'Assemblage & Anti-Falsification Géométrique

Situé dans [`src/features/explorer-osm/domain/geometry.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/features/explorer-osm/domain/geometry.ts), le moteur assemble les segments `way` d'une relation OSM :

1. **Algorithme de Chaînage Glouton** :
   - Tolérance topologique numérique stricte : **2.5 mètres** (`GAP_NUMERICAL_TOLERANCE_METERS = 2.5`), permettant de concilier la précision flottante WGS84 aux jonctions réelles sans combler les disparités géographiques.
   - Détection de sens et inversion dynamique si le chemin est parcouru à rebours.
2. **Règles Anti-Falsification Stricte** :
   - **Zéro fausse liaison** : Si un trou de plus de 2.5 mètres existe entre deux segments (y compris un manque de 20 mètres), ils ne sont **jamais** joints par une ligne droite factice. Ils forment des segments discontinus dans une géométrie `MultiLineString` avec `gapCount > 0` et statut `partial`.
   - **Zéro fausse boucle** : Une proximité approximative (ex. 49 mètres) ne suffit **jamais** à déclarer une boucle. `isLoop` n'est affirmé que si les extrémités coïncident strictement (< 2 mètres, méthode `exact_endpoints`) ou si le tag source OSM spécifie explicitement `roundtrip=yes` (méthode `source_tag`). La géométrie n'est jamais refermée artificiellement.
   - **Zéro faux départ** : Le point de départ est toujours le premier point physique du premier segment de la chaîne principale, jamais le barycentre de la BBOX.
3. **Statut de Qualité Explicite** :
   - `complete` : Tous les segments sont continus et connectés à moins de 2.5m.
   - `partial` : Au moins un trou ou segment manquant. Affichage immédiat d'un badge ambré `Tracé partiel (discontinu)` pour avertir le randonneur.
   - `unavailable` : Tracé sans coordonnées ou géométrie manquante. Bloque le guidage et l'accès au compas avec un statut explicite `geometryStatus = 'unavailable'`.
   - `invalid` : Données corrompues ou vides.

---

## 6. Nomenclature et Typologie des POIs Randonnée

Le service [`normalizationService.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/features/explorer-osm/services/normalizationService.ts) extrait et catégorise les points d'intérêt essentiels au voyageur et au randonneur :

| Catégorie LKDV | Tags OSM correspondants | Icône / Couleur |
| :--- | :--- | :--- |
| `refuge` | `tourism=alpine_hut`, `wilderness_hut` | Tente / Vert Émeraude |
| `water` | `amenity=drinking_water`, `natural=spring` | Goutte / Bleu Azur |
| `summit` | `natural=peak`, `volcano` | Sommet / Violet |
| `camp` | `tourism=camp_site`, `camp_pitch` | Bivouac / Ambre |
| `viewpoint` | `tourism=viewpoint` | Œil / Indigo |
| `parking` | `amenity=parking` | Voiture / Gris Ardoise |
| `transit` | `highway=bus_stop`, `railway=station` | Bus / Cyan |

Chaque POI conserve sa provenance exacte (`source: { provider: 'openstreetmap', externalId, attribution }`) et ses attributs (altitude, nom, tags d'accessibilité).

---

## 7. Résilience, Caching et Protection Réseau (Circuit Breaker)

Le service [`cacheService.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/features/explorer-osm/services/cacheService.ts) implémente une architecture à deux niveaux pour protéger le quota Overpass et assurer la fluidité de l'application :

### Cache LRU Mémoire Borné
- **Résumés de BBOX** : 200 entrées, TTL 5 minutes.
- **Tracés détaillés** : 100 entrées, TTL 30 minutes.
- **POIs** : 200 entrées, TTL 10 minutes.
- Éviction automatique des clés les plus anciennes dès que la limite mémoire est atteinte.

### Circuit Breaker (Disjoncteur Réseau)
- **États** : `CLOSED` (nominal) -> `OPEN` (bloqué après 3 échecs consécutifs) -> `HALF_OPEN` (tentative de sonde après 20 secondes de repos).
- En cas de panne Overpass ou de rate-limiting (429), le disjoncteur s'ouvre immédiatement et renvoie une réponse dégradée sans bloquer les threads Node.js ni saturer le réseau mobile.

### Annulation Client (`AbortSignal`)
Tous les adaptateurs réseau propagent l'`AbortSignal`. Lorsque l'utilisateur effectue un zoom rapide ou déplace la carte successivement, les requêtes précédentes en vol sont annulées immédiatement.

---

## 8. Contrats de Compatibilité Multi-Consommateurs LKDV

Validés dans [`compatibilityContracts.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/features/explorer-osm/services/compatibilityContracts.ts) et testés par la suite de tests automatisée :

1. **Module Compas (`/compas`)** :
   - Reçoit `RouteId`.
   - Charge la géométrie officielle via `getRouteGeometry(routeId)`.
   - Calcule le cap, la distance restante et le guidage sans dépendance Overpass.
2. **Randonnée Active / Suivi GPS (`/randonnee-active`)** :
   - Associe `route_id: RouteId` dans `hike_sessions`.
   - Enregistre les coordonnées réelles de l'utilisateur dans `positions_geojson`.
   - Respecte l'étanchéité stricte entre le tracé prévisionnel et la trace réelle.
3. **Communauté & Social (`/communaute`)** :
   - Référence `route_id` et un snapshot statique léger (`routeName`, `distanceKm`, `dPlus`, `region`).
   - Ne duplique aucun objet GeoJSON lourd dans les posts communautaires.
4. **Profil & Statistiques (`/profil`)** :
   - Agrège les kilomètres parcourus et les sorties complétées à partir des `hike_sessions` terminées.
   - Ne comptabilise jamais une simple consultation de route comme une sortie effectuée.
5. **Carnet de Voyage (`/carnet`)** :
   - Permet d'épingler un itinéraire canonique `RouteId` comme étape d'un voyage.

---

## 9. Sécurité, Quotas et Prévention des Abus (DoS)

Les routes API sous `/api/explorer/osm/*` appliquent des garde-fous stricts :
1. **Validation de BBOX & Garde-fou Géodésique** :
   - Vérification mathématique des coordonnées (-90 <= lat <= 90, -180 <= lng <= 180, south <= north, west <= east).
   - Limitation de l'enveloppe maximale en degrés (`maxDegreesSpan: 1.5°`).
   - **Contrôle d'aire géodésique sphérique** : Rejet immédiat de toute requête dont la BBOX dépasse **400 km²** (`MAX_OVERPASS_GEODESIC_AREA_KM2 = 400`) avec une réponse HTTP 400 `"Zoome pour rechercher des randonnées"`. Formule sphérique exacte : `R² * |sin(lat2) - sin(lat1)| * dLng * π/180`.
2. **Limitation du Débit (Rate Limiting) & Single-Flight** :
   - Intégration de `enforceRateLimit` : **6 requêtes / minute par IP** pour les requêtes Overpass d'exploration (`RATE_LIMIT_MAX_REQUESTS = 6`).
   - Coalescence des requêtes en vol (`SingleFlight`) évitant les tempêtes de requêtes identiques vers l'amont Overpass.
   - Limiteur amont global (`UpstreamRateLimiter`) garantissant l'espacement minimal des appels Overpass (200ms) et l'adhérence stricte aux en-têtes `Retry-After`.
   - Mode de défaillance gracieux (`failMode: 'open'`) si Redis/Upstash est indisponible.
3. **Taille Maximale & Délais Overpass** :
   - Paramètre `maxsize: 33554432` (32 Mo max par requête côté serveur Overpass).
   - Timeout strict de 20 secondes sur la requête HTTP avant déclenchement du circuit breaker.

---

## 10. Cadre Légal & Licence Open Database License (ODbL)

Toute donnée issue d'OpenStreetMap est soumise à la licence ODbL 1.0 :
1. **Attribution Obligatoire** :
   - Affichage de la mention légale : *"© les contributeurs d'OpenStreetMap (ODbL)"*.
   - Lien direct vers `https://www.openstreetmap.org/copyright` dans la fiche détaillée du sentier et dans les fiches POIs.
2. **Données Dérivées vs Données Utilisateur** :
   - Les tracés des sentiers OSM et leurs POIs sont des données de base publiques.
   - Les traces GPS privées des utilisateurs (`hike_sessions`), les notes privées, les photos et les listes de matériel sont des œuvres privées et indépendantes appartenant exclusivement à l'utilisateur, et ne tombent pas sous la clause de partage à l'identique (Share-Alike).

---

## 11. Stratégie de Rollback & Exploitation

1. **Feature Flagging** :
   - Le socle OSM dans Explorer est conditionné par le contexte mobile et peut être débrayé via le flag de déploiement progressif si nécessaire.
2. **Résilience en Base de Données** :
   - La matérialisation canonique utilise des tables relationnelles dédiées (`hiking_route_sources`, `hiking_route_revisions`) avec contraintes `UNIQUE` et gestion d'idempotence applicative et SQL (`ON CONFLICT` / code d'erreur `23505`).
   - Aucun verrou de table n'est posé, aucune migration DDL bloquante n'est requise.
3. **Purge du Cache** :
   - Les caches LRU en mémoire peuvent être vidés à chaud par simple appel à `cacheService.osmRouteSummaryCache.clear()`.

---

## 12. Matrice de Tests & Preuves de Vérification

La robustesse du socle est garantie par **43 tests automatisés** sous Vitest et une compilation TypeScript stricte (`0 erreurs`) :

| Fichier de Test | Nombre de Tests | Objet de la Validation |
| :--- | :---: | :--- |
| `tests/features/explorer-osm/geometryAssembler.spec.ts` | 13 | Chaînage bidirectionnel, tolérance numérique 2.5m, rejet gaps 20m, rôles, MultiLineString, boucles strictes (<2m ou roundtrip=yes, refus 49m) |
| `tests/features/explorer-osm/normalization.spec.ts` | 7 | Normalisation relations/POIs, parsing distance, attribution ODbL |
| `tests/features/explorer-osm/canonicalization.spec.ts` | 6 | Idempotence multi-appels, schéma relationnel sources/révisions, révisions successives, source_deleted, concurrence 23505 |
| `tests/features/explorer-osm/compatibilityContracts.spec.ts` | 4 | Compatibilité Compas, HikeSession, Community, Profile |
| `tests/features/explorer-osm/cacheAndBreaker.spec.ts` | 6 | Cache LRU, TTL, éviction, transitions d'état du Circuit Breaker, SingleFlight, UpstreamRateLimiter |
| `tests/features/explorer-osm/apiRoutes.spec.ts` | 7 | Endpoints API discovery, detail, POIs, rejet BBOX >400 km² (HTTP 400), quotas IP 6 req/min, upstream limiter |
| **Total** | **43** | **100% Succès (Vert)** |
