# P52 — la remontée de nuit refaite (défaut P0-3 de `REVIEW-V6.md`) — cosmos-vfx

15/11/2026. Plan P52 du film : images **1293 à 1334** (inchangées), **42 images à 24 i/s, 1,75 s**. C'est un projet autonome `trailer/remontee-lab/`. Rien n'est modifié dans `film/`, `motion-lab/` ni `ouverture-lab/`, et rien n'est commité.

## Ce qui est fait

Une remontée **continue, de nuit du début à la fin, en un seul mouvement de caméra**. C'est le miroir de la descente de l'ouverture, en sens inverse :

| Images du plan (film) | Ce qu'on voit |
|---|---|
| 0–4 (1293–1297) | On quitte Noah par la vitre du bus. La dernière image montée de P51 recule déjà à l'image 0 (flou de zoom radial). Pluie sur la vitre (gouttes et coulures), néons roses, bleus et ambrés flous. La vitre se fond dans la rue, sans cadre « photo ». |
| 4–12 (1297–1305) | On s'élève au-dessus de la ville de nuit : la rue aux phares (img05), puis les toits et les rues éclairées (img04), toutes deux passées de nuit. Les lumières restent chaudes. |
| 10–21 (1303–1314) | Traversée d'une couche de nuages **sombres** en code : lambeaux qui convergent vers le point de fuite, puis nappe pleine. Ils sont éclairés d'en dessous par une lueur orangée de ville, puis d'en haut par un peu de lune (bleu froid). La nappe se déchire sur la Terre de nuit (dès 19). |
| 21–31 (1314–1324) | Montée jusqu'à l'orbite au-dessus de l'Europe illuminée, avec une vrille (jusqu'à 12° au milieu) qui se défait. Elle freine sur le temps 31. |
| 31–41 (1324–1334) | Se pose exactement sur le cadrage de l'image 1335 : img39 plein cadre, échelle 1, centrée, sans roulis. |

Aucune image de jour, aucun ciel bleu, aucun texte ni logo.

## Technique

- Fichiers :
  - `remontee-lab/compositions/p52.html` : scène `p52`, bloc CONFIG, plaques cachées, un canvas WebGL2 ;
  - `remontee-lab/lib/remontee/remontee.js` : le moteur, un seul shader.
- **Plaques emboîtées** autour d'un même point de fuite S = (844, 425) :
  - dans img39, c'est Paris ;
  - dans P51, c'est un point de la vitre ;
  - l'emboîtement : P51 dans img05 (la rue, ×8), img05 dans img04 (les toits, ×3), img04 dans img39 (×12).
- **Échelle d'img39** : `ln S` interpolé de façon monotone par les repères. Elle va de 288 (P51 plein cadre) à 1.
  - Vitesse : environ 0,23 par image au départ, 0,24 dans les nuages, puis freinage à l'orbite ; pente −0,004 à la dernière image.
  - La fin (`motion-lab/scenes/v6.js`) repart ensuite en très légère poussée (`pushFor`) : le changement de sens est quasi nul.
- **Nuages** : coordonnées log-polaires autour de S, même grammaire que l'ouverture, avec une phase qui fait converger les lambeaux.
- **Matière** :
  - pluie (gouttes, coulures) sur un plan plus proche qui rétrécit plus vite que la vitre ;
  - néons en bokeh accrochés à la rue ;
  - flou de zoom radial (8 échantillons).
- **Pas d'étalonnage du film ici** : l'assemblage l'applique. Les bandes 2,39:1 ne sont pas posées.
  - Un plancher encre (`max(c, encre × 0,35)`) empêche tout noir pur.
  - Un léger relevé des noirs au milieu du plan s'efface aux deux bouts : la dernière image reste la plaque img39 brute.
- **Matière de départ** : `flow/clips/incrustes/p51.mp4`, image source 43, extraite en `remontee-lab/assets/footage/p51-43.png`. Le dossier est ignoré par git, comme les autres plaques copiées (img04, img05, img39).
- **Déterminisme** : fonction pure du numéro d'image (timeline GSAP + `hf-seek`), aucune horloge, aucun aléatoire réel. Contrôle `DUREE` ↔ `data-duration` à l'exécution (`console_error`, donc `check` échoue en cas d'écart).

## Calage (bloc CONFIG, en images du plan ; image du film = 1293 + n)

```js
window.LKDV_REMONTEE = { T_NUAGES: 10, T_SORTIE: 21, T_ORBITE: 31, DUREE: 42, FPS: 24 };
```

Temps 124, 125 et 126 de `mix-v4.beats.json` (images 1303, 1314, 1324) : chaque événement tombe à l'image près sur ces temps.

| Repère | Image du plan | Image du film | Ce qui s'y passe |
|---|---|---|---|
| `T_NUAGES` | 10 | 1303 (temps 124) | les nuages entrent |
| `T_SORTIE` | 21 | 1314 (temps 125) | sortie : la trouée finit de s'ouvrir (on devine la Terre dès 19) |
| `T_ORBITE` | 31 | 1324 (temps 126) | arrivée en orbite, freinage |

Tout le reste est normalisé entre ces repères. Le rendu de contrôle utilise le son de `mix-v5.wav`, mêmes images.

## Raccords

- **Entrée (1292 → image 0)**.
  - Le film à 1292 est la même image que la source 43, au même cadrage (ajustement mesuré : échelle 1,000, décalage 0 ; seuls l'étalonnage et les bandes diffèrent).
  - Mon image 0 = la même image, déjà en recul de 2,5 % (meilleur ajustement à ×0,975) avec flou de zoom et pluie. Écart moyen avec la source : 14,5/255.
  - La coupe se lit comme un départ de caméra, sans saut de cadre (`raccord-entree.png`).
- **Sortie (image 41 → 1335)**.
  - Mon image 41 = img39 brute plein cadre : écart moyen **0,35/255** (le plancher encre ne touche que quelques pixels quasi noirs).
  - L'image 1335 du film = img39 à l'échelle 1 (`reculFin = 1`, `pushFor(0) = 1`), centrée, puis étalonnée et sous bandes : même cadre, même lumière (`raccord-sortie.png`).

## Contrôles

- `npx hyperframes lint` : 0 erreur ; `npx hyperframes check --json` : ok:true.
- **Identité stricte** : 6 images (0, 6, 15, 21, 31, 41) capturées deux fois dans deux sessions sont identiques octet pour octet.
- **Rendus** (dans `trailer/remontee-lab/renders/`, ignoré par git) :
  - `remontee-v1.mp4` : h264 1920×1080, 24/1, **42 images, 1,750 s**, `blackdetect` (seuil 0,05) sans aucune plage noire ;
  - `remontee-v1-controle.mp4` (**66 images, 2,750 s**) : 12 images du film v6 (1281–1292), puis les 42 images de P52 (avec les bandes 2,39:1 ajoutées pour ce contrôle seulement, sans étalonnage), puis 12 images du film (1335–1346), et le son de `qa/mix-v5.wav` de 53,375 à 56,125 s.

## Mesures (`qa/snapshots/remontee/mesures.json`, `mouvement.json`)

**Luminance moyenne (0–1), image par image.** Max **0,184** (image 6, la ville avec les néons), min 0,097 (image 41 = img39). Elle baisse ensuite régulièrement jusqu'à l'orbite.

| Référence | Luminance |
|---|---|
| Nuit autour, non étalonnée : P51 source 43 | 0,185 |
| Nuit autour, non étalonnée : img39 | 0,096 |
| Film étalonné, hors bandes : 1292 | 0,199 |
| Film étalonné, hors bandes : 1335 | 0,108 |
| **Ancienne P52**, mêmes images du film v6 | max **0,416** (image 35 du plan) et 0,32–0,41 sur 28–36 : l'éclair de jour |

Le maximum de la nouvelle P52 ne dépasse pas la nuit qui l'entoure, et il est 2,3 fois plus faible que l'ancien.

**Autres contrôles de couleur.** Noir pur : 0 pixel. `#E4501C` : 0. `#1C2620` : au plus 7,1 % des pixels, sur les images d'img39 elles-mêmes (le bleu-noir de la mer de la plaque, identique dans la fin) ; dans les nuages, au plus 0,5 % après correction.

**Mouvement image à image.** Différence RVB moyenne sur réductions 480×270.

| Plage | Nouvelle P52 : moyenne (min–max) | Ancienne P52 |
|---|---|---|
| Plan entier | 9,55 (2,5–23,9) | 10,9, **max 38,8** (sauts de plaque) |
| 0–10 | 13,8 | — |
| 10–21 | 8,2 | — |
| 21–31 | 10,1 | — |
| 31–41 | 6,2 | — |

## Preuves (`trailer/qa/snapshots/remontee/`, non ignoré par git)

- `planche-toutes.png` : les 42 images, 7 colonnes, numéro sous chaque vignette.
- `raccord-entree.png` : film 1292 | image 0 | image 1.
- `raccord-sortie.png` : image 40 | image 41 | film 1335.
- Pleine taille (JPEG) : `00-vitre-bus.jpg`, `06-ville.jpg`, `15-nuages.jpg`, `24-orbite.jpg`.
- `mesures.json`, `mouvement.json` (avec l'ancienne P52 en regard).

## Ce qui reste faible ou non vérifié — franchement

- **Pas vu en mouvement, pas écouté.** Le rendu de contrôle existe, je ne l'ai pas regardé en lecture ; le jugement est sur planches et mesures.
- **Le mouvement « accélère » surtout en apparence.** En échelle, le recul est fort dès l'image 0 (comme demandé), monte un peu dans les nuages, puis **freine** de 21 à 41 pour se poser sur le cadrage de 1335. Les images 31–41 sont presque fixes (mouvement 6,2, surtout la vrille qui se défait) alors que la musique monte vers 1387. Si l'on veut que ça pousse jusqu'au bout, il faudrait que la fin reprenne le mouvement.
- **Vitre → ville (1–9)** : la vitre de P51 rétrécit dans une rue vue de haut (img05). C'est fondu, flou et pluvieux, mais en arrêt sur image on lit une image dans l'image ; il n'y a pas de vrai extérieur de bus.
- **La ville (img04/img05) très agrandie et filée** : 8–12 est une bouillie bleue avec des points chauds, sans lecture nette des rues.
- **Les nuages (13–18)** sont sombres et brun-gris, un peu « tunnel » au centre ; l'éclairage lune/ville reste subtil.
- **L'image 0 n'est pas étalonnée** alors que 1292 l'est : la continuité de teinte dépend de l'assemblage (P52 doit recevoir le même étalonnage commun). Même chose pour les bandes 2,39:1.
- **Déterminisme vérifié sur ce Mac seulement** (GPU Apple M2).

## Intégration (à faire par l'orchestrateur)

Remplacer P52 du film par la scène `p52` de `remontee-lab/` aux images 1293–1334 :
- copier `compositions/p52.html`, `lib/remontee/` et les plaques `p51-43.png`, img04, img05, img39 ;
- ou monter `renders/remontee-v1.mp4`.

Il faut ensuite appliquer l'étalonnage commun et les bandes comme pour les plans voisins.
