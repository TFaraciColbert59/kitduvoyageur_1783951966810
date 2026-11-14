# REVIEW-FINAL — film rendu `livraison/LKDV-trailer-16x9-son-v2.mp4` (qa-critic, 2026-11-14)

## Verdict
**Pas prêt à montrer, à cause de deux défauts bon marché** : (1) une image « flash » nette et autrement cadrée en tête de 19 plans à filé d'entrée (la 2e image est floue), qui fera clignoter les coupes à 60 i/s ; (2) l'écran de P48, au moment où Léa publie, affiche « Aucun tracé enregistré pour ce carnet » sur une carte du Centre-Val de Loire. Le reste a nettement progressé : l'ancien P0 et 9 des 11 anciens P1 sont corrigés, 14 écrans réels sans vert, son à −14,3 LUFS / −1,9 dBTP avec des effets calés à ≤ 1 image (sauf l'éclaboussure). Une fois (1) et (2) faits, le film est montrable en interne ; la diffusion publique attend en plus la licence de STORM II.

**Décompte : P0 = 0 · P1 = 4 · P2 = 12.**

### Les 5 corrections les plus rentables
1. **Image flash en tête de plan** (19 plans : P16, P17, P19, P20, P22, P26, P27, P29, P30, P32, P36–P43, P45) : l'image locale t=0 doit passer par la même caméra et le même filé que t=1/60 → fonction d'entrée commune (`film/lib/fx/transitions.js`) ou la caméra de chaque `film/compositions/pNN.html` ; contrôle : laplacien 1re/2e image ≤ 1,3.
2. **Écran de P48** : remplacer la capture provisoire E11x par un carnet Sorapis avec tracé et photos (`tools/phone/wire-film.mjs`, entrée `p48`) ; réutiliser pour P07.
3. **Noirs de P50** : `film/compositions/p50.html`, cube à 40–50 % + ombres relevées vers l'encre (2 % sombres ≈ (11, 22, 18) au lieu de (1,5 ; 6,9 ; 6,9)).
4. **Lumière de P31** : `film/compositions/p31.html`, réchauffer et désaturer le ciel pour la même heure dorée que P30.
5. **Éclaboussure P37** : avancer l'effet de 0,11 s (7 images) dans `tools/audio/build-mix.mjs --v2`, puis remesurer la crête AAC ; ou, au choix, le doublon d'image 3376 dans `film/compositions/p53.html` (une ligne).

## Mesures techniques
- `ffprobe -show_entries stream=codec_type,width,height,r_frame_rate,nb_frames,duration` : vidéo 1920×1080, 60/1, **3 600 images**, 60,000 s ; audio 60,000 s. OK.

## Son (mesuré sur le mp4 livré, pas écouté)
- `ffmpeg -i livraison/LKDV-trailer-16x9-son-v2.mp4 -vn -filter_complex ebur128=peak=true -f null -` : **−14,3 LUFS intégrés**, LRA 4,9 LU, **crête vraie −1,9 dBTP**. Cible −14 ±0,5 et ≤ −1 dBTP : OK.
- Effets contre image (enveloppe RMS 10 ms de la dérivée, mono 48 kHz) : clac P20 pic 19,857 s (image 1191,4 ; coupe 1192 : −0,6 image), +18 dB sur le fond aigu ; « Commander » P17 17,243 s (image 1034,6) ; déclic P31 32,130 s (image 1927,8), +21 dB ; éclaboussure P37 37,540 s (image 2252,4) ; logo : RMS max −3,8 dB à 58,01 s (image 3480,6). Tous à ≤ 1 image de leur cause annoncée.
- Repères (M = momentané / S = court terme, LUFS) : 5,41 s M −12,2 → −9,7 à 5,6 s ; 33,48 s M −13,1 → −9,8 à 33,7 s ; 47,47 s M −16,6 → −19,4 (creux voulu de l'outro) ; 51,00 s M −17,7 (S −21,3 → −20,1) ; 54,51 s M −18,4 → −14,6 ; 58,00 s M −12,1 → −11,1.

## Méthode
Décodage unique du mp4 en 480×270 (`ffmpeg … -vf scale=480:270:flags=area -f rawvideo`, script scratchpad `ext.py`), statistiques par image dans `qa/tmp/final/stats.npy` (moyenne, laplacien, écart à l'image précédente, part de noir max<6, `#E4501C` ±12, vert résiduel, 2 % les plus sombres). Images début/milieu/fin de chaque plan et bande ±12 images autour de chaque coupe : `qa/tmp/final/f*.jpg` ; pleines résolutions ciblées `F*.png` ; planches `a1/a4/a5/a7/a9.jpg`, zooms `phz0-2.jpg`, `p17.jpg`, `p38z.jpg`, `p43c.jpg`.

## Suivi des P0/P1 de `REVIEW.md`
| Ancien constat | État | Preuve |
|---|---|---|
| P0 P14 aplat d'encre | **corrigé** | encre ±14 : 12,5 % (823), 6 % (830–870), 23/47/80 % sur 873–875 seulement |
| P1 P53→P54 logo entier avant 3480, saut | voir acte 9–10 | |
| P1 P08 reflet « enveloppe » | **corrigé** | 482–507 : lac turquoise + flèche dans la pupille |
| P1 P08→P09 rond de la pupille | **corrigé, avec réserve** | 508–511 : le rond s'ouvre, mais sur un fond d'encre plein (voir P2) |
| P1 P04→P05 flou radial | **corrigé** | 271/272 : même flou radial, même centre |
| P1 flous de sortie P33–P44 | **amélioré** | netteté fin/milieu : P33 8,4/16,7 (avant 4,4/15,5), P35 16,5/26,3, P37 11,0/17,7, P39 13,3/18,1, P40 10,9/17,9, P43 13,8/21,2, P44 6,9/11,2 |
| P1 P38 Malik 8–10 px | **corrigé** | ≈ 27 px de haut à 2337 (zoom 4×, `p38z.jpg`) |
| P1 P45 gel 2829–2847 | **corrigé** | plus aucune image à écart < 0,15/255 dans le plan (médiane 1,67) |
| P1 P48→P49 coupe 3060 invisible | **corrigé** | écart 33,0/255 à 3060 (0,6–0,8 autour) |
| P1 P47→P48 bonnet | **corrigé** | img37 refaite : tête nue, doudoune sombre (2981, 3020) |
| P1 P30→P31 deux heures de lumière | **toujours là** | 1900 → 1901 : brume dorée → ciel bleu dur, neige blanche froide |
| P1 P27→P28 ciel de midi | **amélioré** (→ P2) | 1717 : horizon rose-orangé, lumière de matin ; reste un saut bleu-gris → chaud |
| P2 P43 Clara sans contraste | **corrigé** | maillot rouge net sur la route grise (`p43c.jpg`) |
| P2 P16 croix de suivi | **amélioré** | non vues à 480×270 ; 2 croix ≈ 2 px annoncées par `INCRUSTATION-1.md`, non retrouvées à l'œil |
| P2 P19→P20 mains | **toujours là** | 1190 manches crème, 1191 mains hâlées sur polaire verte |

## Actes 1–8 (P01–P45), images 0–2847
- **P1** · t=23,45 s… 46,17 s (19 coupes : images 928, 1034, 1139, 1191, 1271, 1507, 1612, 1769, 1822, 1954, 2192, 2245, 2297, 2378, 2429, 2508, 2560, 2640, 2770) · tous plans à filé d'entrée · **la première image de chaque plan est nette et autrement cadrée, la deuxième est floue** : laplacien 1re/2e image P26 22,2/9,3, P27 18,2/6,2, P32 22,2/9,2, P37 18,8/9,3, P38 21,2/8,8, P43 22,3/8,9 ; écart à l'image suivante 15–25/255 (contre 5–10 dans le plan) ; à l'œil 1507→1508 la crête saute de cadre, 2297→2298→2299 net/flou/net. À 60 i/s, c'est une image « flash » à chaque coupe → faire passer l'image locale t=0 par le même tirage caméra + filé que les suivantes (le filé d'entrée doit être maximal à t=0 et décroître, pas démarrer à t=1/60). Outil : la fonction d'entrée commune (`film/lib/fx/transitions.js` / caméra des `pNN.html`) ; vérifier avec le même calcul de laplacien · coupes, durées et directions restent.
- **P1** · t=31,68 s (image 1900→1901) · P30→P31 · lumière dorée brumeuse puis ciel bleu dur et neige froide, autre silhouette de crête : toujours deux heures → réchauffer P31 (température + ciel moins saturé, voile doré à gauche) au niveau de P30, ou refroidir la fin de P30 · cadrage, téléphone et durée restent. `p31.html`.
- **P2** · t=8,47–8,52 s (images 508–511) · P08→P09 · l'œil disparaît d'un coup : 4 images d'encre plate (≈ 90 % du cadre) autour du rond qui s'ouvre, puis le téléphone à 512 → garder l'œil (image 507 agrandie et floutée) autour du rond pendant 508–511 au lieu de l'encre · le rond, sa position et l'entrée dans le téléphone restent. `p09.html`.
- **P2** · t=37,42 s (images 2245–2255) · P37 · l'éclaboussure sonne à 37,540 s (image 2252) mais l'eau gicle déjà sous le pied à 2245 (image nette) : 7 images de retard, à confirmer à l'écoute → avancer l'effet d'éclaboussure de 0,11 s dans le mix, ou caler l'image du contact du pied sur 2252 · la coupe 2245 reste.
- **P2** · t=19,85 s (image 1191) · P19→P20 · mains de P20 (hâlées, polaire verte) ≠ bras crème de P19 → une manche crème ou un bracelet commun · la boucle et le clac restent.
- **P2** · t=2,77 s (image 165→166) · P02→P03 · on remonte de la plongée sur les Dolomites (téléobjectif proche) à une vue orbitale avec courbure de la Terre : la descente recule d'un cran d'échelle → si voulu, garder ; sinon entrer dans P03 à une altitude plus basse (sans horizon courbe) · le nuage de P03→P04 reste.
- Confirmé conforme : P14 trois volets (849 : trois visages pleins), P17 « Commander » au pouce (1034–1059, `p17.jpg`, libellés LKDV ONE 45/60/80 L lisibles), P18/P19 écusson montagne blanche sur pièce noire visible et stable (1060, 1099, 1138, 1190), P26/P27 ★ groupe lisible, P28 têtes entières, P30 ★ Léa visible au bord du lac, P40 ★, P42 ★, P43 ★, P44, P45 → P46.

## Les 14 téléphones (pleine résolution, `phz0.jpg`, `phz1.jpg`, `phz2.jpg`, `p17.jpg`)
Captures réelles partout sauf P31 (écran ≈ 130×70 px couché, illisible par nature, accepté). Vert résiduel : **0 image** avec un pixel vert pur (g > r+90, b+90, > 180) et 0 image avec plus de 20 pixels g > r+60, b+60, sur les 3 600 images. Pouce devant l'écran en P07, P09, P12, P13, P15, P17, P48, P49 ; coins tenus sur toutes les vues. Aucun glissement vu entre début, milieu et fin (l'écran est dans la plaque, vérifié sur 3 instants par plan, pas image par image). P36 (36:29, brassard), P29 (tracé + 1:49:11), P16 (sac 2,8 kg), P17 (LKDV ONE 45/60/80 L, 471 €), P49 (« Créer le carnet »), P51 (carnet en photos) : lisibles et dans l'histoire. Nuit P48–P51 : écran un peu laiteux mais crédible, mains éclairées par le feu.
- **P1** · t=49,68–50,98 s (images 2981–3059, milieu 3020) · P48 · l'écran du soir de publication affiche « Dolomites · Lago di Sorapis », **« Aucun tracé enregistré pour ce carnet »** et une carte du **Centre-Val de Loire** : au moment où Léa publie ses quatre jours, l'app dit qu'il ne s'est rien passé → remplacer la capture provisoire E11x par un carnet Sorapis avec tracé et photos (même compte démo, `tools/phone/wire-film.mjs` entrée `p48`) · plaque, coins, niveau nuit 0,8 et pouce restent.
- **P2** · t=6,72–8,02 s (image 442) · P07 · même écran (carnet vide, carte Centre-Val de Loire sous un titre Dolomites) ; moins grave car Léa rêve encore → capture d'un carnet Sorapis renseigné si elle est refaite pour P48 · le pouce et la poussée restent.
- **P2** · t=12,42–15,45 s · P13 et P15 · états réels « non renseigné » (« Allure retenue : non renseignée », « Jour 1/2/3 non renseigné », « – km ») lisibles au zoom → acceptable tant que l'app est ainsi ; à refaire quand le Compas trace l'itinéraire · rien d'autre.
- **P2** · t=24,23 s (image 1480) · P25 · carte de l'écran gris-vert vide (pas de fond lisible, chrono 0:04) : se lit comme une carte non chargée → capture avec fond topo chargé · le reste ne bouge pas.

## Actes 9–10 (P46–P54), images 2848–3599 (planche `a9.jpg`)
- **P1** · t=51,88 s et 53,20 s (coupes 3113 et 3192) · P49→P50→P51 · **saut de noirs** : 2 % les plus sombres P49 fin (16,6 ; 20,0 ; 19,4), **P50 (1,5 ; 6,9 ; 6,9)**, P51 début (18,1 ; 23,4 ; 23,0) ; P50 est le seul plan aux noirs bleu-cyan quasi purs (1 % le plus sombre 5,1 contre 18–22 autour), le reste du film est en encre verte → étalonner P50 à 40–50 % du cube et relever seulement les ombres vers l'encre (cible 2 % sombres ≈ (11, 22, 18)), ou masquer le bivouac et ne relever que le ciel et le sol · la Voie lactée, le bivouac lumineux et la durée restent. `film/compositions/p50.html` (attribut `data-color-grading` du canvas).
- **P2** · t=49,67 s (2980→2981) · P47→P48 · noirs 25,6 → 16,9 (P47 à 100 %, P48 à 80 %), petit saut de densité sur un même feu → P48 à 90 % ou P47 à 90 % · rien d'autre.
- **P2** · t=54,52 s (image 3270→3271) · P51→P52 · toujours : Noah filé vertical puis toit net et immobile (écart 0,9/255 à 3272) → filé vertical décroissant sur les 4 premières images de P52 · le toit de P05 reste. `p52.html`.
- **P2** · t=56,27 s (image 3376) · P52→P53 · l'image 3376 est **identique** à 3375 (écart 0,0/255, contre 1,2–4,7 autour) : une image tenue en plein mouvement d'orbite → décaler d'une image le départ de P53 ou supprimer le doublon · le reste ne bouge pas. `p53.html`.
- **P2** · t=5,42–5,47 s (images 325–328) · P05→P06 · le halo de la vitre s'éteint puis le cadre saute à 327→328 (écart 35/255, poussée qui démarre d'un coup) → amorcer la poussée de P06 dès 325 · le drop à 5,41 s tombe bien sur l'entrée par la vitre.
- Conforme : logo de P53 : la forme sauge n'apparaît qu'en 3478–3479, très pâle, **même centre et même échelle** que le logo blanc de 3480 (ancien P1 **corrigé**) ; P54 logo moyenne (248,7 ; 247,0 ; 242,9), 5 pixels à 255 sur 57 058 (négligeable) ; dernière image 3599 = encre, pas de noir pur. P46 Voie lactée, P47 rires, P48→P49 coupe nette, P50 ★ bivouac lisible.

## Règles (tout le film, 3 600 images à 480×270)
- Texte hors téléphone : aucun vu (images début/milieu/fin de 54 plans + bandes de coupe). HUD : aucun. Logo net avant 58,00 s : non (fantôme sauge pâle à 3478–3479 seulement).
- `#E4501C` ±12 : 6 images à 1 pixel, maximum 1 pixel : nul.
- Aplat noir pur : aucun (part max de pixels max<6 : 11,6 % à 3373, ciel spatial de P52, pas un aplat). Aplats d'encre : P09 508–511 (≈ 90 %, 4 images, voir P2) et P54 fin (voulu).
- Durées : plus long plan P54 = 120 images ; coupes détectées dans le mp4 aux images de `shots.json` (44/53 par saut d'image ; les 9 autres sont des raccords voulus ou des plans à fort mouvement : 220, 325, 560, 3376…). Calage sur les temps : non remesuré (`compare-timeline` donné à 0 écart par les lots).

## Ce que je n'ai pas pu vérifier
- Images fixes seulement : ni fluidité ni saccade perçue ; l'« image flash » de début de plan est mesurée (laplacien, écart), pas vue en lecture.
- Son mesuré, **pas écouté** : audibilité du clac P20 (aigu +18 dB sur le fond local mais volume momentané qui baisse de −15,9 à −16,2 LUFS), bégaiement possible à 33,40 s, ambiances.
- 9:16 : non jugé (rendu en cours, pas de fichier livré).
- Glissement des écrans : 3 instants par plan, pas chaque image. Visages : à l'œil sur vignettes.
- Licence de synchronisation STORM II : hors de mon champ, toujours à obtenir avant diffusion publique (`SON-AUDIT.md`).
