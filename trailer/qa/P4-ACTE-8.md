# P4 — Acte 8 (P40–P45) — landscape-director

Fichiers : `film/compositions/p40.html` … `p45.html` (même mécanique que p38/p39 : canvas piloté par `FX.bindClock`, caméra bornée `fit`, flou de mouvement par sous-poses, tremblé à graine). Hôtes, durées, `index.html`, `shots.json`, `lib/` intacts. Aucun téléphone à écran vert dans cet acte (pas de `__lkdvCam`).

Contrôles (depuis `film/`, puis `trailer/`) :
- `npx hyperframes lint` : `0 errors, 0 warnings` (56 fichiers).
- `npx hyperframes check --json` : toutes les sections `"ok": true`, `"errorCount": 0` (rapport `film/.hyperframes/artifacts/checks/…`), relancé après la dernière retouche.
- `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}` · `✓ timeline = shots.json à l'image près`.

Preuves (regardées) : `qa/snapshots/p4-acte-8/fNNNN.jpg` (début, milieu, fin de chaque plan + ±2 images autour des coupes 2429, 2508, 2560, 2640, 2718, 2770, 2848) et `planche-1..4.jpg`.

Par plan :
- P40 ★ img30 : entre sur le filé droit de P39 (cx +110 en outCubic, roulis +2° → 0), travelling latéral lent, Clara minuscule et lisible sur le gravel, sommets enneigés dans le cadre. Sortie : poussée vers Clara (S +0,45).
- P41 img31 : naît de la poussée (S 1,12 → 1,22), cadré moyeu + pédale, tremblé de piste. Sortie : montée + roulis +3°.
- P42 ★ img32 : plongée verticale, rotation continue −3° → +3° dans le sens du roulis entrant, Clara dans l'épingle au centre. Sortie : bascule vers le haut.
- P43 ★ img48 : naît de la bascule (cy décroît puis se pose), élévation S 1,08 → 1,04, Ra Gusela et Clara dans le cadre. Sortie : poussée rapide vers Clara.
- P44 img33 : cadre calé en haut, S ≤ 1,055 : gants et casque entiers. Sortie : filé droit (cx +200).
- P45 img34 : naît du filé droit (cx +190 en 12 images), puis décélération sur tout le plan, tremblé éteint ; les images 2846–2847 sont quasi posées, aucune image noire avant l'outro.

Flou de coupe limité à 4 images par côté (obturateur élargi seulement sur f < 4 et f > N−4).

Faible / non vérifié :
- Les sorties de P40, P42, P43 et P44 restent très floues sur leurs 2–3 dernières images (vitesse forte, voulue pour le raccord) ; à l'image près, la sortie de P44 coupe brièvement les mains (S 1,3).
- Raccords vérifiés sur images fixes seulement, pas en vidéo : continuité de vitesse estimée, pas mesurée. Pas de rendu de l'acte.
- Entrée de P43 : sommet de Ra Gusela très près du bord haut sur les 2 premières images.
- 9:16 non traité (hors brief).
