# Chantier 6 — Étalonnage commun et recomposition 9:16 (première partie)

État au 11/11/2026. Agent `landscape-director`. Aucune image de Tony n'est encore arrivée (`assets/footage/` absent) : tout est mesuré sur des images d'essai et des mires, et tous les cadres 9:16 sont provisoires.

## A. La LUT commune

### Livrable

- `film/assets/luts/lkdv-trailer.cube` : 33³, sRGB/Rec.709 SDR, généré par `tools/grade/build-lut.mjs` (ne pas l'éditer à la main ; un test vérifie que le fichier livré est exactement la sortie du script).
- Variante 130 % : `grade-lab/assets/luts/lkdv-trailer-130.cube` (`--strength 1.3`). La variante 60 % n'a pas de fichier : c'est le cube 100 % avec `intensity: 0.6`.
- Validation par media-use : `npx hyperframes media-use resolve --type lut --from ../film/assets/luts/lkdv-trailer.cube --project .` (dans `grade-lab/`) → `{"ok":true,"id":"lut_001",…}`.

### Paramètres (en tête de `build-lut.mjs`, objet `PARAMS`)

| Réglage | Valeur | Effet |
|---|---|---|
| Point noir | `#0B1F17`, `blackMix 0.7`, `toeEnd 0.24` (Oklab L) | remontée monotone des noirs vers l'encre ; teinte verte réservée aux tons quasi neutres (chroma < 0,02–0,08) |
| Point blanc | `#FAF8F5`, `whiteMix 0.85` (plafonné à 0,95), `shoulderStart 0.78` | les blancs roulent vers la crème, sans désaturer les hautes lumières colorées |
| Courbe | S cubique `contrast 0.06`, pivot 0,5 | presque droite |
| Retenue des verts | fenêtre de teinte Oklch 145° ± 32°, −14 % de chroma, 25 % du chemin vers la teinte du sauge (141°) | l'olive du sac (118°) et le turquoise (194°) restent hors fenêtre |
| Protection des peaux | teinte 55° ± 32° | ni le pied ni l'épaule ne les teintent |
| Protection du bleu nuit | teinte 262° ± 45° | la nuit garde son bleu (sinon le pied la verdit) |

### Application dans HyperFrames (vérifiée sur un vrai rendu)

```bash
npx hyperframes media-treatment --project film --file compositions/pNN.html \
  --selector '#pNN-plate' --grading '{"lut":{"src":"assets/luts/lkdv-trailer.cube","intensity":1}}' --apply --json
```

L'attribut produit est un `data-color-grading` complet (adjust, details, effects à zéro) qui se termine par `"lut":{"src":"assets/luts/lkdv-trailer.cube","intensity":1},"colorSpace":"rec709"`. Il est en place sur les 14 images de `grade-lab/index.html`. Preuve que le moteur lit bien le cube : l'écart entre la capture du moteur et notre propre interpolation trilinéaire du même cube vaut ΔE2000 0,08 à 0,72 (colonne « écart moteur »).

### Mesures (moteur HyperFrames, capture neutre contre capture étalonnée)

Commandes : `node tools/grade/lab.mjs` (captures dans `grade-lab/samples/renders/`), `node tools/grade/measure.mjs`. Tableau complet : `qa/snapshots/grade/mesures.md` et `mesures.json`. Extrait à 100 % :

| Image | 1 % sombres | 1 % clairs | Chroma verts | Peau Δh / ΔE | Olive Δh / ΔE | ΔE moyen / p95 |
|---|---|---|---|---|---|---|
| astronaut (visage) | #000000 → #040F0A | #FDFCFB → #FBF9F6 | — | 0,1° / 1,07 | — | 1,81 / 5,60 |
| coffee (ambre) | #100301 → #23140D | #F8F6F3 → #F8F6F3 | — | 0,0° / 0,88 | — | 1,18 / 4,48 |
| rocket (heure bleue) | #090508 → #191718 | #EED5A0 → #F0D8A5 | — | 0,0° / 1,16 | — | 0,96 / 2,95 |
| sac (planche) | #0A0B0B → #171A19 | #B1B474 → #B5B878 | — | — | 0,0° / 0,91 | 1,02 / 1,24 |
| nuancier | #000000 → #040F0A | #FFFFFF → #FBF9F6 | × 0,902 | 0,1° / 0,72 | 0,9° / 1,34 | 1,29 / 3,45 |
| midi-lac (mire) | — | #F0ECE4 → #F1EEE9 | — | — | — | 0,97 / 1,48 |
| feu-nuit (mire) | #03050A → #11181F | #DF9543 → #E29947 | — | −0,2° / 0,59 | — | 2,80 / 5,66 |
| voie-lactée (mire) | #03060A → #10191D | — | — | — | — | 2,81 / 6,12 |

Lecture honnête :
- Peaux et olive du sac : écart de teinte ≤ 0,9°, ΔE ≤ 1,4 aux trois intensités (≤ 1,8 à 130 %). Le vert olive reste juste.
- Noirs : un noir pur devient `#040F0A` à 100 %, `#081A13` à 130 % ; la cible `#0B1F17` n'est atteinte qu'à 130 %, que je déconseille (voir plus bas). Sur les scènes de nuit, les noirs vont vers un bleu-vert sombre (`#11181F`) et pas vers l'encre, à cause de la protection du bleu nuit : c'est voulu.
- Blancs : `#FFFFFF` → `#FBF9F6` (100 %), `#FAF8F5` exact à 130 %.
- Verts : chroma × 0,90 sur les verts francs du nuancier ; aucune photo réelle de végétation n'a pu être mesurée.
- Légèreté : ΔE moyen ≤ 1,8 sur les images de jour à 100 %, mais **2,8 à 4,1 sur les images surtout noires** (feu de nuit, Voie lactée, Hubble), parce que toute la surface noire est relevée.

### Choix des variantes (planches `grade-compare` regardées)

`npx hyperframes grade-compare --for samples/renders/neutre/<id>.png --grades grades.json --project .` (dans `grade-lab/`) : `qa/snapshots/grade/grade-compare-{astronaut,coffee,rocket,sac-planche,nuancier,feu-nuit,voie-lactee,midi-lac}.jpg`, et l'avant/après 100 % `qa/snapshots/grade/avant-apres-100.jpg`.

- **60 %** : à peine visible ; noirs encore presque neutres.
- **100 % (retenue)** : invisible sur les peaux, le sac et le turquoise ; noirs légèrement relevés et verts ; blancs crème.
- **130 % (rejetée)** : la Voie lactée et le sol de nuit deviennent gris-vert et plats ; ΔE p95 de 8 à 11. La LUT se voit.
- Recommandation : 100 % sur les plans de jour, `intensity` 0,6 à 0,8 sur les plans de nuit (P46–P51) à valider sur les vraies images.

## B. La recomposition 9:16

### Fichiers

- `film/crops.json` : 54 plans (lus dans `TRAME-60s.md` par `tools/crops/trame.mjs`, contrôlés aussi contre `film/shots.json`). Pour chaque plan : `frames`, `sources`, `type` (espace, personnage, telephone, objet, groupe, paysage, star, special, code), `start` et `end` (rectangles en % de l'image posée en 16:9, rapport w/h = 81/256), `poi`, `note`, `status: "provisoire, à ajuster à la réception de l'image"`. Les cadres viennent du cadre de chaque prompt (sujet au tiers central, téléphone à 35–40 % de la hauteur, personnage minuscule au tiers central).
- `tools/crops/seed.mjs` : graine de `crops.json` (refuse d'écraser sans `--force`) ; ensuite, le JSON est la source.
- `tools/crops/validate.mjs` : 54 plans dans l'ordre, mêmes images que la trame et `shots.json`, rapport 9:16 à 0,5 % près, cadres dans l'image, point d'intérêt dans les cadres de début et de fin, 8 plans ★ marqués et pourvus d'un repli, P14 et P46 contrôlés, statut provisoire. Sortie : « crops.json valide : 54 plans… conforme à shots.json ».
- `tools/crops/preview.mjs` : une planche par acte (`qa/snapshots/grade/crops-acte-01.jpg` … `-10.jpg`), image réelle si elle existe dans `assets/footage/`, sinon mire (tiers, centre, nom de l'image attendue) ; cadre de début en trait plein, fin en tirets, point d'intérêt, et à droite l'image verticale du début de plan. Planches 04 et 06 regardées.

### Règles appliquées

- Téléphones (P07, P09, P12, P13, P15–P17, P25, P29, P31, P36, P48, P49, P51) : cadre de 56 à 100 % de hauteur centré sur l'écran ; P09 et P49 finissent sur l'écran seul.
- Plans ★ (P26, P27, P30, P38, P40, P42, P43, P50) : **bande pleine hauteur au tiers central**, où la bible place le personnage ; le sommet est au-dessus de lui dans la même bande. Le mouvement se fait par glissé (P26, P40) ou par ouverture de 88–92 % à 100 % (P38, P43, P50). Repli décrit dans `starFallback` : image entière calée en largeur (1080×608) au tiers haut, sur un fond prolongé de la même image agrandie et floutée par media-treatment. Je ne l'utiliserai qu'en dernier recours, parce qu'il réduit le personnage d'environ 44 %.
- P14 : `layout: "trois-bandes-empilees"`. Les trois bandes verticales deviennent trois tranches horizontales de 1080×640 empilées (Sami, Inès, Tom), taillées sur toute la largeur de chaque bande et sur 35,16 % de la hauteur autour des visages ; les volets s'ouvrent à l'horizontale.
- P46 : `layout: "timelapse-meme-cadre"`, un seul cadre pour img35a et img35b.
- P53–P54 : les tracés et le logo sont des scènes codées, recalculées en 1080×1920 (`natif-vertical` pour P54) ; le cadre ne sert que de repère.
- Plans à risque : P23 et P47 (quatre personnes en largeur : la bande n'en garde que deux ou trois), P32 et P39 (le sens du mouvement est à confirmer sur l'image).

### Comment la version 1080×1920 sera produite (non construite)

1. Une seconde racine `film/index-9x16.html` (ou un projet `film-9x16/` qui pointe vers les mêmes `compositions/`) en 1080×1920, qui monte **les mêmes fichiers de scène** aux mêmes `data-start`/`data-duration` issus de `shots.json` : aucun minutage dupliqué.
2. Chaque scène expose sa plaque dans un conteneur `#pNN-frame`. En 9:16, un petit module `lib/reframe.js` lit `crops.json` (incorporé à la construction, aucune lecture réseau) et ajoute, sur un enfant du `.clip`, une transformation GSAP `fromTo` du cadre `start` au cadre `end`, en plus du mouvement 2,5D de la scène. La plaque reste en 1920×1080 dans le conteneur, la caméra virtuelle choisit la bande.
3. Même étalonnage : le `data-color-grading` est sur l'`<img>` des scènes, donc il est commun aux deux formats.
4. Rendu par `npx hyperframes render` sur la seconde racine, avec les mêmes portes (lint, check, snapshots).

Limites que je vois :
- Les téléphones incrustés (ui-builder) suivent quatre coins dans l'espace 1920×1080 : ils resteront justes si l'incrustation vit dans le même conteneur que la plaque. Une incrustation posée par-dessus la scène en coordonnées écran serait fausse en 9:16.
- Les transitions plein cadre (flash, volets, flou radial, P52) sont pensées en 16:9 : il faut les recalculer en 1080×1920, pas les recadrer.
- Lisibilité des écrans : un téléphone qui fait 35–40 % de la hauteur d'un 1920×1080 fait environ 360 px de large en 9:16 à pleine hauteur ; sur un téléphone qui regarde le film, le texte de l'app (corps 14–16 pt dans la capture 1290×2796) tombe sous les 28 px. D'où les cadres serrés sur les plans de téléphone, et les tests de lisibilité à faire sur les vraies captures.
- Zones de l'interface des plateformes (haut 168 px, bas au-delà de 1330 px) : aucun texte n'y doit tomber, ce qui concerne surtout les écrans des téléphones.
- Les images de ChatGPT peuvent arriver en 3:2 (1536×1024) : les pourcentages s'entendent sur l'image posée en cover 16:9, comme dans le film.

Ce que je ferai quand le squelette sera prêt : brancher l'étalonnage sur chaque plaque par media-treatment, écrire `lib/reframe.js` et la seconde racine, refaire les planches de `preview.mjs` sur les vraies images et ajuster `crops.json` plan par plan, puis prendre des snapshots en 9:16 à ±0,2 s de chaque coupe.

## Contrôles lancés

- `node --test tools/grade/*.test.mjs tools/crops/*.test.mjs` → 9 réussis, 0 échec (rampe de gris monotone aux trois forces, noir et blanc, peaux, olive et turquoise ΔE < 2, verts retenus, cube livré égal à la sortie du script, 54 plans et 8 ★ lus dans la trame, crops.json valide, huit fautes volontaires toutes détectées).
- `node tools/crops/validate.mjs` → valide, conforme à `shots.json`.
- `grade-lab` : `npx hyperframes lint` → 0 erreur, 1 avertissement (`timeline_track_too_dense` : 14 images sur une piste, sans importance pour un banc) ; `npx hyperframes check --json` → `ok: true`.
- `film/` : seuls `assets/luts/lkdv-trailer.cube` et `crops.json` sont à moi, je n'ai pas lancé lint ni check sur le film en cours de construction.

## Reporté ou non vérifié

- Aucune vraie photo de montagne : réseau refusé ; mires synthétiques à la place. La retenue des verts n'a pas été jugée sur de la végétation réelle.
- Étalonnage à revoir sur les images de Tony, en particulier les plans de nuit (intensité).
- Planches `crops-acte-*` regardées seulement pour les actes 4 et 6 ; les cadres n'ont été confrontés à aucune image réelle.
- Seconde racine 9:16 et `lib/reframe.js` : non construits, comme demandé.
