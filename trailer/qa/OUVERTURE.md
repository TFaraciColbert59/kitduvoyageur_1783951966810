# Ouverture « nébuleuse → système solaire → Terre » — cosmos-vfx

14/11/2026. Projet d'essai autonome `trailer/ouverture-lab/`, 1920×1080, **24 i/s**, **106 images (4,417 s)**, calé sur le montage musical v3. Rien n'a été modifié dans `trailer/film/`. Rien n'est commité.

## Ce qui est fait

Un seul mouvement de caméra, sans coupe ni fondu entre tableaux. C'est la matière qui se transforme :

| Images (calage v3) | Phase | Ce qu'on voit |
|---|---|---|
| 0–34 | Prélude (zéro numérique jusqu'à 13, entrée très douce vers 29) | Nébuleuse saturée magenta / violet / cyan / or, voiles de poussière sombres. Elle vit : rotation lente, déformation du gaz qui « respire », dérive, étoiles qui scintillent, avancée douce de la caméra (×1,47 sur le prélude), parallaxe de trois couches d'étoiles et d'un voile de fond. |
| 35–46 | Effondrement | Les gaz s'enroulent (rotation différentielle : le centre tourne plus vite) et tombent vers le centre (chute radiale), le nuage s'aplatit en disque incliné, une proto-étoile magenta-or s'allume au cœur. Accélération franche. |
| **47** | **Éclair du Soleil** (premier temps fort, 1,9405 s) | Pic d'une image (décroissance gaussienne d'environ 1 image de part et d'autre), cœur blanc chaud, aigrettes, voile or borné : luminance moyenne 0,44, 4,8 % de pixels au-dessus de 0,9 — jamais un écran blanc. Onde de choc qui creuse le centre du disque. |
| 48–53 | Disque et planètes | Disque doré et crème, anneaux, sillons ouverts par les planètes. Six planètes se condensent en grains (décalées d'un tiers d'image) et filent avec des traînées d'orbite lisibles ; un grain du disque passe de l'or au bleu : c'est la Terre. La rotation ralentit. |
| 53–58 | Plongée | La caméra se tourne vers le point bleu et plonge (zoom ×2 300 en 6 images) : gaz et étoiles filés en rayons, voiles qui défilent, le Soleil part en haut à droite et s'y pose. La Terre (procédurale : océans, continents, nuages, limbe cyan) grossit, puis la vraie plaque `img01` se fond dans son disque. |
| **59–105** | Terre d'aujourd'hui | À l'image 59 la Terre coïncide exactement avec `img01` (limbe mesuré, Soleil sur le limbe, Alpes). La poussée ralentit sans s'arrêter (×1,36 de 59 à 105) en visant les Alpes, l'horizon monte : la descente vers les nuages de P03 est amorcée. Fin sur la première note franche (image 106). |

## Technique

- `ouverture-lab/compositions/ouverture.html` : scène (identifiant `ouverture`), bloc CONFIG, plaque `img01` cachée, un `<canvas>` WebGL2.
- `ouverture-lab/lib/ouverture/ouverture.js` : moteur, deux passes de shaders.
  - Passe gaz (960×540, mipmaps) : bruit fractal à domaine déformé ; effondrement = chute radiale `r0 = r·e^(1,15·c)` + rotation différentielle `θ − Σω·(r+0,25)^−1,5` + aplatissement progressif sur l'inclinaison du disque ; onde de choc, anneaux, sillons ; voiles de plongée. Encodage doux `1 − e^(−x)` pour ne jamais écrêter les cœurs brillants.
  - Passe image (1920×1080) : gaz filé le long du mouvement de caméra (14 échantillons, obturateur 180°), halo par mipmaps, trois couches d'étoiles en parallaxe filées, Soleil (proto-étoile, cœur, aigrettes, traînée anamorphique courte, éclair), planètes (arcs de traînée en coordonnées du disque), Terre (procédurale puis plaque), limbe atmosphérique, grade (noirs → encre `#0B1F17`, hautes lumières → crème `#FAF8F5`, ombres légèrement refroidies), vignette, grain.
- Caméra : similitude (point d'ancrage écran, échelle, roulis) ; vitesse de poussée intégrée à pas fixe (1/16 d'image) depuis l'image 0, dont l'amplitude de la plongée est **résolue** pour que la Terre ait exactement le rayon du limbe d'`img01` à `T_TERRE`. La phase de la Terre est choisie pour que la direction Soleil → Terre soit celle de la plaque.
- Déterminisme : chaque image est fonction de son numéro (timeline GSAP seekée + `hf-seek`), bruit haché, aucune horloge, aucun `Math.random()`. GSAP chargé comme dans `film/` (jsdelivr 3.15.0) ; pas de three.js (inutile ici).
- `img01` est copiée dans `ouverture-lab/assets/footage/` (ignoré par git, `ouverture-lab/.gitignore`, comme `fx-lab`). Sans elle, la Terre reste entièrement procédurale (cas **non regardé**).
- Outils : `tools/capture.sh` (captures `hyperframes snapshot` renommées `f-NN.png`), `tools/planche.mjs` (planches sharp avec numéros sous les vignettes, mesures).

## Calage musical (montage v3) et comment recaler

Repères donnés par `sound-designer` (`qa/MUSIQUE-V3.md`, `qa/mix-v3.beats.json`) : zéro numérique jusqu'à 0,52 s (image 13), musique audible vers 1,2 s (image 29), **premier temps fort 1,9405 s = image 47**, première note franche 4,414 s = image 106.

Bloc en tête de `ouverture-lab/compositions/ouverture.html` :

```js
window.LKDV_OUVERTURE = { T_CREATION: 35, T_SOLEIL: 47, T_TERRE: 59, DUREE: 106, FPS: 24 };
```

- `T_SOLEIL` = image du pic de l'éclair (ici exactement le temps fort 47) ; `T_CREATION` = début de l'effondrement ; `T_TERRE` = Terre plein cadre (raccord `img01`) ; `DUREE` = fin.
- Toutes les phases sont des progressions normalisées entre ces repères. Contrainte : `T_CREATION + 3 ≤ T_SOLEIL ≤ T_TERRE − 8`.
- Si `DUREE` change, reporter `DUREE/24` dans les deux `data-duration` (`compositions/ouverture.html` et `index.html`) : c'est le seul doublon.

**Test de recalage** (fait, puis valeurs remises) : `T_CREATION = 41`, `T_SOLEIL = 47`, `T_TERRE = 65` (effondrement réduit à 6 images, plongée allongée). Les 106 images se rendent, l'éclair reste sur 47, la Terre raccorde sur `img01` à 65, rien ne casse (`qa/snapshots/ouverture/planche-recalage-41-47-65.png` ; luminance 0,158–0,476, 5,4 % de pixels > 0,9 au pic, aucun noir pur). Un premier test sur l'ancien calage (18/22/42, effondrement de 4 images) avait aussi tenu ; il avait révélé un aplat écrêté au centre, corrigé par l'encodage doux du gaz.

## Contrôles

- `npx hyperframes lint` : **0 erreur, 0 avertissement**.
- `npx hyperframes check --json` : **ok: true** — lint, runtime, layout, contrast, craft à 0 erreur / 0 avertissement ; une info `audio_none` (la composition n'a pas de son, voulu).
- Captures : `hyperframes snapshot`, GPU matériel (ANGLE Metal, Apple M2).
- **Identité stricte** : 8 images (0, 20, 42, 47, 51, 59, 80, 105) capturées deux fois dans deux sessions de navigateur : fichiers PNG identiques octet pour octet (`cmp`).
- **Rendu vidéo de contrôle** (ffmpeg 6.0 de `node_modules`) : `npx hyperframes render --fps 24 --quality draft --workers 2` → `ouverture-lab/renders/ouverture-draft.mp4` (h264, 1920×1080, 24/1, **106 images, 4,416667 s**). `blackdetect` (d = 0,04 s, pix_th 0,10) : **aucune** plage noire. Luminance Y moyenne par image : 85 → 100 sur le prélude, creux 84 à 45, **pic 113 à l'image 47** (même image que dans les captures : alignement vérifié), 50 au plus sombre (56), puis 63 → 72 sur la Terre.
- Version avec musique : `ouverture-lab/renders/ouverture-draft-musique.mp4` = vidéo + 4,417 premières secondes de `qa/mix-v3.wav` (AAC 256 k). Non versionné (`*/renders/` est ignoré).

## Mesures (106 images, `qa/snapshots/ouverture/mesures.json`)

- Luminance moyenne (0–1) : min **0,156** (image 56, espace profond pendant la plongée), max **0,479** (image 53, disque plein cadre) ; éclair 47 : 0,444.
- Pixels au-dessus de 0,9 : max **4,8 %** (image 47) ; aucune image proche de 85 % de blanc.
- Noir pur (< 6/255) : **0 pixel** sur les 106 images.
- Proximité de `#E4501C` (somme des écarts < 24) : 0 ; de `#1C2620` (< 9) : max 0,18 % des pixels (fond sombre, image isolée).

## Preuves (`trailer/qa/snapshots/ouverture/`, non ignoré par git)

- `planche-creation.png` : images 33 à 61 consécutives (T_CREATION − 2 → T_TERRE + 2), 6 colonnes, numéro sous chaque vignette.
- `planche-globale.png` : une image sur 4 de 0 à 104.
- `planche-recalage-41-47-65.png` : test de recalage, images 39 à 67.
- Pleine taille (JPEG 1920×1080, < 200 Ko) : `20-prelude.jpg`, `42-effondrement.jpg`, `47-eclair-soleil.jpg`, `51-disque-planetes.jpg`, `80-terre.jpg`, `105-derniere.jpg`.
- `mesures.json`.
- Les planches sont des PNG à palette (≈ 600 Ko) : plus lourdes que la règle « JPEG < 400 Ko » de `CONVENTIONS.md`, mais le brief demandait du PNG.

## Ce qui reste faible ou non vérifié — franchement

- **Aucun regard en mouvement.** J'ai regardé des images fixes et des planches, et mesuré le rendu ; je n'ai pas vu la vidéo défiler. La lisibilité à 24 i/s (effondrement en 12 images, plongée en 6), le stroboscope éventuel des traînées et des étoiles filées, et la sensation de vitesse sont **à juger à l'œil** sur `renders/ouverture-draft-musique.mp4`.
- **Son non écouté** : je n'entends rien. Le calage repose sur les repères mesurés par `sound-designer` ; je n'ai vérifié que l'alignement de l'image du pic (47) entre captures et rendu.
- **Transition Terre procédurale → photo (images 55–58)** : la Terre procédurale est plus « dessinée » que la plaque ; à 57–58 on devine le bord de la plaque qui se fond (fondu doux de 420 px), et à droite le limbe procédural n'a pas tout à fait le même halo. Une à deux images seulement, mais visible en arrêt sur image.
- **Plaque agrandie** : de 59 à 105 l'`img01` est poussée ×1,36 : un peu plus douce que l'original.
- **Le disque** (48–53) tire vers un crème-kaki dans l'anneau extérieur ; lisible, mais moins somptueux que la nébuleuse. Les étoiles du prélude ont une distribution assez régulière.
- **Le prélude** dure 1,46 s et vit (rotation, respiration, scintillement, avancée), mais reste un mouvement doux : s'il paraît statique en lecture, augmenter la vitesse de rotation `omega` avant `T_CREATION` dans `ouverture.js`.
- **Déterminisme vérifié sur ce Mac seulement** (GPU Apple M2). Rendu SwiftShader (`--no-browser-gpu`) ou sur une autre machine non testé : de légers écarts de flottants entre GPU sont possibles.
- **Sans `img01`** : version tout procédurale non regardée.
- Le Soleil d'arrivée touche le bord haut du cadre (y ≈ 35 px) avec ses aigrettes : voulu (raccord `img01`), à valider.

## À faire ensuite

1. Regarder `ouverture-lab/renders/ouverture-draft-musique.mp4` (Tony / `qa-critic`) : rythme, lisibilité des trois états, éclair sur le temps.
2. Si validé, intégrer dans `film/` : copier `compositions/ouverture.html` et `lib/ouverture/` (mêmes chemins relatifs), placer `img01` dans `film/assets/footage/`, monter la scène à l'image 0 à la place de P01–P02, et raccorder la fin (image 106) sur la chute dans les nuages de P03.
3. Rendu final en qualité `delivery` une fois le montage figé.
