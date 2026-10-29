---
name: lkdv-explorer-v2-map
description: Use when touching the Explorer v2 MapLibre stage, layers, display hierarchy, trace styles, terrain, globe projection or camera movements.
---
# Carte Explorer v2 (MapLibre 6)

- Une instance unique (`map/MapStage.tsx`), importée en `dynamic(() => import(...), { ssr:false })`. Jamais recréée au changement de niveau.
- Réutilise `src/components/map/engine/{camera,createMapStyle,mapTheme,icons}.ts` et la source DEM terrarium de `src/features/carte-3d/components/Carte3DMap.tsx`.
- La caméra se dérive de l’état (`store.camera`) dans un seul effet ; les composants n’appellent jamais `flyTo` directement. Chaque intent a un id ; un nouvel intent annule l’animation précédente (`map.stop()`).
- `padding` de caméra = hauteur réelle du tiroir + Island + chrome, recalculé à chaque cran.
- Hiérarchie : `symbol-sort-key`, filtres par `zoom` et par `store.activity`, clustering GeoJSON (`clusterRadius` 50, `clusterMaxZoom` 14). Table complète : `04_CARTE.md §1`.
- Tracés : paint exacts `04_CARTE.md §2`. Partie parcourue via `line-gradient` (source avec `lineMetrics: true`), progression mise à jour au plus 4 fois par seconde.
- Orbite : boucle `requestAnimationFrame` sur `setBearing`, stoppée sur `mousedown/touchstart/wheel`, reprise après 6 s ; arrêtée si l’onglet est masqué.
- Survol : `map.setFreeCameraOptions` le long d’une trace rééchantillonnée tous les 25 m et lissée (moyenne glissante 200 m) ; profil altimétrique synchronisé par la même horloge.
- Mode suivi : `easeTo` 900 ms par fix GPS filtré ; cap lissé ; bascule nord/cap.
- `prefers-reduced-motion` : `jumpTo` + fondu CSS.
- Perf : pas de `setData` pendant une animation ; mises à jour groupées ; images d’icônes ajoutées une fois (`map.addImage` avec `pixelRatio` 2) ; mesurer les frames en test.
