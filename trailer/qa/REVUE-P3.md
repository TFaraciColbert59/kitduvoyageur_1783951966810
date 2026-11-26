# Revue P3 : P52, P53, P54, halo de P01, transitions (qa-critic, 12/11/2026)

Matière : `qa/p3-p52-p54.mp4` (ffprobe : 329 images, 60/1, 1920×1080, vidéo seule, sans son), 30 preuves de `qa/snapshots/p3/`, vraies images `assets/footage/img01, img03, img04, img05, img39.png` (1920×1080).
Extraction : `ffmpeg -i qa/p3-p52-p54.mp4 -vsync 0 f/%03d.png` (le fichier NNN.png correspond à l'image NNN-1). Planches regardées : une image sur 12 (0 à 324), 150 à 202 par pas de 4 (convergence), 203 à 214 recadrées sur le logo, plaques réelles comparées aux images 0, 59, 97, 104 et 105 du rendu.
Mesures faites avec Python, numpy et PIL (variance du laplacien, gradient au 99,5e centile, teinte, niveaux). Pas d'OpenCV sur la machine.

## Réponses chiffrées

1. **Netteté du logo à l'image 209.** Mesure sur le recadrage du logo (x 400–1500, y 200–900), avec le gradient au 99,5e centile :
   - de 196 à 203 : de 81,0 à 78,2, puis de 204 à 208 : 77,0 à 77,5 (plateau doux) ;
   - **209 : 96,0** (+24 %) ; 210 : 98,1 ; 213 : 102,5 ; 217 : 107,3 ; 221 : 110,2 ; 260 : 112,1.
   - Le saut tombe bien sur 209 = 58,00 s et sur aucune image avant. Regardé : de 203 à 208, trait épais vert menthe et flou ; à 209, trait fin blanc et net.
   - En revanche, la netteté continue de monter jusqu'à l'image ≈ 221. À 209, le logo n'est qu'à environ 85 % de sa netteté finale, à cause du halo de l'éclair d'impact.
   - **Le dessin du logo est entièrement lisible (flou) dès l'image ≈ 186 (57,62 s)**. La règle « net seulement à 58 s » est donc respectée à la lettre, mais l'effet « net pour la première fois » est faible : le spectateur reconnaît le logo 0,38 s avant l'impact.
2. **Tracés.** La saturation moyenne des pixels de tracés va de 0,14 à 0,17 (images 130, 150, 165, 180), contre **0,33 pour le sauge `#5B7F55`**. Couleur moyenne des pixels verts : RGB (122,138,122) à (146,169,150). Ce sont donc des tracés **blanc-vert pâle, pas sauge**.
   - Les pixels saturés (min RGB ≥ 254) passent de 0,26 % à l'image 156 à 1,16 % à 168, puis **3,81 % à 180**.
   - À l'œil : de 105 à 145, de petits filaments lisibles (« un par aventure », ça se lit) ; de 160 à 182, une **nappe blanche brûlée** au-dessus de l'Europe, sans aucun tracé individuel.
3. **Convergence.** Regardé de 150 à 202 par pas de 4 : les filaments → une tache blanche (174–178) → un triangle qui sort de la tache (182–190) → le logo épais.
   - **Cela se lit comme un fondu ou une transformation de forme, pas comme un geste.** On ne voit à aucun moment des tracés qui courent vers les bords du logo et s'y posent.
4. **Fin de P54.** La netteté chute dès 300 (gradient 103 → 92 à 310 → 36 à 320) et la dernière image (328) est vide (lapvar 0, max 24). Le logo est à 100 % de 209 à ≈ 304, soit environ 1,6 s.
   - Avis : finir sur l'encre est juste, mais le logo ne doit pas s'éteindre avant la musique. Caler sa sortie sur le fondu musical de 48 images (voir P2-1).
5. **P52.** Différence moyenne entre images consécutives (en 480×270) : 1,5 à l'image 0 → 6,2 à 48 (accélération réelle sur la ville) → pic de 28 de 56 à 58 (bascule vers le nuage) → **quasi arrêt de 63 à 68 (0,09 à 1,7)** → de 7 à 12 sur la stratosphère.
   - La remontée **s'arrête 6 images dans le blanc**, en plein milieu d'une remontée censée accélérer.
   - Raccord P52→P53, ligne de plus forte teinte cyan par colonne : le limbe est en y = 126 au centre à l'image 104 et en **y = 152 à l'image 105** (saut de 26 px ; de 16 à 38 px sur les côtés). La luminance moyenne passe de 38,9 à 27,8. Ce n'est pas « à l'endroit exact ».
6. **Règles.**
   - Aucun texte vu sur les planches.
   - Noirs : pixels de luminance < 6 entre 0 et 0,05 %, pas d'aplat noir. Le fond de P54 a une médiane de (13,26,27), proche de l'encre : conforme.
   - `#E4501C` (±6) : 0 pixel sur les 28 images testées. Aucun littéral interdit dans `fx-lab/compositions` ni `lib` (grep).
   - Les pixels à ±3 de `#1C2620` vont jusqu'à 60 877 (3 %) en P53 : c'est la nuit de la Terre en code. C'est un ton voisin plutôt qu'un littéral, mais il faut le signaler (P2).
   - **Couleur du logo net : (255,255,255) à 209 et (248,250,244) à 240.** C'est du blanc brûlé, pas de la crème `#FAF8F5`.
7. **Transitions et halo** : voir plus bas.

## Bascule vers les vraies images (ajustement d'un cercle sur le limbe, script `limb.py`)

- **img01 / halo de P01** :
  - Limbe réel : cx = 3118, cy = 5377, R = 5433 (résidu médian 4,5 px). Il monte en diagonale du coin bas-gauche (0, 903) vers le haut-droit (1840, 102), avec le soleil vers x ≈ 1750, y ≈ 180.
  - Réglage actuel `HALO = {cx:1650, cy:2820, R:2600, angle:-104}` : le logo est posé vers (1021, 297), alors que le vrai limbe passe à y ≈ 395 à cet endroit, soit **≈ 100 px dans le vide spatial**. La tangente est fausse d'environ 9° (-14° au lieu de ≈ -23°).
  - Le halo doit aussi être à l'endroit où « le soleil perce le limbe », donc vers x 1550–1750, et non au milieu du cadre.
- **img39 / P53** :
  - Limbe réel : cx = 1133, cy = 3585, R = 3454 (résidu 0,3), plus haut à droite qu'à gauche. Il est bleu, alors que le limbe en code est cyan-vert et symétrique.
  - L'Europe est plus grande et décentrée vers la droite (l'Italie au centre).
  - Les 2 600 tracés sont ancrés sur la projection de la Terre en code : **avec la plaque, ils ne tomberont pas sur les lumières des villes**, et la fin de P52 (limbe en code) ne raccordera pas au limbe d'img39.
- **img05** (toits haussmanniens en plongée oblique, lumière chaude) n'a rien de commun avec le quadrillage gris en code.
- **img04** (ville vue par une trouée de nuages) correspond bien à l'idée du nuage.
- **img03** est une stratosphère **de jour, avec le soleil**, alors qu'img39 est **de nuit**. La coupe P52→P53 fera donc un saut de lumière jour → nuit, que la teinte verte en code masquait.

## Notes

### P0
- t = 56,26 s (image 3376, rendu 105) · P52→P53 · le limbe saute de 26 px au centre et de 38 px sur les côtés en une image, et la luminance tombe de 39 à 28. Le raccord « Orbite » casse, et avec img39 l'écart sera pire (autre cercle, autre couleur) → dériver la fin de P52 du cercle mesuré sur img39 (cx 1133, cy 3585, R 3454) et faire le passage jour → nuit d'img03 dans P52 (images 3350–3375) · le minutage des coupes ne bouge pas.
- t = 56,26–58,00 s · P53 avec img39 · les tracés sont ancrés sur la Terre en code. Une fois la plaque posée, ils ne seront plus sur les villes et le logo ne sera plus sur l'Europe d'img39 → recaler l'ancrage (projection) sur img39 avant l'intégration, et le tester avec `PLATE` renseignée · l'instant net à 3480 ne bouge pas.

### P1
- t = 56,9–57,3 s (images 3440–3462, rendu 165–187) · P53 · nappe blanche brûlée (3,8 % de pixels saturés à 180), plus aucun tracé lisible, et la convergence se lit comme un fondu → plafonner l'addition (pas plus de 0,85 en luminance), réduire le nombre de tracés actifs au centre, et faire courir des faisceaux visibles qui se posent sur les arêtes du logo pendant les 20 dernières images · ce qui ne bouge pas : l'allumage de 105 à 145, qui est bon.
- t = 56,26–58 s · P53 · les tracés sont blanc-vert (saturation 0,14–0,17), pas sauge (0,33) → corps en `#5B7F55` éclairci au plus jusqu'à une saturation d'environ 0,28, crème réservée aux seules pointes · le logo reste en crème.
- t = 57,62–57,98 s (images 3466–3479) · P53 · le logo est entièrement reconnaissable 0,38 s avant l'impact, en trait épais menthe → garder un tressage visible jusqu'à 3472, ne fermer le triangle que sur les 8 dernières images, avec un flou de 4 px au moins avant 3480 · l'image nette reste 3480.
- t = 58,00 s (image 3480) · P54 · le logo net est blanc brûlé (255,255,255) et non crème `#FAF8F5`, et la netteté monte encore jusqu'à 3492 (gradient 96 → 110) → limiter le logo à (250,248,245) et retirer le halo de l'éclair de la boîte du logo à 3480 · l'éclair d'impact reste.
- t = 55,56–55,65 s (images 3334–3339, rendu 63–68) · P52 · la remontée s'arrête dans le blanc (différence entre images < 2) → garder la vitesse en `p^1.8` à travers le nuage, sans plateau · la durée totale ne bouge pas.
- t = 0–1,48 s · P01 halo · le réglage ne correspond pas à img01 : logo ≈ 100 px dans le vide, tangente fausse de 9°, pas au soleil → `HALO` à recaler sur le cercle cx 3118, cy 5377, R 5433, angle vers le soleil (≈ x 1650), puis à rejuger · le flou ≥ 6 px et la disparition à l'image 80 ne bougent pas.
- t = 54,51–55,4 s · P52 · le quadrillage en code est très loin d'img05 (toits haussmanniens, lumière chaude) : à jeter, pas à affiner → monter img05, puis img04 pour la trouée · ce qui ne bouge pas : le flou radial proportionnel à la vitesse.
- Transitions : `fx4` (vitre) montre au passage un rectangle à bord dur et de nombreuses taches, ce qui fait « effet généré » ; `fx6` (étincelle) est trop petite pour se lire. → rectangle supprimé et taches réduites de moitié ; étincelle au moins trois fois plus grande · flash, flou radial et nuage restent.

### P2
- t = 59,2–60 s (images 3552–3599) · P54 · le logo s'éteint sur 24 images, plus tôt que la musique (48) → le tenir à 100 % jusqu'à 3575, puis le faire sortir sur la même courbe que le fondu musical, pour finir sur l'encre · la dernière image reste l'encre.
- P53 · environ 3 % de pixels à ±3 de `#1C2620` (nuit de la Terre en code) → décaler le ton vers l'encre `#0B1F17` · sans objet une fois img39 posée.
- `fx3` (trouée) : la texture du nuage fait des taches carrées → plus de douceur sur le bruit.

## Plan le plus faible

**P53** : nappe blanche, tracés non sauge, convergence qui se lit comme un fondu, et ancrage incompatible avec img39.

## Verdict

**Pas prêt à intégrer**, pour trois raisons :
- les raccords et les ancrages sont calés sur des plaques en code, pas sur les vraies images (img39, img01, img05) ;
- la convergence de P53 se lit comme une nappe et un fondu, pas comme un geste ;
- le limbe saute de 26 à 38 px à la coupe P52→P53.

L'instant net à 58,00 s, lui, est juste.

## Non vérifié

- Son : le rendu n'a pas de piste audio.
- 9:16 : aucun recadrage fourni.
- `FX.md` : pas relu en détail, faute de budget.
- Vérification au pixel que la géométrie du logo correspond à `logo-mark.svg` : je me fie au test de l'auteur, non relancé.
- Rendu avec les vraies plaques : `PLATE` est vide, aucun rendu.
- Transitions dans le film : jugées seulement sur les 10 preuves fixes, pas en mouvement.
