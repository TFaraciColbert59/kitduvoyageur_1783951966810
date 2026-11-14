# P4 — Acte 4A « Décision » : P11 à P15 animés (landscape-director)

Rapport tenu au fil de l'eau. Mécanique commune : l'image de la zone `hf-footage` (masquée) est peinte dans un canevas par `FX.bindClock` ; caméra = fonction `camAt(f)` (f fractionnaire possible), bridée pour ne jamais découvrir les bords (échelle et roulis pris en compte) ; flou de mouvement réel = moyenne de la caméra sur l'obturation (0,5–0,6 image), nombre d'échantillons selon la vitesse ; tremblement de main à graine.

| Plan | Mouvement | Raccords |
|---|---|---|
| P11 614–692 img10 | à-coup d'entrée (S 1,24 → 1,14, secousse qui retombe en ~6 i), caméra à l'épaule qui suit l'élan à droite et vers le haut (cx 930 → 1010, cy 585 → 505), roulis ≤ 0,8° ; dès l'image 46, poussée inCubic sur le téléphone (≈ 800, 575 ; S → 1,95) | entrée coupe sèche depuis le lac ; sortie au plus rapide, caméra vers la gauche (image qui glisse à droite) |
| P12 692–745 img40 | glissé latéral : élan de P11 freiné (cx +75 → 0 en ~9 i), dérive lente à gauche, puis poussée inCubic sur l'écran (S 1,36 → 1,70) dès l'image 34. Écran VERT intact. `window.__lkdvCam.p12(f) → {S, cx, cy, rot:0}` ; écran vert : boîte 983–1168 × 271–676 | même sens que P11 à l'entrée ; sortie en poussée |
| P13 745–823 img41 | poussée de P12 freinée (exp, 6 i) puis poussée douce S 1,14 → 1,36, accélérée sur les 12 dernières images. Écran VERT intact. `__lkdvCam.p13` ; écran vert : boîte 890–1267 × 139–786 (téléphone incliné) | entrée en poussée ; sortie en poussée vers les volets |
| P14 823–876 img11 | triptyque (bandes 0–640, 640–1280, 1280–1920) : volets qui s'ouvrent depuis leur axe (outExpo, 7 i) sur les demi-temps (0 ; 14,85 ; 28,0 — temps entiers à +1,7 et +28,0), chaque bande arrive 10 % trop grande et se pose, micro-mouvement propre (Sami poussée, Inès montée, Tom poussée + remontée), bridé dans sa bande source ; fermeture inExpo décalée de 2 i à partir de 41,15 ; liseré crème léger sur les lèvres en mouvement | entrée sèche ; sortie sur l'encre (volets fermés) |
| P15 876–928 img41 | autre cadrage que P13 : départ serré et décalé (S 1,30, cx 1150), poussée franche outCubic vers l'écran (S 1,72 à l'image 38), puis chute vers le bas inCubic (cy +340 jusqu'à la butée, roulis → −2°). Écran VERT intact. `__lkdvCam.p15(f) → {S, cx, cy, rot}` (rot non nul seulement après l'image 38) | entrée sèche depuis les volets ; sortie au plus rapide vers le bas |

## Contrôles (sorties réelles)
- `npx hyperframes lint` : 0 errors, 0 warnings (56 fichiers), relancé après la dernière retouche.
- `npx hyperframes check --json` : ok true ; lint/runtime/layout/motion/contrast/craft/audio 0 erreur (lancé avant la retouche d'une ligne de P14 `OPEN[0]` 0 → −2,5, non relancé).
- `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"mismatches":0,"maxAbsFrameOffset":0}`.
- Snapshots regardés (instants (f + 0,5)/60 pour éviter l'arrondi de frontière) : 613, 614, 615, 653, 690–693, 718, 743–746, 784, 821–824, 826, 828, 832, 838, 851, 858, 866, 870, 875–877, 902, 926, 927 → `qa/snapshots/p4-acte-4a/fNNNN.jpg` (1280×720, < 400 Ko) + planches `sheet-*.jpg` (les planches `sheet-snap-*` montrent encore l'ancienne image 823 toute encre, corrigée : voir `f0823.jpg`, `sheet-snap2-*`).
- Correction faite après regard : P14 image 823 était entièrement encre (volet de Sami fermé à f = 0) → ouverture avancée de 2,5 images, la première image montre déjà la bande de Sami presque ouverte.

## Faible / non vérifié
- P11 : au début (S 1,24, cy 585) le haut de la tête de Léa est coupé ; voulu (elle se lève dans le cadre) mais discutable.
- P11 → P12 : raccord de sens (image qui glisse à droite) correct, mais l'échelle saute (poussée S 1,95 sur le téléphone → gros plan img40 S ~1,4) : pas de raccord de forme strict.
- P13 → P14 : passage poussée → volet sur fond encre, raccord par le rythme plutôt que par le mouvement.
- P15 : la « chute » est une plongée de caméra vers le bas (l'image monte) ; le sens par rapport à l'entrée de P16 (plongée sur Léa allongée) n'est pas vérifié.
- Phase musicale de P14 calculée depuis le drop 1 (image 325, 26,3 i/temps), non écoutée.
- Écrans verts laissés intacts ; incrustations E2/E3/E4 non faites (ui-builder). Aucun rendu MP4, pas de 9:16, pas d'étalonnage.
