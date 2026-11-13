# P4 — Acte 6 (P26–P32), landscape-director

**Fichiers modifiés** : `film/compositions/p26.html` … `p32.html` (gabarits remplacés par la mécanique de p25 : image de la zone hf-footage → canvas `FX.bindClock`, caméra bornée par `fit()`, flou de mouvement par sous-images, tremblé à graine). Zone hf-footage, durées et hôtes inchangés.

**Contrôles** (après la dernière retouche) : `npx hyperframes lint` → `0 errors, 0 warnings` ; `npx hyperframes check --json` → `ok: true` ; `node tools/timeline/compare-timeline.mjs` → `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}` ✓.

**Preuves** : `qa/snapshots/p4-acte-6/*.jpg` (24 JPEG < 160 Ko) : début/milieu/fin de chaque plan + images 1505, 1509, 1610/1614, 1715/1719, 1767/1771, 1820/1824, 1899/1903, 1952/1956, 2005/2007/2011. Toutes regardées : aucun bord, trou ni aplat noir.

| Plan | Mouvement | Raccord d'entrée |
|---|---|---|
| P26 ★ Seceda | montée qui s'amortit (cy 660→520), puis glissé lent vers la droite le long de la crête, S 1,35→1,42 ; sortie : glissé qui accélère + poussée | prolonge l'arrachement vers le haut de P25 (roulis -1,2°→0) |
| P27 ★ Tre Cime | FPV : poussée à rampe (S 1,30→1,65) en passant au-dessus de l'arête, roulis ±2° ; sortie : piqué vers le groupe (S→2,0) | glissé droit de P26 amorti |
| P28 | poussée courte vers les mains (S 1,25→1,55) ; sortie : panoramique droit vers l'épaule de Léa | prolonge le piqué (zoom et descente) |
| P29 | dérive vers le téléphone net (S 1,35→1,50), vert intact, `window.__lkdvCam.p29(f)` ; sortie : levée vers le haut | panoramique droit de P28 amorti |
| P30 ★ Sorapis | élévation qui s'amortit, glissé droit, léger recul ; Léa minuscule sur la rive ; sortie : poussée vers Léa | levée de P29 |
| P31 | dérive vers le téléphone, vert intact, `window.__lkdvCam.p31(f)` ; sortie : panoramique gauche | poussée de P30 amortie |
| P32 | suit Malik vers la gauche ; 8 dernières images : filé gauche qui accélère (cx -200, S +0,30, roulis -2°, obturateur ×4), pas de noir | panoramique gauche de P31 |

**Faiblesses, franchement** : P32 — la tête de Malik est au ras du bord haut de l'image source (y ≈ 54 px) : à S ≥ 1,3 elle reste coupée, acceptable car il est flou, mais visible. P27 — le piqué de sortie et l'entrée sont très flous (≈ 10 images) : voulu, à juger en lecture. Raccords « même vitesse » estimés, non mesurés (vitesse écran P25 en sortie ≈ 150 px/image, P26 entre à ≈ 40 px/image : la décélération est franche). P33 est encore un gabarit : le raccord sortant de P32 (filé gauche) est à reprendre côté acte 7. Pas de déclinaison 9:16, pas d'étalonnage (hors périmètre). Lecture vidéo en continu non faite (snapshots seuls).
