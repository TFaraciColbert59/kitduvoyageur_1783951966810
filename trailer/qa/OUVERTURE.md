# Ouverture « nébuleuse → système solaire → Terre » — cosmos-vfx

14/11/2026, **deuxième passe**. Projet d'essai autonome `trailer/ouverture-lab/`, 1920×1080, **24 i/s**, **106 images (4,417 s)**, calé sur le montage musical v3. Rien n'a été modifié dans `trailer/film/`. Rien n'est commité par moi (la première passe l'a été par l'orchestrateur).

## Retours de la relecture et ce que la deuxième passe change

| Reproche | Correction |
|---|---|
| 1. Terre (59–105) presque immobile, « diaporama » | Poussée qui **accélère** vers les Alpes (vitesse ×6,7 entre 59 et 105, zoom total ≈ ×6). Les Alpes glissent vers le centre, roulis de **8°**. Le Soleil continue de **monter** au-dessus du limbe et son éclat grandit et ondule, ses aigrettes tournent. Une couche de **nuages en code** dérive au-dessus de la plaque, avec une parallaxe propre. L'**atmosphère respire** (limbe et voile près de l'horizon modulés). Les étoiles restent en parallaxe. Quand `img01` devient trop douce, **`img02` (Dolomites au lever)**, emboîtée dans `img01` autour des Alpes, prend le relais (≈ 92–100). **Flou de zoom** radial proportionnel à la vitesse, et **nuages proches qui défilent** à partir de ≈ 85 : à 105 on tombe dans les Dolomites. |
| 2. Prélude (0–34) trop peu mobile | Avancée de caméra ×2,1 (au lieu de ×1,47). Gaz qui s'écoule (dérive ×3,5 et déformation qui évolue ×2,6 plus vite). Parallaxe sur **cinq plans** : trois couches d'étoiles, le voile de fond, la nébuleuse et un **premier plan** de voiles et de poussières qui grossit plus vite. **Étoiles brillantes proches**, avec halo et aigrettes, qui passent et sortent du cadre. |
| 3. Nébuleuse « fond d'écran flou » | Passe du gaz en **pleine résolution** (avant : 960×540). **Filaments** nets en bruit à crêtes sur deux échelles, **couloirs de poussière découpés**, contraste local, **amas d'étoiles** avec halos. Couleurs franches (magenta, cyan, or) gardées. |
| 4. Terre procédurale « dessinée » (54–58), bord de plaque visible | Teintes d'océan, de terres et de nuages reprises des mesures d'`img01` (mer ≈ 8,33,46, terres ≈ 35,52,61, nuages ≈ 70,88,102), suralimentation bleue retirée. La plaque est **prolongée en miroir** au-delà de ses bords : plus de trou ni de bord net. |
| 5. Disque kaki, étoiles en « pluie », DUREE | Anneau extérieur rosé-or. Étoiles filées **en rayons depuis le point de fuite** (longueur selon la distance au centre et la profondeur). `DUREE` ↔ `data-duration` : **contrôle à l'exécution** (voir plus bas) et script `tools/verifie-duree.mjs`. |

L'éclair a aussi été tenu (voile et aigrettes réduits, gaz atténué de 30 % autour du pic) : la nébuleuse plus dense le faisait monter à 0,67 de luminance moyenne.

## Déroulé (calage v3)

| Images | Phase |
|---|---|
| 0–34 | Prélude : zéro numérique jusqu'à 13, entrée très douce vers 29. La nébuleuse vit (voir plus haut). |
| 35–46 | Effondrement : enroulement différentiel, chute vers le centre, aplatissement en disque, proto-étoile. |
| **47** | **Éclair du Soleil** sur le premier temps fort (1,9405 s). Pic d'une image, jamais blanc plein. |
| 48–53 | Disque rosé-or, anneaux, sillons, six planètes qui filent ; un grain devient la Terre (or → bleu). |
| 53–58 | Plongée vers le point bleu, étoiles filées en rayons, Terre procédurale puis plaque `img01` fondue dans le disque. |
| 59 | La Terre coïncide exactement avec `img01` (limbe mesuré, Soleil sur le limbe, Alpes). |
| 59–105 | Terre vivante, puis poussée qui accélère vers les Alpes → `img02` → chute dans les nuages. Fin sur la première note franche (106). |

## Technique

- `ouverture-lab/compositions/ouverture.html` : scène `ouverture`, bloc CONFIG, plaques `img01` et `img02` cachées, un `<canvas>` WebGL2.
- `ouverture-lab/lib/ouverture/ouverture.js` : moteur, deux passes de shaders.
  - **Passe gaz (1920×1080)**, avec mipmaps pour le halo :
    - bruit fractal à domaine déformé, filaments à crêtes, couloirs de poussière ;
    - effondrement : chute radiale, rotation différentielle, aplatissement ;
    - onde de choc, anneaux, sillons ;
    - voile de fond et voiles de premier plan, chacun avec sa caméra de parallaxe ;
    - voiles de plongée.
  - **Passe image** :
    - gaz filé selon le mouvement de caméra, étoiles en trois couches plus une couche d'étoiles proches, filées en rayons ;
    - Soleil, planètes ;
    - Terre : procédurale, puis plaques `img01`/`img02` en miroir avec flou de zoom ; nuages dérivants, limbe qui respire, nuages proches ;
    - grade encre/crème, vignette, grain.
- **Caméra** : similitude intégrée à pas fixe depuis l'image 0. L'amplitude de la plongée est résolue pour que la Terre ait exactement le rayon d'`img01` à `T_TERRE`. Après `T_TERRE`, la vitesse vaut `0,014 + 0,08·u^2,2` (accélération) et le roulis va de 0 à 8°.
- **Déterminisme** : chaque image est fonction de son numéro (timeline GSAP seekée + `hf-seek`), bruits hachés, aucune horloge, aucun `Math.random()`. GSAP chargé comme dans `film/` (jsdelivr 3.15.0).
- `img01` et `img02` sont copiées dans `ouverture-lab/assets/footage/` (ignoré par git). Sans elles, la Terre reste procédurale (**non regardé**).
- Outils :
  - `tools/capture.sh` : captures `snapshot` → `f-NN.png` ;
  - `tools/planche.mjs` : planches, `mesures`, et `mouvement` (nouveau) ;
  - `tools/verifie-duree.mjs` (nouveau).

## Calage musical et recalage

Repères (`qa/MUSIQUE-V3.md`, `qa/mix-v3.beats.json`) : zéro numérique jusqu'à l'image 13, musique audible vers 29, **premier temps fort 1,9405 s = image 47**, première note franche 4,414 s = image 106.

```js
window.LKDV_OUVERTURE = { T_CREATION: 35, T_SOLEIL: 47, T_TERRE: 59, DUREE: 106, FPS: 24 };
```

- Toutes les phases sont des progressions normalisées entre ces repères. Contrainte : `T_CREATION + 3 ≤ T_SOLEIL ≤ T_TERRE − 8`.
- Les réglages fins de l'arrivée sont en tête de `ouverture.js` : `AIM_END`, `IMG2_K`, `ROLL_END`.
- **Lien `DUREE` ↔ `data-duration`.** Je ne l'ai pas rendu automatique : le runtime lit `data-duration` avant que le script ne s'exécute. Il est donc **vérifié deux fois** :
  - à l'exécution, le moteur compare `DUREE/FPS` aux `data-duration` de la scène et de son hôte. En cas d'écart, il appelle `console.error` et pose `window.__ouvertureDureeErreur`. **Testé** avec `DUREE = 100` : `npx hyperframes check` passe à `ok: false` avec `console_error` « [ouverture] DUREE incohérente … » ;
  - `node tools/verifie-duree.mjs` contrôle les trois `data-duration`, sort en erreur et donne la valeur à écrire. Testé dans les deux sens.
- **Test de recalage** (fait, puis valeurs remises) : `41 / 47 / 65`. Les 106 images se rendent, l'éclair reste sur 47, la Terre raccorde à 65 (`planche-recalage-41-47-65.png`). Luminance de 0,190 à 0,629, 5,8 % de pixels au-dessus de 0,9 au pic, aucun noir pur.

## Contrôles

- `npx hyperframes lint` : **0 erreur, 0 avertissement**.
- `npx hyperframes check --json` : **ok: true**. Lint, runtime, layout, motion, contrast et craft sont à 0/0 ; une info `audio_none` (voulue).
- **Identité stricte** : 8 images (0, 20, 42, 47, 51, 59, 80, 105) capturées deux fois dans deux sessions de navigateur sont identiques octet pour octet. GPU matériel : ANGLE Metal, Apple M2.
- **Rendu de contrôle** (ffmpeg 6.0) : `ouverture-lab/renders/ouverture-v2.mp4`, h264 1920×1080, 24/1, **106 images, 4,416667 s**, `blackdetect` sans aucune plage noire.
  - Luminance Y par image : 121–126 sur le prélude, creux 101 à 46, **pic 147 à l'image 47** (même image que dans les captures), 59 au plus sombre (56).
  - Sur la Terre, Y monte **régulièrement de 70 à 111** : la lumière change, ce n'est pas un plan fixe.
- **Avec musique** : `ouverture-lab/renders/ouverture-v2-musique.mp4`, la vidéo et les 4,417 premières secondes de `qa/mix-v3.wav` (AAC 256 k). Le dossier `renders/` est ignoré par git.

## Mesures

**Luminance et couleurs** sur 106 images (`qa/snapshots/ouverture/mesures.json`) :
- luminance moyenne de **0,199** (image 56) à **0,601** (image 47, l'éclair) ;
- pixels au-dessus de 0,9 : au plus **6,2 %** (image 47) ;
- noir pur : **0 pixel** ;
- `#E4501C` : 0 ; `#1C2620` : au plus 0,002 %.

**Mouvement**, avant / après (`qa/snapshots/ouverture/mouvement.json`). Différence absolue moyenne RVB (0–255) entre images consécutives, sur des réductions 480×270 ; le grain seul compte pour environ 1–2.

| Plage | v1 : moyenne consécutive (min–max) | v2 : moyenne consécutive (min–max) | v1 : écart première → dernière | v2 : écart première → dernière |
|---|---|---|---|---|
| Prélude 0–34 | 2,63 (2,29–2,70) | **10,19** (9,01–12,74) | 34,1 | **45,1** |
| Terre 59–105 | 3,30 (2,47–5,21) | **9,92** (5,08–14,80) | 22,2 | **52,9** |

Le mouvement image à image est multiplié par **3,9** sur le prélude et par **3,0** sur la Terre. Sur la Terre, il croît de 5 à 15 : l'accélération se mesure.

## Preuves (`trailer/qa/snapshots/ouverture/`, non ignoré par git)

- Planches (numéro sous chaque vignette) :
  - `planche-creation.png` : images 33 à 61 ;
  - `planche-globale.png` : une image sur 4 de 0 à 104 ;
  - `planche-prelude.png` : une image sur 3 de 0 à 33 ;
  - `planche-terre.png` : une image sur 3 de 59 à 104 ;
  - `planche-recalage-41-47-65.png`.
- Pleine taille (JPEG, < 200 Ko) : `20-prelude.jpg`, `42-effondrement.jpg`, `47-eclair-soleil.jpg`, `51-disque-planetes.jpg`, `80-terre.jpg`, `105-derniere.jpg`.
- `mesures.json`, `mouvement.json`.
- Les planches sont des PNG à palette de 0,4 à 0,7 Mo, donc au-dessus de la règle « JPEG < 400 Ko ». Le brief demande du PNG.

## Ce qui reste faible ou non vérifié — franchement

- **Toujours aucun regard en mouvement ni à l'oreille.** Je juge sur des planches, des images fixes et des mesures. La fluidité à 24 i/s, l'effet du flou de zoom et l'éclair sur le temps fort sont à regarder dans `ouverture-v2-musique.mp4`.
- **Prolongement en miroir de la plaque** : il supprime le bord net mais crée une symétrie visible en bas du disque sur 1 à 2 images autour de `T_TERRE − 2` (57 ; 62–63 dans le test de recalage).
- **Passage `img01` → `img02` (≈ 92–100)** : c'est un fondu dans un masque ovale pendant la poussée. Il est masqué par le flou et les nuages, mais les deux photos n'ont ni le même angle ni la même lumière : en arrêt sur image, c'est un mélange un peu flou. `img02` y est assombrie à 86–92 %.
- **Nuages proches (85–105)** : par endroits ce sont des boules floues ; à 98–101 une colonne blanche passe près du centre. On lit une chute, mais ce n'est pas une vraie mer de nuages volumétrique.
- **Prélude** : beaucoup plus riche, mais les couloirs de poussière ont des contours un peu « découpés papier » et les filaments peuvent faire « plasma ». Il reste peu de ciel noir : c'est voulu (« pleine de couleur »), mais c'est dense.
- **Terre 59–80** : le mouvement est réel (poussée, roulis, nuages, Soleil) mais encore doux sur les 20 premières images ; la vitesse est surtout dans le dernier tiers.
- **Déterminisme vérifié sur ce Mac seulement** (GPU M2). La version sans les plaques n'a pas été regardée.

## À faire ensuite

1. Regarder `ouverture-lab/renders/ouverture-v2-musique.mp4` (Tony / `qa-critic`).
2. Si c'est validé, intégrer dans `film/` :
   - copier `compositions/ouverture.html` et `lib/ouverture/`, ainsi que `img01` et `img02` dans `film/assets/footage/` ;
   - monter la scène à l'image 0 ;
   - la fin (106, dans `img02` avec nuages proches) enchaîne sur la chute de P03 (`img03`).
3. Rendu final en qualité `delivery` une fois le montage figé.
