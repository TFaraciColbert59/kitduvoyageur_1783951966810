# P1 — Squelette de timeline du trailer (trailer-chore)

Date : 2026-11-11. Branche `claude/eager-gates-e7wny4`. Rien n'est commité.

## Ce qui est fait

| Livrable | Fichier |
|---|---|
| Minutage, source unique (54 plans, recopiés de la trame v4.1) | `film/shots.json` (généré une fois par `tools/timeline/trame-to-shots.mjs`, qui refuse d'écraser sans `--force`) |
| Validateur + écarts coupe/temps | `tools/timeline/validate-shots.mjs` (`--json`, `--markdown`, `--file` pour les essais) |
| Racine 60 s, 1920×1080, `data-fps="60"`, 54 hôtes, piste `#music` | `film/index.html` |
| 54 scènes (carte provisoire + emplacement d'image) | `film/compositions/p01.html` … `p54.html` |
| Générateur protégé | `tools/timeline/build-skeleton.mjs` |
| Bascule carte ↔ image | `tools/timeline/sync-footage.mjs` |
| Piste de clics 60,000 s | `tools/timeline/build-click.mjs` → `film/assets/audio/click-60s.wav` (ignoré par git) |
| Contrôle timeline ↔ shots.json | `tools/timeline/compare-timeline.mjs` |
| Fonctions communes (temps du montage, marqueurs, zone d'images) | `tools/timeline/lib.mjs` |
| Animatique | `qa/animatic-v1.mp4` (non versionnée) |
| Preuves | `qa/snapshots/p1/*.jpg` (14 fichiers, tous < 140 Ko) |

### shots.json
Champs : `id`, `act {number, name}`, `startFrame` (inclus), `endFrame` (exclu), `sources` (`["img35a","img35b"]`, `["img05","img04","img03"]`, `[]` pour P54), `screen` (`"E1"`… ou `null`), `code` (P53, P54), `star` (8 plans ★ : P26, P27, P30, P38, P40, P42, P43, P50), `sourceLabel`, `timeLabel`, `cadre`, `action`, `raccord` — textes recopiés tels quels (gras Markdown compris ; la carte retire les `**`).

### Scènes
- Hôte `id="pNN"` = `data-composition-id` de la racine de scène (`id="root"`, forme exigée par le linter) = clé `window.__timelines["pNN"]`. `data-start` = startFrame/60 et `data-duration` = (endFrame−startFrame)/60 écrits en double JS complet (`1.4833333333333334`) : le minutage tombe sur l'image exacte.
- Carte : fond à la teinte de l'acte, « PNN » en Inter 900, source prévue (`img07 + E1`), images et secondes, intention, « ★ plan d'échelle », barre de progression `fromTo scaleX 0→1` sur la durée du plan. Polices embarquées seulement (Inter, JetBrains Mono).
- Teintes : 1 bleu nuit `#14233F` · 2 ardoise bleue `#2E4A63` · 3 turquoise `#1D5E5E` · 4 Forest `#17402C` · 5 Sage foncé `#4A6B45` · 6 ambre `#7A5A1E` · 7 pierre `#4B4A44` · 8 or olive `#646A1E` · 9 orange brûlé `#8A3E1A` · 10 encre `#0B1F17`. Contraste AA vérifié par `check` (31/31).
- Emplacement d'image : `#pNN-frame` (plein cadre) > zone `hf-footage` > `.pNN-shot` (opacité, séquence) > `.pNN-shot-inner` (libre pour le mouvement) > `img` en `object-fit: cover; object-position: 50% 50%` : remplit le 16:9 sans déformer, recadré au centre quel que soit le rapport (1536×1024 testé).
- Plusieurs sources dans un plan : parts égales, dans l'ordre de la trame (P46 : 41 + 41 images ; P52 : 35 + 35 + 35). Si une seule manque, la carte reste visible sur sa part. Choix mécanique, à affiner par le réalisateur (fondu du timelapse P46 par exemple).
- Protection : première ligne `<!-- hf-skeleton generated id=… sha256=… -->` (après le doctype pour `index.html`). L'empreinte exclut la zone `hf-footage`. `build-skeleton` laisse toute scène retouchée ou sans marqueur, sauf `--force` ou `--only`+`--force`. Preuve : retouche de p02 → `{"kept":1}` ; relance à vide → `{"same":55}`.

### sync-footage
Copie `assets/footage/imgXX.(png|jpg|jpeg|webp)` → `film/assets/footage/` (recopie si l'empreinte change), retire les copies dont la source a disparu, réécrit seulement la zone `hf-footage`, ignore (et signale) une scène sans zone, signale les fichiers inattendus et les rapports ≠ 16:9. Ne touche jamais `assets/footage/`. `--dry-run`, `--json`.

## Commandes et sorties

```
$ node tools/timeline/validate-shots.mjs
{"ok":true,"shots":54,"totalFrames":3600,"longest":120,"shortest":26,"beatsInMontage":137,"cuts":53,"maxAbsOffsetFrames":0.4,"meanAbsOffsetFrames":0.245,"cutsWithin1Frame":53}
✓ shots.json valide
```
Essais négatifs (`--file`) : trou entre p10 et p11, 53 plans, départ à 1, fin à 3601 (et plan de 121 i), plan de 172 i → chacun sort en code 1 avec le bon message.

```
$ npx hyperframes lint            →  0 errors, 0 warnings (55 fichiers)
$ npx hyperframes check --json    →  ok true · lint 0/0 · runtime 0/0 · layout 0/0 · contrast 0 e (31/31) · audio 0/0 · motion 0/0 · craft 125 avertissements
$ node tools/timeline/compare-timeline.mjs
{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}
✓ timeline = shots.json à l'image près
$ node tools/timeline/build-click.mjs
{"duration":"60.000000","sampleRate":"48000","channels":1,"beats":102,"downbeats":30,"markers":5,"total":137}
```
Les cinq repères tombent chacun sur un temps du montage (indices du morceau 163, 323, 355, 275, 291) ; ils remplacent ce tic par l'accent « repère » (440 + 880 Hz, 220 ms). Tic 1 kHz 30 ms ; premier temps 1,6 kHz 50 ms, plus fort.

Preuve de la synchronisation (images factices ffmpeg, toutes retirées ensuite, `assets/footage/` créé pour l'essai puis supprimé vide) :
```
img06 1920×1080 (mire unie sauge), img41 1536×1024 (testsrc2), img35a 1920×1080 (testsrc)
1er passage : 3 copiées · → image p06 p13 p15 · partielles p46 (1/2) · « img41.png : 1536×1024, rapport 1.500 ≠ 16:9, recadrée au centre »
2e passage  : 0 copiées, 3 inchangées · scènes inchangées 53   (idempotent)
check --json : ok true, 0 erreur
images retirées → 3 retirées · → carte p06 p13 p15 p46 ; 2e passage : rien ; check --json : ok true, 0 erreur
```
Snapshots : `sync-p06-image.jpg` (aplat sauge plein cadre, aucune carte), `sync-p13-image-1536x1024.jpg` (mire recadrée au centre, non déformée ; P15 partage img41), `sync-image-planche.jpg` (P06, P13, P46 première moitié = image, P46 seconde moitié = carte), `sync-p06-carte.jpg` (carte revenue, barre à mi-course).

Rendus :
```
qa/animatic-v1.mp4 (--fps 30 --quality draft --workers 2, 59 s de rendu, 2,1 Mo)
video 1920×1080 30/1 duration=60.000000 nb_read_frames=1800 · audio 48000 Hz duration=60.000000 · format 60.000000
contrôle 60 i/s (--fps 60, 1 min 57 s de rendu), ffprobe -count_frames : nb_read_frames=3600, duration=60.000000 ; supprimé après contrôle
```
Sur le rendu à 60 i/s, la teinte d'un pixel change exactement aux images 166, 325, 614, 1191, 1507, 2009, 2429, 2848, 3192 (les neuf changements d'acte), ni avant ni après.

## Ce que montrent les snapshots
- `acte-01.jpg` … `acte-10.jpg` (milieu de chaque acte) : P01 bleu nuit, P04 ardoise, P07 turquoise « img07 + E1 », P15 Forest « img41 + E4 », P23 sauge, P28 ambre, P36 pierre « img27 + E10 », P42 or olive avec « ★ plan d'échelle », P48 orange brûlé « img37 + E11 », P53 encre « img39 + code » ; barre de progression à mi-course, texte lisible.
- `coupe-0325.jpg` : images 323–324 = P05 ardoise, 325–326 = P06 turquoise (drop 1) ; `coupe-2009.jpg` : 2007–2008 P32 ambre, 2009–2010 P33 pierre (drop 2) ; `coupe-3480.jpg` : 3478–3479 P53, 3480–3481 P54 (impact final). Barre pleine avant la coupe, vide après.

## Avertissements gardés
- `line_unread` × 125 (craft, jamais bloquant) : les intentions et libellés des cartes restent moins longtemps que le temps de lecture d'un plan de 0,43 à 2 s. Gardés : les cartes sont un outil de travail qui disparaît avec les images, et le minutage ne bouge pas. Aucun autre avertissement (lint 0, runtime 0, layout 0, motion 0, audio 0). En état « image », il en reste 119 (les plans sur image n'ont plus de texte).

## Écarts coupe / temps de musique
Temps du morceau (`storm-ii.beats.json`) reportés en temps de film par les 6 segments de MUSIQUE.md ; 137 temps dans le montage. Écart = (image de coupe / 60 − temps le plus proche) × 60. Aucune coupe déplacée. Toutes à 0,4 image au plus (les repères en secondes à deux décimales de la trame tombent entre deux images).

| Coupe | Image | Film (s) | Temps le plus proche, film (s) | Morceau (s) | Indice | 1er temps | Écart (images) |
|---|---|---|---|---|---|---|---|
| p01→p02 | 89 | 1.4833 | 1.480 | 67.565 | 154 |  | +0.20 |
| p02→p03 | 166 | 2.7667 | 2.770 | 68.855 | 157 |  | -0.20 |
| p03→p04 | 220 | 3.6667 | 3.670 | 69.755 | 159 | oui | -0.20 |
| p04→p05 | 272 | 4.5333 | 4.530 | 70.615 | 161 |  | +0.20 |
| p05→p06 | 325 | 5.4167 | 5.410 | 71.495 | 163 | oui | +0.40 |
| p06→p07 | 403 | 6.7167 | 6.720 | 72.805 | 166 |  | -0.20 |
| p07→p08 | 482 | 8.0333 | 8.030 | 74.115 | 169 |  | +0.20 |
| p08→p09 | 508 | 8.4667 | 8.470 | 74.555 | 170 |  | -0.20 |
| p09→p10 | 560 | 9.3333 | 9.340 | 75.425 | 172 |  | -0.40 |
| p10→p11 | 614 | 10.2333 | 10.230 | 76.315 | 174 |  | +0.20 |
| p11→p12 | 692 | 11.5333 | 11.530 | 77.615 | 177 |  | +0.20 |
| p12→p13 | 745 | 12.4167 | 12.420 | 78.505 | 179 | oui | -0.20 |
| p13→p14 | 823 | 13.7167 | 13.720 | 79.805 | 182 |  | -0.20 |
| p14→p15 | 876 | 14.6000 | 14.600 | 80.685 | 184 |  | +0.00 |
| p15→p16 | 928 | 15.4667 | 15.470 | 81.555 | 186 |  | -0.20 |
| p16→p17 | 1034 | 17.2333 | 17.230 | 83.315 | 190 |  | +0.20 |
| p17→p18 | 1060 | 17.6667 | 17.670 | 83.755 | 191 | oui | -0.20 |
| p18→p19 | 1139 | 18.9833 | 18.990 | 85.075 | 194 |  | -0.40 |
| p19→p20 | 1191 | 19.8500 | 19.850 | 85.935 | 196 |  | +0.00 |
| p20→p21 | 1219 | 20.3167 | 20.310 | 86.395 | 197 |  | +0.40 |
| p21→p22 | 1271 | 21.1833 | 21.180 | 87.265 | 199 | oui | +0.20 |
| p22→p23 | 1323 | 22.0500 | 22.050 | 88.135 | 201 |  | +0.00 |
| p23→p24 | 1402 | 23.3667 | 23.360 | 89.445 | 204 |  | +0.40 |
| p24→p25 | 1454 | 24.2333 | 24.240 | 90.325 | 206 |  | -0.40 |
| p25→p26 | 1507 | 25.1167 | 25.110 | 91.195 | 208 |  | +0.40 |
| p26→p27 | 1612 | 26.8667 | 26.860 | 92.945 | 212 |  | +0.40 |
| p27→p28 | 1717 | 28.6167 | 28.610 | 94.695 | 216 |  | +0.40 |
| p28→p29 | 1769 | 29.4833 | 29.490 | 95.575 | 218 |  | -0.40 |
| p29→p30 | 1822 | 30.3667 | 30.370 | 96.455 | 220 |  | -0.20 |
| p30→p31 | 1901 | 31.6833 | 31.690 | 97.775 | 223 | oui | -0.40 |
| p31→p32 | 1954 | 32.5667 | 32.570 | 98.655 | 225 |  | -0.20 |
| p32→p33 | 2009 | 33.4833 | 33.480 | 141.565 | 323 | oui | +0.20 |
| p33→p34 | 2063 | 34.3833 | 34.390 | 142.475 | 325 |  | -0.40 |
| p34→p35 | 2114 | 35.2333 | 35.240 | 143.325 | 327 | oui | -0.40 |
| p35→p36 | 2192 | 36.5333 | 36.540 | 144.625 | 330 |  | -0.40 |
| p36→p37 | 2245 | 37.4167 | 37.420 | 145.505 | 332 |  | -0.20 |
| p37→p38 | 2297 | 38.2833 | 38.290 | 146.375 | 334 |  | -0.40 |
| p38→p39 | 2378 | 39.6333 | 39.630 | 147.715 | 337 |  | +0.20 |
| p39→p40 | 2429 | 40.4833 | 40.490 | 148.575 | 339 | oui | -0.40 |
| p40→p41 | 2508 | 41.8000 | 41.800 | 149.885 | 342 |  | +0.00 |
| p41→p42 | 2560 | 42.6667 | 42.670 | 150.755 | 344 |  | -0.20 |
| p42→p43 | 2640 | 44.0000 | 44.000 | 152.085 | 347 | oui | +0.00 |
| p43→p44 | 2718 | 45.3000 | 45.300 | 153.385 | 350 |  | +0.00 |
| p44→p45 | 2770 | 46.1667 | 46.170 | 154.255 | 352 |  | -0.20 |
| p45→p46 | 2848 | 47.4667 | 47.470 | 155.555 | 355 | oui | -0.20 |
| p46→p47 | 2930 | 48.8333 | 48.840 | 156.925 | 358 |  | -0.40 |
| p47→p48 | 2981 | 49.6833 | 49.690 | 157.775 | 360 |  | -0.40 |
| p48→p49 | 3060 | 51.0000 | 51.000 | 120.545 | 275 | oui | +0.00 |
| p49→p50 | 3113 | 51.8833 | 51.890 | 121.435 | 277 |  | -0.40 |
| p50→p51 | 3192 | 53.2000 | 53.200 | 122.745 | 280 |  | +0.00 |
| p51→p52 | 3271 | 54.5167 | 54.510 | 124.055 | 283 | oui | +0.40 |
| p52→p53 | 3376 | 56.2667 | 56.260 | 125.805 | 287 | oui | +0.40 |
| p53→p54 | 3480 | 58.0000 | 58.000 | 127.545 | 291 | oui | +0.00 |

## Remplacer les clics par la musique
Quand `storm-ii.mp3` arrivera et que `assets/audio/storm-ii-montage-60s.wav` sera refait (commande dans MUSIQUE.md), copier le fichier dans `film/assets/audio/` et changer une seule ligne de `film/index.html` :
`src="assets/audio/click-60s.wav"` → `src="assets/audio/storm-ii-montage-60s.wav"` (ou ajuster `build-skeleton.mjs` puis le relancer tant que la racine n'a pas été retouchée).

## Limites et points ouverts
- Les vraies images ne sont pas encore là : l'état « image » n'a été vu que sur trois mires. Lancer `node tools/timeline/sync-footage.mjs` à leur arrivée, puis `check` et des snapshots.
- La GSAP de la racine reste l'URL jsDelivr du gabarit (`gsap@3.15.0`), que le CLI sert depuis sa copie embarquée ; aucun échec réseau relevé par `check`.
- Répartition égale des sources de P46 et P52 et coupe franche entre elles : choix mécanique, à reprendre.
- Les scènes p52–p54 portent une carte au même minutage ; si `cosmos-vfx` y dépose des scènes sans marqueur ni zone `hf-footage`, les deux scripts les laissent intactes (signalées).
- `film/assets/luts/lkdv-trailer.cube` (autre agent) n'a pas été touché.
