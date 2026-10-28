# 01 · Audit de l’existant (vérifié le 27/10/2026)

Audit fait sur `main` au commit `4969d92` et sur la BDD active `icxyvwzfjbflcbqukpfz` (Postgres 17, eu-west-3) par requêtes SQL directes. **Revérifie chaque chiffre en phase 0** : la base vit.

## 1. Règle générale
Réutiliser tout ce qui marche et ne ralentit pas. Recréer seulement si l’existant bloque, ralentit ou contredit la maquette. Chaque remplacement = une ligne dans `DECISIONS.md`.

## 2. Front-end existant
| Élément | Chemin | Verdict |
|---|---|---|
| Page actuelle | `src/app/explorer/page.tsx` (62 l.) + `src/components/explorer/ExplorerClient.tsx` (1 404 l.) | **Remplacer** par v2 derrière le flag `explorer_v2_enabled` ; supprimer à la phase 10 |
| Moteur ATLAS | `src/components/map/UnifiedExplorerMap.tsx` (1 757 l., MapLibre 6, projection globe) | **Réutiliser les briques** (sources, couches densité, POI, membres), mais l’extraire en modules `src/features/explorer-v2/map/*`. Ne pas l’importer tel quel : trop monolithique pour la caméra pilotée par état |
| Caméra | `src/components/map/engine/camera.ts` (`flyToTarget`, `easeToTarget`) | **Réutiliser et étendre** avec les 6 mouvements (`04_CARTE.md §3`) |
| Style carte | `src/components/map/engine/createMapStyle.ts`, `mapTheme.ts`, `standardBase.ts`, `icons.ts` | **Réutiliser** ; ajouter un thème « Explorer v2 » (clair + sombre) |
| Relief 3D | `src/features/carte-3d/components/Carte3DMap.tsx` (AWS Terrain Tiles `terrarium`, gratuit) | **Réutiliser la source DEM** et le réglage d’exagération |
| Tuiles vecteur | OpenFreeMap (`OPENFREEMAP_STYLE_URL`, gratuit, sans clé) | **Garder** |
| Tiroir | `src/components/compte/drawer/shell/DrawerShell.tsx`, `LensPager.tsx`, `SlotSelector.tsx`, `src/components/ui/CapsuleTabs.tsx` | **Réutiliser** la grammaire (poignée, capsule d’onglets, lentille, mini-sélecteur) ; ajouter les crans de feuille (peek/low/mid/full) dans un `ExplorerSheet` qui compose ces briques |
| Barre basse | `src/components/navigation/IOS27BottomBar.tsx` (commit `4969d92`, unifiée partout) | **Réutiliser** ; ajouter le mode « activité » (pastille + commandes) via props |
| Navigation | `src/components/mobile-nav/MobileNavWrapper.tsx`, `destinationRegistry.ts` | Déclarer `/explorer` correctement (une seule barre) |
| Haptique | `src/hooks/useHapticFeedback.ts` → `src/lib/native/haptics.ts` (`triggerNativeHaptic`) | **Réutiliser** ; étendre les styles (selection, impact light/medium/heavy/rigid, notification success/warning/error) |
| Fiche POI OSM | `src/components/explorer/OsmPoiSheet.tsx`, `TrailDetailPanel.tsx` | Récupérer la logique de données, pas l’UI |
| Services OSM | `src/features/explorer-osm/**` (Overpass + cache + normalisation, testés) | **Réutiliser tels quels** |
| API Explorer | `src/app/api/explorer/osm/{pois,routes,route/[id],materialize}` | **Réutiliser** ; ajouter les routes v2 (`02_ARCHITECTURE.md §6`) |
| CSP | `csp.config.mjs` + `tests/security/csp-*.spec.ts` | **Mettre à jour** pour chaque nouvelle origine, tests à garder verts |
| Natif | `capacitor.config.ts`, `ios/App`, `@capacitor/haptics`, `@capacitor/geolocation` installés | Ajouter le plugin local Live Activity (Swift) |
| CI | `.github/workflows/{ci,ios,ios-testflight,lighthouse-ci,visual-regression}.yml` | **Réutiliser** ; ajouter le job `explorer-v2` |
| Tests | `playwright.config.ts` (projets `desktop-chromium`, `mobile-webkit`, `mobile-chromium`), `playwright.visual/a11y/glass.config.ts`, Vitest | **Réutiliser** les projets et configs |
| Skills dépôt | `.agents/skills/*` (dont `lkdv-ios27-page-refonte`, `map-geospatial`, `supabase-postgis`, `testing-qa`, `verification-before-completion`) | **Lire et suivre** ; exceptions Explorer listées dans `00_MISSION.md §8` |

Dette connue à ne pas aggraver : First Load JS de `/explorer` à 265 Ko (cible ≤ 170 Ko), 4 suites Vitest et 12 snapshots visuels déjà rouges avant ce chantier (ne pas les compter comme régressions, mais les lister dans le rapport final).

## 3. Base de données (chiffres réels du 27/10/2026)
| Objet | Lignes | RLS | Usage Explorer v2 | Constat |
|---|---|---|---|---|
| `countries_geo` | 246 (FR présent) | oui | Pays, langue, monnaie, fuseau, indicatif | **80 pays sans géométrie** (166/246) → importer Natural Earth ; **pas de numéros d’urgence ni prises** → table `country_practical` |
| `admin_regions_geo` | 49 617 (niv. 1 : 3 531, niv. 2 : 46 086) | oui | Régions | **Aucune géométrie** (0/49 617) → importer Natural Earth admin-1 simplifié |
| `geo_pois` | 112 400 | oui | Eau, sources, abris, camping, refuges | Sous-types présents : drinking_water 85 718, spring 7 725, shelter 6 474, camp_site 5 766, alpine_hut 4 579, wilderness_hut 2 138. **Manquent** sommets, belvédères, cols, parkings, arrêts → import Overpass |
| `hiking_routes` | 1 181 (géom. présente) | oui | Itinéraires (GR, PR) | Source principale des traces |
| `trail_segments` | **0** | oui | — | Vide : ne pas en dépendre (vérifier `trails_in_viewport`) |
| `trail_pois` | 1 811 | oui | Repères le long des traces | Réutiliser |
| `map_water_points` / `outdoor_points` | 10 / 25 | oui | — | Quasi vides ; fusionner dans `geo_pois` ou ignorer (décision consignée) |
| `terrain_reports` (+ confirmations, events) | 0 | oui | Signalements eau, danger, neige, fermeture | Mécanique complète (présent/disparu, sévérité, expiration) **à réutiliser** |
| `hike_sessions` (+ photos 75, kudos, comments, gear) | 136 | oui | Historique des sorties | `ended_at NOT NULL` → inadapté au direct. Créer `activity_sessions` pour le live, puis écrire le résumé compatible |
| `group_live_sessions` / `group_live_positions` | 1 / 0 | oui | Amis en direct | **Réutiliser** pour la position partagée (abonnés mutuels, expiration) |
| `sos_alerts` | 0 | oui | SOS | Colonnes minimales → étendre (précision, batterie, activité, statut) |
| `trips` + `depart_participants` | — / 4 | oui | Départs (« Créer un départ ») | Réutiliser `trips` (statut, dates, visibilité, places) |
| `activity_catalog` | 43 actifs | oui | Sports | Pas d’escalade → ajouter `escalade-voie` ; mapping des 9 sports en `05_DONNEES.md §4` |
| `carnets` / `carnet_moments` / `hike_session_photos` | 82 / 228 / 75 | oui | Carnets et photos | Réutiliser |
| `user_follows` | 1 027 | oui | Amis, confiance | Réutiliser |
| `country_centroids`, `country_trail_density`, `trail_density_geohash5` | vues matérialisées | n/a | Densités globe | Vérifier les `GRANT` (pas de RLS possible sur une vue matérialisée) |
| `feature_flags` | — | oui | `explorer_unified_map_enabled` existe | Créer `explorer_v2_enabled` |

RPC existantes à réutiliser : `trails_in_viewport`, `get_routes_for_map`, `get_route_geojson`, `get_route_pois`, `get_route_deviation`, `get_route_offline_bbox`, `geo_pois_around`, `get_trail_pois_bbox`, `a5_terrain_reports_near`, `a11_merge_terrain_report`, `persist_processed_hike_session`, `refresh_atlas_density`. Les fonctions `compas_*` appartiennent à Compas : les lire, ne jamais les modifier.

## 4. Écarts entre maquette et existant (à combler)
1. Géométries régions et 80 pays manquantes → bloquent les niveaux Pays/Région.
2. Sommets, belvédères, accès absents de `geo_pois`.
3. Pas de session d’activité en direct, ni de flux de positions, ni de résumé multi-sport.
4. Pas de données pratiques pays (urgences, prises, conduite) en BDD.
5. Pas de plugin Live Activity natif.
6. Pas de hiérarchie d’affichage pilotée par niveau et activité (aujourd’hui : couches fixes).
7. Pas de mouvements de caméra orchestrés (orbite, révélation, suivi, vue d’ensemble).
8. Pas de zone hors-ligne téléchargeable.
9. Signalements terrain jamais alimentés (0 ligne) : les écrans doivent gérer l’état vide proprement.

## 5. Risques
| Risque | Parade |
|---|---|
| Bundle MapLibre (~230 Ko gz) | Chargé en différé après le shell ; squelette globe immédiat ; budget mesuré |
| Overpass rate-limit | Import par tuiles en tâche de fond avec le cache existant, jamais à l’ouverture d’écran |
| Tuiles OpenFreeMap et usage hors-ligne | Vérifier les conditions d’usage ; plafond de tuiles par zone ; consigner |
| Positions en direct = donnée sensible | RLS stricte, expiration, abonnés mutuels, coupure auto, jamais en clair dans les logs |
| SOS | Toujours confirmation + compte à rebours annulable ; aucun appel réel en test |
| Capture d’écran maquette ≠ rendu réel | Parité jugée sur structure, contenu, hiérarchie et couleurs, pas au pixel près |
