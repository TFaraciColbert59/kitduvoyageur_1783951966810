# PLONGEE — la photo du lac en grand (P07) puis la plongée dans l'écran (P09 → P10), 16/11

Retour de Tony : on ne voit pas que Léa regarde le post, et on doit « plonger dedans » comme à l'ouverture. Découpage v6 de DECOUPAGE-24.md : P07 4 temps, P08 1, P09 2, P10 4. Tout est livré non étalonné, 1920×1080 plein cadre, sans bandes. Rien n'est commité.

## Ce qui est fait

- **P07** : `flow/clips/incrustes/p07.mp4`, refait. Il a 94 images, comme la source, et garde sa numérotation. L'ancienne version est dans `p07-v3.mp4`. Réglage : `tools/incrustation/plans.json` (entrée p07, avec une note). **Plage montée : p07 n°22–63** (42 images).
  - n°22–27 : le pouce descend et le carnet (E01a) glisse vers le bas. Le fil de la communauté (E13) arrive, avec en tête la carte « Carnet de la semaine · Dolomites · Lago di Sorapis » et sa grande photo du lac. La carte « Centre-Val de Loire / Aucun tracé » d'E01a ne se voit que sur 2 à 3 images, au tout début, pendant qu'elle sort du cadre.
  - n°33–42 : le pouce remonte jusqu'à son point le plus haut, à 0,55 de la hauteur de l'écran (n°41–43, mesuré). C'est le seul geste de la prise qui ressemble à un toucher. Il n'y a pas de tap net, comme le disait FLOW-RELECTURE-1.
  - n°43–47 : la photo s'ouvre. La vignette de la carte grandit jusqu'à la pleine largeur de l'écran, son contenu passe à la photo, et le fond descend au noir.
  - n°48–63 : la photo est en grand, plein écran sur fond noir, sans aucune interface, comme une photo ouverte dans n'importe quelle app. Elle reste ainsi 16 images (0,67 s).
  - **La photo est l'image 30 de `flow/clips/plans/p10.mp4`**, pas img09.
- **P09** : `flow/clips/rendus/p09-plongee.mp4` (27 images = 6 de marge + 21 de plongée ; 1920×1080, 24 i/s, H.264 CRF 10, sans son). Script : `tools/incrustation/plonge.py`. Mesures et réglages : `tools/incrustation/suivi/plongee-p09.json`.
  - **Marge (images 0–5)** : p07 n°58–63 telles quelles, c'est la fin de P07.
  - **Plongée (images 6–26)** : elle part de **p07 n°64** et suit la vidéo en direct jusqu'au n°84 : la pluie, la vapeur et le pouce continuent de bouger.
  - **Image 26 (la dernière) = image 30 de p10**, posée telle quelle.
  - Caméra : homographie qui amène le rectangle suivi de la photo sur le cadre entier. Le zoom accélère de façon continue (z = Z^(t^2,2), Z = ×5,87 au total), une rotation de 3,7° redresse l'écran, et la perspective est corrigée à l'arrivée.
  - Rendu :
    - fond : le téléphone, les mains et la fenêtre de l'image incrustée, déformés ;
    - photo : rendue nette depuis p10 n°30, pas agrandie depuis la vidéo ;
    - doigts : gardés devant grâce au vert de la source ;
    - flou de vitesse : moyenne de 2 à 24 sous-images sur l'obturateur. Il produit un flou de zoom radial qui grandit avec la vitesse, et il est ramené à zéro sur les deux dernières images pour arriver net.
  - Les bords du téléphone et les doigts sortent du cadre à partir de l'image 13 environ.
- **Rendu de contrôle** : `livraison/LKDV-essai-declic-plongee.mp4`. Il enchaîne P07 (p07 incrusté n°22–63), P08 (p08 n°40–50, inchangé), P09 (plongée, images 6–26) et P10 (p10 n°30–71) : 116 images, 4,833 s, non étalonné. Son : `qa/mix-v5.wav` de 7,875 s à 12,708 s (provisoire).

## Mesures

- **Raccord P09 → P10** : écart moyen de 1,70 niveau sur 255 (max 20) entre la dernière image de la plongée décodée et p10 n°30 décodée. Le reste vient de l'encodage : l'image écrite est exactement p10 n°30.
- **Mouvement image à image** (écart moyen entre deux images en 480×270) :
  - marge : 2,0 à 2,4 ;
  - plongée : 3,6 → 6,3 → 9,0 → 10,9 → 12,6 → 14,0 → 15,2 → 16,5 → 17,8 → 19,2 → 19,0 → 19,0 → 20,7 → 22,0 → 23,5 → 25,0 → 25,3 → 28,8 → 35,9 → 44,0 → 49,4.
  - La croissance est continue, avec un léger palier sur les images 16 et 17 (le pouce sort du cadre).
- **Zoom image à image** : ×1,002, puis une croissance régulière jusqu'à ×1,197 à l'arrivée.
- **P07** : déplacement des coins de 0,82 px par image en moyenne (max 1,53). Tremblement : 0,11 en moyenne, max 0,49. Vert pur restant dans le téléphone : 0. Écart hors zone : 2,1 (réencodage).
- Le téléphone, avec sa photo, reste dans la fenêtre 2,39:1 décalée de +40 px : l'écran va de y = 173 à y = 905, la fenêtre visible de 98 à 902. La photo (y ≈ 445–635) est en plein milieu. Seuls les 3 derniers pixels du bas de l'écran passent sous la bande.

## Preuves (`qa/snapshots/plongee/`, regardées une à une)

- `p07-bande.jpg` : une image sur deux, de n°22 à 62.
- `p07-zoom-4.jpg` : défilement (n°28), toucher (n°42), ouverture (n°45), photo en grand (n°56), en pleine résolution.
- `plongee-21.jpg` : les 21 images de la plongée.
- `raccord-p09-p10.jpg` : la dernière image, p10 n°30 et leur différence ×8.
- `mouvement.jpg` : les barres de mouvement et le zoom par image.
- `essai-declic-planche.jpg` : une image sur quatre du rendu de contrôle.

## Faiblesses (franchement)

- **Le toucher ne tombe pas sur le lac.** Le pouce de la prise ne monte jamais au-dessus de 0,55 de la hauteur de l'écran, alors que la carte du lac dans E13 s'arrête à 0,52. Au n°42, le bout du pouce est posé sur le haut de la carte voisine (« La traversée du Vercors »). La photo grandit bien depuis la carte du lac, juste au-dessus, et on lit « elle ouvre cette photo », mais quelqu'un qui arrête l'image verra que le doigt est à côté. Aucune capture réelle n'a de photo du lac à cette hauteur sous le pouce : la carte du jour 1 d'E01a est plus haut et au-dessus de la carte de France. Il reste deux options : une reprise Flow avec le pouce qui monte plus haut, ou ce montage tel quel.
- **Pas de vrai tap** : le pouce monte, marque un léger temps d'arrêt puis redescend. L'ouverture est calée sur ce temps d'arrêt.
- **Contenu de la photo** : la photo ouverte (p10 n°30) n'est pas la même image que la vignette de la carte (img09). Le passage se fait par un fondu pendant que la vignette grandit, sur 5 images.
- **Format** : comme la photo ne prend que la largeur de l'écran (16:9 dans un écran portrait), elle est « en grand » mais pas énorme à l'image : environ 385 × 217 px dans un cadre de 1920 × 1080. Elle se lit clairement comme un lac.
- **Liseré** : un liseré clair d'un pixel reste visible autour de l'écran noir (bord de l'arrondi). Le liseré magenta, lui, a été corrigé dans `incruste.py`. Les autres plans incrustés n'ont pas été recomposés avec cette correction ; elle n'y change rien de visible, faute d'écran noir.
- **Arrivée de la plongée** : les deux dernières images sont nettes (obturateur fermé) alors que la vitesse est maximale. Le flou s'arrête donc un peu sec, à ×1,2 de zoom par image. La plongée de l'ouverture continue sur un mouvement ; ici, c'est P10 (le survol en avant) qui le reprend.
- **Son** : la piste est 12 ms plus courte que l'image (dernière trame AAC).
- **Non jugé en mouvement** : je n'ai vu que des planches et des bandes, pas la lecture à vitesse réelle. Restent à juger par Tony : le rythme de l'accélération, l'effet du flou de zoom, la lisibilité du toucher et le raccord avec le survol de P10.
