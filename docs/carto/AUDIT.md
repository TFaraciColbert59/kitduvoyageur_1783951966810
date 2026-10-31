# CARTO · Audit (2026-10-31)

Branche : `main` @ `d065897eb` (worktree `/Users/fr168256/Desktop/lkdv-explorer-v2`).
Aucune modification de HUB ni de Compas n'a été faite avant cet audit.

## 1. Moteur partagé existant (travail de Claude, « chantier ATLAS »)

| Fichier | Rôle |
|---|---|
| `src/components/map/engine/createMapStyle.ts` | style MapLibre construit depuis la palette LKDV ; 3 modes `topo \| osm \| satellite` ; sources OpenFreeMap (vecteur) + ArcGIS (raster, clé `NEXT_PUBLIC_ARCGIS_API_KEY`) |
| `src/components/map/engine/standardBase.ts` | fond « Clair » OpenFreeMap, repli documenté |
| `src/components/map/engine/{camera,geo,icons,mapTheme,leafletTiles,poiTooltip,poiPopupPlacement}.ts` | primitives (caméra, géométrie, icônes, palette, tuiles Leaflet, tooltips) |
| `src/components/map/UnifiedExplorerMap.tsx` | carte unifiée (globe + sentiers + densité) |
| `src/components/map/UnifiedCountryGlobe.tsx` | globe pays |
| `src/components/map/InteractiveMap.tsx` | carte générique |
| `src/components/map/hooks/useViewportData.ts` + `layers/densityLayers.ts` | données viewport, densité |

**Conclusion** : il existe déjà un moteur partagé, avec satellite ArcGIS. La refonte
consiste à **l'étendre** (base Maptoolkit Hiking 3D + hybride) et à migrer les
consommateurs, pas à repartir de zéro.

## 2. Consommateurs recensés (imports du moteur partagé)

Migrables : `carte-interactive/CarteClient`, `carnet/profile/CarnetTraceMap`,
`compte/map/CompteMap`, `explorer/ExplorerMap`, `groupes/ParcoursCard`,
`pays/PaysRightSidebar`, `community/create/CarnetMapDrawer`,
`community/reels/FreedomKitDrawer`, `materiel/depart/DepartMap`,
`messaging/TraceMap`, `trips/domain/{dayTraces,trailToActivity}`,
`features/explorer-v2/map/MapStage`.

**Interdits (HUB / Compas)** :
`components/hub/HubMiniMap.tsx`, `features/hub/components/mobile/HubGlobeMap.tsx`,
`features/hub/components/mobile/HubRouteMap.tsx`, `features/hub/hooks/useHubSwipeNav.ts`,
`features/compas/**` (moteur propre : `compas/engine/mapStyle.ts`, `compas/v5/map/LiveMap.tsx`,
`compas/components/useCompasController.ts`).

## 3. Maptoolkit — vérifications faites le 2026-10-31

| Point | Résultat |
|---|---|
| `styles.maptoolkit.org/hiking-3d.json` | **200**, 158 839 octets, MapLibre v8, 133 couches, `terrain` (`rgb-tiles`, exaggeration 1), `sky`, 4 `hillshade`, `color-relief` |
| `styles.maptoolkit.org/hiking.json` | **200**, identique **sans** `terrain` |
| Sources | `mtk` (vecteur, `tiles.maptoolkit.org/mtk-contours.json`), DEM `terrainrgb`, `bathymetry`, `naturalearth`, `rocks` |
| Glyphes / sprites | `fonts.maptoolkit.org`, `icons.maptoolkit.org` |
| Tuile test `…/mtk-contours/12/2098/1445.mvt` | **200**, 81 980 octets, sans clé |
| Licence | Community License (Toursprung GmbH), **professionnelle uniquement** |

### Contraintes de licence à respecter (extraites du TOS du 1er juillet 2026)

1. **Éligibilité** : usage professionnel ; Community License si usage non commercial,
   open source non exploité, **ou** « small commercial » = **CA < 1 M€ et < 10 ETP**.
   → À confirmer par Tony (condition bloquante si dépassée).
2. **Attribution obligatoire** : logo Maptoolkit **≥ 24 px** + ligne
   `© Maptoolkit © Openstreetmap` en **bas à droite**, liens actifs, **jamais masqués**.
   Manquement = rupture matérielle. Helper officiel : `@maptoolkit/maplibre-gl-logo`.
3. **Interdits** : téléchargement/miroir en masse, **jeux de tuiles hors ligne**,
   rendu serveur non interactif, impression, revente, entraînement de modèles.
   → **La zone hors ligne de l'Explorer ne doit jamais mettre en cache des tuiles Maptoolkit.**
4. **Styles** : copie, modification et auto-hébergement autorisés **si** toutes les
   références de tuiles/glyphes/sprites restent sur les domaines officiels Maptoolkit.
5. **Débit** : 10 req/s non cachées non enregistré, 100 req/s avec Referer enregistré.
   Aucun SLA.

## 4. Satellite

Le projet utilise déjà **ArcGIS World Imagery** (`ibasemaps-api.arcgis.com`, clé
`NEXT_PUBLIC_ARCGIS_API_KEY`), gratuit jusqu'à 2 M tuiles/mois puis coupé, attribution
« Powered by Esri » obligatoire. C'est la source retenue pour l'hybride : elle est
déjà licenciée dans le projet, mondiale, et compatible MapLibre raster.

**Hybride** = ArcGIS imagerie (raster, sous tout) + DEM Maptoolkit (`rgb-tiles`) pour
le relief 3D + couches vectorielles Maptoolkit (sentiers, courbes, POI) + données LKDV.

## 5. Risques identifiés

| Risque | Parade |
|---|---|
| Casser HUB/Compas en modifiant `engine/*` | `engine/*` **inchangé** ; nouveau module `src/features/carto/` ; HUB garde l'ancien import |
| Quota ArcGIS (2 M tuiles) | mode satellite **opt-in**, pas de préchargement, cache navigateur standard |
| Cache hors ligne des tuiles Maptoolkit | liste blanche du service worker (OpenFreeMap + AWS DEM uniquement) |
| Attribution masquée par le tiroir Explorer | contrôle d'attribution dédié, hors de la zone du tiroir |
| Éligibilité Community License | à confirmer par Tony avant mise en production |
