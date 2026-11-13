# 02 · Architecture cible

## 1. Principes
- Une page, une carte, un tiroir. L’état de l’écran est **une seule machine d’état** (`useExplorerStore`, zustand) ; la carte et le tiroir ne font que la lire.
- Rien ne bloque l’affichage : shell + squelette globe en < 1 s, carte chargée en différé, données en flux.
- Serveur pour la géo lourde (PostGIS), Web Worker pour les calculs client, natif seulement là où le web ne peut pas (Live Activity, haptique, GPS fond).
- Zéro donnée inventée : chaque champ affiché a une source dans `05_DONNEES.md`, sinon il est masqué.

## 2. Arborescence
```
src/app/explorer/page.tsx                 // RSC : flag, position approx., préchargements
src/features/explorer-v2/
  ExplorerV2.tsx                          // client root, monte carte + chrome + tiroir
  state/store.ts                          // zustand : machine d’état (§3)
  state/scenes.ts                         // scènes nommées = états de la maquette (tests)
  state/haptics.ts                        // table événement → haptique (09_DESIGN §6)
  map/MapStage.tsx                        // MapLibre, chargé en dynamic import
  map/style.ts                            // style clair/sombre, sources
  map/layers/{countries,regions,trails,pois,friends,user,traces}.ts
  map/hierarchy.ts                        // règles d’affichage (04_CARTE §1)
  map/camera.ts                           // 6 mouvements + suivi (04_CARTE §3)
  chrome/{SearchCapsule,Breadcrumb,LayersButton,CompassButton,SosButton,Guidance,Toast}.tsx
  sheet/ExplorerSheet.tsx                 // feuille à crans + capsule d’onglets + lentille + mini-sélecteur
  sheet/kinds/*.tsx                       // un fichier par type de tiroir (03_ECRANS)
  activity/{useActivity,tracker,LiveSheet,Countdown,Summary}.ts(x)
  native/liveActivity.ts                  // pont Capacitor (no-op web)
  workers/geo.worker.ts                   // simplification, profil, hors-trace, isochrone
  data/*.ts                               // hooks react-query par source
crates/lkdv-geo/                          // Rust → wasm (optionnel, §8)
ios/App/App/LiveActivity/*.swift          // plugin local ActivityKit
supabase/migrations/2026110*_explorer_v2_*.sql
tests/explorer-v2/*.spec.ts
```

## 3. Machine d’état (calquée sur la maquette)
```ts
type Level = 0|1|2|3;               // monde, pays, région, lieu
type Geo = string;                  // ISO2 du pays courant ('' = pays de l’utilisateur)
type Detent = 'peek'|'low'|'mid'|'full';
type Sport = 'course'|'rando'|'velo'|'kayak'|'trail'|'ski'|'escalade'|'famille'|'bivouac';
interface ExplorerState {
  level: Level; geo: Geo; regionId?: string; placeId?: string;
  sheet: SheetKind; detent: Detent; tab: number; mini: 0|1;
  selection?: { kind: PoiKind; id: string };
  activity?: { sport: Sport; sessionId: string; startedAt: number; paused: boolean; offRoute: boolean };
  camera: CameraIntent;              // dérivée, jamais saisie à la main
  profile: 'solo'|'famille'|'enfants'|'senior'|'pmr'|'sportif'|null;
  easyMode: boolean; theme: 'light'|'dark'; online: boolean; locationPermission: 'granted'|'denied'|'prompt';
  orbitPaused: boolean; reveal: boolean; background: boolean; toast?: { title: string; sub: string };
}
```
`SheetKind` = `welcome | noLocation | level | previewCountry | search | layers | offline | summit | water | trail | depart | refuge | bivouac | viewpoint | danger | access | friend | start | live | sos | summary | easy`.
Les 42 écrans de la maquette = 42 valeurs de `scenes.ts` (`maquette/ecrans.json` → champ `scene`). Un paramètre `?scene=` (dev et tests uniquement, désactivé en production) charge une scène pour les tests et la parité.

## 4. Carte
- MapLibre GL 6 déjà présent. Projection `globe` aux niveaux 0–1, `mercator` à partir du niveau 2 (transition gérée par MapLibre).
- Relief : source `raster-dem` terrarium (AWS Terrain Tiles), `setTerrain({exaggeration:1.3})` dès zoom ≥ 9, `hillshade` sous les étiquettes.
- Sources : OpenFreeMap (fond), `countries` (GeoJSON simplifié statique en CDN Next, 110m/50m), `regions` (GeoJSON par pays à la demande depuis l’API, mis en cache), `trails` (RPC viewport → GeoJSON, puis tuiles MVT si > 2 000 entités), `pois`, `reports`, `friends`, `activity-track`.
- Un seul composant monte la carte une fois ; changer de niveau ne recrée jamais la carte.

## 5. Tiroir
`ExplorerSheet` = feuille à crans (peek 168 px, low 300, mid 52 %, full 88 % de la hauteur), poignée, en-tête (titre, sous-titre, ≤ 2 boutons icône), capsule d’onglets (actif = icône + libellé), volets à lentille, mini-sélecteur bas droite seulement pour : Région (été/hiver), Lieu (2D/3D), Itinéraire (carte/survol). Glisser = suivi au doigt (framer-motion `drag`, déjà dans le bundle), relâcher = cran le plus proche selon vitesse. Jamais de voile ni de croix.

## 6. API (nouvelles routes, toutes Zod + rate limit + cache HTTP)
| Route | Rôle | Cache |
|---|---|---|
| `GET /api/explorer/v2/countries` | pays (géom. simplifiée, faits pratiques) | 7 j, CDN |
| `GET /api/explorer/v2/regions?country=FR` | régions niv. 1 | 7 j |
| `GET /api/explorer/v2/place?lat&lng` | lieu, compteurs réels, conditions | 5 min |
| `GET /api/explorer/v2/pois?bbox&kinds&z` | repères hiérarchisés | 5 min, clé tuile |
| `GET /api/explorer/v2/weather?lat&lng` | MET Norway proxy (User-Agent, cache) | 30 min |
| `POST /api/explorer/v2/reports` | signalement (eau, danger…) | non |
| `POST /api/explorer/v2/activity` / `PATCH …/[id]` / `POST …/[id]/points` | session en direct | non |
| `POST /api/explorer/v2/sos` | alerte SOS | non |
| `GET /api/explorer/v2/search?q` | recherche texte + langage naturel | 1 min |

## 7. Natif
- Haptique : `@capacitor/haptics` via `triggerNativeHaptic`.
- GPS : `@capacitor/geolocation` (premier plan) ; écran maintenu allumé pendant l’activité ; suivi en arrière-plan en option (plugin communautaire gratuit) seulement si testable en CI, sinon consigné.
- Live Activity : plugin local Swift (ActivityKit) avec `start/update/end`, appelé quand l’app passe en arrière-plan. **Dans l’app, l’Island n’affiche rien** (règle iOS) : les messages passent par le bandeau toast.
- SOS : `tel:112` (ou numéro du pays) après confirmation, envoi position via `sos_alerts`.

## 8. Rust/WASM (seulement si mesuré utile)
Crate `crates/lkdv-geo` (wasm-bindgen, `wasm-pack build --target web`) exposant : `simplify(track, tol)`, `profile(track, demTiles)`, `distance_to_route(point, route)`, `isochrone(dem, start, minutes, tobler)`. Exécuté dans `geo.worker.ts`. **Règle** : implémenter d’abord en TypeScript, mesurer (`scripts/explorer-v2/bench-geo.mjs`), passer au WASM uniquement si gain ≥ 2× et wasm ≤ 150 Ko gz. Pas de serveur de tuiles Rust (budget 0 € : pas d’hébergement dédié).

## 9. Performance (budgets bloquants)
| Mesure | Budget |
|---|---|
| First Load JS `/explorer` (hors chunk MapLibre différé) | ≤ 170 Ko |
| LCP mobile (Lighthouse, 4G lente) | ≤ 2,0 s |
| INP | ≤ 100 ms |
| Premier rendu de carte après shell | ≤ 1,5 s |
| Frames pendant un mouvement de caméra | ≥ 55 i/s médian, aucune > 50 ms (trace Playwright) |
| Requêtes au démarrage | ≤ 12 hors tuiles |
| Mémoire après 10 min d’activité simulée | < +40 Mo |

## 10. Sécurité
RLS sur toute nouvelle table, politiques testées par intrusion (`.agents/test_rls_intrusion.mjs`), clé service uniquement serveur, Zod sur chaque entrée, limitation de débit, `bbox` bornée côté RPC, positions arrondies à 3 décimales pour les non-amis, purge automatique des positions (24 h), CSP à jour, aucun secret dans le client, journaux sans coordonnées précises.
