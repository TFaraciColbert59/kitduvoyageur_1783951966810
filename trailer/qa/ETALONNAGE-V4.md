# Étalonnage de l'ours v4

État au 15/11/2026. Film : `livraison/LKDV-ours-v4.mp4` (maître, CRF 16), `livraison/LKDV-ours-v4-reperes.mp4`, `livraison/LKDV-ours-v4-mobile.mp4` (copie d'envoi, non versionnés). Liste : `montage/edl-ours-v4.json` = v3 + champs `etalonnage` (plans, entrées, durées, vitesses, recadrages identiques).

Commandes (depuis `trailer/`, ffmpeg et ffprobe dans le PATH) :

```
python3 tools/montage/lut-v4.py                     # régénère montage/luts/lkdv-v4.cube (--verifier : contrôle)
node tools/montage/build-ours.mjs montage/edl-ours-v4.json --reutiliser-segments
python3 tools/montage/controle-ours.py              # qa/OURS-V4.md, qa/snapshots/ours-v4/
python3 tools/montage/mesures-etalonnage.py livraison/LKDV-ours-v3.mp4 livraison/LKDV-ours-v4.mp4
ffmpeg -i livraison/LKDV-ours-v4.mp4 -c:v libx264 -preset slow -crf 19 -maxrate 3400k -bufsize 6800k -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 192k -movflags +faststart livraison/LKDV-ours-v4-mobile.mp4
```

## Le look

- **LUT commune** `montage/luts/lkdv-v4.cube` (33³, générée par `tools/montage/lut-v4.py`, paramètres en tête du script). Courbe de film par canal : noir relevé à ≈ 10/255, milieu presque droit, épaule qui roule le blanc à ≈ 243/255. Saturation × 0,96 et compression douce des chromas forts (genou 0,20, plafond 0,50). Les mélèzes, le feu et le turquoise restent francs sans devenir fluo, et les peaux (chroma faible) ne bougent presque pas. Les ombres presque neutres prennent la teinte de l'encre #0B1F17 (force 0,42, jusqu'à Y' 0,24). Les ombres colorées, ciel de nuit et braises, sont protégées. Les blancs presque neutres tirent vers une crème un peu plus chaude que #FAF8F5. Aucune rotation de teinte. Sondes : noir → #080B0A, blanc → #F5F3ED, peau #D99E80 → #D6A182, #E4501C → #C5542F (la LUT éloigne la couleur interdite).
- **Adoucissement** commun très léger : unsharp négatif 5×5 à −0,2 sur la luminance et la chrominance. Il est plus fort sur les plans à texture « vermiculée » (P10 0,45, P38 0,6, P40 0,5, P50 0,5 en 7×7).
- **Grain** de luminance fin, posé en dernier : gris moyen + bruit gaussien temporel (amplitude 6), flou σ 0,6, fusion overlay sur Y seulement. Il est plus faible dans les noirs et les blancs, ce qui ménage la compression. COSMOS × 0,8, P50 × 0,6.
- **Matrice couleur corrigée.** Les vidéos Flow sont en YUV BT.601 (balise smpte170m), mais les ours v1–v3 les livraient sous une balise BT.709, donc avec une légère dérive de teinte. La v4 les décode en BT.601 et sort en BT.709 balisé. Les plans en code sont déjà en BT.709.

Chaîne par segment (`tools/montage/etalonnage.mjs`, appelée par `build-ours.mjs` après la coupe et la mise à l'échelle) : YUV (matrice de la source) → RGB 16 bits → correction du plan (lutrgb gain/gamma/noir, matrice de saturation, colorbalance) → LUT (tétraédrique, ou mélange `look` < 1) → YUV 4:4:4 16 bits Rec.709 → adoucissement → grain → yuv420p. Sans champ `etalonnage`, le script ne passe pas par cette branche : les listes v1–v3 donnent le même résultat qu'avant. Le code de cette branche est inchangé, mais je n'ai pas réencodé la v3 pour le prouver.

## Corrections plan par plan (`etalonnage` dans la liste)

| Plan | Problème | Correction |
|---|---|---|
| COSMOS | nébuleuse aux couleurs franches voulues | look 0,6, grain × 0,8 |
| P10 | lac froid et très lumineux entre deux intérieurs chauds ; roche vermiculée | température +0,6, exposition −0,15, saturation 0,95, adoucissement 0,45 |
| P12, P14, P16, P18 | intérieur plus orangé que P11/P13 (R−B 45–48 contre 35) | température −0,5 / −0,5 / −0,4 / −0,4 ; P14 noir +0,01 (écrêtage 1,5 %) |
| P17 | gros plan trop orangé, noirs bouchés | température −0,3, noir +0,008 |
| P20 | boucle très sombre après le plan à plat lumineux | gamma 1,1, noir +0,01 |
| P23 | retrouvailles froides et ternes à l'aube | température +0,5, saturation 1,06 |
| P24 | contre-jour trop orangé | température −0,4 |
| P25 | plus sombre que ses voisins | gamma 1,1 |
| P27 | lever de soleil neutre, raccord avec P28 rose et P29 doré | température +0,6, hautes lumières chaudes |
| P28 | ciel rose-crème trop clair (repeint par Flow) | teinte −0,4 (moins magenta), température +0,2, exposition −0,15 |
| P29 / P30 | doré à garder dans la suite | température +0,2 / +0,3 |
| P31 | plein jour (image source) après le soleil bas de P30 | température +0,6, exposition −0,1 |
| P34 | poussière en contre-jour trop claire et orangée | exposition −0,2, température −0,3 |
| P38 | roche vermiculée | adoucissement 0,6 |
| P40, P41, P44 | lumière dorée très orangée (R−B 58–71) | température −0,3 ; P40 saturation 0,92 et adoucissement 0,5 |
| P42 | vue aérienne sombre | gamma 1,08 |
| P46 → P47 | crépuscule bleu puis feu (saut de dominante) | P46 +0,3, P47 −0,3 (la nuit reste chaude) |
| P48 | noirs bouchés, visage sombre | gamma 1,08, noir +0,008 |
| P50 | bivouac illisible (Y' moyen 16) | gamma 1,35, exposition +0,3, température +0,4, adoucissement 0,5, grain × 0,6 |

Pas de correction propre pour P06–P09, P11, P13, P15, P19, P21, P22, P26, P32, P33, P35–P37, P39, P43, P45, P49, P51–P54 : le look commun suffit.

## Preuves (regardées)

`qa/snapshots/etalonnage-v4/` : `avant-apres-1.jpg` à `-8.jpg` (image du milieu de chaque plan, v3 | v4), `raccords-1.jpg` à `-5.jpg` (planches de coupes de la v4), `peaux.jpg` (Léa dans 8 plans), `telephones.jpg` (P07, P13, P29, P36, P49, P51), `p50.jpg`, `mesures.md` et `mesures.json`. Contrôle du film : `qa/OURS-V4.md`, `qa/snapshots/ours-v4/`.

- **Peaux** : constantes et naturelles. Le look ne les déplace presque pas (P28 un peu moins rosée, P47 un peu moins orangée).
- **Écrans** : ni brûlés ni ternis. Le blanc de l'app reste blanc cassé net, les chiffres restent lisibles.
- **P50** : Y' moyen 16,4 → ≈ 37. On lit les montagnes, la neige, l'herbe et le campement. Le bruit reste contenu.
- **Copie d'envoi** : 27,2 Mo, 3,43 Mb/s, AAC 192 kb/s, 1 440 images. Comparée au maître à 100 % sur P47 et sur le ciel de P50 : pas de blocs dans les aplats sombres. Le grain y est en partie lissé par l'encodeur, mais je ne l'ai pas allégé.

## Mesures du film v4 (controle-ours.py)

1 440 images, 24 i/s, 60,000 s (image et son), coupes 48 sur 49 à l'image attendue. P52 → P53 n'est pas détectée parce que c'est un fondu en code, comme en v3. Aucune plage noire, aucune image gelée, −14,0 LUFS, LRA 6,0, crête −2,0 dBTP (inchangés).

## Ce qui reste faible

- Je n'ai pas vu le film en mouvement. Le grain temporel, le scintillement éventuel de l'adoucissement et la sensation des raccords à vitesse réelle ne sont jugés que sur des images fixes.
- La texture vermiculée est atténuée mais pas effacée : les filaments de la Voie lactée de P50 restent visibles à 100 %, comme la roche de P38 à l'arrêt. Aller plus loin ternirait les étoiles et le coureur.
- Les grands sauts qui restent sont surtout des changements de lieu voulus : COSMOS (éclat ambre) → P06, P09 → P10 → P11 (le lac rêvé entre deux intérieurs), P19 → P20, P49 → P50. Je ne les ai pas égalisés. COSMOS → P06 se joue dans l'animation de l'ouverture, pas à l'étalonnage.
- La dispersion de luminance dans la section Décision ne baisse pas (14,6 → 14,7) : les écarts viennent de plans de nature différente (gros plans, plan à plat lumineux).
- Le maître pèse 167 Mo contre 121 Mo en v3, à cause du grain.
- La balise de transfert est BT.709 (comme en v3). QuickTime peut afficher le film un peu plus clair qu'un navigateur.
- Les mesures sont des statistiques globales : un saut de teinte local, sur un visage par exemple, peut leur échapper. Les planches en tiennent lieu.

## Mesures par plan (avant → après)

Y' Rec.709 sur 0–255, toutes les images du plan. Sat. = saturation HSV moyenne. R−B = dominante (positif = chaud). Écrêtés = % de pixels avec un canal à 255 ou les trois à 0. #E4501C = % de surface à ΔE76 < 20 de la couleur interdite.

| Plan | Y moy. | Y méd. | Noirs p1 | Blancs p99 | Sat. | R−B | Écrêtés % | #E4501C % |
|---|---|---|---|---|---|---|---|---|
| COSMOS | 103,2 → 103,2 | 98,4 → 98,1 | 32,7 → 32,8 | 202,9 → 203,1 | 0,333 → 0,330 | −8,5 → −8,6 | 0,01 → 0,00 | 0,00 → 0,00 |
| P06 | 76,4 → 75,5 | 72,8 → 70,4 | 11,0 → 15,7 | 178,3 → 176,8 | 0,477 → 0,423 | 29,4 → 25,1 | 0,23 → 0,00 | 0,00 → 0,00 |
| P07 | 80,8 → 80,3 | 69,3 → 66,4 | 8,7 → 14,4 | 212,3 → 212,3 | 0,443 → 0,395 | 28,3 → 24,5 | 0,03 → 0,00 | 0,00 → 0,00 |
| P08 | 66,6 → 65,0 | 73,0 → 70,0 | 8,7 → 14,1 | 117,0 → 117,2 | 0,478 → 0,409 | 36,3 → 31,6 | 0,00 → 0,00 | 0,00 → 0,00 |
| P09 | 91,9 → 92,5 | 75,9 → 74,3 | 12,0 → 16,6 | 223,0 → 220,5 | 0,402 → 0,372 | 26,1 → 24,7 | 0,02 → 0,00 | 0,00 → 0,00 |
| P10 | 125,1 → 121,7 | 121,2 → 119,1 | 27,4 → 27,9 | 233,8 → 220,3 | 0,347 → 0,297 | −26,2 → −14,9 | 0,02 → 0,00 | 0,00 → 0,00 |
| P11 | 78,0 → 76,9 | 73,0 → 70,6 | 12,1 → 16,5 | 179,9 → 180,0 | 0,492 → 0,439 | 34,5 → 29,9 | 0,10 → 0,00 | 0,00 → 0,00 |
| P12 | 80,3 → 79,2 | 73,0 → 69,7 | 6,0 → 12,4 | 199,5 → 199,4 | 0,532 → 0,447 | 48,2 → 38,0 | 0,38 → 0,00 | 0,00 → 0,00 |
| P13 | 89,7 → 88,7 | 77,0 → 73,7 | 9,4 → 14,7 | 227,3 → 223,8 | 0,378 → 0,341 | 36,6 → 32,1 | 0,17 → 0,00 | 0,00 → 0,00 |
| P14 | 71,1 → 72,2 | 55,3 → 55,0 | 3,8 → 12,4 | 197,8 → 196,1 | 0,486 → 0,391 | 47,0 → 36,0 | 1,46 → 0,00 | 0,05 → 0,00 |
| P15 | 95,5 → 95,6 | 79,8 → 78,5 | 11,0 → 15,8 | 222,1 → 219,6 | 0,352 → 0,337 | 35,3 → 33,6 | 0,17 → 0,00 | 0,00 → 0,00 |
| P16 | 104,5 → 104,1 | 115,1 → 113,8 | 10,9 → 15,7 | 197,1 → 196,2 | 0,410 → 0,338 | 46,7 → 37,3 | 0,49 → 0,00 | 0,01 → 0,00 |
| P17 | 97,8 → 98,5 | 95,6 → 95,9 | 4,7 → 12,7 | 239,4 → 232,2 | 0,420 → 0,345 | 41,5 → 33,8 | 0,00 → 0,00 | 0,00 → 0,00 |
| P18 | 110,2 → 110,0 | 106,2 → 105,0 | 8,1 → 14,0 | 233,5 → 228,1 | 0,404 → 0,336 | 44,9 → 36,2 | 0,00 → 0,00 | 0,00 → 0,00 |
| P19 | 117,3 → 117,7 | 119,1 → 119,4 | 10,0 → 15,4 | 236,4 → 230,3 | 0,234 → 0,213 | 23,9 → 21,5 | 0,01 → 0,00 | 0,00 → 0,00 |
| P20 | 62,3 → 71,2 | 41,4 → 50,3 | 0,8 → 11,6 | 168,9 → 176,8 | 0,402 → 0,318 | 30,2 → 25,5 | 0,39 → 0,00 | 0,00 → 0,00 |
| P21 | 84,1 → 83,5 | 87,8 → 85,5 | 11,2 → 16,3 | 201,8 → 203,0 | 0,311 → 0,277 | 23,8 → 21,1 | 0,13 → 0,00 | 0,00 → 0,00 |
| P22 | 106,1 → 106,0 | 97,1 → 96,8 | 13,6 → 17,5 | 223,3 → 219,3 | 0,242 → 0,225 | 14,2 → 13,4 | 0,13 → 0,00 | 0,00 → 0,00 |
| P23 | 98,8 → 98,0 | 97,9 → 96,3 | 14,8 → 17,7 | 220,9 → 216,4 | 0,151 → 0,168 | 7,7 → 11,7 | 0,11 → 0,00 | 0,00 → 0,00 |
| P24 | 101,7 → 100,2 | 97,3 → 95,8 | 24,7 → 26,0 | 233,3 → 228,3 | 0,360 → 0,302 | 41,8 → 33,6 | 0,06 → 0,00 | 0,00 → 0,00 |
| P25 | 78,1 → 85,3 | 72,0 → 79,0 | 5,9 → 15,1 | 236,1 → 230,7 | 0,272 → 0,255 | 18,0 → 15,3 | 0,08 → 0,00 | 0,00 → 0,00 |
| P26 | 121,3 → 121,5 | 110,0 → 110,1 | 35,9 → 36,6 | 229,1 → 224,0 | 0,164 → 0,151 | 8,3 → 8,0 | 0,00 → 0,00 | 0,00 → 0,00 |
| P27 | 108,1 → 108,3 | 96,6 → 96,1 | 28,1 → 29,8 | 204,1 → 203,8 | 0,172 → 0,139 | −7,8 → 3,4 | 0,07 → 0,00 | 0,00 → 0,00 |
| P28 | 123,1 → 116,9 | 107,2 → 100,7 | 13,0 → 16,7 | 237,5 → 223,2 | 0,207 → 0,200 | 22,2 → 19,3 | 0,03 → 0,00 | 0,00 → 0,00 |
| P29 | 104,4 → 104,6 | 96,0 → 94,6 | 8,1 → 14,1 | 228,6 → 225,2 | 0,231 → 0,229 | 14,2 → 15,1 | 0,09 → 0,00 | 0,00 → 0,00 |
| P30 | 122,4 → 123,4 | 118,1 → 121,0 | 17,6 → 21,4 | 237,0 → 231,2 | 0,286 → 0,253 | −1,2 → 2,3 | 0,09 → 0,00 | 0,00 → 0,00 |
| P31 | 108,1 → 106,4 | 114,9 → 112,3 | 8,8 → 14,1 | 223,4 → 215,1 | 0,325 → 0,293 | −5,8 → 0,4 | 0,04 → 0,00 | 0,00 → 0,00 |
| P32 | 111,9 → 112,5 | 108,0 → 108,1 | 12,9 → 17,2 | 216,9 → 215,9 | 0,266 → 0,241 | 7,6 → 7,2 | 0,00 → 0,00 | 0,00 → 0,00 |
| P33 | 104,5 → 105,2 | 100,5 → 100,2 | 13,5 → 17,7 | 199,9 → 200,3 | 0,352 → 0,314 | 27,3 → 24,7 | 0,00 → 0,00 | 0,00 → 0,00 |
| P34 | 132,6 → 123,7 | 132,9 → 123,9 | 27,4 → 26,6 | 233,9 → 217,0 | 0,318 → 0,268 | 49,0 → 37,6 | 1,24 → 0,00 | 0,00 → 0,00 |
| P35 | 105,8 → 106,0 | 103,3 → 103,0 | 14,8 → 17,7 | 194,0 → 195,2 | 0,328 → 0,301 | 33,4 → 30,3 | 0,01 → 0,00 | 0,00 → 0,00 |
| P36 | 97,6 → 97,4 | 93,9 → 92,0 | 6,6 → 13,4 | 230,9 → 226,8 | 0,357 → 0,319 | 37,0 → 33,1 | 0,02 → 0,00 | 0,00 → 0,00 |
| P37 | 81,8 → 81,2 | 72,0 → 70,0 | 15,1 → 18,6 | 227,9 → 223,2 | 0,281 → 0,257 | 21,5 → 18,5 | 0,03 → 0,00 | 0,00 → 0,00 |
| P38 | 104,8 → 104,0 | 102,0 → 101,1 | 38,4 → 38,1 | 193,6 → 192,9 | 0,259 → 0,238 | 19,9 → 17,4 | 0,03 → 0,00 | 0,00 → 0,00 |
| P39 | 125,6 → 124,8 | 123,7 → 123,3 | 25,1 → 26,3 | 239,1 → 232,0 | 0,325 → 0,300 | 43,3 → 39,4 | 0,08 → 0,00 | 0,00 → 0,00 |
| P40 | 117,6 → 115,7 | 108,5 → 105,7 | 25,8 → 26,7 | 230,5 → 225,1 | 0,486 → 0,398 | 71,3 → 54,0 | 0,90 → 0,00 | 0,00 → 0,00 |
| P41 | 98,3 → 96,8 | 90,4 → 88,0 | 15,7 → 18,4 | 228,0 → 223,2 | 0,498 → 0,432 | 58,5 → 49,3 | 0,56 → 0,00 | 0,00 → 0,00 |
| P42 | 71,6 → 77,3 | 57,4 → 62,3 | 5,4 → 14,4 | 197,9 → 200,0 | 0,536 → 0,418 | 44,3 → 36,8 | 0,06 → 0,00 | 0,00 → 0,00 |
| P43 | 82,3 → 81,4 | 69,4 → 67,3 | 14,7 → 18,5 | 207,6 → 205,4 | 0,434 → 0,383 | 36,1 → 31,0 | 0,33 → 0,00 | 0,01 → 0,00 |
| P44 | 113,5 → 111,5 | 96,8 → 93,8 | 24,0 → 25,4 | 218,0 → 214,2 | 0,441 → 0,378 | 61,4 → 50,0 | 1,92 → 0,00 | 0,00 → 0,00 |
| P45 | 92,0 → 90,2 | 86,3 → 83,7 | 10,0 → 15,1 | 187,7 → 183,2 | 0,357 → 0,334 | 28,2 → 23,8 | 0,08 → 0,00 | 0,00 → 0,00 |
| P46 | 58,2 → 58,0 | 44,0 → 43,2 | 8,1 → 14,4 | 167,4 → 163,9 | 0,362 → 0,308 | −0,2 → 0,7 | 0,04 → 0,00 | 0,00 → 0,00 |
| P47 | 50,8 → 50,6 | 33,9 → 33,4 | 8,6 → 14,1 | 238,6 → 231,9 | 0,456 → 0,409 | 37,6 → 28,9 | 1,88 → 0,02 | 0,23 → 0,00 |
| P48 | 44,0 → 50,9 | 27,2 → 33,9 | 2,0 → 11,7 | 196,7 → 199,3 | 0,529 → 0,371 | 25,5 → 20,8 | 0,66 → 0,00 | 0,09 → 0,00 |
| P49 | 53,4 → 55,3 | 38,6 → 38,6 | 3,7 → 11,4 | 193,2 → 195,0 | 0,581 → 0,469 | 36,5 → 32,6 | 0,47 → 0,00 | 0,15 → 0,00 |
| P50 | 16,4 → 36,5 | 13,5 → 32,6 | 3,2 → 16,6 | 52,7 → 81,9 | 0,681 → 0,445 | −15,0 → −18,3 | 0,01 → 0,00 | 0,00 → 0,00 |
| P51 | 44,8 → 45,6 | 36,8 → 36,8 | 2,5 → 10,6 | 171,4 → 174,8 | 0,284 → 0,262 | −1,5 → −2,6 | 0,23 → 0,00 | 0,00 → 0,00 |
| P52 | 65,6 → 65,4 | 54,0 → 52,8 | 7,7 → 13,4 | 210,5 → 210,1 | 0,374 → 0,344 | −23,2 → −22,1 | 0,01 → 0,00 | 0,00 → 0,00 |
| P53 | 33,6 → 35,7 | 24,2 → 25,9 | 6,9 → 13,3 | 134,6 → 136,1 | 0,582 → 0,421 | −8,1 → −6,4 | 0,01 → 0,00 | 0,00 → 0,00 |
| P54 | 29,9 → 31,9 | 21,7 → 23,8 | 12,1 → 16,6 | 245,2 → 237,0 | 0,592 → 0,444 | −9,5 → −7,4 | 0,00 → 0,00 | 0,00 → 0,00 |

## Dispersion à l'intérieur des sections (écart type des moyennes de plans, avant → après)

| Section | Plans | Luminance | Dominante R−B |
|---|---|---|---|
| cosmos | 1 | 0,0 → 0,0 | 0,0 → 0,0 |
| declic | 5 | 20,2 → 19,5 | 22,8 → 16,8 |
| decision | 9 | 14,6 → 14,7 | 7,5 → 4,8 |
| depart | 6 | 15,3 → 11,8 | 11,1 → 7,7 |
| montagne | 7 | 7,3 → 6,9 | 10,1 → 6,4 |
| coureur-cycliste | 13 | 17,0 → 15,1 | 15,2 → 11,3 |
| bivouac | 5 | 14,8 → 7,4 | 20,9 → 19,1 |
| final | 3 | 13,2 → 12,3 | 9,1 → 8,4 |
| logo | 1 | 0,0 → 0,0 | 0,0 → 0,0 |

## Raccords (dernière image du plan sortant → première du plan entrant)

| Raccord | Image | ΔY avant | ΔY après | Δ(R−B) avant | Δ(R−B) après |
|---|---|---|---|---|---|
| COSMOS → P06 | 126 | −86,7 | −88,2 | −86,1 | −87,7 |
| P06 → P07 | 189 | 1,3 | 1,8 | −0,1 | 0,1 |
| P07 → P08 | 231 | −15,0 | −16,2 | 8,5 | 7,5 |
| P08 → P09 | 242 | 23,8 | 26,1 | −9,8 | −6,5 |
| P09 → P10 | 252 | 30,2 | 26,7 | −54,6 | −41,9 |
| P10 → P11 | 294 | −48,1 | −46,0 | 67,0 | 49,9 |
| P11 → P12 | 315 | −0,6 | −0,8 | 18,5 | 12,3 |
| P12 → P13 | 336 | 8,9 | 9,1 | −11,4 | −5,8 |
| P13 → P14 | 357 | −19,5 | −17,3 | 9,6 | 3,3 |
| P14 → P15 | 378 | 23,9 | 23,0 | −11,6 | −2,4 |
| P15 → P16 | 389 | 8,3 | 8,0 | 11,6 | 3,8 |
| P16 → P17 | 420 | −7,4 | −6,4 | −5,0 | −3,3 |
| P17 → P18 | 431 | 10,6 | 9,9 | 4,1 | 3,0 |
| P18 → P19 | 452 | 2,5 | 3,1 | −21,1 | −14,8 |
| P19 → P20 | 462 | −56,4 | −47,7 | 5,4 | 3,2 |
| P20 → P21 | 473 | 20,6 | 11,2 | −9,0 | −6,7 |
| P21 → P22 | 494 | 21,9 | 22,4 | −10,5 | −8,5 |
| P22 → P23 | 515 | −6,9 | −7,6 | −6,8 | −1,9 |
| P23 → P24 | 557 | 1,4 | 0,8 | 33,7 | 21,4 |
| P24 → P25 | 578 | −24,8 | −16,1 | −24,1 | −18,7 |
| P25 → P26 | 589 | 43,9 | 36,9 | −8,7 | −6,3 |
| P26 → P27 | 631 | −12,7 | −12,7 | −14,8 | −3,4 |
| P27 → P28 | 673 | 17,0 | 10,4 | 31,7 | 17,5 |
| P28 → P29 | 694 | −21,9 | −15,2 | −7,1 | −3,4 |
| P29 → P30 | 715 | 18,3 | 19,0 | −14,0 | −11,6 |
| P30 → P31 | 757 | −16,3 | −19,0 | −4,7 | −2,1 |
| P31 → P32 | 778 | 0,3 | 2,7 | 12,7 | 5,8 |
| P32 → P33 | 799 | −14,6 | −14,7 | 23,4 | 20,6 |
| P33 → P34 | 820 | 16,9 | 7,7 | 17,0 | 9,1 |
| P34 → P35 | 830 | −40,7 | −31,1 | −22,4 | −13,2 |
| P35 → P36 | 851 | −12,3 | −13,0 | 4,4 | 3,5 |
| P36 → P37 | 862 | −18,4 | −18,8 | −16,2 | −15,3 |
| P37 → P38 | 883 | 22,9 | 22,8 | 0,2 | 0,5 |
| P38 → P39 | 925 | 21,7 | 21,7 | 26,0 | 24,4 |
| P39 → P40 | 946 | −6,8 | −7,9 | 30,3 | 16,4 |
| P40 → P41 | 978 | −16,5 | −16,0 | −11,4 | −3,5 |
| P41 → P42 | 988 | −27,9 | −20,8 | −13,2 | −11,6 |
| P42 → P43 | 1020 | 11,2 | 4,8 | −6,7 | −4,7 |
| P43 → P44 | 1051 | 31,1 | 30,0 | 25,8 | 19,4 |
| P44 → P45 | 1072 | −23,2 | −22,9 | −33,4 | −26,4 |
| P45 → P46 | 1093 | −4,5 | −3,7 | −24,2 | −19,3 |
| P46 → P47 | 1135 | 25,4 | 22,4 | 41,0 | 31,1 |
| P47 → P48 | 1177 | −6,9 | 0,2 | −11,0 | −7,4 |
| P48 → P49 | 1209 | 8,3 | 3,3 | 9,6 | 10,5 |
| P49 → P50 | 1219 | −37,8 | −19,9 | −51,4 | −51,2 |
| P50 → P51 | 1261 | 28,4 | 9,3 | 17,6 | 19,2 |
| P51 → P52 | 1293 | 11,2 | 9,6 | −15,8 | −13,9 |
| P52 → P53 | 1335 | 0,1 | 0,1 | 0,0 | 0,0 |
| P53 → P54 | 1387 | 23,0 | 20,4 | 1,7 | 0,4 |

**Les 10 raccords qui sautent encore le plus** (score |ΔY| + ½ |Δ(R−B)|, après) : COSMOS → P06 (132,0, avant 129,7) ; P10 → P11 (70,9, avant 81,6) ; P19 → P20 (49,3, avant 59,1) ; P09 → P10 (47,6, avant 57,5) ; P49 → P50 (45,5, avant 63,6) ; P25 → P26 (40,0, avant 48,2) ; P43 → P44 (39,7, avant 44,0) ; P46 → P47 (37,9, avant 45,9) ; P34 → P35 (37,7, avant 51,9) ; P44 → P45 (36,1, avant 39,9).

Score moyen des 49 raccords : 28,8 avant → 23,7 après. Écrêtés : au plus 0,02 % après (plan le plus touché : P47). Surface proche de #E4501C : au plus 0,00 % après (COSMOS), 0,23 % avant.
