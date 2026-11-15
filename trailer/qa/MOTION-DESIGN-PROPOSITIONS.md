# Motion design par-dessus le film : propositions (15/11/2026)

Demande de Tony : « propose du Motion design par dessu, propose des idées sur toute le filme, smooth propre épuré ». Ce sont des **propositions à choisir**. Le montage (`livraison/LKDV-ours-v2.mp4`) et les fichiers existants n'ont pas été modifiés.

- Planches : `qa/snapshots/motion/planche-idees.jpg` (idées 1 à 6) et `planche-idees-2.jpg` (7 à 12).
- Images clés (1920×1080, sur de vraies images du montage) : `qa/snapshots/motion/idee-NN-*.jpg`.
- Essais animés (non versionnés) : `livraison/LKDV-motion-essai-1-fil-seceda.mp4`, `-essai-2-iris.mp4`, `-essai-3-donnee.mp4` (et `-essai-3-donnee-28mo.mp4`, version allégée pour l'envoi).
- Outils : `motion-lab/` (`render.mjs` : Chrome sans tête + canevas 2D, une image par appel ; `track.py` : suivi de caméra OpenCV ; `scenes/*.js` : une scène par idée ; `essais.sh`, `stills.sh` : tout refaire). Les images extraites du film et les rendus intermédiaires sont dans `motion-lab/frames/` et `motion-lab/work/`, ignorés par git.

## Le système graphique (commun à toutes les idées)

- **Le tracé** : trait Stone `#FAF8F5` de 2,5 px (2,75 px vu du ciel, 3 px au logo), bouts ronds, halo Stone flou à 7 px (mode écran), ombre encre `#06120C` très douce dessous (flou 3 px, 30 %) pour qu'il tienne sur la neige et les nuages. La queue s'estompe sur 60 à 140 px, la tête est un point de 3,6 px.
- **Le point / l'anneau** : un point de 3,2 px et un anneau de 1,5 px qui s'ouvre une fois (rayon ×4 à ×6, courbe quintique amortie) puis s'éteint.
- **Mouvement** : tracés qui se dessinent (« trim path ») puis dont la queue rattrape la tête, courbes `inOutQuint`, `out` cubique ou quintique. Aucune courbe ne dépasse sa valeur d'arrivée (rien ne rebondit), rien ne clignote. Chaque élément vit moins d'une seconde.
- **Suivi** : le trait est posé sur le vrai chemin (coordonnées relevées sur grilles au 1/1 à ×3, ou axe de route calculé par carte de distance) et suit la caméra par homographie image par image (flux optique Lucas-Kanade + RANSAC, au moins 662 points retenus par image), les sujets sont suivis séparément.
- **Typographie** (familles B et C seulement) : libellés de l'app en Inter 600, 15 px, capitales espacées de 2,6 px ; valeurs en JetBrains Mono 400, 30 px ; mots en Georgia italique, 40 px.
- Jamais deux éléments à la fois, rien sur un visage, rien sur un écran de téléphone.

## Les idées

Temps : image du film à 24 i/s ; temps de musique d'après `qa/mix-v4.beats.json` (1 temps = 10,51 images).

### 1. Le fil — famille A (sans texte ni chiffre)
- **Ce que c'est** : un seul trait de lumière qui court sous le film et se montre par touches sur les vrais chemins.
- **Où** : il naît à l'allumage du Soleil (image 32, temps 4 de la mesure 1). L'ouverture contient **déjà** un fin trait bleu qui file vers la Terre (images 36 à 42) : il suffit de le passer en Stone pour qu'il devienne le début du fil (idee-01-fil-soleil). Puis P26 Seceda (images 600 à 631, du temps 57 au temps 60) : il part du premier marcheur et file sur la crête qu'ils suivent. P27 Tre Cime (637 à 671) : il monte le sentier jusqu'au sommet. P35 (831 à 851) : il descend les lacets devant le coureur. P38 Tofana (894 à 924) : il file devant Malik sur le sentier de l'éboulis. P42 (épingle vue du ciel, 988 à 1019) : il remonte la route devant la roue avant de Clara. Final : il devient la crête du logo (idée 10).
- **Apporte** : le lien entre l'ouverture, les aventures et les milliers de tracés de la fin ; le motif de marque sans un mot.
- **Risque** : un trait mal posé se voit tout de suite ; trop de touches et il devient décoratif. Sur P33 (le coureur vient vers la caméra) le chemin devant lui est hors champ : pas de fil.
- **Images** : `idee-01-fil-soleil.jpg`, `idee-01-fil-seceda.jpg`, `idee-01-fil-tofana.jpg`, `idee-01-fil-epingle.jpg` ; essais 1 et 3.
- **Avis** : **à garder**, c'est la colonne vertébrale. Quatre ou cinq touches suffisent (Seceda, Tofana, épingle, logo).

### 2. Le point qui vit — famille A
- **Ce que c'est** : le « ping » de position, comme le point GPS de l'app : un point posé aux pieds, un anneau qui s'ouvre une fois, et le fil part de là.
- **Où** : P26 (images 590 à 608, sur le drop, anneau autour du premier marcheur), P38 (884 à 902, autour de Malik), P30 Sorapis (715 à 756), éventuellement P40, P43, P50.
- **Apporte** : l'œil trouve en une demi-seconde des personnages de 20 px dans des plans larges de 1,7 s.
- **Risque** : le cercle autour d'un personnage rappelle vite la sélection d'unité d'un jeu vidéo. Corrections faites : pas d'ellipse au sol, anneau unique, éteint en 0,75 s, et sur P30 il passe **derrière** Léa (ses pixels sombres sont reposés par-dessus).
- **Image** : `idee-02-point-sorapis.jpg` ; essais 1 et 3 (version A).
- **Avis** : **à doser** : deux ou trois fois dans le film (Seceda, Tofana), jamais sur un plan où le personnage se voit déjà.

### 3. Le cadre qui s'ouvre — famille A
- **Ce que c'est** : de l'image 0 à 588 (cosmos, fenêtre, préparation, départ), le film est en 2,39:1 (deux bandes noires de 138 px). Sur le drop (image 589, premier temps de la mesure 15), l'image s'ouvre en plein cadre en 8 images (courbe cubique sortante : ça s'ouvre sur le coup puis ça se pose). Elle se referme doucement au bivouac (vers 1093, outro) en 24 images.
- **Apporte** : le drop gagne de l'air au sens propre ; aucun élément graphique, aucun risque de goût.
- **Risque** : les plans à téléphone de la décision perdent 13 % de hauteur (vérifier que les écrans incrustés restent entiers) ; l'ouverture (cosmos) devra être recadrée.
- **Images** : `idee-03-cadre.jpg` (588 | 589) ; essai 1.
- **Avis** : **à garder**, c'est la plus forte et la moins chère.

### 4. L'iris — famille A
- **Ce que c'est** : P08 → P10 ne coupe plus : le lac grandit depuis le reflet du lac dans la pupille de Léa (cercle à bord doux, 20 % de fondu), pendant que l'œil pousse vers la pupille (×1,6). Le lac part de ×1,22 et se pose exactement sur l'image 252.
- **Où** : images 237 à 252 (temps 23 à 24). Dans cette variante, **P09 (le pouce sur l'écran vert, 242–251) disparaît** : l'œil est tenu (image 241) pendant que l'iris s'ouvre. Le cercle suit la pupille (suivi, écart ≤ 3 px).
- **Apporte** : le « déclic » devient une image ; le rêve naît dans le regard.
- **Risque** : on perd le geste du pouce (P09) ; le lac est figé (image 252 tenue avec un léger recul) pendant 15 images, ça passe à l'œil dans l'essai mais à vérifier en grand.
- **Image** : `idee-04-iris.jpg` (image 244 de l'essai) ; essai 2.
- **Avis** : **à garder**, si Tony accepte de perdre P09.

### 5. Les courbes de niveau — famille A
- **Ce que c'est** : un voile de courbes topographiques (1,2 px, 40 % dans l'image clé, une courbe maîtresse sur cinq plus marquée) qui se dessine une seconde autour du sommet que gravit le groupe à Tre Cime (P27) ; même motif sur la carte papier de la préparation.
- **Apporte** : un motif de marque (carte, relief).
- **Risque** : posées sur une photo, les courbes ne suivent pas le vrai relief (on n'a pas d'altitude) et se battent avec la texture de la roche ; à 15–25 % elles disparaissent, au-delà elles font calque. Je n'ai pas obtenu un rendu convaincant.
- **Image** : `idee-05-courbes-tre-cime.jpg`.
- **Avis** : **à éviter** sur la montagne ; acceptable seulement sur la carte papier (idée 11).

### 6. La constellation — famille A
- **Ce que c'est** : au bivouac (P50, plan très sombre), cinq **vraies** étoiles de l'image se relient d'un trait de 1,25 px et dessinent le logo dans le ciel ; une sixième, cerclée, en est le soleil. Elles ont été trouvées par recherche automatique : chaque étoile est à moins de 9 px de la géométrie exacte du logo (échelle 15, centre 1168/288). Le logo s'annonce sans un mot, sept secondes avant la fin.
- **Où** : images 1225 à 1250 (mesure 30) ; à dessiner étoile par étoile sur deux temps, puis à laisser s'éteindre. Dans P51, une lueur peut partir du téléphone de Noah vers le haut du cadre (non dessiné : le téléphone est encore vert).
- **Risque** : P50 est accéléré ×2,5 avec un recul de drone : les étoiles bougent, il faudra le même suivi que pour les autres plans ; trop lumineux, ça devient un clin d'œil appuyé.
- **Image** : `idee-06-constellation.jpg`.
- **Avis** : **à garder** (alpha 0,6 à 0,7, très court).

### 7. La donnée juste — famille B (chiffres réels de l'app, assouplit la règle)
- **Ce que c'est** : une seule valeur à la fois, petite, accrochée au sujet par un trait de rappel de 1,25 px : libellé de l'app en capitales (Inter), valeur en JetBrains Mono.
- **Valeurs réelles relevées** (aucune inventée) : capture E08 (Tre Cime/Sorapis) : DISTANCE 6,4 km · ALLURE 4,0 km/h · TEMPS 1 h 36 · **D+ 172 m** ; capture E10 (coureur) : DISTANCE 2,1 km · ALLURE 3,5 km/h · TEMPS 36:18 · D+ 89 m ; capture E07 (départ) : DISTANCE 0 m, chrono 0:04. **« D+ 812 m » et « 0,00 km » de la trame n'existent pas dans l'app** ; l'allure de E10 (3,5 km/h) est une allure de marche, inutilisable pour un coureur (il faudrait une capture en mode course).
- **Où** : P27 (D+ 172 m, image clé), P33 (TEMPS 36:18, images 800–819), P38 (DISTANCE 2,1 km, 886–924). Jamais sur un plan à téléphone, jamais avec le fil dans le même plan.
- **Apporte** : relie l'image à l'app ; donne l'échelle.
- **Risque** : c'est exactement la pente du « HUD flottant » que Tony a refusé ; les valeurs réelles sont modestes (89 m, 2,1 km) et ne font pas rêver.
- **Images** : `idee-07-donnee-tre-cime.jpg`, `idee-07-donnee-coureur.jpg` ; essai 3 (version B).
- **Avis** : **à doser** : une ou deux fois dans tout le film au maximum, ou pas du tout.

### 8. Le total qui fond — famille B
- **Constat** : la capture `assets/screens/E05b-kit-studio-bilan.png` **ne contient aucun montant** : elle montre « 2,8 kg sur le dos », « Base sèche 2,8 kg », « Eau et vivres 0,0 kg », « Porté sur toi 0,0 kg ». Le seul prix réel des captures est « Commander · 5 pièces · 471 € » (E06), qui ne fond pas. Je n'ai donc pas fait fondre de prix.
- **Image clé** : `idee-08-poids-lit.jpg` (P16, image 405) : « SUR LE DOS / 2,8 kg » en Inter 200 de 128 px, posé sur la couverture olive (lisible, loin du visage et du téléphone).
- **Risque** : sans montant qui chute, l'idée ne raconte plus « partir avec presque rien » ; P16 contient déjà le téléphone (vert) qui montrera l'app.
- **Avis** : **à éviter en l'état** ; à reprendre seulement si l'app affiche un vrai total qui baisse (capture à faire).

### 9. Quatre verbes — famille C (des mots, rompt la règle)
- **Ce que c'est** : un mot par chapitre, Georgia italique 40 px, Stone, en bas à gauche dans la zone titre (le bas centre est occupé par le feu, les mains ou les téléphones) : « Rêver » (P06, 126), « Préparer » (P11, 294), « Partir » (P20, 462), « Raconter » (P47, 1135), chacun moins d'une seconde.
- **Images** : `idee-09-verbes-rever.jpg`, `idee-09-verbes-raconter.jpg`.
- **Risque** : effet bande-annonce générique ; ça explique ce que l'image dit déjà ; contredit la règle posée par Tony.
- **Avis** : **à éviter**.

### 10. Le logo — famille A, variante C
- **Ce que c'est** : pendant que les milliers de tracés convergent (P53), le fil unique du film (3 px, tête lumineuse) dessine la **crête** du logo, avec sa géométrie exacte (`film/lib/fx/traces.js` : centre 960/540, 21 px par unité), puis le logo se pose sans rebond sur le coup de l'impact (image 1387) et le point du soleil se pose en dernier (idée 12). Variante C : le nom « LE KIT DU VOYAGEUR » en Inter 600, 22 px, espacé de 9 px, sous le logo (image 1420).
- **Images** : `idee-10-logo-crete.jpg` (image 1378), `idee-10-logo-signature.jpg` (image 1420).
- **Risque** : figé, le tracé partiel de la crête peut faire penser à une courbe de graphique ; en mouvement (et avec le trait épais du logo qui suit) ça se lit comme un dessin du logo. Toucher à `p53`/`p54` est un chantier à part.
- **Avis** : **à garder** ; la ligne de nom est la seule entorse que je recommanderais (le spectateur ne connaît pas encore le nom de l'app).

### 11. La carte qui annonce — famille A (mon idée)
- **Ce que c'est** : pendant la préparation (P13, images 336 à 356, et P15), l'itinéraire se trace sur la carte papier posée au sol, flou comme elle (flou de 1,6 px), puis on retrouve ce tracé en vrai sur la crête de Seceda.
- **Image** : `idee-11-carte.jpg` (image 345).
- **Risque** : plan à téléphone (le trait reste sur la carte, loin de l'écran) ; très discret, peut passer inaperçu.
- **Avis** : **à doser** (bonus pour le niveau appuyé).

### 12. Le point du Soleil — famille A (mon idée)
- **Ce que c'est** : l'étincelle du Soleil (image 32–36) est le même point qui se pose en dernier sur le logo (le soleil du logo, image 1387 et suivantes) : un anneau identique s'ouvre aux deux endroits. Le film commence et finit sur le même point.
- **Image** : `idee-12-point-soleil.jpg` (deux volets).
- **Avis** : **à garder** : coût minimal, sens fort.

## Essais animés

| Essai | Images du film | Contenu | Mesures (ffprobe) |
|---|---|---|---|
| `LKDV-motion-essai-1-fil-seceda.mp4` | 547–673 | 2,39:1 jusqu'à 588, ouverture en 8 images sur le drop (589) ; anneau autour du premier marcheur (590–608) ; fil sur la crête de Seceda (600–631) ; fil sur le sentier de Tre Cime jusqu'au sommet (637–671) | 127 images, 24 i/s, 1920×1080, 5,292 s ; son 5,290 s |
| `LKDV-motion-essai-2-iris.mp4` | 210–294 | l'iris de 237 à 252 (P09 retiré) | 85 images, 24 i/s, 1920×1080, 3,542 s ; son 3,541 s |
| `LKDV-motion-essai-3-donnee.mp4` | 799–925, deux fois | carton A (1 s, silence) · version A (fil sur les lacets P35, anneau + fil P38) · carton B (1 s) · version B (TEMPS 36:18 sur P33, fil P35, DISTANCE 2,1 km sur P38) | 302 images, 24 i/s, 1920×1080, 12,584 s ; son 12,583 s ; 32,8 Mo |
| `LKDV-motion-essai-3-donnee-28mo.mp4` | idem | même contenu, H.264 CRF 20 (au lieu de 15), pour l'envoi | 302 images, 12,584 s ; 21,5 Mo |

Son : le passage correspondant de `qa/mix-v4.wav` (mêmes temps, AAC 256 kb/s). Les cartons de l'essai 3 sont des cartons de présentation, pas du film.

## Recommandation

- **Minimal** (respecte la règle, rien d'écrit) : 3 Le cadre qui s'ouvre · 1 Le fil (Seceda, Tofana, épingle) · 10 Le logo (crête tracée, sans nom) · 12 Le point du Soleil.
- **Équilibré** (mon choix) : le minimal + 4 L'iris · 2 Le point qui vit (Seceda et Tofana seulement) · 6 La constellation · 10 variante C (le nom sous le logo, la seule entorse).
- **Appuyé** : l'équilibré + 7 La donnée juste (deux fois : D+ 172 m à Tre Cime, DISTANCE 2,1 km sur Tofana) · 11 La carte qui annonce · 5 Les courbes de niveau sur la carte papier seulement. Même à ce niveau, je laisserais de côté 8 (pas de montant réel) et 9 (les verbes).

## Polices utilisées
- **Inter** (variable, `src/app/fonts/inter.woff2` du dépôt) : libellés, nom sous le logo, planches.
- **JetBrains Mono 400** (`trailer/node_modules/hyperframes/…/JetBrainsMono-400.woff2`, licence OFL dans le même dossier) : valeurs de la famille B. Remarque : `tokens.css` déclare IBM Plex Mono comme mono de l'app (`src/app/fonts/plexmono-*.woff2` existe) ; la brief demandait JetBrains Mono, à trancher.
- **Georgia italique** (système macOS) : les verbes, les titres de planche.

## Ce qui n'est pas vérifié
- Seuls les trois passages des essais sont animés ; les autres idées n'existent qu'en image fixe (leur timing est indiqué mais non rendu).
- Le suivi de P35 (FPV très rapide) et de P27 n'a été contrôlé qu'à l'œil sur quelques images ; P33 est ancré à la main (le flou de bougé fait décrocher le suivi automatique).
- Le contour du trait sur fond très clair (neige) n'a été vu que sur le gravier de P42 et les nuages de P26 ; pas sur un plan de neige.
- Les essais sont montés sur l'ours v2 (écrans verts, pas d'étalonnage) : à revoir sur l'étalonnage final, et l'idée 3 avec les écrans incrustés.
- Les essais ont été regardés image par image (planches de contrôle), pas en lecture plein écran sur un grand moniteur ni en 9:16.
- La géométrie de la constellation suppose que P50 garde ce cadrage (montage en cours de modification par un autre agent).

## Intégration v6 (15/11/2026)

Socle commun aux niveaux « minimal » et « équilibré » posé dans le film : **3 le cadre qui s'ouvre, 1 le fil, 10 le logo tracé par le fil, 12 le point du Soleil**. Film : `livraison/LKDV-ours-v6.mp4` (+ `-reperes.mp4`, `-mobile.mp4`), liste `montage/edl-ours-v6.json` (= v4 + motion design), rapport `qa/OURS-V6.md`, preuves `qa/snapshots/motion-v6/`. Son : `qa/mix-v5.wav` (présent au moment de l'assemblage).

### Chaîne
1. `node motion-lab/v6/render-v6.mjs` (Chrome sans tête, canevas 2D) lit `motion-lab/v6/reglages-v6.json` et écrit, par image du film, `motion-lab/renders/v6/avant/fNNNN.png` (fil, logo, point ; transparence), `motion-lab/renders/v6/apres/fNNNN.png` (bandes du cadre) et `motion-lab/renders/v6/fin-base.mkv` (la fin 1335–1439 à 24 i/s natif, sans logo). Non versionnés.
2. `node tools/montage/build-ours.mjs montage/edl-ours-v6.json --reutiliser-segments` : pour chaque plan, correction → look commun (LUT) → adoucissement → **surcouche « avant »** → grain → **surcouche « apres »** (`tools/montage/etalonnage.mjs`, paramètre `surcouches` : fusion `maskedmerge` en 4:4:4 16 bits, l'overlay de ffmpeg 6.0 n'ayant pas de 4:4:4 au-delà de 8 bits). Le fil et le logo prennent donc le grain du film ; les bandes restent d'une couleur exacte. Ajouts à `build-ours.mjs`, tous facultatifs : `edl.surcouches`, `plan.decalage` (décalage vertical), `plan.source = "rendu"` + `fichier` + `entree` (plage remplacée par un rendu externe). Les listes v1 à v4 donnent exactement les mêmes chaînes de filtres qu'avant (vérifié sur les 54 plans × 2 matrices).
3. `python3 tools/montage/controle-ours.py` : pour une liste à surcouches, les mesures d'image (coupes, gel, noirs) portent sur la fenêtre 1920×804, sans les bandes.
4. `python3 motion-lab/v6/preuves-v6.py livraison/LKDV-ours-v6.mp4` : planches `qa/snapshots/motion-v6/`.
Suivi : `python3 motion-lab/v6/track-v6.py motion-lab/frames/v4 motion-lab/v6/track-v6.json` (homographies par image, flux optique chaîné puis affiné par ECC sur une bande autour du chemin ; contrôle par corrélation de patchs le long du chemin, écart en px sur **toutes** les images).

### Interrupteurs (`motion-lab/v6/reglages-v6.json`)
`cadre`, `fil`, `logo_fil`, `point_soleil` : **allumés**. `nom_sous_logo` (variante C de 10), `iris` (4), `point_qui_vit` (2), `constellation` (6) : éteints. Chaque idée se coupe seule : changer l'interrupteur, relancer `render-v6.mjs` puis `build-ours.mjs … --reutiliser-segments` (≈ 6 min). Sans `logo_fil`, le logo se pose net sur 1387 sans être tracé ; sans `point_soleil`, son soleil se pose avec lui.

### Ce qui est posé
- **3 · Le cadre** : bandes 2,39:1 (138 px, encre `#0B1F17`) de 0 à 588 ; ouverture en 8 images sur le drop (589–596, courbe cubique sortante, celle de l'essai 1). **Choix pour la suite** : ouvert pendant toute la montagne, le coureur, la cycliste et le bivouac (le monde est grand) ; **refermé sur la reprise (1261–1272, P51)** : Noah rêve dans son bus comme Léa à sa fenêtre, le cycle recommence dans le même format que le début ; **rouvert sur le coup du logo (1387–1394)**. Je n'ai pas refermé à 1093 : le bivouac (Voie lactée, P50) est un grand plan qui mérite le plein cadre, et une troisième bascule aurait fait système.
  Plans recalés verticalement pour que rien ne soit coupé (champ `decalage`, px, + = vers le bas) : P06 +80 (tête de Léa), P07 +40 (haut du téléphone), P09 −50 (écran), P11 +130 (visage qui se lève), P13 +24, P14 +40 (visages des trois amis), P15 +40 (téléphone ; il fait 920 px de haut et ne tient pas en entier dans 804 : on garde le haut de l'écran), P16 −100 (Léa et le téléphone sur le lit), P17 −40 (pouce sur le bouton), P18 +50 (visage et sac), P23 +110 (têtes du groupe). P25 −100 : on garde le téléphone à l'épaule (le plan d'origine coupe déjà le visage au menton). L'ouverture (cosmos), P08, P10, P12, P19 à P22 et P24 passent tels quels. La bande découverte par le décalage est sous les bandes.
- **1 · Le fil** (Stone 2,5 px, halo, ombre douce) : naissance au Soleil 33–46 (du cœur de la galaxie vers la tête du trait bleu de l'ouverture, écran fixe) ; P26 Seceda 598–624 (part devant le premier marcheur, file sur la crête ; la queue ne repasse jamais derrière les marcheurs) ; P35 836–847 (lacets devant le coureur) ; P38 894–924 (sentier de l'éboulis, devant Malik) ; P42 990–1019 (route de l'épingle devant la roue avant, trait 2,75 px avec ombre plus marquée sur le gravier clair) ; puis le contour du logo (1349–1380). Pas de fil sur P27 (le trait passerait au-dessus des marcheurs en contre-jour, gros plan à moins d'une seconde du drop), sur P33 (le coureur vient vers nous, le chemin est hors champ) ni sur P43 (respiration avant le bivouac). Écart de suivi mesuré, sur les images où le trait est visible : P26 médiane 1,4 px (partie lointaine 2,2 px), max 16 px au bout lointain pendant l'extinction (le brouillard bouge sous les patchs de contrôle) ; P35 médiane 1,0 px, max 23 px à l'image 847 (le bras couvre le chemin, trait presque éteint) ; P38 médiane 0, max 4 px ; P42 médiane 0, max 23 px sur un seul point aux images 1014–1016 (ombre de la cycliste). Fond clair : `fil-test-fond-clair.jpg` (neige de P10, brouillard de P26).
- **10 · Le logo** : la fin (P53 + P54, 1335–1439) est refaite à 24 i/s natif dans `motion-lab/scenes/v6.js` (même plaque img39, mêmes 2 200 tracés et même convergence que `film/lib/fx`, recalés : 1335 → F 0, 1387 → F 104 = logo net). Le fil dessine le contour du logo de 1349 à 1380 sur la géométrie exacte de `public/assets/logo-mark.svg` (centre 960/540, 21 px par unité, celle de l'ancienne p54) ; **le logo est posé, plein et net, sur 1387** (de 1381 à 1387 le trait du fil s'épaissit de 3 px à 33,6 px, courbe quintique sortante, sans dépassement ; il arrive sur le coup avec l'éclair d'impact de la fin), puis le recul de 5,5 % et la sortie sur l'encre comme avant. Corrigé au passage : la plaque couvre toujours le cadre pendant le recul (l'ancienne p54 laissait un liseré encre de quelques pixels sur les bords).
- **12 · Le point du Soleil** : l'étincelle part de 1389, arrive au soleil du logo à 1398, grossit jusqu'au disque du logo en 6 images, un anneau s'ouvre une fois (1398–1414). C'est la même étincelle (même trait, même tête) que celle qui naît au Soleil à l'image 33.
- Variante C (éteinte) : « LE KIT DU VOYAGEUR » sous le logo, Inter 600 22 px espacé de 9 px, entrée 1408–1418 : `qa/snapshots/motion-v6/logo-variante-nom.jpg`.

### Ajouter les idées 4, 2 et 6 (niveau équilibré)
Les trois interrupteurs existent déjà. Pour chacune : écrire son dessin dans `motion-lab/scenes/v6.js` (fonction appelée par la scène `v6-avant`) et déclarer ses images dans `M.v6.actif()` ; ses repères vont dans `geo-v6.json` et, s'il faut un suivi, un plan de plus dans `track-v6.py` (même format). Le reste de la chaîne ne change pas.
- **4 · L'iris** remplace P09 : c'est un changement d'image, pas une surcouche. Rendre la séquence 237–251 (scène `essai-2` de l'essai 2, sur les images v4) dans un fichier, puis passer P09 en `source: "rendu"` dans la liste (champ déjà disponible).
- **2 · Le point qui vit** : `M.ring` sur `subject("p26", n)` (590–608) et `subject("p38", n)` (884–902) ; les sujets sont déjà suivis dans `track-v6.json`.
- **6 · La constellation** : les six étoiles réelles de P50 (`scenes/stills.js`, `STARS`) à suivre dans P50 (plan accéléré ×2,5 : ajouter `p50` dans `geo-v6.json` avec une bande sur le ciel), apparition sur la mesure 30 (≈ 1225–1250).
