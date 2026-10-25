# Compte — la carte vivante

**Date :** 2026-10-23
**Statut :** proposition à valider — aucun code écrit pour ce chantier
**Périmètre :** la carte du bas de `/compte`, ses calques, ses contrôles en verre,
ses états, ses animations et le contexte carte de chaque drawer (Profil, Réseau,
Sortie, Compte). Les contenus des drawers, l'en-tête du profil et les profils
publics ne sont pas refaits ici.

---

## 1. Audit factuel — ce qui se passe réellement

### 1.1 Constat en production

Mesures faites sur `https://kitduvoyageur-1783951966810-ruddy.vercel.app/compte`
(430 × 932, Chromium, mode invité) :

| Mesure | Valeur observée |
|---|---|
| Carte MapLibre créée | oui (`window.__lkdvCompteMap3D`) |
| `map.loaded()` | `false` après chargement complet |
| `map.isStyleLoaded()` | `true` |
| Marqueurs `.maplibregl-marker` | `0` |
| Source `compte-tmb-track` | absente |
| Requête de worker MapLibre | aucune |
| Tuiles satellite ArcGIS | 200, visibles à l'écran |
| Tuiles de relief S3 | 200 |
| Erreurs console | 0 |

Autrement dit : le fond satellite s'affiche, mais **aucun contenu personnel**
n'est ajouté. L'écran n'est pas vide au sens « blanc » : il est vide au sens
« aucune donnée, aucun marqueur, aucun tracé ».

### 1.2 Cause racine n° 1 — le worker MapLibre n'est jamais configuré

Le reste de l'application appelle `setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')`
avant de créer une carte :

- `src/components/map/UnifiedExplorerMap.tsx:511`
- `src/components/map/UnifiedCountryGlobe.tsx:172`
- `src/features/carte-3d/components/Carte3DMap.tsx:88`
- `src/app/carte-3d/Carte3D.tsx:33`

`src/components/compte/compte-liquid-glass-v8-runtime.js` ne l'appelle **jamais**.
Le commentaire de `UnifiedExplorerMap` documente pourtant le symptôme exact :
sans cette URL, le worker pointe vers un chunk inexistant et « aucune source
GeoJSON [n'est] rendue ».

Conséquence en cascade :

1. le worker ne démarre pas ;
2. `map.on('load')` ne se déclenche pas (ou reste bloqué) ;
3. tout le contenu est enregistré **à l'intérieur** de ce callback ;
4. les marqueurs, le tracé et les sources ne sont jamais créés ;
5. le SVG de secours `#tm` a été masqué avant l'initialisation et n'est restauré
   que sur une erreur explicite — erreur qui n'arrive pas ;
6. l'écran garde donc un fond satellite sans contenu.

C'est un défaut de robustesse, pas un problème de données : même avec des
données parfaites, le callback ne s'exécute pas.

### 1.3 Cause racine n° 2 — le contenu est une maquette codée en dur

Tout le contenu ajouté dans `map.on('load')` est statique :

- un tracé « Tour du Mont-Blanc » de 12 points, utilisé comme fallback ;
- 7 massifs (`Mont-Blanc`, `Pyrénées`, `Vercors`, `Écrins`, `Corse`,
  `Dolomites`, `Valais`) avec des statistiques inventées ;
- 4 POI (`Mont-Blanc`, `Aiguille du Midi`, `Col de Voza`, `Refuge de Miage`) ;
- 4 photos d'expédition (`Lac Blanc`, `Néouvielle`, `Glacier Blanc`, `Col de Voza`)
  avec des coordonnées inventées.

Aucun de ces objets n'est relié aux données du compte. Le SVG de secours
`drawMap()` est du même ordre : massifs, carnets et kits positionnés par des
coordonnées `x/y` de mise en page, pas par une géographie.

### 1.4 Cause racine n° 3 — le payload ne contient aucune géométrie

`/api/compte/bootstrap` renvoie bien des sorties réelles, mais :

| Donnée | Ce que le bootstrap expose | Ce qu'il faudrait pour la carte |
|---|---|---|
| `outings` | `id`, `title`, `mass`, `km`, `dplus`, `x`, `y` | géométrie réelle (`positions_geojson`), bornes, départ/arrivée |
| `massifs` | `[]` (commentaire : « aucune table de massifs personnels ») | massifs réellement visités + centre `geo_massifs` |
| `carnets` | posts communauté, sans géographie | carnet lié à une sortie (`hike_sessions.carnet_id`) |
| `photos` | non exposées dans le bootstrap | compte par sortie ; coordonnées absentes aujourd'hui |
| POI | `poi_events` non exposé | `{ label, lat, lng }` réels |
| `stamps` | nom, nombre de sorties, `verified` | + `lat/lon` du massif |

`positions_geojson` existe pourtant en base, et `positions_timed` porte les
échantillons horodatés. `hike_session_photos` n'a **pas** de `lat/lng` : une
photo ne peut donc pas être punaisée à sa position réelle aujourd'hui. Le plan
ne l'invente pas.

### 1.5 Cause racine n° 4 — le contexte des nouveaux drawers n'existe pas

`applyMapContext()` ne reconnaît que l'ancien tiroir `step` avec `S.step === 0`
(les slots du drawer Profil). Les drawers `account_drawer`, `followers_sheet`
et `outing_drawer` appellent bien `applyMapContext()`, mais la fonction retombe
sur « aucun contexte » : elle restaure les calques et retire le badge.

Le badge existant est d'ailleurs un petit pill blanc de 26 px, sans lien avec
la grammaire de la barre du bas, et les calques de contexte sont des calques
de la maquette SVG (`empreinte`, `traces`, `carnets`, `lignees`), pas des
données.

### 1.6 Cause racine n° 5 — les contrôles ne respectent pas la grammaire

- `#mctl` : boutons de 42 × 40 px, sous la cible tactile de 44 px.
- Deux jeux de contrôles se superposent : `#mctl` (bas droite) et
  `.map-scale-selector` (haut gauche), plus le panneau `#mopts`.
- `#mopts` propose 8 calques dont plusieurs n'ont aucun contenu réel
  (« Lignées », « Hors-ligne », « Courbes »).
- Aucune attribution visible (Esri/OSM) alors que les tuiles l'exigent.
- Le badge de contexte est `rgba(255,255,255,.78)` avec un blur de 16 px :
  ce n'est pas la recette de la barre du bas.

### 1.7 Ce qui fonctionne déjà et qu'il ne faut pas casser

- La carte est bien montée dans `.mapzone` et suit `mapbig` / le redimensionnement.
- Les drawers Profil, Réseau, Sortie et Compte sont React, branchés sur des
  endpoints réels.
- Les slots du drawer Profil ont déjà une discipline « aucune donnée inventée »
  (Vitrine, Prêts, Souvenirs, Communauté).
- La barre du bas est la référence visuelle validée : capsule 48 px, verre,
  lentille, ombres internes.
- Les tuiles ArcGIS et le relief S3 répondent en production.

---

## 2. Décision produit

**La carte du Compte devient une carte de données réelles, pas une illustration.**

Elle répond à trois questions, dans cet ordre :

1. **Où suis-je allé ?** traces GPS réelles, massifs réellement visités.
2. **Qu'est-ce que je regarde ?** le contexte du drawer ouvert (Vitrine, Kit,
   Prêts, Souvenirs, Communauté, Compte, Réseau, Sortie).
3. **Que puis-je faire ?** ouvrir une sortie, recentrer, changer d'échelle,
   filtrer par année, agrandir.

Règles non négociables :

- **Aucune coordonnée inventée.** Pas de tracé Tour du Mont-Blanc par défaut,
  pas de massif « Mont-Blanc » pour un compte qui n'a rien enregistré.
- **Aucune donnée d'un autre compte.** La carte du Compte est celle du
  propriétaire authentifié, lue avec sa session et la RLS.
- **Aucun écran vide sans explication.** Un état vide est un contenu : titre,
  phrase, action. Pas de fond nu.
- **Le verre de la barre du bas est la seule recette.** Pas de nouveau blanc
  opaque, pas de nouvelle palette, pas de blur différent.
- **Le mouvement sert la compréhension.** On ne fait pas bouger la carte pour
  décorer ; chaque vol répond à une action.

---

## 3. Ce que la carte doit afficher

### 3.1 Les calques

| Calque | Source réelle | Condition d'affichage | Rendu |
|---|---|---|---|
| **Traces** | `hike_sessions.positions_geojson` (LineString) | au moins 2 points valides | ligne 3 px, halo 8 px, départ plein, arrivée cerclée |
| **Massifs** | `hiking_routes.region` → `geo_massifs` | massif nommé + centre GeoNames | pastille verre avec nom + nombre de sorties |
| **Carnets liés** | `hike_sessions.carnet_id` → `carnets` | sortie géolocalisée + carnet lisible | pastille verre livre, au départ de la sortie |
| **POI** | `hike_sessions.poi_events[{label,lat,lng}]` | coordonnées valides | petit point, tooltip au tap |
| **Photos** | `hike_session_photos` | **aucune coordonnée aujourd'hui** → pas de punaise ; compteur dans la fiche de sortie | pas de calque tant que `lat/lng` n'existent pas |
| **Stats** | agrégats `hike_sessions` | compte authentifié | capsule de synthèse, pas un calque |

Un calque sans donnée n'est pas affiché. Un calque avec données partielles
n'affiche que les objets valides ; le reste est compté dans l'état vide
(« 3 sorties sans trace GPS »).

### 3.2 Les éléments d'interface

| Élément | Contenu | Position | Style |
|---|---|---|---|
| **Capsule de contexte** | libellé du mode + compteur | haut gauche, 10 px | 48 px, verre barre du bas |
| **Capsule d'échelle** | Globe / Massif / Sentier | haut gauche, sous la capsule de contexte | 48 px, 3 cellules, lentille |
| **Contrôles** | calques, recentrer, agrandir, localiser | haut droite, colonne | 44 × 44 px, verre |
| **Synthèse** | `N sorties · X km · D+ Y m` | bas gauche, au-dessus de la barre | 30 px, verre secondaire |
| **Légende / année** | Toutes / 2026 / 2025 | bas gauche, selon mode | 30 px, verre secondaire |
| **Attribution** | « Powered by Esri · © OpenStreetMap » | bas droit, 10 px | texte sur verre, lien crédits |
| **Callout** | titre, méta, action | ancré sur l'objet | carte verre 20 px, max 260 px |
| **État vide** | titre, phrase, CTA | centré | carte verre, pas de fond blanc |
| **Voile de contexte** | assombrit la carte derrière un drawer | plein cadre | 12–18 %, transition 300 ms |

### 3.3 Les informations de la fiche (callout)

**Sortie :**
- titre réel (`hike_sessions.title` ou nom de l'itinéraire) ;
- date, distance, D+, altitude max ;
- badge « Trace GPS vérifiée » si ≥ 2 points ;
- nombre de photos, nombre de compagnons ;
- action « Voir la sortie » → drawer Sortie.

**Massif :**
- nom réel, nombre de sorties ;
- pays si `country_code` réel ;
- action « Voir les sorties » → ouvre le slot Souvenirs.

**Carnet :**
- titre du carnet, sortie liée ;
- action « Ouvrir le carnet » → `/carnets/[id]`.

**POI :**
- label réel, jour si fourni ;
- action « Voir la sortie ».

Aucune fiche ne s'ouvre sur un objet sans données : le tap est ignoré ou le
callout affiche un état « information indisponible », jamais un faux contenu.

---

## 4. Matrice par contexte

La carte ne montre **pas tout** dans tous les drawers. Chaque contexte a un
rôle, un cadrage et un niveau de détail.

| Contexte | Caméra | Calques | Interface | Interaction | Vide / neutre |
|---|---|---|---|---|---|
| **Aucun drawer** | fit de toutes les traces ; sinon globe France | traces + massifs + départs | capsule « Ta carte », échelle, contrôles, synthèse | tap sortie/massif, recentrer, agrandir | « Ta carte se dessine à ta première sortie. » + CTA |
| **Profil · Vitrine** | fit des traces | traces + massifs | capsule « Vitrine » + stats | tap massif | « Aucune sortie publiée. » |
| **Profil · Kit** | fit des traces liées à un kit | traces avec `kit_id` + massifs | capsule « Kit » + compteur | tap sortie | « Aucune sortie liée à un kit. » |
| **Profil · Prêts** | caméra conservée, pas de fit | aucun calque de données | capsule « Prêts » | aucune | « Les prêts n'ont pas de position. Les lieux de vie ne sont jamais publiés. » |
| **Profil · Souvenirs** | fit des traces de l'année | traces + massifs + carnets + POI | capsule « Souvenirs » + année | tap carnet, tap massif, filtre année | « Aucun souvenir géolocalisé. » |
| **Profil · Communauté** | fit des sorties partagées | traces avec participants + massifs | capsule « Communauté » + compteur | tap sortie | « Aucune sortie partagée géolocalisée. » |
| **Compte** | caméra conservée | aucun | aucune (le drawer est le contenu) | aucune | voile 18 %, pas de carte de message |
| **Réseau** | caméra conservée | aucun | aucune | aucune | « Le réseau n'est pas une carte. Aucune position de tes relations n'est exposée. » |
| **Sortie** | fit de la sortie, pitch 45° | trace sélectionnée + POI + départ/arrivée | capsule titre + km/D+ | tap POI, fermer | « Trace GPS non enregistrée pour cette sortie. » + massif si réel |
| **Invité** | globe France | aucun | capsule « Ta carte » + CTA connexion | CTA | « Connecte-toi pour voir ta carte. » |
| **Chargement** | fond neutre | aucun | squelette verre | aucune | squelettes, pas de faux marqueurs |
| **Erreur** | fond neutre | aucun | carte d'erreur + Réessayer | retry | « Impossible de charger ta carte. » |
| **WebGL indisponible** | projection SVG réelle | traces + massifs en SVG | capsule + contrôles | tap | « Carte simplifiée » (pas « indisponible ») |
| **Hors ligne** | dernière vue | dernières données en cache | capsule + badge « Hors ligne » | aucune navigation réseau | « Dernières données enregistrées. » |

**Précisions :**

- **Prêts / Réseau** n'ont aucune coordonnée réelle. On ne fabrique ni ville,
  ni massif, ni position de personne. Le message est explicite et court.
- **Compte** : le drawer couvre la carte ; inutile d'ajouter un message qui
  ferait doublon. On conserve la dernière vue, voilée, sans interface.
- **Communauté** : seules les sorties avec au moins un participant réel
  (`hike_session_participants`) sont montrées. Les clubs et événements n'ont
  pas de coordonnées : ils ne deviennent pas des punaises.
- **Souvenirs** : le filtre d'année du drawer émet un événement
  `lkdv:compte-map-year` ; la carte s'y aligne sans dupliquer le filtre.
- **Sortie** : une seule trace, plus les POI réels de cette sortie. Les autres
  sorties sont masquées pour éviter la confusion.

---

## 5. Grammaire visuelle — le verre de la barre du bas

### 5.1 La référence mesurée

La barre du bas (`#tb.lg`) en production, à 430 px :

```
height: 48px
border-radius: 999px
background: linear-gradient(
  180deg,
  rgba(255,255,255,.486),
  rgba(255,255,255,.325) 55%,
  rgba(255,255,255,.404)
)
backdrop-filter: blur(4px) saturate(1.9) brightness(1.07)
box-shadow:
  inset 0 1px 0 rgba(255,255,255,.9),
  inset 0 -1px 1px rgba(255,255,255,.45),
  inset 1px 0 1px rgba(255,255,255,.28),
  inset -1px 0 1px rgba(255,255,255,.28),
  inset 0 0 12px rgba(255,255,255,.14),
  0 0 0 .5px rgba(23,43,36,.14),
  0 8px 22px rgba(23,43,36,.12)
color: #172B24
font: 14px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif
```

La lentille active reprend la recette de `.lkdv-capsule .sel-lens` :

```
background: linear-gradient(180deg, rgba(255,255,255,.62), rgba(255,255,255,.26))
box-shadow:
  inset 0 1px 0 #fff,
  inset 0 -1px 1px rgba(255,255,255,.5),
  0 0 0 .5px rgba(23,43,36,.07),
  0 2px 8px rgba(23,43,36,.08)
transition: transform 420ms cubic-bezier(.32,.72,0,1)
```

### 5.2 Les composants carte

| Composant | Hauteur | Rayon | Padding | Texte | Remarque |
|---|---|---|---|---|---|
| Capsule principale | 48 px | 999 | 3 px | 13 px / 600 | même ombre que `#tb` |
| Capsule secondaire | 30 px | 999 | 2.5 px | 11 px / 600 | même recette que `.lkdv-lens-float` |
| Contrôle rond | 44 px | 50 % | 0 | icône 17 px | cible tactile 44 px |
| Pastille massif | 30 px | 999 | 0 10 px | 11 px / 600 | nom + compteur |
| Point de sortie | 12 px | 50 % | — | — | blanc 2 px, ombre douce |
| Callout | auto | 20 px | 12 px | 13 px / 11 px | max 260 px |
| Carte d'état | auto | 22 px | 18 px | 15 px / 12 px | max 300 px |
| Attribution | 22 px | 999 | 0 8 px | 10 px | opacité .72 |

Aucune surface opaque : le fond reste le verre. Les cartes d'état et le callout
utilisent `rgba(255,255,255,.72)` + blur 20 px, jamais `#fff`.

### 5.3 Couleurs

Uniquement les tokens existants :

- encre : `#17402C` (`--lkv-primary`) ;
- encre secondaire : `#365233` / `#5A7064` ;
- sauge : `#5B7F55` ;
- alerte : `#C89A3B` ;
- danger : `#A8443A` ;
- blanc : `#FFFFFF`.

Les tracés utilisent l'encre, le halo la sauge, la sélection l'alerte. La
couleur n'est jamais le seul signal : chaque état a aussi un texte ou une forme.

### 5.4 Ce qu'on retire

- le badge `.lkdv-map-context-badge` blanc 26 px ;
- le panneau `#mopts` et ses 8 calques ;
- `.map-scale-selector` et `#mctl` actuels (remplacés par la capsule et les
  contrôles React) ;
- le filtre `saturate(.6) brightness(.97)` posé par `.mapzone[data-map-context]`
  (remplacé par un voile dosé et animé) ;
- tout `!important` nouveau : les styles carte sont scopés sous `.lkdv-map-root`.

---

## 6. Mouvement

### 6.1 Table

| Action | Animation | Durée | Courbe | Reduced motion |
|---|---|---|---|---|
| Premier affichage | fondu du canvas + fit depuis le globe | 900–1200 ms | `cubic-bezier(.32,.72,0,1)` | saut |
| Changement de mode | fondu des calques sortants, fit, fondu des entrants | 180 + 700 + 220 ms | idem | saut |
| Sélection d'une sortie | `flyTo` centre + zoom 12,4, pitch 45° | 1200 ms | Van Wijk (curve 1.42) | saut |
| Sélection d'un massif | `flyTo` zoom 9, pitch 30° | 900 ms | idem | saut |
| Globe / Massif / Sentier | `flyTo` 3 paliers | 1200 / 1600 / 1800 ms | idem | saut |
| Ouverture d'un drawer | interface carte opacité 1 → 0 ; voile 0 → 1 | 160 / 300 ms | ease-out | instantané |
| Fermeture d'un drawer | interface 0 → 1 ; voile 1 → 0 | 220 / 300 ms | ease-out | instantané |
| Appui sur un marqueur | échelle .94 → 1 | 180 ms | spring | instantané |
| Callout | opacité 0 → 1, translation 4 px, échelle .96 → 1 | 180 ms | ease-out | instantané |
| Halo de sélection | 2 pulsations | 2 × 1,6 s | ease-in-out | aucune |
| `mapbig` | redimensionnement + ajustement du padding | 450 ms | `cubic-bezier(.32,.72,0,1)` | saut |
| Déplacement natif | inertie MapLibre | linearity .3, maxSpeed 1400, deceleration 2500 | — | — |

### 6.2 Règles

- **Pas d'animation en boucle** en dehors du halo de sélection (2 cycles).
- **Pas de parallaxe** sur les contrôles : le verre reste stable pendant le pan.
- **Pas de `flyTo` à l'ouverture d'un drawer** sauf pour `Sortie` : sinon la
  carte bouge sous le doigt alors que l'utilisateur lit.
- **Un seul vol à la fois** : toute nouvelle intention caméra annule la
  précédente (`map.stop()`).
- **Le padding tient compte de la feuille** : quand un drawer est ouvert, le
  fit se fait sur la hauteur totale du téléphone, pas sur la bande visible.
- **Le voile n'est pas un fond blanc** : `rgba(11,16,27,.14)` + désaturation
  légère, jamais un `#fff` translucide.
- **Haptique** : sélection (light), changement d'échelle (medium), ouverture
  de sortie (medium). Jamais sur un simple pan.

---

## 7. Données et API

### 7.1 Endpoint

`GET /api/compte/map`

- Authentification obligatoire (`requireUser`), sinon 401.
- Aucun paramètre obligatoire. La carte charge une fois, filtre en mémoire.
- `Cache-Control: no-store`.
- Réponse :

```ts
interface CompteMapPayload {
  tracks: MapTrack[];
  massifs: MapMassif[];
  carnets: MapCarnet[];
  pois: MapPoi[];
  stats: {
    outings: number;
    km: number;
    dplus: number;
    massifs: number;
    countries: number;
  };
  bounds: [number, number, number, number] | null;
  truncated: boolean;
  generatedAt: string;
}
```

### 7.2 Requêtes serveur

1. **Sorties récentes avec géométrie** — 80 maximum :
   `id, title, started_at, ended_at, distance_km, elevation_gain_m,
   max_altitude_m, positions_geojson, visibility, kit_id, carnet_id, poi_events`
   filtrées `user_id = auth.uid()`.
2. **Toutes les sorties sans géométrie** — pour les stats et les massifs :
   `id, route_id, started_at, ended_at, distance_km, elevation_gain_m`.
3. **Itinéraires** — `hiking_routes(id, name, region)` pour les `route_id`.
4. **Massifs** — `geo_massifs(geoname_id, feature_code, name, name_plain,
   country_code, lat, lon, elevation_m)` pour les régions trouvées.
5. **Photos** — `hike_session_photos(session_id)` pour les sorties affichées
   (compteur uniquement).
6. **Participants** — `hike_session_participants(session_id)` pour les sorties
   affichées (compteur + mode Communauté).
7. **Carnets** — `carnets(id, title, cover_image)` pour les `carnet_id` réels.

Aucune clé service. Aucune lecture d'un autre utilisateur.

### 7.3 Simplification

- `positions_geojson` peut contenir des milliers de points.
- Chaque trace est simplifiée à **120 points maximum** (Douglas-Peucker puis
  échantillonnage uniforme si nécessaire), extrémités conservées.
- 80 traces × 120 points ≈ 9 600 points, soit un payload JSON d'environ
  150–220 Ko avant gzip. Budget cible : **≤ 250 Ko**.
- Si plus de 80 sorties : `truncated: true`, l'interface affiche
  « 80 sorties affichées sur N ». Le reste n'est pas inventé.

### 7.4 Règles de données

- Coordonnée non finie, hors `[-180, 180] × [-90, 90]` : rejetée.
- Trace de moins de 2 points valides : pas de tracé, mais la sortie reste
  comptée dans les stats et peut apparaître dans le drawer.
- Massif sans ligne `geo_massifs` : pas de pastille. Le nom reste dans la
  sortie, mais aucune coordonnée n'est inventée.
- Carnet sans sortie géolocalisée : pas de pastille.
- POI sans `lat/lng` : ignoré.
- Photo sans coordonnée : pas de punaise ; compteur seulement.
- `visibility` d'une sortie : la carte du propriétaire montre tout ; une
  future carte publique devra filtrer. Le présent chantier ne sert que le
  propriétaire.

### 7.5 Migration

Une seule migration additive :

```sql
create index if not exists idx_hike_sessions_user_started
  on public.hike_sessions (user_id, started_at desc);
```

Aucune colonne nouvelle. Les coordonnées de photo ne sont pas ajoutées dans ce
chantier : sans flux de capture réel, une colonne vide ne produirait que des
punaises absentes.

---

## 8. Architecture technique

### 8.1 Principe

Le runtime vanilla garde la feuille, les gestes et la coquille. **La carte
devient un îlot React** monté dans le nœud existant `#maplibre-compte-canvas`,
comme les drawers React sont montés dans `#lkdv-drawer-root`.

Le runtime ne crée plus de `maplibregl.Map`. Il fournit :

- le nœud DOM ;
- le contexte courant (`mode`, `detent`, `outingId`, `year`) ;
- les actions de navigation (`openOutingDrawer`, `openCarnet`).

React fournit :

- l'instance MapLibre, le style, les sources, les calques ;
- la caméra, les marqueurs, le callout ;
- l'interface verre et les états.

### 8.2 Fichiers

```
src/features/compte/map/
  types.ts                  contrat de données
  geometry.ts               parsing, simplification, bornes
  modes.ts                  matrice mode → calques / caméra / HUD
  server/loadCompteMap.ts   lectures Supabase + assemblage
  __tests__/geometry.test.ts
  __tests__/modes.test.ts
  __tests__/loadCompteMap.test.ts

src/app/api/compte/map/route.ts

src/components/compte/map/
  CompteMap.tsx             îlot React, cycle de vie MapLibre
  CompteMapHud.tsx          capsules, contrôles, synthèse
  CompteMapCallout.tsx      fiche verre
  CompteMapFallback.tsx     SVG réel si WebGL absent
  compte-map.css            styles scopés .lkdv-map-root
  __tests__/CompteMapHud.test.tsx
  __tests__/CompteMapStates.test.tsx
```

Modifications :

- `src/components/compte/CompteLiquidGlassV8.tsx` : portail du map root,
  réception du contexte, arrêt de l'import `maplibregl`.
- `src/components/compte/compte-liquid-glass-v8-runtime.js` : suppression de
  `setup3DMap`, émission du contexte, suppression des anciens contrôles.
- `src/components/compte/drawer/SlotShell.tsx` : retrait du badge de contexte
  et du filtre carte hérités.
- `src/components/compte/drawer/slots/MemoriesSlot.tsx` : émission de
  `lkdv:compte-map-year` au changement d'année.

### 8.3 Démarrage MapLibre

```ts
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const map = new MapLibreMap({
  container,
  style: createMapStyle('satellite'),
  center: DEFAULT_CENTER, // [2.5, 46.5]
  zoom: 4.2,
  minZoom: 1.2,
  maxZoom: 18,
  maxPitch: 70,
  attributionControl: false,
  renderWorldCopies: false,
  locale: { 'Map.Title': 'Carte du compte' },
});
```

Règles :

- **Pas de `terrain` dans le style initial** : le relief est un hillshade
  ajouté après `style.load`, ou rien. On ne réintroduit pas le chemin qui a
  bloqué le chargement.
- **Readiness sur `style.load`**, pas sur `load` : c'est la pratique déjà
  validée par `UnifiedExplorerMap`.
- **Watchdog 4 s** : si `style.load` n'arrive pas, on affiche le fallback SVG
  réel et on journalise `map_style_timeout`. Jamais de spinner infini.
- **`setWorkerUrl` avant `new Map`**.
- **Aucun `sky` à la racine du style** (bug MapLibre v6.4.1 documenté).
- **Nettoyage** : `map.remove()`, `ResizeObserver.disconnect()`, annulation des
  `requestAnimationFrame`.

### 8.4 Pont runtime ↔ React

Le runtime expose :

```ts
window.__lkdvCompteMapContext = (ctx: CompteMapContext) => void;
window.__lkdvCompteMapState = ctx; // dernier état, pour le montage tardif
window.__lkdvCompteMapAction = (action: 'recenter' | 'fit-outing' | 'fit-massif', id?: string) => void;
```

React expose au runtime :

```ts
window.__lkdvCompteMapReady = true;
window.__lkdvCompteMapOpenOuting = (id: string) => void;
```

Le runtime émet le contexte dans `renderSheet()`, `setDet()` et
`finishClose()`. React s'abonne et met à jour la caméra/les calques. Aucun
`setState` du runtime ne déclenche un re-render React de la carte en boucle.

### 8.5 Nettoyage de l'ancien

Après validation du nouvel îlot :

- supprimer `setup3DMap()` et son appel ;
- supprimer `#tm`, `#mctl`, `.map-scale-selector`, `#mopts`, `#mgrab` ;
- remplacer `drawMap()` par un no-op documenté ;
- supprimer `applyMapContextLayers`, `restoreMapContextLayers`,
  `mapContextLayers`, `renderMopts`, `renderMctl` ;
- conserver `S.map.acc` pour la barre accessoire ;
- supprimer les imports `maplibregl` devenus inutiles.

Le retrait se fait en une tâche séparée, après que la nouvelle carte est verte,
pour ne pas mélanger un bug de migration et un bug de rendu.

---

## 9. États et cas limites

| État | Déclencheur | Rendu | Action |
|---|---|---|---|
| **Chargement** | bootstrap ou `/api/compte/map` en vol | fond neutre + squelettes verre | aucune |
| **Invité** | `authenticated !== true` | globe France + carte « Connecte-toi pour voir ta carte. » | `/connexion?redirect=/compte` |
| **Aucune sortie** | `tracks.length === 0` et `stats.outings === 0` | globe + « Ta carte se dessine à ta première sortie. » | `/compas` |
| **Sorties sans GPS** | `stats.outings > 0` mais `tracks.length === 0` | globe + « N sorties enregistrées, aucune trace GPS. » | « Voir mes sorties » (drawer) |
| **Aucun massif reconnu** | tracks mais `massifs.length === 0` | traces seules, pas de pastilles | — |
| **Kit sans sortie** | mode Kit et `tracks.filter(kitId).length === 0` | voile + « Aucune sortie liée à un kit. » | « Voir mes kits » |
| **Prêts** | mode Prêts | voile + message | aucune punaise |
| **Réseau** | mode Réseau | voile + message | aucune punaise |
| **Erreur API** | `isError` | carte d'erreur + « Réessayer » | refetch |
| **401** | session expirée | état invité | reconnexion |
| **WebGL absent** | test de contexte | fallback SVG réel + « Carte simplifiée » | — |
| **Tuiles indisponibles** | erreurs raster | fond de couleur + traces | message discret |
| **Hors ligne** | `navigator.onLine === false` | dernières données + badge | pas de requête |
| **Reduced motion** | media query | tous les vols en durée 0 | — |

---

## 10. Accessibilité, performance, vie privée

### 10.1 Accessibilité

- Toutes les cibles : 44 × 44 px minimum.
- `aria-label` explicite sur chaque contrôle (« Recentrer la carte », « Changer
  d'échelle », « Ouvrir la sortie du 12 octobre »).
- La carte a un résumé texte lisible par lecteur d'écran :
  « Carte de tes sorties : 12 sorties, 4 massifs, 351 km. »
- Le focus clavier est visible (`--lkv-focus-ring`).
- Les callouts sont atteignables au clavier (bouton de fermeture, action).
- La couleur ne porte jamais seule une information : statut = texte + forme.
- `prefers-reduced-motion` : aucun vol, aucune pulsation, aucun stagger.
- Contraste : encre `#17402C` sur verre blanc ≥ 7:1 ; texte secondaire
  `#365233` sur verre ≥ 4.5:1.

### 10.2 Performance

- MapLibre est déjà chargé par la page : pas de nouvelle librairie.
- Le worker est servi depuis `/public/maplibre/` (déjà copié au build).
- Payload carte ≤ 250 Ko, 80 traces, 120 points/trace.
- Pas de `backdrop-filter` sur chaque marqueur : seulement sur les capsules,
  le callout et les cartes d'état.
- Les marqueurs DOM sont limités aux massifs (≤ 12) ; les sorties sont des
  couches GeoJSON.
- `ResizeObserver` unique ; `map.resize()` throttlé.
- Pas de re-render React à chaque frame de pan : la caméra et les callouts
  sont mis à jour par MapLibre.
- Objectif : carte interactive ≤ 2,5 s sur 4G, pas de CLS.

### 10.3 Vie privée

- La carte du Compte est **propriétaire uniquement**. L'API exige une session
  et filtre `user_id`.
- Aucune position d'un autre utilisateur, aucun profil public, aucun follower.
- La géolocalisation de l'appareil n'est jamais demandée automatiquement ;
  le bouton « Ma position » demande la permission au clic.
- Les traces ne sont jamais envoyées à un tiers : seules les tuiles ArcGIS
  voient le viewport, pas les données.
- `Cache-Control: no-store` sur l'API.
- Le mode invité ne fait aucun appel à `/api/compte/map`.

---

## 11. Critères de réussite

1. En production, sur un compte avec au moins une sortie GPS :
   - `data-map-ready="true"` ;
   - `map.isStyleLoaded() === true` ;
   - au moins une source `compte-tracks` et un marqueur massif ;
   - aucune erreur console.
2. Sur un compte sans sortie :
   - une seule carte d'état « Ta carte se dessine à ta première sortie. » ;
   - zéro marqueur, zéro trace, zéro massif.
3. En mode invité :
   - aucune requête `/api/compte/map` ;
   - CTA de connexion visible ;
   - zéro marqueur.
4. Chaque drawer change `data-map-mode` :
   - Vitrine, Kit, Prêts, Souvenirs, Communauté, Compte, Réseau, Sortie.
5. Le drawer Sortie affiche une seule trace et ses POI réels.
6. Les contrôles font 44 px, la capsule 48 px, la capsule secondaire 30 px.
7. Aucun `#fff` opaque, aucun nouveau token de couleur.
8. `prefers-reduced-motion` : aucun vol, aucune pulsation.
9. Payload ≤ 250 Ko ; 80 traces maximum.
10. Tests : géométrie, modes, API, HUD, états, E2E invité/vide/sortie, visuel
    430 × 932 et 390 × 844.

---

## 12. Hors périmètre

- Refonte de l'en-tête du profil et de la grille de stories.
- Contenu des drawers (déjà traité).
- Carte des profils publics (le profil public n'a pas de carte).
- Photos géolocalisées : nécessite une capture EXIF et une migration dédiée.
- Cache de tuiles hors ligne (service worker).
- Relief 3D terrain temps réel.
- Positions live des membres de la cordée.
- Carte des clubs et événements (pas de coordonnées réelles).
