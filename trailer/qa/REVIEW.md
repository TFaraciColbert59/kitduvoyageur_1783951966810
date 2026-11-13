# REVIEW — animatic v4 (qa-critic, 2026-11-13)

Objet jugé : `qa/animatic-v4.mp4`. Images extraites au ffmpeg (image n = n/60 s), aucun rendu HyperFrames relancé.
Hors défaut (prévu plus tard) : écrans verts, étalonnage commun, son, 9:16, écusson.

## Mesures techniques (faites)
- `ffprobe -show_entries stream=width,height,r_frame_rate,nb_frames` : 1920×1080, 60/1, **3 600 images**. OK.
- Durées (`film/shots.json`, endFrame exclusif) : plus long plan = P54, 120 images (2,00 s). Aucun plan > 120 images. OK.
- Coupes sur les temps : écart de chaque coupe au temps le plus proche du **montage** (beatTimes de `storm-ii.beats.json` reportés selon la table de `MUSIQUE.md`) : **max 0,4 image** sur les 53 coupes. OK.
  (Contre `beatTimes` bruts, sans la table de montage, l'écart monte à 9,1 images : ce n'est pas un défaut, la musique est remontée.)

## Les 10 corrections les plus rentables (dans l'ordre)
1. `film/compositions/p14.html` — P0 : trois volets pleins dès 823, encre ≤ 15 % hors des 8 dernières images.
2. `film/compositions/p53.html` — logo : tressage ouvert jusqu'à 3474, forme finale = boîte exacte du logo de P54 (pas de saut à 3480).
3. `film/compositions/p08.html` + `p09.html` — reflet = photo du lac (pas une « enveloppe »), entrée de P09 par le rond de la pupille.
4. `film/compositions/p33/p35/p37/p39/p40/p43/p44.html` — filé de sortie ≤ 4 images, entrée ≤ 2 (P38 inclus).
5. `film/compositions/p38.html` — Malik ≥ 18 px.
6. `film/compositions/p45.html` — supprimer le gel 2829–2847, ciel qui accélère.
7. `film/compositions/p49.html` — rendre la coupe 3060 visible (plan perçu de 2,2 s).
8. `film/compositions/p31.html` (ou `p30.html`) — même heure de lumière et même montagne sur le lac.
9. `film/compositions/p28.html` — ciel de midi → lumière de matin.
10. `film/compositions/p05.html` — flou radial hérité de P04 sur 3 images. (Puis : image P48/P49 sans bonnet, à refaire côté images.)

**Décompte : P0 = 1 · P1 = 11 · P2 = 9** (une ligne P1 regroupe 7 plans flous en sortie).

## Notes acte par acte

### Actes 1–3 (P01–P10), images 0–613
Planches : `qa/tmp/shots_0.jpg`, `shots_1.jpg`, `cuts_00.jpg`, `cuts_01.jpg` (extraction ffmpeg rawvideo 480×270, script scratchpad `ext.py`).
- P1 · t=8,03–8,47 s (image 482–507) · P08 · le reflet dans la pupille est un petit rectangle cyan à pointe en V qui se lit comme une **icône d'enveloppe** (courriel), pas comme le lac → y mettre la photo du lac (img09, turquoise + flèche de la montagne) en reflet bombé, ≥ 2× plus grand, bords doux · l'œil, la poussée et la durée restent.
- P1 · t=8,47 s (image 508) · P08→P09 · le raccord « rond de la pupille » n'existe pas : on saute de l'œil au plan large du téléphone déjà vu en P07 (même cadre, même fenêtre) → ouvrir P09 serré sur le rond (iris → coin arrondi de la photo), ou faire un zoom arrière de 6–8 images depuis la photo plein cadre · la poussée vers la photo et la sortie identique à P10 restent.
- P1 · t=4,53 s (image 271→272) · P04→P05 · le dôme flou de P04 (vue oblique) devient d'un coup un toit net vu d'aplomb, autre bâtiment, sans flou commun → prolonger le flou radial de P04 sur les 3 premières images de P05 (décroissant) et caler le toit/la fenêtre au centre du dôme · la vitre éclairée et l'entrée dans la fenêtre restent.
- P2 · t=1,48 s (image 88→90) · P01→P02 · le flash blanc ne tient qu'une image pleine (89) : les Alpes reviennent saturées dès 90 → fondre le blanc sur 4–6 images · la coupe 89 reste.
- Confirmé conforme : P01, le halo ne montre aucun logo lisible (images 0, 44, 88 regardées) ; P03→P04 raccord blanc-nuage parfait ; P05→P06 entrée par la vitre correcte ; P09→P10 identité de l'image de sortie (écart d'image à la coupe 2,3/255).
- Images quasi figées mesurées (écart moyen < 0,15/255 entre images voisines) : 223–236 (P04, plein nuage blanc, 0,23 s) → acceptable car c'est le cœur du nuage, mais ajouter une dérive de texture.

### Acte 4 (P11–P19), images 614–1190
Planches : `shots_1..3.jpg`, `cuts_02..04.jpg`.
- **P0** · t=13,72–14,60 s (images 823–875) · P14 · « Sami, Inès et Tom disent oui » se lit comme une mise en page cassée : aplat d'encre `#0B1F17` sur **70 % du cadre à l'image 823, 68 % à 836, 82 % à 875** (mesure : part des pixels à ±14 de (11,31,23), ffmpeg select + numpy) ; on ne voit jamais les trois visages ensemble en plein cadre (deux à 849, un seul à 875) → ouvrir sur **trois volets pleins (3 × 640 px) dès l'image 823**, entrée en cascade de 4 images maxi, fermeture des volets sur les 8 dernières images seulement ; encre ≤ 15 % du cadre hors de ces 8 images · les trois portraits, l'ordre Sami-Inès-Tom et la coupe 876 restent. Fichier `film/compositions/p14.html`.
- P2 · t=15,47–17,23 s (images 1028–1033) · P16 · des repères de suivi « + » sont visibles aux 4 coins de l'écran vert → s'assurer qu'ils disparaissent avec l'incrustation E5 · le reste ne bouge pas.
- P2 · t=11,53–12,40 s · P12 · le visage de Léa est coupé à moitié au bord gauche (amorce) sur tout le plan → décaler le cadre de 60–80 px vers la droite ou assumer une amorce plus floue · le téléphone reste centré.
- P2 · t=19,85 s (image 1191) · P19→P20 · les mains de P20 (larges, hâlées, sur polaire verte) ne ressemblent pas aux mains fines à manche crème de P19 → vérifier que c'est bien Léa (polaire verte = tenue de P23, donc logique) ; sinon ajouter un bout de manche/bracelet commun · la boucle et l'impact restent.
- Confirmé conforme : P10→P11 coupe sèche lisible ; P11→P12 et P12→P13 pouce/écran ; P15→P16 chute sur le lit ; P17→P18 impact « Commander » → colis ; P18→P19 ; P20→P21 (escalier). P17 tient 4 images quasi figées (1047–1050) : c'est l'appui, voulu.

### Actes 5–6 (P20–P32), images 1191–2008
Planches : `shots_3..5.jpg`, `cuts_04..07.jpg`.
- P1 · t=31,68 s (image 1901) · P30→P31 · saut de lumière sur le même lac : P30 en lumière rasante dorée (mélèzes contre-jour, rochers chauds), P31 en lumière de midi froide et ciel bleu dur, et la montagne n'a pas la même silhouette → réchauffer P31 (ou refroidir P30) pour une seule heure, et caler la dent centrale de P31 sur celle de P30 au premier tiers du plan · la mise au point et la durée restent. Fichiers `p30.html`, `p31.html`.
- P1 · t=28,62 s (image 1717) · P27→P28 · on quitte un lever de soleil brumeux (P27, bleu-gris) pour un plein ciel de midi saturé (P28, bleu cobalt) → baisser la saturation du ciel de P28 et ajouter une lumière rasante chaude à gauche, sinon cette coupe saute de 4 h · l'action (main tendue) reste.
- P2 · t=30,37–31,67 s · P30 ★ · Léa mesure ≈ 3 px sur une planche 480 px (≈ 12 px en 1920) et se perd en fin de plan (flou d'arrachement) → garder ≥ 14 px et ne flouter que les 4 dernières images · le cadre large et le lac restent.
- Confirmé conforme : P26 ★ (quatre points lisibles sur la crête, images 1507–1611), P27 ★ (groupe lisible), raccords P21→P22 (filé), P22→P23, P23→P24 (vers le sol), P24→P25 (montée vers la bretelle), P25→P26, P28→P29, P29→P30, P31→P32 (coureur en amorce), P32→P33 (filé commun). Suivi de la pochette sur la bretelle stable (P25, P29) sur les images vues.
- Faiblesse du rapport P4-ACTE-6 confirmée sans gravité : tête de Malik au ras du bord haut en P32, illisible car floue — acceptable.

### Actes 7–8 (P33–P45), images 2009–2847
Planches : `shots_5..7.jpg`, `cuts_07..10.jpg`, zoom `qa/tmp/p38c.jpg` (image 2337, recadrage 960×540 pleine résolution).
- P1 · t=38,95 s (image 2337) · P38 ★ · Malik mesure **≈ 8–10 px de haut en 1920×1080** (zoom pleine résolution), visible surtout grâce à sa traînée de poussière ; sur un téléphone il disparaît → agrandir pour ≥ 18 px (S de départ 1,55 → ≥ 1,9 sur ce point, ou recadrer plus bas) et éclaircir légèrement la piste sous lui · paroi immense, rapport d'échelle et sortie le long de la piste restent. Fichier `p38.html`. (Le rapport P4-ACTE-7 annonçait ≈ 15 px : infirmé.)
- P1 · flou de sortie trop long et trop fort, en série : P33 (netteté fin/milieu 4,4/15,5), P35 (6,3/24,2), P37 (5,0/16,6), P39 (5,1/17,2), P40 (4,0/16,0), P43 (4,7/18,8), P44 (2,7/10,4) — mesure : énergie de laplacien moyenne sur l'image 480×270 (`stats.npy`) ; à l'œil, les 3 dernières images de chaque plan sont illisibles et P38 entre déjà flou (2297–2299) → limiter le filé à **4 images** en sortie et 2 en entrée, flou plafonné à la moitié de l'actuel ; un plan sur deux sort net par un mouvement porteur plutôt que par le flou · coupes et directions restent. Fichiers `p33/p35/p37/p39/p40/p43/p44.html`.
- P1 · t=47,15–47,45 s (images 2829–2847) · P45 · le plan se fige : 19 images à écart < 0,15/255 entre voisines (médiane du plan 0,41) alors que le raccord prévu est « le ciel accélère » ; la coupe vers P46 arrive sur une image morte → garder une poussée/dérive continue jusqu'à 2847 et faire défiler les nuages (2–3 px/image) pour amorcer la tombée de nuit · Clara qui salue reste.
- P2 · t=44,40 s (images 2640–2717) · P43 ★ · Clara se devine dans les lacets mais n'a aucun contraste (maillot bordeaux sur herbe brune) → +15 % de luminance locale sur elle ou un liseré de contre-jour · le cadre reste.
- Confirmé conforme : P34 impact, P36→P37, P39 (Clara dépasse, salut lisible), P40 ★ cycliste lisible sur la piste, P41→P42, P42 ★ (cycliste lisible dans l'épingle), P44 mains coupées seulement sur les 2 dernières images (rapport P4-ACTE-8 confirmé, mineur).

### Actes 9–10 (P46–P54), images 2848–3599
Planches : `shots_7..8.jpg`, `cuts_11..13.jpg`, rampe du logo `qa/tmp/logo_ramp.jpg` (images 3440, 3455, 3465, 3472).
- P1 · t=57,87–58,00 s (images 3472–3479) · P53→P54 · le logo est **déjà entier et lisible** en sauge épaisse 8 images avant l'impact (3477–3479 sur `cuts_13.jpg`), puis **saute de taille et de place** à 3480 (P53 : grand, décalé à gauche-bas ; P54 : plus petit, plus haut, blanc) → faire coïncider exactement la forme finale de P53 avec la boîte du logo de P54 (même centre, même échelle) et garder le tressage ouvert jusqu'à 3474, fermeture sur les 6 dernières images seulement · l'image nette reste 3480. Fichier `p53.html`. (REVUE-P3 l. 56 : non corrigé.)
- P1 · t=49,68–51,87 s (images 2981–3112) · P48→P49 · aucune coupe visible à 3060 (écart moyen 0,7/255 entre 3059 et 3060) : le spectateur voit un seul plan de **132 images (2,2 s)**, au-delà de la règle des 2 s → marquer la coupe 3060 (serrer sur le pouce/l'écran au moment de « Publier », ou changer d'axe) · la musique « montée » à 3060 reste.
- P1 · t=49,68 s (image 2981) · P47→P48 · costume : en P47 Léa est tête nue en doudoune verte ; en P48–P49 elle porte un bonnet de laine et un châle gris → refaire img (P48/P49) sans bonnet, doudoune verte, ou mettre le bonnet en P47 (PROMPTS-CHATGPT, chronologie) · le cadre et le feu restent.
- P2 · t=56,27 s (image 3376) · P52→P53 · même cas : coupe invisible (écart 0,5/255), on lit un seul plan cosmique de 3271 à 3479 (3,5 s) → acceptable pour l'orbite, mais à valider par l'orchestrateur au regard de la règle des 2 s.
- P2 · t=54,52 s (image 3271) · P51→P52 · Noah filé vertical, puis toit net immobile : l'arrachement s'arrête net → reprendre le filé vertical sur les 4 premières images de P52 · le retour au toit de P05 reste.
- P2 · t=58,00–60,00 s · P54 · logo : moyenne des pixels > 700 = (247,6 ; 247,2 ; 243,2), mais crête à (255,255,255) → plafonner à (250,248,245) (REVUE-P3 l. 57, à moitié corrigé) · éclair et fondu restent.
- Confirmé conforme : P46 tombée de nuit + Voie lactée (la coupe d'entrée depuis P45 passe car la lumière est continue), P47 rires, P50 ★ bivouac lisible sous la Voie lactée, P51 Noah, P54 dernière image = encre (pas de noir pur : part de pixels max<6 ≤ 0,159 sur tout le film, image 1192, une polaire sombre, pas un aplat).

## Règles (tout le film)
- Texte hors téléphone : aucun vu sur les 162 images début/milieu/fin et les 318 images de coupe. HUD : aucun. Logo net avant 58 s : non (forme sauge lisible à partir de 3472, voir P53, classé P1 car douce, pas nette).
- Couleur interdite `#E4501C` (±12 par canal) : 0 pixel sur 3 600 images (480×270). `#1C2620` non mesuré séparément (proche de l'encre, non discriminable à cette tolérance).
- Aplat noir pur : aucun.

## Ce que je n'ai pas pu vérifier
- Je ne vois que des images fixes (480×270 et quelques pleines résolutions) : ni fluidité, ni saccades, ni sensation de vitesse aux raccords ; vitesses écran non mesurées (pas de flot optique).
- Son : la piste est un clic, hors champ ; LUFS et crête non mesurés.
- 9:16, écrans, écusson, étalonnage : hors champ par brief.
- Visages (ressemblance fine Léa P06/P11/P18/P22/P23/P47/P48) : jugée à l'œil sur vignettes seulement.
- Bords et trous de parallaxe : vérifiés seulement sur les images début/milieu/fin et ±3 autour des coupes, pas sur chaque image.
