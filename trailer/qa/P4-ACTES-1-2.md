# P4 — Actes 1–2 : P01 à P05 animés (cosmos-vfx)

Fichiers : `film/compositions/p01.html` … `p05.html` (réécrits : carte provisoire retirée, plaque `hf-footage` gardée invisible comme source d'un canevas piloté par `FX.bindClock`). `index.html`, `shots.json`, autres scènes : non touchés.

| Plan | Mouvement | Coupe de sortie |
|---|---|---|
| P01 0–89 | poussée 1,08→1,156 + roulis 0→8° (inOutSine), identiques à `p01-halo.html` ; soleil qui perce (noyau + `lensFlare` qui montent) | `solarFlash` cut 89, 2+2 images, origine [1786,352] |
| P02 89–166 | entrée dans le flash ; poussée télé qui accélère vers les Dolomites (O = 960,450, 1,08→1,76), plongée (image monte de 70 px) | flou radial croissant (0→0,11) |
| P03 166–220 | chute, poussée 1,10→1,95, vibration à graine (dans la plaque, marge ≥ 10 %), flou radial 0,05→0,12 | `cloudPass` p = (F−198)/52, blanchi sur la coupe |
| P04 220–272 | même `cloudPass` continu (graine 404), trouée centrale sur la ville vers F 235–250, poussée 1,15→2,05 | ville floutée en zoom |
| P05 272–325 | `glassPass` p 0,2→0,62 (départ déjà lancé), vitre mesurée [939,505,40,62], intérieur = img06 recadré | dernière image = passage de la vitre (éclat chaud, img06 plein cadre) |

## Contrôles
- `npx hyperframes lint` : 0 erreur, 0 avertissement. `check --json` : ok true (lint/runtime/layout/craft 0 erreur).
- `compare-timeline.mjs` : 54 plans, mismatches 0, maxAbsFrameOffset 0.
- Snapshots regardés : `qa/snapshots/p4-actes-1-2/f<image>.jpg` (0, 44, 87, 88, 89, 90, 128, 165, 166, 193, 200, 212, 219b, 220, 232, 246, 260, 271, 272, 298, 323, 324, 325) ; halo : `p01-halo-limbe-f20-f44-f70.jpg` (le halo reste posé sur le limbe aux trois instants).

## Faible / non vérifié
- P01 : le mouvement imposé (inOutSine) arrive à vitesse nulle sur la coupe ; c'est le flash qui porte la coupe.
- Halo (`p01-halo.html`, non modifié) : lisible comme une ligne ondulée assez nette près du soleil vers l'image 20–44 — à revoir par son propriétaire.
- P04→P05 : saut d'échelle (ville vue de haut → toit en gros plan), même direction de zoom mais pas même vitesse mesurée.
- P05 image 323 : gros plan très serré sur le pull de Léa (zoom exponentiel de `glassPass`), puis image 324 plein cadre : saut sensible.
- P03 : blanchi presque uniforme env. 15 images autour de la coupe 220.
- Rendu MP4 0–325 non lancé (budget). Le raccord avec la scène P06 (autre agent) n'est pas vérifié au-delà de l'image 325.
