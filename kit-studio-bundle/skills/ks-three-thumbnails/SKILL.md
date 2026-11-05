---
name: ks-three-thumbnails
description: Use for Kit Studio three.js work — scene lifecycle on iOS, on-demand render loop, context loss, shared thumbnail renderer with cache.
---
# three.js sur iPhone, sans fuite

- Boucle à la demande : démarrer sur geste ou amortissement, arrêter 600 ms après le repos ; `visibilitychange`/`pagehide` coupent.
- `webglcontextlost` : `event.preventDefault()`, geler l'affichage ; `webglcontextrestored` : reconstruire depuis le store.
- `dispose()` de chaque géométrie, matériau, texture, cible de rendu ; test : `renderer.info.memory` stable sur 20 cycles.
- Vignettes : **un** renderer 256×256 partagé, géométries et matériaux partagés avec la scène, cache par clé (`b:<sac>:<couleurs>`, `c:<couleur>`, `i:<objet>`), file d'attente à une vignette par frame, repli SVG.
- Rendu d'une vignette : caméra 3/4, `renderer.setClearColor(0,0)`, `toBlob` ou `createImageBitmap` ; ne jamais lire les pixels de façon synchrone dans la boucle.
- Performances : `setPixelRatio(min(dpr,2))`, ombres dégradables, pas d'`antialias` si dpr > 2, pas d'allocation dans la boucle (réutiliser `Vector3`, `Matrix4`).
- Mesurer d'abord : `performance.now()` sur 30 images, `renderer.info.render`, taille du chunk (`next build` + analyse).
- three importé par chemins nommés (`import { WebGLRenderer } from 'three'`), uniquement depuis `scene/`, chargé en `dynamic(…, { ssr: false })`.
- Documentation : `context7` (bibliothèque `three`), pas de recherche web.
