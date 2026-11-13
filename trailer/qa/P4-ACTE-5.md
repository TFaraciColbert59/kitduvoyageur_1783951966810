# P4 — Acte 5 « Départ » : P20 à P25 animés (landscape-director)

Même mécanique que P19 : image de la zone `hf-footage` peinte dans un canevas via `FX.bindClock` (`lib/fx/core.js`), caméra `{S, cx, cy, rot}` bridée par `fit()` (rotation comprise : les bords ne sont jamais découverts), flou de mouvement par obturateur (0,6 image, jusqu'à 12 échantillons), tremblement à graine. Chaque caméra est exposée dans `window.__lkdvCam.pNN(f)`.

| Plan | Mouvement | Raccords |
|---|---|---|
| P20 1191–1219 img13 | impact à l'image 0 : coup de zoom S 1,30 → 1,42 en 2 i + secousse à graine (décroissance 0,62^f) ; retombée S → 1,16 ; 8 dernières images : poussée inCubic S → 1,30 | entrée sur la poussée de P19 vers la boucle (boucle au centre des deux côtés) ; sortie en poussée |
| P21 1219–1271 img14 | rotation continue 0 → −16°, poussée S 1,30 → 1,90 vers le centre de la spirale ; filé latéral final cx +300 (inCubic, 14 i) | sortie au plus rapide, l'image file vers la gauche |
| P22 1271–1323 img15 | glissé latéral cx 720 → 1200 (outExpo), S 1,36 → 1,30, vibration du train qui s'éteint ; arrêt à la fin | entrée sur le filé de P21, même sens |
| P23 1323–1402 img16 | rampe p = 0,5 + 0,5·signe(x)·\|x\|³ (+0,04x) : entrée rapide vers la droite S 1,75 → 1,42, ralenti net sur la tente au centre, relance vers le sol (cy → 800, S → 1,85) | sortie vers le sol (jambes, gravier) → P24 au ras du sol |
| P24 1402–1454 img17 | avancé bas S 1,15 → 1,28 avec rebond de pas ; montée finale cy → 400, S → 1,40 (inCubic, 16 i) | sortie en montée vers le haut du corps |
| P25 1454–1507 img18 | entrée : l'image descend encore (cy 720 → 660) ; poussée vers le téléphone S 1,50 → 2,10 ; écran vert intact ; sortie « drone » cy → 280, S → 1,85, roulis −2° (inCubic, 14 i) | `window.__lkdvCam.p25(f)` pour l'incrustation E7 ; sortie vers le haut → P26 Seceda |

## Contrôles (après la dernière retouche)
- `npx hyperframes lint` : 0 errors, 0 warnings (56 fichiers).
- `npx hyperframes check --json` : ok true ; lint, runtime, layout, motion, contrast, craft, audio : 0 erreur, 0 avertissement.
- `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}`.
- Snapshots regardés (instants (f + 0,5)/60) : 1190, 1191, 1205, 1218, 1219, 1245, 1270, 1271, 1297, 1322, 1323, 1362, 1401, 1402, 1428, 1453, 1454, 1480, 1506, 1507 → `qa/snapshots/p4-acte-5/fNNNN.jpg` (1280×720) + `contact-sheet-1..3.jpg`, toutes < 400 Ko. Aucun bord découvert, aucun texte.

## Faible / non vérifié
- P22 : pas de séparation de plans (le premier plan ne file pas plus vite que les montagnes) ; glissé 2D seul. Le flou de l'image source porte l'illusion.
- P21 : la rotation se fait autour du centre de l'écran, pas de l'axe exact de la spirale (le bridage interdit de centrer la spirale, basse dans l'image) ; fin très floue (filé + rotation + S 1,9).
- P22 → P23 : P22 s'arrête, P23 repart vite vers la droite : raccord de sens, pas de vitesse (voulu par la trame : « arrêt »).
- P24 : la poussière n'est pas animée (seulement celle de l'image) ; P25 → P26 : P26 commence large et lent, l'arrachement vers le haut n'y est pas repris (hors périmètre).
- Rien écouté (calage de l'impact P20 sur le temps musical non vérifié) ; pas de rendu MP4, pas de 9:16, pas d'étalonnage.
