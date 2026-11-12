# P4 — Acte 4B : P16 à P19 animés (landscape-director)

Même mécanique que P11–P15 : l'image de la zone `hf-footage` (masquée) est peinte dans un canevas par `FX.bindClock` ; caméra `camAt(f)` bridée par `fit()` (échelle + roulis, l'image ne découvre jamais ses bords) ; flou de mouvement réel = moyenne de la caméra sur l'obturation ; tremblement de main à graine. Cartes provisoires du squelette retirées. Caméras exposées dans `window.__lkdvCam.p16` … `p19` (`{S, cx, cy, rot}`).

| Plan | Mouvement | Raccords |
|---|---|---|
| P16 928–1034 img42 | entrée : la caméra continue de descendre en freinant (cy 470 → 545, outCubic 40 i), roulis −2° → 0 (outExpo 12 i) ; Léa qui sourit cadrée large jusqu'à ~l'image 38 ; puis descente vers le téléphone (position inOutCubic 58 i, échelle inCubic S → 3,2), centré sur l'écran | entrée sur la chute de P15 (même sens vertical, roulis repris) ; sortie au plus rapide de la poussée |
| P17 1034–1060 img43 | la poussée de P16 continue en freinant (S 1,10 → 1,22, outExpo 9 i) ; appui dès l'image 17 : coup de zoom inExpo (S → 1,52) + secousse à graine croissante jusqu'à la coupe | IMPACT sur la coupe 1060 |
| P18 1060–1139 img44 | entrée : poussée qui freine (S 1,10 → 1,18) + secousse qui retombe en ~10 i ; contre-plongée simulée : la caméra se relève en poussant (cy 600 → 520) vers le sac au centre ; roulis 0,5° → 0 ; dernière accélération inCubic (S → 1,62) | entrée sur l'impact (sonnette) ; sortie en poussée vers le lit |
| P19 1139–1191 img12 | poussée rapide (S 1,10 → 1,45, outCubic 20 i) vers le sac, roulis 0 → +3° (inOutSine), puis nouvelle accélération inCubic (S → 2,45) sur la boucle de la sangle (≈ 936, 590) | entrée en poussée (sens de P18) ; sortie au plus rapide vers la boucle (P20) |

**Écran à la fin de P16** (image 1033, mesure sur le PNG 1920×1080, pixels verts) : lignes 239 à 866 → **58,1 % de la hauteur du cadre** (à l'image 1010 : 32,7 %). Écran vert et ses quatre croix intacts.

## Contrôles (sorties réelles, après la dernière retouche)
- `npx hyperframes lint` : 0 errors, 0 warnings (56 fichiers).
- `npx hyperframes check --json` : ok true ; lint/runtime/layout/motion/contrast/craft/audio : 0 erreur, 0 avertissement.
- `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}`.
- Snapshots regardés (instants (f + 0,5)/60) : 927, 928, 929, 960, 981, 1010, 1033, 1034, 1035, 1047, 1059, 1060, 1061, 1100, 1138, 1139, 1140, 1165, 1190, 1191 → `qa/snapshots/p4-acte-4b/fNNNN.jpg` (1280×720) + planches `sheet-1..3.jpg` (toutes < 400 Ko).

## Faible / non vérifié
- P16 fin : agrandissement ×3,2 d'une image 1920 : le drap et le bord du téléphone sont mous (l'écran sera remplacé par l'incrustation E5, mais le cadre du téléphone reste visible).
- P15 → P16 : sens vertical repris, mais l'échelle saute (P15 serré sur l'écran tenu → P16 large sur le lit) ; raccord de mouvement plus que de forme.
- P16 → P17 : téléphone vertical posé → téléphone horizontal tenu ; raccord par la poussée, pas par la forme.
- P18 : la « contre-plongée » est simulée (relevé de caméra), l'image source est presque frontale.
- P19 → P20 : la boucle de la sangle de P19 est au centre à la coupe, la boucle de P20 aussi : bon raccord de forme, mais sous des angles différents.
- Rien n'est écouté (phase musicale de l'impact P17 non vérifiée) ; pas de rendu MP4, pas de 9:16, pas d'étalonnage.
