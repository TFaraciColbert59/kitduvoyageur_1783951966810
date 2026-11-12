# P4 — Acte 3 « Déclic » : P06 à P10 animés (landscape-director)

Rapport tenu au fil de l'eau (plans traités dans l'ordre).

| Plan | Mouvement | Raccords |
|---|---|---|
| P06 325–403 | Images 0–15 : fin de `TR.glassPass` (p 0,62→1, gouttes qui grossissent, éclat chaud qui retombe), échelle totale 1,08 compensée du « settle » pour reprendre exactement la dernière image de P05. Puis travelling latéral (70 px vers la gauche du décor) + poussée en `inCubic` sur le téléphone à partir de 45 % (S 1,08→1,80), flou de zoom proportionnel à la poussée, micro-tremblement qui s'éteint, pluie au premier plan sur la vitre plus rapide que le fond (parallaxe) | entrée = passage de vitre de P05 ; sortie au plus rapide de la poussée, vers le téléphone |
| P07 403–482 | img07, élan de P06 freiné (exp, 7 images) + poussée lente S 1,08→1,33 sur l'écran, flou de zoom d'entrée qui retombe, tremblement de main (bruit à graine). Écran VERT intact. Caméra exposée : `window.__lkdvCam.p07(f) → {S, cx, cy}` ; écran vert mesuré : boîte 789–1107 × 178–795 (haut 800–1067 à y 200, bas 828–1107 à y 700) | entrée dans la direction de la poussée de P06 ; sortie lente (turquoise à venir avec E1) |
| P08 482–508 | img08, impact (coup de zoom 1,22→1,10 en ~5 images, secousse et flou qui retombent), micro-poussée vers la pupille, halo turquoise additif sur le reflet qui gonfle jusqu'à la coupe | sortie sur le rond de la pupille |
| P09 508–560 | img07 : tape (10 images, petit coup de zoom + secousse), puis poussée inCubic exponentielle S 1,30→9 sur le centre de l'écran (945, 485), flou de zoom jusqu'à 0,10. **PROVISOIRE** : img09 incrusté dans l'écran par un masque calculé à l'exécution sur les pixels verts d'img07 (le pouce reste devant), photo tenue en espace écran ; dernière image = img09 plein cadre à 1,08. ui-builder remplacera par E1 (`window.__lkdvCam.p09`) | entrée : jump-cut sur img07 ; sortie = img09 à 1,08, identique à l'entrée de P10 |
| P10 560–614 | img09, drone : parallaxe 2 plans coupés à l'horizon (y 588, fondu 46 px), falaises S 1,08→1,36, eau +14 % de plus, roulis FPV ≤ 0,7°, flou de vitesse qui part de celui de P09 et remonte avec la course | coupe sèche au plus rapide |

## Contrôles (sorties réelles)
- `npx hyperframes lint` : 0 errors, 0 warnings (56 fichiers).
- `npx hyperframes check --json` : ok true ; lint/runtime/layout/motion/contrast/craft/audio 0 erreur, 0 avertissement.
- `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"mismatches":0,"maxAbsFrameOffset":0}`.
- Snapshots regardés : images 324, 325, 326, 345, 364, 402, 403, 404, 442, 481, 482, 483, 495, 507, 508, 509, 520, 534, 548, 559, 560, 561, 587, 613, 614 → `qa/snapshots/p4-acte-3/fNNNN.jpg` + planches `sheet-*.jpg` (toutes < 400 Ko).

## Faible / non vérifié
- P06 : la pluie de premier plan est discrète (peu lisible en vignette) ; la poussée finale cadre Léa et le téléphone mais pas encore l'écran seul → saut d'axe vers le POV de P07 (pas de raccord de forme strict).
- P09 : écran déjà rempli par le lac dès la 1re image (P07 finit en vert) ; incrustation provisoire. Liseré sombre du bord de l'écran visible vers l'image 548 (passage de la coque), voulu mais non affiné.
- P10 : coupure eau/falaises en ligne droite : léger cisaillement possible des rochers de la rive gauche près de l'horizon, non regardé à 100 %.
- Image 614 : la capture à 10,2333 s montre encore P10 (arrondi de l'instant à la frontière) ; le raccord avec P11 n'est pas vérifié.
- Aucun rendu MP4, aucune déclinaison 9:16, pas d'étalonnage (`media-treatment`) appliqué.
