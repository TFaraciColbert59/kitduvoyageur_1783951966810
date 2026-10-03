# ADR-016 — Identité canonique des randonnées LKDV & Socle géographique

**Date :** 2026-10-03  
**Statut :** Accepté  
**Décideurs :** Antigravity, Équipe Architecture LKDV  
**Contexte :** Mission Finale LKDV Explorer & Socle Randonnée Commun  

---

## 1. Contexte & Problématique

LKDV proposait historiquement une exploration de sentiers via des imports statiques partiels dans Supabase, centrés initialement sur Chamonix et quelques massifs français (1 170 lignes dans `hiking_routes`, 1 811 POIs dans `trail_pois`, 20 sessions dans `hike_sessions`).

L'introduction de la consultation mondiale à la demande via OpenStreetMap (OSM / Overpass) pose une question architecturale fondamentale :
> **Quelle est la source de vérité d'une randonnée LKDV, et comment garantir qu'une randonnée découverte dans Explorer soit réutilisable à l'identique dans Compas, l'activité active, le profil, la communauté, les carnets, les voyages et l'IA LKDV ?**

Un anti-pattern majeur consisterait à :
1. Adopter l'identifiant OSM (`osm_relation_id`) comme clé primaire universelle de LKDV (créant un couplage fort avec un fournisseur externe dont les relations peuvent muter, être scindées ou disparaître) ;
2. Dupliquer les géométries lourdes dans chaque post communautaire, carnet ou session ;
3. Confondre le tracé officiel prévu (*Route*) et la trace GPS réelle enregistrée par le marcheur (*HikeSession / Activity*).

---

## 2. Décision architecturale

### A. La table `hiking_routes` est la source de vérité canonique

La table existante `public.hiking_routes` (clé primaire `id BIGSERIAL`) est **la source de vérité canonique** pour tous les objets « itinéraire » de LKDV.

L'audit de la base de données réelle (3 octobre 2026) a confirmé que l'ensemble du modèle de données LKDV converge déjà vers `hiking_routes.id` :
- `hiking_routes.id` (`bigint`) : Clé primaire canonique stable.
- `hiking_routes.osm_relation_id` (`bigint`) : Index UNIQUE (`idx_hiking_routes_osm_relation_id`) garantissant l'unicité et l'idempotence de la relation externe.
- `hike_sessions.route_id` (`bigint`) : Clé étrangère vers `hiking_routes.id`.
- `trail_metadata.trail_id` (`bigint`) : Métadonnées enrichies (dénivelé, difficulté, saison, terrain).
- `activities.hiking_route_id` (`bigint`) : Agrégation d'activités utilisateur.
- `adventure_plan_route_selections.route_id` (`bigint`) : Sélections d'itinéraires dans le planificateur d'aventures.

**Décision ferme :** Aucune seconde table concurrente de routes n'est créée. `hiking_routes` est confirmée et consolidée comme identité canonique LKDV.

---

### B. Découplage strict des 4 niveaux d'identité normalisés

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. External Source Identity (public.hiking_route_sources)              │
│    provider: 'openstreetmap' | external_id: '2251447'                  │
│    source_version, source_timestamp, license, fetched_at, updated_at   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Canonical Route Identity (public.hiking_routes)                     │
│    id: RouteId (hiking_routes.id = 8451)                               │
│    name, ref, network, distance_km, geom, created_at                   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│ 3. Route Revisions                   │   │ 4. Activity / HikeSession   │
│    (public.hiking_route_revisions)   │   │    id: uuid (hike_sessions) │
│    revision_number, geometry_hash    │   │    user_id, route_id: 8451  │
│    quality, is_current, geom         │   │    positions_geojson: GPS!  │
│    (historique auditable complet)    │   │    duree, D+, pauses, temps │
└──────────────────────────────────────┘   └─────────────────────────────┘
```

1. **External Source Identity (`hiking_route_sources`)** : Identifiant externe fourni par le tiers (`provider: 'openstreetmap'`, `external_type: 'relation'`, `external_id: '2251447'`). Table normalisée dédiée avec contrainte d'unicité `(provider, external_id)` pour supporter de futurs fournisseurs (IGN, etc.).
2. **Canonical Route Identity (`hiking_routes`)** : Identifiant entier `RouteId` (`hiking_routes.id`), immuable, appartenant au domaine LKDV. Si OSM supprime une relation demain, l'objet LKDV reste vivant et passe en statut `source_deleted` sans briser l'écosystème.
3. **Route Revision Identity (`hiking_route_revisions`)** : Table normalisée d'audit et d'historique géographique (`geometry_hash`, `revision_number`, `quality: 'complete'|'partial'|'unavailable'|'source_deleted'`, `is_current: boolean`).
4. **Activity Identity (`HikeSession` / `Activity`)** : L'acte réel accompli par un utilisateur. La géométrie officielle de la route ne remplace JAMAIS la trace GPS réelle du marcheur, et la trace GPS du marcheur ne remplace JAMAIS la route officielle.

---

### C. Stratégie hybride de données (Ne pas importer le monde)

Supabase ne doit pas stocker les millions de relations OSM mondiales. Nous mettons en œuvre une stratégie en 3 paliers :

- **Palier A — Découverte (Viewport Explorer)** :
  L'utilisateur déplace la carte sur une zone (ex. Chamonix, Dolomites, Japon).
  Le backend LKDV interroge Overpass avec des filtres stricts (`type=route`, `route=hiking|foot`), met en cache court (mémoire / HTTP stale-while-revalidate), et renvoie un payload léger (`ExternalRouteSummary`).
  *Aucune écriture en base de données.*

- **Palier B — Consultation (Ouverture d'une fiche)** :
  L'utilisateur tape sur un sentier. Le drawer mobile s'ouvre instantanément.
  Le tracé complet (`LineString` / `MultiLineString`) et la hiérarchie des membres (rôles `main`, `approach`, `excursion`, `alternative`) sont chargés à la demande et validés géométriquement.
  *Aucune écriture persistante requise à ce stade.*

- **Palier C — Matérialisation canonique (Idempotente)** :
  Dès qu'une randonnée est enregistrée, ajoutée à un carnet, démarrée comme session active, ou planifiée dans une aventure, elle est matérialisée dans `hiking_routes` via `getOrCreateCanonicalRoute()`.
  L'index UNIQUE `idx_hiking_routes_osm_relation_id` garantit une idempotence stricte : deux requêtes concurrentes produiront exactement le même `RouteId`.

---

### D. Audit des tables legacy

- `saved_trails` (`trail_id text`) : 0 ligne en production, mentionnée uniquement dans l'export RGPD.
- `saved_adventures` (`trail_ids uuid[]`) : 0 ligne en production, mentionnée uniquement dans l'export RGPD.
- `activities` vs `hike_sessions` : `activities` sert de synthèse de haut niveau (nombre de sorties, km total affichés sur le profil), tandis que `hike_sessions` stocke la télémétrie GPS détaillée, les points de passage et les récits d'aventure.

---

## 3. Qualité géométrique et intégrité

Une relation OSM complexe n'est jamais aplatie à l'aveugle en un tableau de points non structuré :
- Statuts de géométrie : `complete`, `partial`, `unavailable`, `invalid`.
- **Règles d'or anti-falsification :**
  1. Ne JAMAIS relier deux segments disjoints par une ligne droite artificielle.
  2. Ne JAMAIS fermer artificiellement une boucle si la relation source ne boucle pas.
  3. Ne JAMAIS inventer un départ au centre géométrique d'une BBOX.
  4. Si des membres sont manquants : déclarer explicitement `partial` (« Tracé partiel »).

---

## 4. Conséquences & Compatibilité

- ✅ **Explorer mobile** : Expérience fluide 60fps, gestes cartographiques préservés, chargement du tracé réel à la demande.
- ✅ **Compas (futur)** : Accès direct via `getCanonicalRoute(routeId)` et `getRouteGeometry(routeId)` sans dépendance envers Overpass.
- ✅ **Communauté & Profil** : Publications et carnets référencent `route_id` + `hike_session_id` + snapshot statique léger, sans recopier des mégaoctets de GeoJSON.
- ✅ **Conformité ODbL** : Traçabilité claire de la source (`provider: 'openstreetmap'`), horodatage et attribution.
