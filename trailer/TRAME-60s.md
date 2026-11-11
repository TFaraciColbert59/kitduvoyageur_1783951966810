# LKDV — Trailer 60 s · Trame complète v3

« On va vivre UNE AVENTURE. » 60 s · 1920×1080 · 60 i/s · 3 600 images · 49 plans · aucun plan au-dessus de 2 s.

## L'idée en une ligne

Le film est une **boucle d'inspiration**. Léa voit un carnet LKDV sur son téléphone, on plonge dans la photo et on vit l'aventure : préparation avec le Compas, kit, départ, montagne, coureur, cycliste, bivouac. Elle publie son propre carnet, qu'un inconnu découvre à l'autre bout du monde. La caméra remonte alors jusqu'à l'espace, où des milliers de tracés forment le logo.

Ce que le film montre de LKDV : **Carnet → Compas (Où, Nous, Résa, Verdict, Kit) → Kit Studio → cockpit GPS → retour terrain → Carnet**.

## Règles tenues tout du long

- Aucune phrase à l'écran. Seuls les libellés de la vraie interface apparaissent (« Où », « Nous », « Essentiel », chiffres du cockpit).
- Le logo est fondu dans le décor à 0:00 (halo de l'atmosphère) et ne devient lisible qu'à 58,2 s.
- Les plans au sol gardent leurs couleurs réelles, avec un étalonnage léger (noirs à l'encre `#0B1F17` au lieu du noir pur, hautes lumières crème `#FAF8F5`).
- La caméra ne s'arrête jamais : poussée, filé, rampe de vitesse, FPV, rotation.
- Chaque coupe tombe sur un temps de la musique. Les temps ci-dessous supposent un drop à 6,0 s, une montée à 41–53 s, un impact final à 58,2 s, **à recaler sur le fichier audio de STORM II**.
- Chaque plan naît du précédent : par le mouvement, la forme, la couleur ou un élément qui traverse le cadre.

## Le vrai HUD LKDV (construit en code, composité sur les écrans verts)

- Matériau : verre Liquid Glass du Compas (`backdrop-filter: blur(24px) saturate(1.5)`), fonds Stone `#FAF8F5`, état actif Forest `#17402C`, accent Sauge `#5B7F55`, ombres à l'encre `rgba(11,31,23,.18)`.
- Typographie : Inter/Söhne. Emphase en Georgia italique forest. Chiffres en JetBrains Mono. Libellés en capitales, approche 0,14 em.
- Écrans :
  - **Carnet** : moments en cartes, grande photo, défilement.
  - **Compas** : capsule d'étapes Où · Nous · Résa · Verdict · Kit, tiroir à trois hauteurs, lignes `.cp-row`, bouton « Préparer mon aventure ».
  - **Explorer** : carte 3D MapLibre, tracé sauge qui se dessine.
  - **Kit Studio** : sac 3D, objets qui s'ajoutent, bilan.
  - **Cockpit randonnée** : distance, durée, D+, allure, tracé vivant, batterie.
  - **Retour terrain** : puces Essentiel / Utile / Jamais servi / Défaillant / Manquait.
- Barre d'onglets à 5 entrées (Accueil, Explorer, Boutique, Communauté, Compte) avec les icônes `LkvIcon`.

---

## Découpage seconde par seconde

Abréviations : TGP très gros plan, GP gros plan, PM plan moyen, PE plan d'ensemble. « img » = image à générer (liste plus bas). « code » = fait en code (HUD, 3D, particules).

### ACTE 1 — L'ESPACE · 0,0 → 3,0 s (images 0–180)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord sortant |
|---|---|---|---|---|---|---|---|---|
| P01 | 0,00–1,50 | 0–90 | img01 | PE, Terre entre par la droite. Poussée avant rapide et roulis de 8°. | Soleil rasant derrière le limbe, liseré cyan. | 4 images de noir, puis la Terre surgit. Logo fondu dans le halo de l'atmosphère (opacité 12 %). | Souffle, sub qui monte. | Le soleil perce le limbe : flash blanc. |
| P02 | 1,50–3,00 | 90–180 | img02 | Plus serré sur les Alpes vues d'orbite, poussée vers les Dolomites. | Matin, neige éclatante. | Nuages, crêtes. | Riser. | Plongée verticale, flou radial. |

### ACTE 2 — LA DESCENTE · 3,0 → 6,0 s (images 180–360)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P03 | 3,00–4,00 | 180–240 | img03 | Plongée, vibration, flou de vitesse. | Ciel bleu nuit qui passe au bleu. | Stratosphère, voile de nuages loin dessous. | Vent qui siffle. | On fonce dans un nuage. |
| P04 | 4,00–5,00 | 240–300 | img04 | Traversée du nuage. | Blanc qui s'ouvre. | Le nuage se déchire. | Pression, grondement. | Trouée sur une ville. |
| P05 | 5,00–6,00 | 300–360 | img05 | Plongée verticale sur une ville européenne au crépuscule, accélération vers une fenêtre éclairée. | Bleu de l'heure bleue, fenêtres ambrées. | La dernière fenêtre grossit ; 0,2 s avant la coupe, on traverse la vitre. | Aspiration, puis coupure sèche. | La vitre éclate en reflet. |

### ACTE 3 — LE DÉCLIC · 6,0 → 12,0 s (images 360–720)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P06 | 6,00–7,20 | 360–432 | img06 | PM, travelling latéral et micro-poussée. | Écran froid sur le visage, lampes chaudes derrière, pluie sur la vitre. | Léa assise sur le rebord de fenêtre, genoux repliés, téléphone en main. | **DROP** | Le regard de Léa vers l'écran. |
| P07 | 7,20–8,40 | 432–504 | img07 + code | GP du téléphone, légère poussée. | Écran lumineux. | **HUD Carnet** : un carnet d'un autre voyageur défile, 3 moments, puis la grande photo du lac turquoise (img09). Le pouce ralentit. | Clic de défilement sur les temps. | La couleur turquoise. |
| P08 | 8,40–9,40 | 504–564 | img08 | TGP de l'œil de Léa, très léger zoom. | Reflet turquoise dans la pupille. | Elle cligne, fascinée. | Inspiration. | Pupille ronde vers le doigt rond. |
| P09 | 9,40–10,60 | 564–636 | img07 + code | GP, pouce qui tape la photo, puis poussée violente dans l'écran. | — | La photo grandit jusqu'à remplir le cadre (code). | Whoosh. | La photo s'anime. |
| P10 | 10,60–12,00 | 636–720 | img09 | Drone au ras de l'eau du lac de Sorapis, foncée vers les falaises. | Matin, eau turquoise laiteuse. | Le rêve : l'endroit devient réel. | Vent, oiseau, montée. | Coupe sèche, retour brutal dans la chambre. |

### ACTE 4 — LA DÉCISION, LE COMPAS · 12,0 → 20,0 s (images 720–1 200)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P11 | 12,00–13,20 | 720–792 | img10 | Épaule, Léa se lève d'un bond, la caméra suit. | Même chambre. | Sourire décidé, téléphone en main. | Impact. | Son pouce sur l'écran. |
| P12 | 13,20–14,40 | 792–864 | code | Écran plein cadre, inclinaison 3D légère. | — | **Compas, étape Où** : la capsule s'allume sur « Où », « Dolomites » s'écrit dans le champ, la carte zoome. | Frappes calées sur les doubles croches. | La capsule glisse vers « Nous ». |
| P13 | 14,40–15,40 | 864–924 | code | Plein cadre. | — | **Étape Nous** : 1, puis 4 avatars s'ajoutent en cascade. | Pops. | Chaque avatar devient un visage. |
| P14 | 15,40–16,60 | 924–996 | img11 | Triptyque qui s'ouvre en volets. | Trois lumières : bureau, cuisine, rue. | Sami, Inès et Tom reçoivent la notification et sourient. | Trois coups. | Les volets se referment sur une carte. |
| P15 | 16,60–17,80 | 996–1 068 | code | Survol 3D, rotation. | Relief éclairé de côté. | **Explorer + Verdict** : le tracé sauge se dessine sur les Dolomites, 4 étapes. | Arpège montant. | La carte se replie en sac. |
| P16 | 17,80–19,00 | 1 068–1 140 | code | Rotation 360° du sac. | Studio doux. | **Kit Studio** : le sac 3D tourne, les cartes d'objets s'ajoutent, le bilan se remplit. | Clics mécaniques. | Vue de dessus identique au plan suivant. |
| P17 | 19,00–20,00 | 1 140–1 200 | img12 | Vue de dessus, poussée rapide. | Lumière du jour, draps blancs. | Le même matériel, en vrai, étalé sur le lit. Les mains de Léa le glissent dans le sac. | — | Sangle. |

### ACTE 5 — LE DÉPART · 20,0 → 26,0 s (images 1 200–1 560)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P18 | 20,00–20,80 | 1 200–1 248 | img13 | TGP, boucle de sangle clipsée. | Dure, de côté. | Clac. | **Impact.** | Elle sort par la porte. |
| P19 | 20,80–21,80 | 1 248–1 308 | img14 | Plongée dans une cage d'escalier, flou de mouvement. | Matin froid. | Léa dévale l'escalier, sac au dos. | Pas rapides. | Mouvement latéral. |
| P20 | 21,80–22,80 | 1 308–1 368 | img15 | À travers la vitre du train, filé latéral. | Soleil levant. | Les Dolomites défilent, reflet de Léa dans la vitre. | Rails. | Arrêt brusque. |
| P21 | 22,80–24,00 | 1 368–1 440 | img16 | PM, rampe de vitesse (ralenti puis accéléré). | Aube rose sur le parking du refuge. | Les quatre amis se tapent dans la main et rient. | Clap sur le temps. | Plongée vers le sol. |
| P22 | 24,00–25,00 | 1 440–1 500 | img17 | Ras du sol, caméra qui recule devant les bottes. | Rasante, poussière dorée. | Premiers pas sur le sentier caillouteux. | Crunch. | Montée vers la bretelle. |
| P23 | 25,00–26,00 | 1 500–1 560 | img18 + code | GP, téléphone fixé sur la bretelle. | Contre-jour. | **Cockpit** : 0,00 km · 00:00 · D+ 0 m, le tracé démarre. | Bip de départ. | Le drone s'arrache. |

### ACTE 6 — LA MONTAGNE · 26,0 → 34,0 s (images 1 560–2 040)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P24 | 26,00–27,40 | 1 560–1 644 | img19 | FPV qui surgit derrière une crête et découvre le groupe sur l'arête, Tre Cime au fond. | Lever de soleil, ombres longues. | Grand moment de liberté. | Ouverture large. | Main tendue. |
| P25 | 27,40–28,60 | 1 644–1 716 | img20 | GP, la caméra monte avec le mouvement. | Chaude. | Tom tend la main, Léa est tirée sur un rocher, rires. | Rire. | Inès pointe le doigt. |
| P26 | 28,60–29,80 | 1 716–1 788 | img21 | Contre-jour, panoramique qui suit le doigt. | Halo solaire. | Inès montre l'horizon. | — | L'horizon devient le HUD. |
| P27 | 29,80–31,00 | 1 788–1 860 | img19 + code | Paysage avec HUD en surimpression flottante. | — | **Cockpit** : 6,4 km · D+ 812 m, le tracé avance sur la carte. | Ticks des chiffres. | Le tracé file vers un lac. |
| P28 | 31,00–32,20 | 1 860–1 932 | img22 + code | Par-dessus l'épaule de Léa. | Midi, eau turquoise. | **Le moment clé** : le vrai lac de Sorapis, cadré exactement comme la photo du carnet. Elle le prend en photo. | Silence de 2 temps, puis reprise. | Le coureur flou en amorce. |
| P29 | 32,20–34,00 | 1 932–2 040 | img23 | Plan bas, le groupe reprend la marche. | — | Un coureur surgit, flou, au premier plan. | Whoosh. | La caméra part avec lui. |

### ACTE 7 — LE COUREUR · 34,0 → 41,0 s (images 2 040–2 460)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P30 | 34,00–35,20 | 2 040–2 112 | img24 | Panoramique filé qui accroche Malik et le suit. | Après-midi. | Sentier en balcon au-dessus du vide. | Le tempo double. | Ses pieds. |
| P31 | 35,20–36,20 | 2 112–2 172 | img25 | TGP au ras du sol, ralenti. | Poussière en contre-jour. | Le pied frappe la pierre. | Impact. | Vue arrière. |
| P32 | 36,20–37,40 | 2 172–2 244 | img26 | FPV dans son dos, descente technique. | — | Pierres, lacets. | Souffle. | Son bras. |
| P33 | 37,40–38,60 | 2 244–2 316 | img27 + code | GP, téléphone sur le brassard. | — | **Cockpit** : 12,4 km/h · allure 4'50 · tracé vivant. | Bips. | Le torrent. |
| P34 | 38,60–39,80 | 2 316–2 388 | img28 | Profil, rampe de vitesse figée à l'apex. | Gouttelettes en contre-jour. | Saut au-dessus d'un torrent. | Temps suspendu, puis retombée. | Il atterrit sur une piste. |
| P35 | 39,80–41,00 | 2 388–2 460 | img29 | Large. | — | Malik atterrit sur une piste blanche ; une cycliste le dépasse, il la salue. | Roue libre. | La caméra prend la cycliste. |

### ACTE 8 — LA CYCLISTE · 41,0 → 47,0 s (images 2 460–2 820)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P36 | 41,00–42,20 | 2 460–2 532 | img30 | Drone latéral rapide. | Heure dorée. | Clara roule, sacoches, sur un gravel le long d'un lac. | **Montée.** | La roue. |
| P37 | 42,20–43,20 | 2 532–2 592 | img31 | Ras de la roue avant. | Rasante. | Gravillons projetés. | Crépitement. | Vue du ciel. |
| P38 | 43,20–44,40 | 2 592–2 664 | img32 + code | Plongée verticale, rotation. | Ombres longues. | Virage en épingle ; le tracé GPS sauge se superpose à la route. | — | Elle lève les bras. |
| P39 | 44,40–45,60 | 2 664–2 736 | img33 | Contre-plongée de face. | Soleil couchant derrière elle. | Bras levés dans la descente. | Cri de joie. | Passage devant le bivouac. |
| P40 | 45,60–47,00 | 2 736–2 820 | img34 | Elle passe, la caméra reste. | Crépuscule. | Elle salue le groupe installé au bivouac ; la caméra s'arrête sur eux. | Le tempo retombe. | Le ciel accélère. |

### ACTE 9 — LE BIVOUAC · 47,0 → 53,0 s (images 2 820–3 180)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P41 | 47,00–48,20 | 2 820–2 892 | img35a → img35b | Timelapse en léger travelling. | Crépuscule, puis Voie lactée. | Tentes sur l'alpage, la nuit tombe en accéléré. | Nappe. | Le feu. |
| P42 | 48,20–49,40 | 2 892–2 964 | img36 | GP, rotation lente. | Feu orangé sur les visages. | Rires, gamelle qui fume. | Crépitement. | Léa sort son téléphone. |
| P43 | 49,40–50,80 | 2 964–3 048 | img37 + code | GP, écran. | Écran et feu. | **Carnet + retour terrain** : elle ajoute la photo du lac, puis touche « Essentiel » sur le réchaud. | Taps calés. | Pouce. |
| P44 | 50,80–52,00 | 3 048–3 120 | img37 + code | TGP du pouce. | — | Elle publie ; l'écran pulse en sauge. | **Build final.** | Une étincelle monte. |
| P45 | 52,00–53,00 | 3 120–3 180 | img36 + code | La caméra suit une étincelle vers le ciel. | — | L'étincelle traverse le cadre. | Souffle. | L'étincelle devient une notification. |

### ACTE 10 — LE FINAL · 53,0 → 60,0 s (images 3 180–3 600)

| Plan | Temps | Images | Source | Cadre / caméra | Lumière | Contenu | Son | Raccord |
|---|---|---|---|---|---|---|---|---|
| P46 | 53,00–54,20 | 3 180–3 252 | img38 + code | GP. | Néons d'un bus de nuit, dans une autre ville. | Un inconnu fait défiler son fil Carnet et tombe sur la photo de Léa. Son pouce s'arrête. **La boucle est bouclée.** | Coupure, un seul temps. | La caméra s'arrache vers le haut. |
| P47 | 54,20–56,00 | 3 252–3 360 | img05→04→03 + code | Remontée inverse : bus, ville, nuages, stratosphère, en accéléré. | — | La descente du début, à l'envers. | Riser inversé. | Orbite. |
| P48 | 56,00–58,20 | 3 360–3 492 | img39 + code | Orbite, poussée lente, le seul plan « calme ». | Terre de nuit. | Des milliers de tracés sauge s'allument sur tous les continents, un par aventure, puis convergent. | Montée maximale. | Les lignes se tressent. |
| P49 | 58,20–60,00 | 3 492–3 600 | code | Fixe, très léger recul. | Lueur crème. | Les tracés forment le **logo LKDV**, net pour la première fois. Il tient jusqu'au bout. | **Impact final**, puis queue de réverbération. | Fin. |

**Déclinaison 9:16** : même montage, recadré sur le personnage qui porte l'action (tiers central de chaque image). Les écrans HUD passent en plein cadre vertical, au format natif du téléphone.

---

## Liste des images à générer (39 images)

img01 Terre · img02 Alpes vues d'orbite · img03 stratosphère · img04 nuage · img05 ville au crépuscule · img06 Léa à la fenêtre · img07 téléphone en main · img08 œil · img09 lac de Sorapis · img10 Léa se lève · img11 triptyque des amis · img12 matériel sur le lit · img13 boucle · img14 escalier · img15 train · img16 retrouvailles · img17 bottes · img18 téléphone sur la bretelle · img19 arête · img20 main tendue · img21 Inès pointe · img22 photo du lac · img23 coureur en amorce · img24 balcon · img25 pied · img26 descente FPV · img27 brassard · img28 saut · img29 piste et cycliste · img30 gravel au lac · img31 roue · img32 épingle vue du ciel · img33 bras levés · img34 passage au bivouac · img35a/img35b alpage au crépuscule puis de nuit · img36 feu · img37 Léa sous la tente · img38 bus de nuit · img39 Terre de nuit.

---

# PROMPT CHATGPT (à copier tel quel)

Mode d'emploi : une seule conversation ChatGPT. Envoyer le **Message 1** (la bible), puis le **Message 2** (les fiches personnages), puis les plans **un par message**. Télécharger chaque image sous son nom (img01.png…). Si un personnage dérive, renvoyer sa fiche en pièce jointe avec le plan.

## Message 1 — Bible du film (à envoyer en premier)

```
Tu es directeur de la photographie et chef décorateur d'une publicité cinéma de 60 secondes pour une application de voyage et de randonnée. Je vais te demander une série de 39 images fixes qui seront ensuite animées et montées très vite (plans de 1 à 2 secondes). Elles doivent toutes appartenir au MÊME film : mêmes personnages, mêmes vêtements, même lumière selon l'heure, même étalonnage. Garde cette bible en mémoire pour chaque image que je te demanderai.

FORMAT
- Paysage 16:9 (1536×1024 ou le plus proche possible).
- Le sujet principal doit toujours être dans le TIERS CENTRAL de l'image, car chaque image sera aussi recadrée en vertical 9:16. Laisse de la matière autour (pas de sujet coupé au bord).
- Une seule image par réponse, sans cadre, sans bordure, sans planche, sans légende.

STYLE
- Photoréaliste, look de film tourné sur caméra cinéma ARRI Alexa 35, optiques sphériques haut de gamme, grain argentique très fin, profondeur de champ naturelle.
- Énergie de film d'aventure et de liberté : mouvement figé en pleine action, flou de mouvement réaliste quand je le demande, poussière, eau et cheveux en mouvement.
- Couleurs RÉELLES et naturelles, aucun filtre fantaisie, aucun HDR exagéré, pas de saturation criarde. Ciels crédibles.
- Étalonnage commun léger : noirs légèrement verts très sombres (jamais noir pur), hautes lumières crème chaudes, verts naturels un peu désaturés vers le vert sauge.
- Aucun rendu « IA » : pas de peau plastique, pas de mains déformées (5 doigts), pas de visages dupliqués, pas de symétrie parfaite.

INTERDITS ABSOLUS
- AUCUN texte, chiffre, lettre, panneau lisible, logo ou marque nulle part (vêtements, sacs, vélo, téléphone, montres, bus, bâtiments). Le matériel est générique et sans marque.
- Aucun écran allumé avec du contenu.

ÉCRANS DE TÉLÉPHONE (très important)
- Quand un téléphone est visible, c'est un smartphone moderne générique noir, sans logo, bords fins.
- Son écran est d'un VERT CHROMA UNI ET PUR (#00FF00), mat, sans reflet, sans icône, sans dégradé, avec les quatre coins arrondis de l'écran bien visibles et nets, pour que j'y incruste l'interface ensuite. La lumière verte ne doit pas déborder sur la peau.

PALETTE DES COSTUMES (identité discrète)
- Vert forêt profond, vert sauge, pierre et crème, bleu encre, sable. Pas d'orange vif ni de jaune fluo.

LIEU ET CHRONOLOGIE DE LA LUMIÈRE
- Une aventure de trois jours dans les Dolomites (Italie) : lac de Sorapis (eau turquoise laiteuse), Tre Cime di Lavaredo, alpages, pistes de gravier blanc, torrents.
- Jour 0 soir : appartement en ville, pluie, heure bleue.
- Jour 1 matin : départ, aube rose, lever de soleil sur les crêtes.
- Jour 1 midi : lac turquoise, lumière haute.
- Jour 1 après-midi : sentier en balcon, lumière franche.
- Jour 1 heure dorée : piste de gravier au bord d'un lac.
- Jour 1 nuit : bivouac sur alpage, feu de camp, Voie lactée.

Réponds simplement « Bible enregistrée » et attends mes demandes.
```

## Message 2 — Fiches personnages (à envoyer en deuxième)

```
Voici les personnages. Leurs traits et leurs vêtements ne changent JAMAIS d'une image à l'autre. Génère d'abord une fiche de référence pour Léa : une seule image 16:9, trois vues côte à côte (face, trois-quarts, profil), en pied, tenue de randonnée, fond gris neutre, toujours sans aucun texte. Ensuite j'enverrai les plans.

LÉA (héroïne) — Française, 27 ans, 1,68 m, mince et sportive. Cheveux châtain foncé ondulés mi-longs, attachés en queue basse avec des mèches libres. Taches de rousseur légères, yeux noisette, sourire franc.
  Tenue ville : grand pull en maille crème, jean brut, chaussettes de laine grises.
  Tenue randonnée : veste softshell VERT FORÊT profond, t-shirt écru, pantalon de trekking gris pierre, chaussures de randonnée en cuir brun foncé, sac à dos 38 litres gris anthracite avec sangles vert sauge et boucles noires mates. Téléphone fixé sur la bretelle gauche dans un étui noir.

SAMI — 30 ans, peau mate, cheveux noirs courts bouclés, barbe courte soignée. Veste beige sable, bonnet de laine gris chiné, sac à dos olive.
INÈS — 26 ans, peau noire, longues tresses fines attachées en chignon haut, lunettes de soleil posées sur la tête. Veste vert sauge clair, legging noir, sac à dos crème.
TOM — 29 ans, grand (1,90 m), cheveux blond roux courts, barbe de trois jours, taches de rousseur. Veste bleu encre, pantalon gris foncé, grand sac à dos gris.
MALIK (coureur de trail) — 34 ans, métisse, crâne rasé, très sec et musclé. T-shirt technique ivoire, short noir, gilet d'hydratation noir avec deux flasques, chaussures de trail grises, brassard noir avec téléphone.
CLARA (cycliste) — 31 ans, cheveux blond cendré courts dépassant du casque mat gris, peau claire bronzée. Maillot bordeaux sombre, cuissard noir, vélo gravel vert olive mat avec sacoches de cadre et de selle noires.
NOAH (inconnu de la fin) — 19 ans, cheveux bruns en bataille, sweat à capuche gris, écouteurs filaires blancs.
```

## Messages 3 et suivants — Un plan par message

Préfixe à mettre devant chaque plan : `Selon la bible et les fiches personnages, génère l'image suivante :`

```
img01 — Vue depuis l'orbite basse : la Terre occupe le tiers droit et le bas de l'image, courbure bien visible, lever de soleil exactement sur le limbe, fine couche d'atmosphère bleu cyan lumineuse, Europe de l'Ouest encore dans la pénombre, espace noir profond avec quelques étoiles. Réaliste comme une photo de la Station spatiale internationale. Grande zone sombre à gauche.
```
```
img02 — Vue orbitale plus rapprochée de la chaîne des Alpes au petit matin : sommets enneigés éclatants, vallées dans l'ombre, quelques nuages, les Dolomites au centre de l'image. Légère courbure à l'horizon, soleil rasant venant de la droite.
```
```
img03 — Vue en plongée depuis la stratosphère, comme une caméra qui tombe : ciel bleu nuit en haut qui devient bleu clair, mer de nuages blancs loin en dessous, flou de mouvement radial vers le centre, sensation de vitesse et de chute.
```
```
img04 — À l'intérieur d'un nuage blanc dense traversé à grande vitesse, le nuage se déchire au centre et laisse apparaître une trouée vers le sol, voile de vapeur sur les bords, flou de vitesse.
```
```
img05 — Vue de drone en plongée verticale sur une ville européenne à l'heure bleue (immeubles de pierre claire, toits de zinc, rues mouillées), fenêtres ambrées allumées. Au centre de l'image, une fenêtre de dernier étage éclairée plus chaudement que les autres. Pluie fine, flou de vitesse léger vers le centre.
```
```
img06 — Intérieur d'un petit appartement en ville, le soir. Léa, en tenue ville (pull crème), est assise de profil trois-quarts sur un large rebord de fenêtre, genoux repliés, un téléphone dans les mains. Son visage est éclairé en lumière froide par l'écran ; derrière elle, des lampes chaudes, des plantes et des étagères de livres. Par la fenêtre : gouttes de pluie et ville floue à l'heure bleue. L'écran du téléphone n'est pas visible de face. Rêveuse, un peu lasse.
```
```
img07 — Gros plan sur les mains de Léa (manches du pull crème) tenant le téléphone presque de face, légèrement incliné. Écran vert chroma uni #00FF00 avec les quatre coins nets. Le pouce droit est posé sur le bas de l'écran comme pour faire défiler. Arrière-plan : rebord de fenêtre et ville de nuit en bokeh ambré et bleu.
```
```
img08 — Très gros plan macro sur l'œil droit de Léa (iris noisette, quelques taches de rousseur, cils nets). Dans la pupille et la cornée se reflète un petit rectangle lumineux bleu turquoise (l'écran). Lumière froide de l'écran, fond sombre. Émerveillement.
```
```
img09 — Le lac de Sorapis dans les Dolomites, au matin. Vue de drone à 1 mètre au-dessus de l'eau turquoise laiteuse, qui file vers les hautes falaises de dolomite et le pic en aiguille au fond. Mélèzes sur les rives, légère brume, flou de mouvement sur l'eau au premier plan. Lumière douce et dorée de côté. Aucun personnage. Cadrage symétrique et iconique : cette image sert aussi de « photo de carnet ».
```
```
img10 — Même appartement que img06. Léa se lève d'un bond du rebord de fenêtre, en mouvement, avec un grand sourire décidé, le téléphone dans la main droite. Caméra à l'épaule près d'elle, léger flou de mouvement sur les cheveux et le pull. Lampes chaudes, pluie derrière la vitre.
```
```
img11 — Triptyque vertical en trois bandes égales, sans bordure épaisse (fine ligne sombre entre les bandes), sans texte. Bande gauche : Sami dans un bureau moderne en fin de journée, il regarde son téléphone et sourit. Bande centrale : Inès dans sa cuisine, lumière chaude, un mug à la main, elle rit en regardant son téléphone. Bande droite : Tom dans une rue de nuit sous un réverbère, capuche, il lève le poing de joie, le téléphone à la main. Les écrans des trois téléphones ne sont pas visibles.
```
```
img12 — Vue de dessus parfaitement verticale sur un lit aux draps blancs, en lumière du jour. Le matériel de randonnée est rangé au carré (flat lay) : sac à dos anthracite aux sangles vert sauge ouvert au centre, sac de couchage compressé, matelas gonflable, réchaud et popote en titane, lampe frontale, gourde, trousse de secours, veste vert forêt pliée, carte papier pliée (sans texte lisible), couteau, chaussettes de laine. Les deux mains de Léa entrent dans le cadre et glissent le réchaud dans le sac. Aucun texte, aucune marque.
```
```
img13 — Très gros plan : les mains de Léa clipsent la boucle noire mate de la sangle ventrale de son sac (sangle vert sauge), sur la veste vert forêt. Mouvement net, lumière dure de côté du petit matin, fond flou.
```
```
img14 — Vue en plongée dans une cage d'escalier en colimaçon d'un vieil immeuble européen, rampe en fer forgé. Léa, en tenue de randonnée complète avec le sac, dévale les marches. Fort flou de mouvement sur elle, marches nettes. Lumière froide du matin par une verrière.
```
```
img15 — Plan à travers la vitre d'un train régional, de l'intérieur. Les Dolomites défilent au soleil levant en flou de mouvement horizontal. Le reflet translucide de Léa (veste vert forêt, queue basse) se superpose au paysage, elle regarde dehors en souriant.
```
```
img16 — Petit parking de gravier au pied d'un refuge de montagne à l'aube rose, sommets éclairés derrière. Les quatre amis Léa, Sami, Inès et Tom se retrouvent avec leurs sacs à dos et se tapent dans les mains en riant, en plein mouvement. Plan moyen, tous les visages visibles.
```
```
img17 — Caméra au ras du sol, face au marcheur : les chaussures de randonnée brun foncé de Léa avancent sur un sentier de cailloux calcaires. Poussière dorée soulevée en contre-jour par le soleil rasant, faible profondeur de champ, montagnes floues derrière.
```
```
img18 — Gros plan sur l'épaule gauche de Léa : la bretelle vert sauge du sac porte un téléphone dans un étui noir, écran vert chroma uni #00FF00 bien visible, coins nets, orienté vers la caméra. En arrière-plan flou : le sentier qui monte et des crêtes au contre-jour du lever de soleil.
```
```
img19 — Grand plan d'ensemble type drone FPV juste au-dessus d'une arête rocheuse au lever du soleil. Le groupe des quatre (Léa en tête en vert forêt, puis Inès, Sami, Tom) marche sur l'arête, petits dans le cadre mais reconnaissables à leurs couleurs. Au fond, les trois tours des Tre Cime di Lavaredo, ombres très longues, mer de nuages dans les vallées. Sensation immense de liberté.
```
```
img20 — Gros plan en contre-plongée : Tom, debout sur un rocher, tend la main et tire Léa vers lui ; elle rit, les cheveux au vent. Lumière dorée du matin, ciel bleu profond.
```
```
img21 — Contre-jour : Inès, de dos trois-quarts, sur un promontoire, tend le bras et pointe l'horizon montagneux. Halo solaire autour de sa main, Léa et Sami floutés à côté d'elle qui regardent dans la même direction.
```
```
img22 — Par-dessus l'épaule droite de Léa (veste vert forêt, queue basse) : elle tient son téléphone à deux mains devant elle et photographie le lac de Sorapis. Le paysage réel derrière le téléphone est EXACTEMENT celui de img09 (même lac turquoise, même pic en aiguille centré, même falaise). Écran du téléphone vert chroma uni #00FF00, coins nets. Lumière de midi.
```
```
img23 — Plan bas sur un sentier en balcon : le groupe des quatre reprend la marche au second plan, net. Au tout premier plan à gauche, un coureur de trail (Malik, t-shirt ivoire) traverse le cadre en très fort flou de mouvement.
```
```
img24 — Malik court sur un étroit sentier en balcon au-dessus d'un vide vertigineux, vallée et sommets dolomitiques derrière. Panoramique filé : Malik net, arrière-plan en flou de mouvement horizontal. Lumière franche de l'après-midi.
```
```
img25 — Très gros plan au ras du sol, ralenti : la chaussure de trail grise de Malik frappe une pierre calcaire, nuage de poussière et petits graviers suspendus en contre-jour.
```
```
img26 — Vue FPV juste derrière et au-dessus de Malik qui dévale une descente technique en lacets de pierre, gilet d'hydratation noir visible, flou de vitesse sur les bords, vallée en contrebas.
```
```
img27 — Gros plan sur l'avant-bras de Malik en pleine course : brassard noir avec un téléphone à écran vert chroma uni #00FF00, coins nets, tourné vers la caméra. Sueur sur la peau, sentier flou derrière.
```
```
img28 — Profil, figé à l'apex du saut : Malik bondit au-dessus d'un torrent de montagne clair, jambes tendues, gouttelettes en suspension illuminées en contre-jour, rochers nets.
```
```
img29 — Plan large sur une piste de gravier blanc qui serpente dans un alpage. Malik vient d'atterrir sur la piste et ralentit ; Clara à vélo gravel le dépasse à pleine vitesse en le saluant de la main. Mélèzes, lumière de fin d'après-midi.
```
```
img30 — Vue de drone latérale rapide : Clara roule sur une piste de gravier le long d'un lac alpin à l'heure dorée, sacoches noires, maillot bordeaux. Reflets dorés sur l'eau, montagnes au fond, flou de mouvement sur le sol.
```
```
img31 — Caméra au ras de la roue avant du vélo gravel vert olive de Clara : pneu à crampons qui projette des gravillons, lumière rasante dorée, faible profondeur de champ.
```
```
img32 — Plongée parfaitement verticale de drone au-dessus d'un virage en épingle d'une piste de gravier blanc dans la forêt de mélèzes. Clara, petite, prend le virage. Ombres longues de l'heure dorée. Composition graphique.
```
```
img33 — Contre-plongée de face : Clara descend la piste les bras levés au ciel, sans les mains, cri de joie, le soleil couchant juste derrière sa tête, halo et poussière dorée.
```
```
img34 — Alpage au crépuscule : au premier plan, Clara à vélo passe de gauche à droite en flou de mouvement et lève la main ; au second plan, net, le groupe des quatre installe deux tentes vert sauge et crème près d'un petit feu naissant et lui répond d'un signe. Ciel rose et violet.
```
```
img35a — Plan fixe d'ensemble : deux tentes (vert sauge et crème) sur un alpage, silhouettes des sommets dolomitiques derrière, ciel de crépuscule bleu et rose, un petit feu orangé entre les tentes.
```
```
img35b — EXACTEMENT le même cadre que img35a (même position des tentes, des sommets et du feu), mais en pleine nuit : Voie lactée nette au-dessus des sommets, tentes éclairées de l'intérieur, feu plus vif.
```
```
img36 — Gros plan de nuit autour du feu de camp : visages de Léa, Inès, Sami et Tom éclairés en orangé, rires, une popote fume, étincelles qui montent dans le noir. Couvertures et doudounes.
```
```
img37 — Nuit. Léa assise à l'entrée de la tente, couverture sur les épaules, tient son téléphone presque de face. Écran vert chroma uni #00FF00, coins nets. Son visage est éclairé par la lueur orangée du feu à droite. Sourire paisible. Étoiles floues au fond.
```
```
img38 — Nuit, intérieur d'un bus urbain dans une grande ville d'Asie ou d'Amérique (néons flous à travers la vitre mouillée). Noah, assis côté fenêtre, tient un téléphone en gros plan presque de face. Écran vert chroma uni #00FF00, coins nets. Son pouce s'est figé, il se penche, captivé.
```
```
img39 — Vue orbitale de la Terre la nuit : l'Europe et l'Afrique du Nord au centre, lumières des villes dorées, fine ligne d'atmosphère bleue sur le limbe, espace noir. Réaliste comme une photo de la Station spatiale internationale.
```

## Après la génération

1. Vérifier la cohérence : même veste vert forêt, même sac anthracite à sangles sauge, mêmes visages.
2. Contrôler que les écrans sont bien vert uni avec les quatre coins visibles.
3. Aucun texte nulle part.
4. Déposer les 39 images dans `assets/footage/` avec leur nom exact (img01.png … img39.png, img35a.png, img35b.png), plus le fichier audio de STORM II.

Ce que je fais ensuite : incrustation du vrai HUD, animation de chaque image (parallaxe 2,5D, poussées, flou de vitesse, rampes), particules et logo final en code, calage des coupes sur la musique, export 16:9 et 9:16.
