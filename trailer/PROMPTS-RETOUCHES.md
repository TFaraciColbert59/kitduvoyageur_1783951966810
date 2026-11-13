# LKDV — Trailer 60 s · Images à refaire (retouches du 13/11/2026)

Trois images ne raccordent pas avec leurs voisines au montage (relecture `qa/REVIEW.md`). Tout le reste est gardé.

| Image | Plan | Défaut constaté | Fichiers à joindre dans ChatGPT |
|---|---|---|---|
| `img37` | P48 et P49 | Léa porte un bonnet, alors qu'elle est tête nue au plan d'avant (`img36`) | `F1-lea.png`, `img36.png`, l'ancienne `img37.png` |
| `img20` | P28 | Ciel bleu de plein midi entre deux plans de lever de soleil (`img19`, `img46`) | `F1-lea.png`, `F4-tom.png`, `img19.png`, `img46.png`, l'ancienne `img20.png` |
| `img43` | P17 | Le pouce appuie en haut de l'écran, alors que le vrai bouton « Commander » de l'app est tout en bas | `F1-lea.png` (tenue de ville), l'ancienne `img43.png` |

Pas à refaire : `img09b` et `img22` (le lac : l'écart de lumière est faible, l'étalonnage le rattrape) ; `img42` (les petites croix aux coins de l'écran vert seront recouvertes par la capture de l'app).

## Mode d'emploi

1. Dans la même conversation ChatGPT que le film (la bible et les fiches y sont déjà), envoie le MESSAGE D'OUVERTURE.
2. Puis une image par message, avec les fichiers à joindre indiqués. Attends d'être satisfait avant la suivante.
3. Contrôle chaque image avec la grille de `PROMPTS-CHATGPT.md` (16:9, aucun texte, mains, écran vert uni aux coins visibles).
4. Enregistre sous le MÊME nom (`img37.png`, `img20.png`, `img43.png`) dans `trailer/assets/footage/`, en remplacement, et pousse dans git. Le contrôle de réception et la remise en place dans le film se font ensuite de mon côté.

## MESSAGE D'OUVERTURE

```
Nous reprenons le même film, avec la même bible, les mêmes fiches personnages et les mêmes règles : image paysage 16:9, photoréaliste comme une image extraite d'un film, aucun texte, chiffre, logo ni marque, écran de téléphone en vert chroma uni.

Trois images sont à refaire, parce qu'au montage elles ne raccordent pas avec le plan d'avant ou d'après. Pour chacune, je joins l'ancienne image et ses voisines dans le film. Change UNIQUEMENT ce que je demande et garde tout le reste (cadre, personnages, tenues, décor). Génère une seule image à la fois.
```

## img37 — Léa publie son carnet (P48 et P49)

Joindre : `F1-lea.png`, `img36.png`, l'ancienne `img37.png`.

```
IMAGE À REFAIRE : img37, Léa publie son carnet, la nuit au bivouac.

POURQUOI : dans le plan juste avant (img36, jointe), Léa est TÊTE NUE, en doudoune vert forêt, près du feu. Dans l'ancienne img37 (jointe), elle porte un bonnet et une couverture sur les épaules : au montage, le bonnet apparaît d'un coup.

CE QUI CHANGE : Léa est tête nue, exactement comme dans img36 : cheveux châtain foncé ondulés, queue de cheval basse, deux mèches libres autour du visage, petites créoles argentées. Sa doudoune vert forêt se voit nettement (col et épaules). La couverture de laine grise est seulement posée sur ses genoux, en bas du cadre, pas sur ses épaules.

CE QUI NE CHANGE PAS : le cadre de l'ancienne img37. Plan rapproché, objectif de 50 mm à f/1,8, Léa de profil trois-quarts à gauche de l'image, assise à l'entrée de la tente vert sauge. Elle tient son téléphone à deux mains au centre de l'image, écran tourné vers la caméra, ENTIER dans le cadre : vert chroma uni pur #00FF00, mat, quatre coins arrondis nets et visibles. Le pouce droit est sur le point de toucher l'écran. Sourire paisible et fier. Le feu de camp à droite, les montagnes sombres et les étoiles floues au fond.

LUMIÈRE : la même nuit que img36. Lueur orangée du feu, à droite, sur la joue et les mains ; lumière ambrée douce de la tente derrière elle.

INTERDITS : bonnet, capuche, lueur verte sur la peau, contenu ou reflet sur l'écran, texte.
```

## img20 — La main tendue (P28)

Joindre : `F1-lea.png`, `F4-tom.png`, `img19.png`, `img46.png`, l'ancienne `img20.png`.

```
IMAGE À REFAIRE : img20, la main tendue.

POURQUOI : le plan d'avant (img19, jointe) et le plan d'après (img46, jointe) se passent au lever du soleil : lumière dorée rasante, ciel pâle, brume dans les vallées. L'ancienne img20 (jointe) a un ciel bleu cobalt de plein midi : au montage, on saute de quatre heures.

CE QUI CHANGE : la lumière et le ciel, rien d'autre. Petit matin, quelques minutes après le lever du soleil : ciel très pâle, bleu clair qui tire vers le pêche près de l'horizon, un voile de nuage fin ; soleil très bas, par la droite, lumière dorée rasante et chaude sur les visages, contour or sur les cheveux, ombres longues et douces ; légère brume au loin. Au fond, entre les deux personnages, la silhouette lointaine et voilée des Tre Cime, comme dans img46. Couleurs retenues, aucun bleu saturé.

CE QUI NE CHANGE PAS : le cadre et l'action de l'ancienne img20. Gros plan en contre-plongée, objectif de 35 mm à f/2,8, les deux mains jointes au centre de l'image. Tom (veste bleu encre, barbe blond roux, tapis de sol roulé sur son sac), debout sur un gros rocher de dolomite, se penche et tend la main ; Léa (veste polaire vert forêt, sac LKDV ONE vert olive identique à la fiche) saisit sa main et se fait tirer vers le haut, elle rit aux éclats, la queue de cheval soulevée par le vent. Prise ferme, cinq doigts à chaque main.

INTERDITS : ciel bleu profond, soleil haut, ombres dures de midi, mains fusionnées, doigts en trop, texte.
```

## img43 — Le pouce sur le bouton (P17)

Joindre : `F1-lea.png` (tenue de ville), l'ancienne `img43.png`.

```
IMAGE À REFAIRE : img43, le pouce de Léa appuie sur son téléphone.

POURQUOI : j'incruste ensuite sur cet écran une vraie application, dont le grand bouton est tout EN BAS de l'écran. Dans l'ancienne image (jointe), le pouce appuie en HAUT de l'écran et on ne voit que le haut du téléphone : le geste ne tombe pas sur le bouton.

CE QUI CHANGE : le téléphone est tenu à la verticale dans la main gauche, vu presque de face, en très légère plongée. Le cadre montre la MOITIÉ BASSE du téléphone : le bord inférieur du téléphone et les deux coins arrondis du BAS de l'écran sont visibles et nets. Le pouce droit entre par le bas à droite de l'image, et sa pulpe touche l'écran dans son QUART INFÉRIEUR, au milieu de la largeur. Le pouce couvre au plus un cinquième de l'écran visible ; le reste de l'écran est dégagé.

CE QUI NE CHANGE PAS : très gros plan macro, objectif de 100 mm à f/2,8. Pouce aux taches de rousseur légères, ongle court sans vernis, bord de la manche en grosse maille crème. Écran vert chroma uni pur #00FF00, mat, sans rien dessus. Lampe chaude latérale, fond sombre et flou.

INTERDITS : bouton, icône ou contenu dessiné sur l'écran, lueur verte sur la peau, doigt déformé, texte.
```

## Si une image dérive

Les phrases de correction de `PROMPTS-CHATGPT.md` restent valables (personnage qui dérive, mains, écran, lumière incohérente).
