# Relecture critique — ours v6 (24 i/s, 1 440 images)

Relecteur : `qa-critic`, 15/11/2026. Fichier jugé : `livraison/LKDV-ours-v6.mp4`. Rien n'a été corrigé ni committé.
Méthode : les 1 440 images extraites (640×360 et pleine taille), regardées en 20 planches d'une image sur 2 ; agrandissements des visages, des téléphones, du fil, des bandes, des plans accélérés et du logo ; mouvement mesuré par plan ; son mesuré sur la piste AAC du fichier livré. **Je n'ai pas vu le film défiler et je n'ai rien entendu** : tout jugement de rythme ou de son est déduit d'images et de chiffres.
Preuves : `qa/tmp/review-v6/` (ignoré par git) : `s/b00.jpg` à `s/b19.jpg` (planches, numéro d'image sur chaque vignette), `z/*.jpg` (agrandissements), `mouvement.txt` (mesures par plan), `f/` et `full/` (toutes les images).

## 1. Verdict

1. **Pas montrable à des milliers de personnes aujourd'hui.** Le film est propre, cohérent et calé, mais il reste trois points bloquants, dont un qui n'a rien à voir avec l'image : la musique n'a pas de licence.
2. Le drop 1, le moment que tout le découpage prépare, tombe sur les trois plans les plus immobiles du film (P26, P27, P30). C'est exactement là que revient l'effet « diaporama » que Tony a reproché au premier film.
3. La remontée finale (P52) est faite de photos fixes zoomées, avec un éclair de plein jour au milieu d'une séquence de nuit. Elle se trouve juste avant le logo, à l'endroit où le spectateur décide de ce qu'il retient.
4. Ailleurs, le film tient : coupes à moins d'une demi-image du temps, -14,0 LUFS, téléphones crédibles, une vraie progression émotionnelle de la pluie au bivouac.
5. **Note : 6/10 aujourd'hui ; 8/10 une fois les P0 et les P1 corrigés** (8,5 si P26, P27 et P30 sont refaits avec un vrai mouvement de drone).

**Compte : 3 P0, 8 P1, 13 P2.**

## 2. Défauts

### P0 : bloquants

**P0-1 · Musique sans licence (tout le film).**
- Ce qu'on a : STORM II est un titre commercial. `qa/SON-V5.md`, section « Fragile » : « une licence de synchronisation reste à obtenir avant toute diffusion publique ».
- Conséquence : sans licence, une plateforme bloque ou démonétise le film dès la mise en ligne (Content ID). C'est le seul défaut qui interdit la diffusion à lui seul.
- Correction : obtenir la licence de synchronisation (éditeur ou plateforme de licence) avant toute publication. À défaut, choisir un titre sous licence et refaire le calage. C'est coûteux : tout le découpage est construit sur ce morceau.

**P0-2 · Le drop 1 tombe sur des plans presque immobiles (P26, P27, P30 ; images 589–672 et 715–756, 5,25 s sur les 8,75 s de la section).**
- Ce qu'on voit : trois vues de drone qui ne font qu'une poussée de 2 à 2,5 % en 1,75 s, sans translation ni parallaxe.
- Mesures (`mouvement.txt`) :
  - différence médiane entre images consécutives : P26 1,25, P27 1,16, P30 1,09 ; le grain seul en produit environ 1, et le logo fixe (P54) 0,70 ;
  - écart mesuré entre la première et la dernière image (corrélation de phase, plus agrandissement) : translation 0 px, échelle ×1,020, ×1,025 et ×1,025.
- Pourquoi c'est bloquant : à vitesse réelle, ce sont des photos qui zooment doucement, sur l'explosion du morceau. La musique dit « le souffle coupé », l'image dit « carte postale ».
- Correction la plus économique, au remontage :
  - P27 : prendre la prise p27 sur une plage plus longue, accélérée ×2 (la source fait 4,96 s ; utiliser 0–113 au lieu de 72–113) ;
  - ajouter sur les trois plans une rampe de vitesse et une poussée plus franche (6–8 %, courbe sortante) ;
  - mettre P28 (la main tendue, le plan le plus vif du drop : 10,5) en deuxième position.
- Correction propre, demandée à Tony : refaire P26 et P30 dans Omni Flash avec un vrai mouvement de drone.
  - P26 (img45) : « drone FPV fast lateral glide along the Seceda ridge, strong parallax between the grass ridge in the foreground and the sea of clouds, four tiny hikers walking, camera banks slightly, continuous motion, no zoom ».
  - P30 (img09b) : « drone pulls back fast and rises above the Sorapis lake, tiny hiker on the shore, larches pass in the foreground ».

**P0-3 · La remontée finale (P52, images 1293–1334).**
- Ce qu'on voit (`z/p52-remontee.jpg`, chaque image) :
  - un toit avec une fenêtre éclairée, puis une ville avec un dôme et un fleuve (une autre ville que celle de l'ouverture), puis une mer de nuages **en plein jour**, puis la Terre de nuit ;
  - ce sont des images fixes agrandies avec un flou radial : l'ancienne composition à 60 i/s, ramenée à 24 i/s.
- Mesures : luminance moyenne 56,7 à l'image 1320, 131 à 138 de 1322 à 1328, puis 58,6 à 1330 et 26,9 à 1331. Les différences entre images montent à 51,7, 36,6 et 46,9 (`mouvement.txt`).
- Pourquoi c'est bloquant : un éclair de jour de 8 images (0,33 s) entre deux nuits casse la logique (Noah est de nuit, la Terre est de nuit). La technique est précisément celle du film « diaporama ». La remontée part aussi d'un toit, alors que Noah est dans un bus.
- Correction la plus économique :
  1. Étalonner les images 1321–1328 en nuit (même plaque que la Terre de nuit, ou nuages éclairés par la lune), ou couper l'étape nuages et passer directement ville → Terre de nuit dans le flou.
  2. Faire partir la remontée de la vitre du bus de Noah, pas d'un toit.
- Correction propre : une prise Omni « camera pulls back through the rainy bus window at night and rises fast above the city lights into the night clouds, continuous drone move ».

### P1 : à corriger avant diffusion

**P1-1 · La fin ne nomme pas la marque (P54, images 1387–1439).**
- Ce qu'on voit : le logo est une montagne au trait avec un point, sans nom. Rien dans le film ne dit « LKDV » ni « Le Kit du Voyageur » de façon lisible.
- Conséquence : un spectateur qui découvre la marque ne sait pas quoi chercher.
- Correction : allumer la variante C (le nom sous le logo, 1408–1418, `qa/snapshots/motion-v6/logo-variante-nom.jpg`) : un interrupteur et un rendu d'environ 6 min. C'est une entorse à la règle « aucun texte », donc **décision de Tony**. Je la recommande.

**P1-2 · Images doublées et fantômes dans P37 (images 862–882, accéléré ×2,4 par mélange d'images).**
- Ce qu'on voit : le corps du coureur en double exposition, torse transparent, bras dédoublés.
- Preuve : `z/acceleres.jpg`, images 869 et 871.
- Correction : refaire l'accélération sans mélange, en prenant une image source sur 2 ou 3 (fps=… sans fusion, ou `select`). Sinon, garder 21 images consécutives à vitesse ×1 (le saut seul).

**P1-3 · L'œil de P08 (images 231–241).**
- Ce qu'on voit : le « lac » est un rectangle turquoise net collé sur la pupille, sans courbure ni reflet de cornée. On le voit à la première vision : c'est un très gros plan sur un accent.
- Preuve : `s/b03.jpg`.
- Correction, au compositing : réduire le reflet à environ 40 %, le déformer sur la sphère de l'œil (effet loupe), le flouter de 1 à 2 px et le placer en écran (mode *screen*) avec la lumière de la fenêtre. Sinon, raccourcir P08 à 6 images.

**P1-4 · P09 ne délivre pas l'étincelle (images 242–251).**
- Ce qu'on voit : au toucher, l'écran montre une petite vignette du lac et une carte du centre de la France (« Bourges », « Nevers », en clair à l'image 246, `z/telephones.jpg`). La trame voulait « la photo remplit le cadre », puis « la photo s'anime » vers P10. Le raccord P09 → P10 n'a donc aucun pont.
- Correction : poser l'iris (idée 4), déjà rendu dans `livraison/LKDV-motion-essai-2-iris.mp4` (237–252). P09 passe en `source: "rendu"` : le pouce touche la vignette du lac, elle s'ouvre en rond jusqu'au plein cadre et devient P10.

**P1-5 · Éboulis « vermiculé » et fil qui ressemble à une rayure (P38, images 883–924).**
- Ce qu'on voit :
  - en pleine taille, toute la moitié basse est couverte de la texture en vers de terre de Flow, la signature d'une image générée la plus visible du film ;
  - le fil y est un trait blanc rectiligne avec une tête ronde, qui se lit comme une rayure de pellicule plutôt que comme un chemin.
- À l'opposé, sur P26 et P42, le fil est presque invisible en demi-taille (`z/fil.jpg`). Le fil ne se lit donc nulle part comme une idée.
- Preuves : `z/fil-zoom.jpg` (image 915), `z/fil.jpg`.
- Corrections :
  - texture : adoucissement local de la bande basse (flou bilatéral léger, ou bruit de grain plus fort), ou recadrage ×1,1 vers le haut sur la paroi ;
  - fil : le faire suivre la courbe réelle du sentier, l'épaissir à 3–3,5 px avec un halo plus large sur P26, P35 et P42, et l'éteindre en fondu au lieu de garder une tête ronde fixe.

**P1-6 · P44 est figé (images 1051–1071).**
- Ce qu'on voit : le cri de joie, bras levés, reste immobile pendant 21 images, sans pédalage ni cheveux qui bougent.
- Mesures : différence médiane 1,08, au niveau du grain (`mouvement.txt`) ; écart sur 12 images 7,9 au plus bas.
- Correction : prendre la plage de la source où elle avance encore (p44, 0–2,6 s), accélérée ×1,5, ou ajouter une poussée de 4 %. Sinon, raccourcir P44 à 1 temps et donner un temps de plus à P45.

**P1-7 · Les mains de P20 ne sont pas celles de Léa (images 462–472).**
- Ce qu'on voit : des mains d'homme mûr, veineuses, en très gros plan sur l'accent du clac, juste après les bras fins et jeunes de P19.
- Preuve : `s/b06.jpg`.
- Correction : nouvelle prise (img13) avec le prompt « young woman's slim hands with a knit cream sweater cuff, clicking the black hip-belt buckle of an olive backpack shut, sharp snap, close-up ». En attendant, refroidir et désaturer les mains ne suffira pas.

**P1-8 · L'ouverture commence sur une nébuleuse magenta (images 0–30).**
- Ce qu'on voit : un fond magenta, cyan et orange saturé, hors de la palette du film (encre verte et crème), qui évoque un économiseur d'écran. Ce sont les 1,3 premières secondes, celles qui décident si l'on reste.
- Preuve : `s/b00.jpg`.
- Correction, réglage seul dans `ouverture-lab` : nébuleuse désaturée vers des bleus profonds, des verts encre et des crèmes (teinte −40 %, saturation −50 %), poussière plus fine et plus sombre, pour que l'allumage du Soleil (image 32) soit la première vraie lumière.

### P2 : finition

| # | Où | Ce qu'on voit, avec la preuve | Correction |
|---|---|---|---|
| P2-1 | Toute la décision et le coureur | Coupes très régulières : 18 plans sur 49 font exactement 2 temps (21 images) et 11 exactement 4 temps (42 images) ; P11 à P14 font 4 × 21 images d'affilée. Les coupes sont à ±0,49 image du temps (mesure ci-dessous), mais la cadence risque de sonner mécanique. | Faire glisser 2 ou 3 coupes d'un demi-temps, ou fusionner P13 et P15. |
| P2-2 | P30 → P31 → P32 (756/757, 777/778) | Soleil bas doré, puis plein midi bleu, puis midi. Le raccord de lumière est connu (FLOW-RELECTURE-2) et toujours visible (`s/b10.jpg`). | Réchauffer P31 et P32 (balance +300 K, hautes lumières crème). |
| P2-3 | P47 → P48 (1176/1177) | Léa n'a pas de bonnet au feu, puis bonnet et couverture au plan suivant (`s/b16.jpg`). | Accepter, ou retoucher le bonnet hors de P48 (coûteux). |
| P2-4 | P25 (578–588) | Torse sans tête, coupé au menton par la bande du haut (`z/cadre.jpg`, image 580). | Décaler de −40 px de plus, ou laisser (0,46 s). |
| P2-5 | P15 (378–388) | Le haut du téléphone et l'en-tête de l'app passent sous la bande (`z/cadre.jpg`, image 383). | Recadrer à ×1,15 au lieu de ×1,3, ou ouvrir le cadre à 2,2:1 sur ce plan seulement (non : ça ferait système). Accepter. |
| P2-6 | P53/P54 (1340–1439) | Le fond sombre du logo tombe sur la couleur interdite #1C2620 : 7,9 % des pixels à ±3 (image 1390) et 24 % à ±6. C'est un dégradé de l'encre de la LUT, pas un aplat. | Pousser les noirs du fond du logo vers #0B1F17, la couleur des bandes. |
| P2-7 | P20 (472) | Le clac n'émerge pas : +1,7 dB seulement sur 30 ms à l'image 472 (enveloppe de 10 ms), plafonné à 12,4 dB sous la musique (SON-V5). | Abaisser la musique de 3 dB pendant 80 ms sous le clac. |
| P2-8 | P09, P13 (246, 345) | « Camille Démo » et « par Camille Démo » se lisent à l'arrêt sur image, alors que l'héroïne s'appelle Léa (`z/telephones.jpg`). | Captures avec un compte « Léa ». |
| P2-9 | P17 (420–430) | Libellés à l'envers pour le spectateur ; seuls les bouts du bouton « Commander » sont visibles. | Accepter (0,46 s), ou nouvelle prise vue du côté de Léa. |
| P2-10 | P34 (820–829) | Ralenti : le pied est posé et les cailloux flottent, ce qui trahit l'image générée. | Accélérer ×1,5 sur 10 images. |
| P2-11 | P29 (694–714) | Léa paraît plus âgée, plus rousse et plus tachée de son que dans P06 et P11 (`z/lea-6.jpg`). On la reconnaît encore. | Accepter, ou étalonner les cheveux plus sombres. |
| P2-12 | P16 (389–419) | Le téléphone est posé sur le lit et minuscule : on ne lit pas Kit Studio, et l'idée « partir avec presque rien » ne passe pas. | Insérer 4 à 6 images de E5 en gros plan, ou accepter que l'idée « prêt » ne passe que par P23. |
| P2-13 | P54 (1387–1439) | Le logo est déjà plein et épais dès l'image 1382 (57,58 s) : la règle disait « net à 58 s ». | Accepter (5 images, intention « il arrive sur le coup ») ; à valider par Tony. |

### Mesures (commandes)

- **Fichier** (`ffprobe -show_entries stream=…`) : h264 1920×1080, yuv420p, BT.709, 24/1, **1 440 images comptées** (`-count_frames`), 60,000 s ; AAC 48 kHz stéréo, 322 kb/s, 60,000 s.
- **Son** (`ffmpeg -af ebur128=peak=true`) : **-14,0 LUFS** intégré, LRA 5,9 LU, **crête vraie -1,7 dBTP**.
- **Son au départ** : présent dès la 1re fenêtre de 50 ms (-18,5 dBFS RMS) ; aucun silence sur les 600 premières ms.
- **Son court terme, par section** (moyenne de la mesure sur 3 s) :

| Section | LUFS |
|---|---|
| Cosmos | -16,4 |
| Déclic | -17,3 |
| Décision | -16,0 |
| Départ | -14,4 |
| Montagne | -12,3 |
| Coureur et cycliste | -11,6 |
| Bivouac | -17,6 |
| Final | -16,0 |

La montée est régulière et le bivouac retombe de 6 LU, comme voulu.

- **Attaques** (enveloppe de 10 ms, plus forte montée à ±0,3 s) :

| Repère | Ce qu'on mesure |
|---|---|
| Soleil (image 32) | +10 dB à l'image 31,7 |
| Drop 1 (image 589) | attaque à 588,5 ; -23 → -12 dBFS (le creux voulu, puis le drop) |
| Drop 2 (image 799) | attaque à 798,5 |
| Reprise (image 1261) | attaque à 1261,2 ; -24 → -16 dBFS |
| Logo (image 1387) | attaque à 1387,4 ; -23 → -11 dBFS |
| Nuit (image 1093) | pas d'attaque, c'est la retombée : voulu |

  Toutes les attaques sont à moins d'une image.
- **Raccords musicaux** : aucun trou.

| Raccord | Avant (dBFS) | Après (dBFS) | Remarque |
|---|---|---|---|
| 12,263 s | -21,5 | -18,2 | |
| 33,285 s | -14,8 | -12,6 | |
| 52,556 s | -22,8 | -16,8 | creux de -26 dBFS sur 10 ms : c'est la respiration avant la reprise, à écouter |
| 58,249 s | -16,8 | -27,1 | queue du coup du logo |

- **Coupes sur les temps** : `mix-v4.beats.json`, 136,997 BPM. Écart de chacune des 49 coupes au temps le plus proche : **au plus 0,49 image**.
- **Images** : différence moyenne entre images consécutives sur 192×108, fenêtre sans les bandes. Plans au niveau du grain : P26, P27, P30, P44, P50 et P54 (`mouvement.txt`).
- **Couleurs** : #E4501C : 0 pixel sur 720 images.

## 3. Plan par plan

| Plan | Images | Note /10 | Remarque |
|---|---|---|---|
| COSMOS | 0–125 | 6 | Nébuleuse magenta hors palette ; plongée vers la fenêtre efficace. |
| P06 | 126–188 | 8,5 | Pluie, lampe, regard : intime, crédible, bien cadré. |
| P07 | 189–230 | 8 | Écran crédible, vapeur du mug, défilement vivant. |
| P08 | 231–241 | 5 | Rectangle de lac collé dans la pupille : se voit. |
| P09 | 242–251 | 5 | Carte de France au lieu du lac ; pas d'étincelle. |
| P10 | 252–293 | 8 | Lac turquoise au ras de l'eau, soleil : beau. |
| P11 | 294–314 | 8,5 | Elle se lève d'un bond : vrai élan. |
| P12 | 315–335 | 8 | Doigt sur l'écran, lumière chaude juste. |
| P13 | 336–356 | 7,5 | Écran lisible ; plan presque fixe ; « Camille Démo ». |
| P14 | 357–377 | 6,5 | Triptyque de rires figés, un peu banque d'images. |
| P15 | 378–388 | 7 | Écran Cortina lisible, haut coupé par la bande. |
| P16 | 389–419 | 7 | Joie crédible ; téléphone minuscule, Kit Studio illisible. |
| P17 | 420–430 | 6 | Pouce net ; libellés à l'envers, bouton caché. |
| P18 | 431–451 | 8 | Le vrai sac, l'écusson, le sourire : réussi. |
| P19 | 452–461 | 7,5 | Le matériel étalé est lisible ; le plan est court. |
| P20 | 462–472 | 5 | Mains d'homme mûr ; clac inaudible et sans claquement visible. |
| P21 | 473–493 | 7,5 | Escalier en spirale, graphique ; personnage minuscule. |
| P22 | 494–514 | 9 | Reflet dans la vitre du train : le meilleur plan. |
| P23 | 515–556 | 8,5 | Retrouvailles naturelles, buée, lumière d'aube. |
| P24 | 557–577 | 8 | Premier pas, poussière, contre-jour : vivant. |
| P25 | 578–588 | 6 | Torse sans tête ; téléphone d'épaule bien incrusté. |
| P26 | 589–630 | 6 | Seceda magnifique mais immobile sur le drop. |
| P27 | 631–672 | 6 | Tre Cime carte postale, poussée de 2,5 % seulement. |
| P28 | 673–693 | 8,5 | Main tendue, rires : le plan vivant du drop. |
| P29 | 694–714 | 7,5 | Écran juste ; Léa un peu différente. |
| P30 | 715–756 | 6 | Sorapis immobile, Léa minuscule : photo qui zoome. |
| P31 | 757–777 | 7,5 | La même photo que dans le carnet : bonne idée ; lumière de midi. |
| P32 | 778–798 | 8,5 | Le coureur traverse et emmène la caméra : bon passage de relais. |
| P33 | 799–819 | 8,5 | Balcon au-dessus du vide, filé : énergie juste. |
| P34 | 820–829 | 6,5 | Ralenti flottant, poussière d'image générée. |
| P35 | 830–850 | 7 | FPV vif ; flou radial un peu artificiel ; fil invisible. |
| P36 | 851–861 | 7 | Brassard secoué, écran illisible par nature. |
| P37 | 862–882 | 5 | Fantômes du mélange d'images ×2,4. |
| P38 | 883–924 | 5,5 | Éboulis vermiculé, fil-rayure, Malik à peine visible. |
| P39 | 925–945 | 8 | Salut du coureur à la cycliste : passage clair. |
| P40 | 946–977 | 7,5 | Lac doré, mélèze, cycliste minuscule : beau, un peu lent. |
| P41 | 978–987 | 8 | Roue, gravillons : bon impact. |
| P42 | 988–1019 | 8 | Épingle vue du ciel ; fil trop discret. |
| P43 | 1020–1050 | 7,5 | Passo Giau superbe ; cycliste introuvable à vitesse réelle. |
| P44 | 1051–1071 | 5,5 | Bras levés figés pendant 0,9 s. |
| P45 | 1072–1092 | 8 | Elle passe devant le bivouac : raccord de récit juste. |
| P46 | 1093–1134 | 8 | La nuit tombe, la Voie lactée naît : bon. |
| P47 | 1135–1176 | 8,5 | Rires au feu, étincelles : chaleur réelle. |
| P48 | 1177–1208 | 7,5 | Écran lisible au feu ; bonnet apparu. |
| P49 | 1209–1218 | 7 | Geste de publier peu marqué ; il reste lisible. |
| P50 | 1219–1260 | 7 | Voie lactée sublime mais presque fixe. |
| P51 | 1261–1292 | 8 | Noah, pluie, néons : le cycle se comprend. |
| P52 | 1293–1334 | 3,5 | Photos zoomées, éclair de jour dans la nuit. |
| P53 | 1335–1386 | 8 | Les tracés sur l'Europe et le fil qui dessine le logo : élégant. |
| P54 | 1387–1439 | 7,5 | Logo net sur le coup, point du Soleil ; il manque le nom. |

## 4. Ce qui est vraiment réussi

1. **Le calage musique-image** : 49 coupes à moins d'une demi-image du temps ; les attaques du Soleil, des deux drops, de la reprise et du logo tombent à moins d'une image ; la courbe de niveau suit l'émotion (-17 → -11,6 → -17,6 LUFS). La demande de Tony (« que ça suive les émotions ») est respectée dans la structure.
2. **Le premier acte en intérieur** (P06–P07, P10–P12) et **le bivouac** (P46–P48) : lumière, pluie, vapeur, feu. On y croit à de vrais acteurs.
3. **Les téléphones** : de vraies captures, sans vert résiduel, avec les doigts devant et une lumière de scène crédible. Sur P13, P15 et P48, l'app se lit.
4. **Les passages de relais** : P32 (le coureur traverse le groupe), P39 (le coureur salue la cycliste), P45 (la cycliste passe devant le bivouac). L'idée « d'autres aventuriers » se comprend sans un mot.
5. **Le cadre 2,39:1 qui s'ouvre sur le drop et se referme sur Noah** : une idée simple et lisible, qui fait rimer le début et la fin.

## 5. Ce que je n'ai pas pu juger

- **Le film en lecture continue** : saccades, fluidité des accélérations et sensation de rythme ne sont déduites que d'images et de mesures.
- **Le son à l'oreille** : timbre du clac, de la pluie, du feu et des whooshes, équilibre musique et effets, et le creux de 52,556 s (respiration ou trou ?). Tout est mesuré, rien n'est écouté.
- **La version 9:16** (`-mobile.mp4`) et la version à repères : non ouvertes.
- **L'aspect sur grand écran ou sur téléphone** : la lisibilité des écrans de l'app et la visibilité du fil dépendent de la taille de diffusion.
- **La compréhension par un spectateur neuf** : je connais la trame. Le test réel serait de montrer le film une fois à 3 personnes qui ne la connaissent pas et de leur demander de raconter l'histoire.
- **Le statut juridique de la musique** au-delà de ce que dit `SON-V5.md`.
