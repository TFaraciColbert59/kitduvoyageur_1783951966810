# Spécification 3D

## Dépendance
`three` (MIT), version fixée dans `package.json` (≥ 0.170, ESM, imports nommés pour le tree-shaking). Importé **uniquement** depuis `src/features/kit-studio/scene/`, chargé via `dynamic(() => import('…'), { ssr: false })`. Ajouter `three` à `transpilePackages` s'il manque. Aucun CDN (la CSP bloque jsDelivr). Aucun modèle importé : géométries procédurales.

## Scène principale
- Un `WebGLRenderer` (`alpha`, `antialias` seulement si `devicePixelRatio ≤ 2`), `setPixelRatio(min(dpr, 2))`, `powerPreference: 'high-performance'`.
- Ombre : une seule lumière directionnelle, `PCFSoftShadowMap`, carte 1024, sol `ShadowMaterial`. Désactiver les ombres si la moyenne de 30 images dépasse 24 ms.
- **Boucle à la demande** : `renderer.setAnimationLoop` démarre quand quelque chose bouge (geste, amortissement, animation) et s'arrête 600 ms après le repos. `visibilitychange` et `pagehide` arrêtent la boucle. Objectif : 0 % CPU au repos.
- **Perte de contexte** : écouter `webglcontextlost` (`preventDefault`) et `webglcontextrestored` (reconstruire la scène depuis l'état) ; afficher en attendant une image fixe du dernier rendu.
- **Nettoyage** : tout `Geometry`, `Material`, `Texture`, `RenderTarget` est libéré (`dispose`) à chaque changement de sac, de kit, de pièce et au démontage ; un test compte `renderer.info.memory` avant/après 20 cycles (écart nul).
- Gestes via `PointerEvent` (orbite, inclinaison, pincement à deux pointeurs, double toucher), `touch-action: none` sur le canvas, alternatives clavier (flèches : orbite ; `+`/`−` : pièces séparées).

## Vignettes 3D des cartes
- **Un seul** second rendu hors écran (`WebGLRenderer` 256 × 256 à dpr 2, fond transparent) partagé par toutes les cartes, avec géométries et matériaux **partagés** avec la scène principale.
- Clé de cache : type d'objet + forme + couleur (ex. `b:b42:#2D482A:#3D6038:#1E301C`, `c:#5B7F55`). Résultat converti en `Blob` URL (ou `ImageBitmap`) et gardé en mémoire ; file d'attente (une vignette par frame, `requestIdleCallback`), les cartes visibles d'abord.
- Rendu de repli si WebGL indisponible : pictogramme SVG de la carte (`glyph`).
- Orientation des objets : 3/4 avant, légère contre-plongée, ombre au sol douce. Un sac est dessiné à `s = min(0,8 ; 0,8 × L/42)` pour rester dans la zone objet.

## Budget
Première image de scène < 1,2 s sur iPhone 16 Pro en 5G ; chargement du chunk 3D < 180 Ko gzip (hors `three` partagé) ; 60 images/s en orbite ; mémoire GPU < 150 Mo ; 12 vignettes en < 600 ms.

## Couleurs
Aucune couleur littérale dans le code neuf : coloris et couleurs d'objets viennent de `domain/palette.ts`, qui fait correspondre chaque coloris à des **tokens** `--lkv-*` (forest, sage, stone…) lus au démarrage via `getComputedStyle`. Les teintes d'objets du catalogue sont stockées comme **noms de matériau** (ex. `wool-green`), résolus par la palette.
