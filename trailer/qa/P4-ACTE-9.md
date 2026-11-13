# P4 — Acte 9 (P46–P51) — landscape-director

**Fichiers modifiés** : `film/compositions/p46.html` … `p51.html` (même mécanique que p45 : zone `hf-footage` source d'un canvas, `FX.bindClock`, caméra bornée par `fit`, flou de mouvement par sous-images, tremblé à graine). P52–P54, `index.html`, `shots.json`, `lib/` intacts.

**Contrôles** (lancés après la dernière retouche) :
- `npx hyperframes lint` → `0 errors, 0 warnings` (56 fichiers).
- `npx hyperframes check --json` → `"ok": true`, lint/runtime/layout/motion/contrast/craft/audio : `errorCount 0`, `warningCount 0`.
- `node tools/timeline/compare-timeline.mjs` → `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}` ✓.

**Preuves regardées** : `qa/snapshots/p4-acte-9/fNNNN.jpg` (21 JPEG 1280×720, 50–136 Ko) : 2846, 2850, 2889, 2928, 2932, 2955, 2979, 2983, 3020, 3058, 3062, 3086, 3111, 3115, 3152, 3190, 3194, 3231, 3269, 3270, 3273. Aucun bord, trou, aplat noir ou blanc ; téléphones entiers.

**Par plan**
- P46 (img35a→35b, 82 i) : 35a et 35b se superposent exactement (même cadrage) → fondu lissé images 8→74, poussée lente S 1,04→1,13 vers le feu, sans flou. Entrée : coupe franche depuis P45 posé, départ presque immobile.
- P47 (img36, 51 i) : roulis lent −1,4°→+1,0°, S 1,10→1,18, dérive à gauche ; prolonge la poussée de P46.
- P48 (img37, 79 i, vert E11) : posé, S 1,10→1,18, glisse vers le téléphone (cx 1000→1100). `__lkdvCam.p48(f)`.
- P49 (img37, 53 i, vert E12) : MÊME fonction caméra que P48 (`leaCam(79+f)`) → zéro saute à 3060 ; poussée qui accélère (S →1,66, u^2,2) puis bascule haute sur les 16 dernières images. `__lkdvCam.p49(f)`.
- P50 (img49 ★, 79 i) : drone qui recule et s'élève (S 1,45→1,06 géométrique, cy 706→515, roulis −1°→0), entre sur la bascule haute de P49 ; bivouac minuscule, lumineux, toujours dans le cadre.
- P51 (img38, 79 i, vert E13) : entre sur la descente du contenu (montée continuée), poussée lente vers le téléphone, puis arrachement vertical inCubic sur 18 images, flou vertical croissant, vers le zoom arrière de P52. `__lkdvCam.p51(f)`.

**Faible / non vérifié, franchement** : la fin de P51 (3266–3270) est très floue (filé ≈ 100 px) : voulu pour lancer P52, mais l'écran E13 y sera illisible. Le raccord P51→P52 est vertical d'un côté, zoom arrière radial de l'autre : cohérent (montée), pas identique. P46 entre en coupe franche (img34 → img35a, sujets différents) sans mouvement porteur. P50 démarre déjà assez large (le bivouac reste petit même à S 1,45). Lecture vidéo en continu non faite (snapshots seuls) ; vitesses aux coupes estimées, non mesurées. Pas de 9:16 ni d'étalonnage (hors brief).
