# Relecture Flow 1 : prises P06 à P25

Relecteur : qa-critic, 14/11/2026. Matière : `flow/clips/plans/pNN.mp4` (1920×1080, 24 i/s), planches `qa/snapshots/flow/pNN.jpg`, mesures `flow/inventaire.json` (courbe de mouvement sur 24 points, écrans verts).
Extractions pleine taille (6 images par prise : n°0, 1/5, 2/5, 3/5, 4/5, dernière) dans `qa/tmp/flow/relecture-1/pNN_fNNN.jpg` ; bandes de recadrage et mosaïques image par image dans `qa/tmp/flow/relecture-1/crops/`.
Commandes : `ffmpeg -i pNN.mp4 -vf "select=eq(n\,N)" -frames:v 1` ; mosaïques `select=between(n\,a\,b)*not(mod(n\,k)),crop=…,tile=…` ; bandes de recadrage `qa/tmp/flow/strip.sh`.

Numéros d'image = images du fichier à 24 i/s (n°0 = première). Durées utiles demandées par `DECOUPAGE-24.md` : 1 temps = 10,5 images, 2 temps = 21, 3 = 32, 4 = 42, 6 = 63.

**Règle appliquée** : un défaut visible à vitesse réelle élimine la prise *dans le passage retenu*. Aucune prise n'a besoin d'être refaite pour la durée demandée : chacune a assez d'images propres. Les défauts lourds (chapeau qui pousse sur Sami, mains qui changent de corps dans P19, pas qui se croisent dans P24, tache sur l'écran vert dans P17) tombent tous **après** le passage retenu. Il faut donc couper aux images indiquées, pas « à peu près ».

## Synthèse

| Prise | Verdict | Passage retenu (images · secondes) | Durée propre disponible | Défaut principal | Note /10 |
|---|---|---|---|---|---|
| p06 | GARDER | 8–71 · 0,33–2,96 s (63 i., 6 temps) | 94 i. (tout) | léger flottement, mouvement médian 1,47 | 9 |
| p07 (P07 + P09) | GARDER AVEC RÉSERVE | P07 : 8–50 · 0,33–2,08 s (42 i.) ; P09 : 80–90 · 3,33–3,75 s (10 i.) | 94 i. (tout) | trois balayages, **pas de vrai tap** ; P09 n'a qu'un pouce qui se pose | 8,5 |
| p08 | GARDER AVEC RÉSERVE | 40–50 · 1,67–2,08 s (10 i.) | 72 i. (tout) | le « lac » est un rectangle net collé dans la pupille (hérité d'img08) | 7,5 |
| p11 | GARDER AVEC RÉSERVE | 2–23 · 0,08–0,96 s (21 i.) | ≈ 0–36 (1,5 s) | après 1,5 s : coiffure, lampe et coussin apparaissent, le visage s'arrondit | 8 |
| p12 | GARDER | 24–45 · 1,00–1,88 s (21 i.) | 72 i. (tout) | aucun visible | 8,5 |
| p13 (P13 + P15) | GARDER | P13 : 20–41 · 0,83–1,71 s ; P15 : 98–108 · 4,08–4,50 s | 119 i. (tout) | mains un peu âgées pour 27 ans (arrêt sur image seulement) | 8 |
| p14 | GARDER AVEC RÉSERVE | 4–25 · 0,17–1,04 s (21 i.) | 0–28 (1,17 s) | **dès n°29 le bonnet de Sami glisse et recouvre ses boucles** | 7 |
| p16 | GARDER | 8–40 · 0,33–1,67 s (32 i.) | 94 i. (tout) | téléphone tête-bêche par rapport à Léa (hérité d'img42) | 8 |
| p17 | GARDER AVEC RÉSERVE | 16–27 · 0,67–1,13 s (11 i., appui à n°26) | 0–27 (1,13 s) | cadrage ≠ img43, coins bas hors champ, **tache blanche sur le vert dès n°28**, appui mou | 6 |
| p18 | GARDER | 17–38 · 0,71–1,58 s (21 i.) | 94 i. (tout) | sac un peu déformé et visage légèrement différent à la fin | 8 |
| p19 | GARDER AVEC RÉSERVE | 20–31 · 0,83–1,29 s (11 i.) | 0–52 (2,2 s) | **après n°52 : la tête disparaît, les bras changent d'origine, un filtre bleu apparaît** | 7 |
| p20 | GARDER AVEC RÉSERVE | 13–23 · 0,54–0,96 s (11 i., emboîtement à n°22) | 72 i. (tout) | pas de « clac » : les moitiés glissent l'une dans l'autre ; mains d'homme mûr | 6,5 |
| p21 | GARDER | 6–27 · 0,25–1,13 s (21 i.) | 72 i. (tout) | personnage petit, rien à reprocher à vitesse réelle | 7,5 |
| p22 | GARDER | 36–57 · 1,50–2,38 s (21 i.) | 72 i. (tout) | paysage qui défile un peu lentement pour un train | 9 |
| p23 | GARDER | 0–42 · 0,00–1,75 s (42 i., 4 temps) | 94 i. (tout) | visage de Léa un peu différent à la fin (n°75+) | 8,5 |
| p24 | GARDER AVEC RÉSERVE | 4–25 · 0,17–1,04 s (21 i.) | 0–34 (1,4 s) | **n°36–52 : les deux pieds se rapprochent et se croisent** | 7,5 |
| p25 | GARDER AVEC RÉSERVE | 14–25 · 0,58–1,04 s (11 i.) | 0–45 (1,9 s) | étui qui se transforme (la patte à pression disparaît vers n°57), polaire à texture « vermiculée » | 7 |

**Compte : 8 GARDER · 9 GARDER AVEC RÉSERVE · 0 REFAIRE.** Deux reprises facultatives (P17, P20), décrites plus bas.

Meilleures : p22 (9), p06 (9), p23 (8,5) ; à égalité p12 et p07. Plus faibles : p17 (6), p20 (6,5), p14, p19 et p25 (7).

## Fiches

### p06 · Léa rêve à la fenêtre · GARDER · 9/10
Première image identique à img06 (écart 3,05). Elle lève les yeux vers la fenêtre (n°8 → n°42), se tourne de profil, puis redescend sur le téléphone en souriant (n°51 → n°93) : l'action demandée est faite. Le visage est stable de bout en bout (créoles, taches de rousseur, fossette) ; peau texturée, sourire crédible. Les mains, le téléphone (dos noir, sans logo), le pull et le décor ne bougent pas. La fumée du mug est vivante. « Ralenti probable » (médiane 1,47, cv 0,22) : le geste est lent mais c'est une rêverie, pas un ralenti flottant. Non vérifié à vitesse réelle : la pluie coule-t-elle sur la vitre ? (les arrêts sur image montrent des gouttes qui changent de place).
Images : `p06_f000/018/037/056/075/093.jpg`, `crops/p06_face.jpg`, `crops/p06_hands.jpg`.

### p07 · Le pouce défile (P07 + P09) · GARDER AVEC RÉSERVE · 8,5/10
Identique à img07. Mains réalistes (pores, plis, ongles), pas de doigt en trop, pull et jean stables, pluie et vapeur vivantes. Écran vert net, entier, quatre coins lisibles sauf le coin bas droit quand le pouce passe dessus (doigt devant l'écran : c'est voulu). Surface verte 7,48–10,78 % (la hausse vient de la poussée). Action : le pouce fait **trois** allers-retours (montées n°16–20, 40–44, 68–72) puis se pose en bas (n°80–92). Il n'y a pas de tap net : pour P09, on prend la pose finale du pouce (n°80–90) et c'est l'effet sonore et la poussée dans l'écran qui feront le « tap ».
Images : `p07_f056.jpg` (pleine taille), `crops/p07_hands.jpg`, `crops/p07_tile.jpg` (une image sur 4).

### p08 · Le lac dans la pupille · GARDER AVEC RÉSERVE · 7,5/10
Identique à img08. Œil vivant, cils, veinules, taches de rousseur ; un clignement naturel (fermé n°26–30, rouvert à n°34, soit 0,33 s) ; poussée lente. Le reflet reste du début à la fin, mais c'est une **petite photo rectangulaire à bords nets posée dans la pupille** (lac, montagnes, ciel), pas un reflet courbé sur la cornée. Avec 10 images, le spectateur lira « une photo de lac dans son œil » : ça sert l'histoire. Celui qui s'arrête sur l'image verra une incrustation. Défaut hérité d'img08, une reprise ne le corrigerait pas.
Images : `p08_f000…f071.jpg`, `crops/p08_blink.jpg`, `crops/p08_pupil71.jpg` (pupille à 100 %).

### p11 · Léa se lève d'un bond · GARDER AVEC RÉSERVE · 8/10
Identique à img10. L'élan est franc et à vitesse réelle (médiane 5,3, pic n°13–26), les cheveux volent, elle sourit, et la caméra épaule la suit vers la droite. Après 1,5 s : la queue de cheval basse devient haute puis lâchée, le visage s'arrondit un peu (n°71), un lampadaire et un coussin apparaissent sur la banquette. Le téléphone reste en main droite. Le passage retenu (n°2–23) est l'élan seul, avant toute dérive.
Images : `p11_f000/014/028/043/057/071.jpg`, `crops/p11_faces.jpg`.

### p12 · Le Compas « Où » · GARDER · 8,5/10
Identique à img40. L'index tape (n°13–20), puis remonte sur l'écran (n°26–45) ; la main gauche tient le téléphone avec des doigts propres. Écran vert entier, coins nets, aucune interface ; surface 2,6–3,6 % (l'index masque une partie, c'est normal). Le glissé latéral est réel. Profil et oreille stables.
Images : `p12_f000…f071.jpg`, `crops/p12_hands.jpg`.

### p13 · « Nous » puis l'itinéraire (P13 + P15) · GARDER · 8/10
Identique à img41. Trois appuis du pouce, puis une pause, avec une poussée lente vers l'écran. « Quasi figée » (médiane 0,98) : c'est un geste de pouce, et c'est attendu. Écran vert entier, quatre coins visibles jusqu'à la fin, aucune interface. Les mains paraissent un peu âgées (plis marqués) : visible seulement à l'arrêt.
Images : `p13_f000…f118.jpg`, `crops/p13_hands.jpg`.

### p14 · Sami, Inès et Tom disent oui · GARDER AVEC RÉSERVE · 7/10
Identique à img11. Les trois volets restent séparés et à leur place. Trois vraies joies : Inès rit dans son mug, Tom lève le poing sous la pluie, Sami rit la tête en arrière. **Défaut visible** : img11 montre un bonnet porté tout en arrière sur les boucles de Sami ; quand il redresse la tête (n°29–37), ce bonnet glisse vers l'avant et couvre ses boucles. Le spectateur voit un bonnet « pousser » sur sa tête. À partir de n°33, Sami porte un bonnet noir enfoncé. Le passage n°4–25 est propre (boucles visibles, rire tête en arrière).
Images : `p14_f014.jpg` (pleine taille), `crops/p14_sami.jpg` (source | n°0 | n°14 | n°28), `crops/p14_beanie.jpg` (n°20–37 image par image).

### p16 · Kit Studio, le total fond · GARDER · 8/10
Identique à img42. Sa main quitte sa bouche (n°17–25), suivie d'un grand sourire tenu. Visage stable et crédible, poussée lente. À partir de n°34, son bras droit s'allonge et la main se pose **à côté** du téléphone, contre le bord gauche, sans couvrir l'écran. Écran vert entier avec les quatre repères « + » nets à chaque image, idéal pour le suivi. Anatomie vérifiée à n°56 : deux bras cohérents. Réserve héritée d'img42 : l'encoche du téléphone est tournée vers Léa, donc l'écran est tête-bêche pour elle. Il faudra incruster la capture retournée à 180° pour qu'elle la lise.
Images : `p16_f056.jpg` (pleine taille), `crops/p16_body.jpg`.

### p17 · Le pouce sur « Commander » · GARDER AVEC RÉSERVE · 6/10
La première image **n'est pas img43** (écart 73,7). Flow a recadré : téléphone vu en perspective, bord bas et **deux coins bas hors champ**, pouce venant du haut. Pouce crédible (taches de rousseur, ongle unique). Appui à n°26 (ombre la plus marquée), mais le geste est mou, sans vrai enfoncement. **Dès n°28, une tache blanchâtre** (trace de doigt) apparaît sur le vert : elle gênera l'incrustation. Écran vert 27,8–33,2 % du cadre. Passage retenu : n°16–27, qui finit sur l'appui. L'incrustation se fera avec les deux coins hauts et les bords latéraux prolongés. Raccord avec P16 : la main et la manche crème vont bien, mais la géométrie du téléphone n'est pas celle d'img43.
Images : `p17_f000…f071.jpg`, `crops/p17_press.jpg` (n°18–40, une image sur 2).

### p18 · Le sac sort du carton · GARDER · 8/10
Identique à img44. Elle sort le sac du carton avec un vrai rire, le papier de soie bouge, puis elle le serre contre elle et regarde en l'air (fin). L'écusson carré noir au pictogramme blanc reste net et **sans lettres** pendant tout le passage retenu (vérifié n°37 à 100 %). Le sac se déforme un peu quand il pivote (ceinture qui sort sur le côté, dos noir) et le visage de n°93 diffère un peu de n°0 (nez, menton) : visible en comparant, pas en lecture.
Images : `p18_f037.jpg`, `p18_f093.jpg` (pleine taille), `crops/p18_mid.jpg`.

### p19 · Elle remplit le sac · GARDER AVEC RÉSERVE · 7/10
Identique à img12. Le réchaud descend dans le sac (n°20–32) et les mains ressortent pour tenir le bord (n°36–52) : propre, objets du lit stables. **Après n°52** : la tête de Léa disparaît du bas du cadre, les mains reviennent depuis le bas du sac comme si le corps avait changé de place, une gourde-filtre bleue apparaît près des bouteilles, le sac s'allonge. Ces défauts se voient à vitesse réelle. Le passage n°20–31 (1 temps) est propre.
Images : `p19_f000…f071.jpg`, `crops/p19_stove.jpg` (n°8–52, une image sur 4).

### p20 · Le clac de la boucle · GARDER AVEC RÉSERVE · 6,5/10
Identique à img13. img13 montre déjà les deux moitiés engagées : la vidéo ne peut donc que les faire glisser l'une dans l'autre, et elles se rejoignent à n°22 sans à-coup. Pas de « clac » visuel ni de tir sec sur la sangle. Ensuite les mains lâchent, la sangle se tend un peu et la boucle reste intacte (pas de déformation, pas de doigt en trop). Mains veineuses et masculines pour Léa : héritées d'img13, et le cadrage serré empêche de juger qui c'est. Pour un impact d'un temps, garder n°13–23 et laisser le son faire le « clac ».
Images : `p20_f000…f071.jpg`, `crops/p20_snap.jpg` (n°10–55, une image sur 3).

### p21 · Elle dévale l'escalier · GARDER · 7,5/10
Identique à img14. Plongée verticale. Elle descend en suivant la courbe, la main sur la rampe à la fin, le sac et la queue de cheval rebondissent. La caméra descend aussi, ce qui agrandit la spirale : la géométrie de l'escalier reste cohérente. Mouvement à vitesse réelle (médiane 8,3). Visage trop petit pour juger, mais rien d'anormal à 100 %.
Images : `p21_f000…f071.jpg`, `crops/p21_fig.jpg`.

### p22 · Les Dolomites défilent · GARDER · 9/10
Identique à img15. Le reflet du visage reste à sa place et ne se déforme pas. Il cligne (n°14, n°28) puis le sourire s'élargit : visage très crédible. Le paysage glisse de droite à gauche, avec un premier plan flou de vitesse et des sommets presque fixes. Seule réserve : le village avance d'environ 100 px en 3 s, lent pour un train mais crédible pour un train de vallée.
Images : `p22_f000…f071.jpg`, `crops/p22_face.jpg`.

### p23 · Retrouvailles, la tente tendue · GARDER · 8,5/10
Identique à img16. Sami tend la housse grise à Léa, qui la serre contre elle en riant (n°0–40). Inès et Tom finissent leur tope-là, l'haleine fume. Quatre personnes du début à la fin, tenues constantes (bonnet gris de Sami, polaire verte et sac olive de Léa, veste sauge et sac crème d'Inès, veste marine de Tom). Le visage de Léa change un peu entre n°0 et n°75 (plus rond), sans gêne à vitesse réelle.
Images : `crops/p23_group.jpg` (n°0, n°37, n°75 à 100 %).

### p24 · Premiers pas sur le sentier · GARDER AVEC RÉSERVE · 7,5/10
Identique à img17. Travelling arrière au ras du sol, la chaussure retombe dans une poussière dorée : très beau sur la première foulée (n°0–32). **n°36–52** : les deux chaussures se rapprochent, se touchent puis échangent de place, une démarche impossible qui se voit à vitesse réelle. Couper avant n°34.
Images : `p24_f000…f071.jpg`, `crops/p24_gait.jpg` (une image sur 4).

### p25 · Le suivi démarre · GARDER AVEC RÉSERVE · 7/10
Identique à img18. Une respiration, puis un petit sourire qui se forme (n°0 → n°71), et le visage reste stable. Écran vert entier, quatre coins visibles, aucune interface ; surface 2,57–3,27 % (poussée). L'étui change : la patte à pression disparaît vers n°57 et les proportions du téléphone varient un peu. La polaire a une texture « vermiculée » de synthèse, visible à 100 % seulement. Accélération nette de la poussée vers n°45 (courbe de mouvement 1,3 → 4,0). Passage retenu n°14–25.
Images : `p25_f000…f071.jpg`, `crops/p25_phone.jpg`, `crops/p25_face.jpg`.

## Reprises

Aucune reprise n'est nécessaire pour monter le film. Deux sont **facultatives**, à lancer seulement s'il reste des crédits après P26–P51.

### P17 (facultative, 9 crédits) : l'appui sur « Commander »
**Cause** : Flow n'a pas respecté le cadrage d'img43 (coins bas hors champ), l'appui est mou et une trace blanche apparaît sur le vert après l'appui.
**Consigne** : image de départ `img43.png`, durée **3 s**, fichier `p17-2.mp4`.

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm lamplight. Macro close-up of hands in cream knit sleeves holding a phone upright, the whole phone and its four screen corners inside the frame, exactly as in the starting image. Early in the shot the right thumb presses the lower part of the screen once, quick and firm, then lifts away. Locked-off camera, no reframing. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text, no fingerprint or smudge on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```
**Changements et raison** : « Very slow push-in » devient « Locked-off camera, no reframing » et « the whole phone and its four screen corners inside the frame, exactly as in the starting image » est ajouté, pour que Flow garde le cadrage d'img43 et les quatre coins. « Early in the shot… quick and firm » place l'appui tôt et le rend net. « no fingerprint or smudge on it » vise la trace blanche. Chance de réussite moyenne : si `p17-2` recadre encore, garder `p17` (n°16–27).

### P20 : contourner plutôt que refaire
**Cause** : img13 montre une boucle déjà engagée, donc aucun prompt ne fera de « clac ». Refaire avec la même image ne servirait à rien.
**Contournement** : garder n°13–23, accélérer ces 11 images à 150 % pour que l'emboîtement tombe sur le premier temps de la mesure 12, et poser le « clac » au son. Si Tony veut un vrai clac, il faut d'abord une nouvelle image fixe avec les deux moitiés séparées de 5 cm (à demander à ChatGPT), puis relancer le prompt P20 de la feuille de route tel quel.

## Ce que je n'ai pas pu vérifier

- **Lecture à vitesse réelle** : je n'ai vu que des arrêts sur image (6 par prise, plus des mosaïques une image sur 2 à 4). Les jugements de vitesse (« ralenti flottant ») reposent sur ces images et sur la courbe de mouvement de `inventaire.json`. Il faut un visionnage par Tony, surtout pour p06, p07 et p13.
- **Son** : piste AAC présente sur les 17 prises (inventaire), mais je ne l'ai ni écoutée ni mesurée. De toute façon, le film utilise la musique.
- **Incrustation réelle** : je n'ai fait aucun essai de détourage. Les verdicts sur les écrans verts (p07, p12, p13, p16, p17, p25) reposent sur leur aspect et sur les mesures de surface.
- **9:16** : aucun recadrage vertical testé.
- **Pluie sur les vitres** (p06, p07, p11) : les gouttes changent d'une image à l'autre, mais je n'ai pas pu vérifier qu'elles coulent.
- **Étalonnage commun** : pas mesuré, ce sera au montage.
