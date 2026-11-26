# Essai Google Flow — 3 plans, 7 vidéos, Veo 3.1 Lite contre Omni Flash 1.2

> **Remplacée le 14/11/2026 par `FEUILLE-DE-ROUTE.md`.** Tony a tranché : Omni Flash 1.2 seul, un prompt par plan, tout le film d'un coup. Cette fiche reste pour ses notes de vérification (tarifs, sources) en fin de document.

**But de l'essai.** Savoir si des vidéos générées dans Flow à partir de nos images fixes donnent l'impression de vrais acteurs filmés, et plus d'un diaporama. Et savoir **quel modèle** le fait le mieux : Veo 3.1 Lite (le moins cher) ou **Omni Flash 1.2** (sorti le 5/11/2026, que Google présente comme supérieur en qualité et en constance des personnages).
On teste trois cas difficiles : un plan large avec des marcheurs minuscules (P26), une action rapide (P37) et un gros plan de visages (P47).
Pour chaque plan, **le même prompt A est lancé une fois avec Veo 3.1 Lite et une fois avec Omni Flash 1.2** : à prompt égal, on voit la différence entre les modèles. Le prompt B reste en réserve (ne le lance pas pour l'instant).
Une 7e vidéo teste ce qui ferait d'Omni « un vrai studio » : un **nouveau cadrage qui n'existe pas en image**, avec les mêmes acteurs (fiche bonus en section 5 bis).

**Coût.** 3 vidéos Veo 3.1 Lite (10 crédits chacune) = 30 crédits. 3 vidéos Omni en 720p (3 crédits par seconde : 18 + 12 + 18) = 48 crédits. Bonus Omni de 4 s = 12 crédits. **Total : 90 crédits** sur les 1 000 crédits mensuels de l'abonnement Google AI Pro. L'agrandissement en 1080p est gratuit jusqu'à 10 s.

**Temps estimé.** 10 minutes de réglages la première fois, puis 2 à 5 minutes par vidéo (attente comprise). Compter **environ 1 heure** en tout.

---

## 1. Réglages Flow (une seule fois)

Les noms de boutons ci-dessous viennent de l'aide Google et de guides récents. L'interface change souvent : **le libellé exact peut différer**. Si un bouton n'est pas là où je le dis, cherche l'équivalent, et note-le pour qu'on corrige la fiche.

1. **Ouvrir Flow.** Sur le Mac, dans Google Chrome (Google le recommande), va sur `https://labs.google/fx/tools/flow` et connecte-toi avec le compte qui a l'abonnement Google AI Pro.
2. **Couper le filigrane visible.** Clique sur ta photo de profil (en haut à droite). Dans le menu, il y a un interrupteur « Visible watermarking » (filigrane visible) : mets-le sur **désactivé**. Le filigrane invisible SynthID reste, on ne peut pas l'enlever et il ne se voit pas.
   Profites-en pour noter ton solde de crédits.
3. **Créer un projet.** Clique sur « New project » (nouveau projet). Nomme-le `LKDV essai`.
4. **Passer en vidéo à partir d'une image.** Dans la zone de saisie du prompt (en bas), clique sur le nom du modèle, puis choisis **Video**, puis le mode **Frames** (« Frames to Video », image de départ). Tu dois voir une case du type « + Add start frame » (image de début) et éventuellement « + Add end frame » (image de fin).
   **On ne met que l'image de début. Laisse l'image de fin vide.**
5. **Choisir le modèle.** Clique sur l'icône **Settings** (réglages) en haut à droite de la zone de prompt. Chaque plan se fait deux fois :
   - d'abord avec **Veo 3.1 - Lite** : le coût affiché doit être **10 crédits** ;
   - puis avec **Omni Flash 1.2**, résolution **720p** (pas 360p) : le coût affiché doit être **3 crédits par seconde** (12 crédits pour 4 s, 18 crédits pour 6 s).
   Si le coût affiché est plus élevé, n'envoie rien et préviens-moi.
6. **Format.** Choisis **16:9** (paysage, « landscape »). Jamais 9:16 pour cet essai.
7. **Nombre de résultats par prompt : 1.** Dans les mêmes réglages, mets le nombre de sorties (« outputs », souvent affiché « x1 », « x2 »…) sur **x1**. Chaque vidéo en plus coûte 10 crédits de plus.
8. **Durée.** Elle se règle aussi dans ces réglages (4, 6 ou 8 secondes). **Elle change selon le plan** : regarde la fiche de chaque plan.
9. **Le son.** Veo fabrique un son avec la vidéo. On ne s'en servira pas (la musique est STORM II). Si une génération échoue avec le message « Audio Generation Failed », les crédits sont rendus : relance-la une fois. Si ça se répète, dans les réglages du projet, active « Return silent videos » (vidéos sans son).

### Après chaque génération : agrandir en 1080p et télécharger

1. Attends que la vidéo apparaisse (une vignette dans le projet).
2. Regarde-la une fois en entier, sans rien relancer.
3. Ouvre le menu de téléchargement de la vidéo (icône de téléchargement ou menu « … » sur la vignette ; le libellé peut différer).
4. Choisis **1080p** (version agrandie, gratuite pour les abonnés). **Pas** « 720p original », **pas** le GIF.
   L'agrandissement peut prendre une minute avant que le téléchargement démarre.
5. Renomme le fichier téléchargé avec le nom exact donné dans la fiche (par exemple `p26-veo.mp4` pour Veo 3.1 Lite, `p26-omni.mp4` pour Omni).

### Si Flow refuse une génération

Flow peut refuser une image avec des personnes réelles ou un prompt (filtre de sécurité). Dans ce cas, les crédits sont rendus en moins d'une heure. **Ne modifie pas le prompt** : note juste « refusé » et le message affiché, et passe à la suite.

---

## 2. Règles suivies pour écrire les prompts (pour info)

- Style prise de vue réelle : caméra de cinéma, rendu 35 mm, grain léger, lumière naturelle, profondeur de champ réaliste.
- Une seule action physique, en temps réel. Pas de ralenti.
- Des petits signes de vie : respiration, clignements, cheveux et tissus qui bougent au vent, vapeur, étincelles.
- Un seul mouvement de caméra, nommé précisément.
- Personnages, tenues, décor et lumière identiques à l'image de départ.
- Aucun texte, aucun logo, aucun sous-titre, pas de coupe, pas de morphing, pas de dialogue, son d'ambiance naturelle seulement.
- Les prompts sont en anglais : Google recommande l'anglais pour Flow.

Dans chaque fiche, le prompt **A** est le plus sobre (peu d'action, caméra très calme). Le prompt **B** va plus loin (action plus marquée ou autre mouvement de caméra). Copie le bloc entier, tel quel.

**Pour cet essai : lance le prompt A deux fois (une fois avec Veo 3.1 Lite, une fois avec Omni Flash 1.2 en 720p), même image, même durée. Ne lance pas le prompt B : il sert de réserve si le A ne donne rien.**

---

## 3. Fiche P26 — Seceda, les quatre marcheurs minuscules

**Rôle dans le film.** Premier plan « à couper le souffle » de l'acte Montagne (vers 25 s). Quatre amis minuscules sur une crête immense, au-dessus d'une mer de nuages. Il doit laisser bouche bée. Dans le film, il durera 1,5 à 2 s.

**Ce qu'il y a dans l'image.** Une crête d'herbe vert doré traverse l'image en diagonale, du haut à gauche vers le bas à droite. À gauche, elle tombe en falaise de calcaire pâle. Derrière, des aiguilles de roche et des sommets enneigés. Une mer de nuages remplit les vallées des deux côtés. Les quatre marcheurs sont au centre, en file, sacs au dos : ils **montent la pente vers la gauche** (vérifié en agrandissant l'image : ils font face à la gauche). Lumière douce de l'aube, ombres longues des marcheurs vers le bas à gauche.

**Image à importer.** `img45.png`
Chemin : `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/footage/img45.png`

**Durée à choisir : 6 s.** Le mouvement est lent : il faut un peu de temps pour qu'il soit régulier et qu'on choisisse les 2 meilleures secondes. 8 s laisserait plus de temps au décor pour se déformer.

**Prompt A** (marche simple, glissé de drone latéral très lent)

```
Live-action aerial shot filmed on a cinema camera, 35mm film look, fine grain, soft natural dawn light. A grassy alpine ridge in the Dolomites crosses the frame diagonally and drops on the left into a pale limestone cliff, with jagged rock spires behind and a sea of clouds in the valleys. Four tiny hikers with backpacks walk in single file up the grass slope toward the left at a normal walking pace, their long shadows moving with them. The grass ripples in a light wind. The clouds drift slowly, keeping their shape. Slow, steady lateral drone drift to the left at constant height. Real time. Natural wind ambience only.
```

**Prompt B** (même marche, poussée de drone vers les marcheurs)

```
Live-action aerial shot filmed on a cinema camera, 35mm film look, fine grain, soft natural dawn light. A grassy alpine ridge in the Dolomites crosses the frame diagonally and drops on the left into a pale limestone cliff, with jagged rock spires behind and a sea of clouds in the valleys. Four tiny hikers with backpacks walk in single file up the slope toward the left, steady strides, arms swinging, long shadows sliding over the grass. Wind combs the grass in waves; thin wisps of mist slide over the cliff edge. Slow, smooth drone push-in toward the hikers with a gentle descent. Real time. Natural wind ambience only.
```

**Ce qu'on doit voir.**
- Les quatre silhouettes marchent vraiment : jambes qui alternent, pas réguliers, à vitesse normale.
- L'herbe bouge au vent, les nuages dérivent lentement sans changer de forme.
- La caméra glisse ou avance de façon lente et régulière, sans à-coups.
- Les montagnes restent exactement les mêmes du début à la fin.

**Défauts éliminatoires.**
- Image figée (rien ne bouge à part la caméra) ou marcheurs qui glissent sans bouger les jambes.
- Marcheurs qui marchent à reculons ou font demi-tour (ils doivent monter vers la gauche).
- Nuages qui bouillonnent, gonflent ou se tordent comme de la fumée.
- Montagnes ou falaise qui se transforment, sommets qui apparaissent ou disparaissent.
- Un marcheur en plus ou en moins, marcheurs qui fusionnent.
- Ralenti flottant.
- Texte, logo, sous-titre ou filigrane qui apparaît.

**Fichiers à rendre.** `p26-veo.mp4` (prompt A, Veo 3.1 Lite, 6 s, 10 crédits) et `p26-omni.mp4` (prompt A, Omni Flash 1.2 en 720p, 6 s, 18 crédits).

---

## 4. Fiche P37 — Malik saute au-dessus du torrent

**Rôle dans le film.** Le pic d'action de l'acte du coureur (vers 37 s), juste après le gros plan du brassard. Un vrai saut, à pleine vitesse. Dans le film, il durera environ 1 s.

**Ce qu'il y a dans l'image.** Malik est vu de profil, il court vers la droite. Il vient de quitter le rocher de gauche (une gerbe d'eau jaillit sous son pied arrière) et il est en l'air, jambe avant tendue vers le gros rocher moussu de droite. Il porte un t-shirt technique gris clair, un gilet d'hydratation noir avec deux flasques transparentes sur la poitrine, un short noir, un bandeau gris, des chaussures de trail gris foncé et des chaussettes noires. Torrent vert turquoise, mélèzes dorés en contre-jour, caméra basse au niveau de l'eau.

Attention : l'image de départ montre déjà Malik en l'air. La vidéo commencera donc pendant le saut. On veut voir la fin du vol, la réception et la reprise de course.

**Image à importer.** `img28.png`
Chemin : `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/footage/img28.png`

**Durée à choisir : 4 s.** La réception arrive en moins d'une seconde. Avec une durée longue, Veo a tendance à étirer l'action et à la ralentir. 4 s, c'est la durée la plus courte, donc la plus sûre pour garder une vitesse réelle.

**Prompt A** (réception dans le cadre, caméra presque fixe)

```
Live-action sports footage filmed on a cinema camera, 35mm film look, fine grain, warm backlit afternoon sun. A trail runner in a light grey t-shirt, black hydration vest with two soft flasks, black shorts and grey headband is mid-leap in profile over a clear turquoise mountain stream. At full real-time speed he lands his leading foot on the big mossy boulder on the right, knee bending to absorb the impact, and drives straight into his next running stride. Water from the take-off splash falls back into the stream. Low camera at water level, locked off with slight handheld shake. Real-time speed. Natural stream ambience only.
```

**Prompt B** (réception et sortie, travelling latéral qui le suit)

```
Live-action sports footage filmed on a cinema camera, 35mm film look, fine grain, warm backlit afternoon sun through golden larches. A trail runner in a light grey t-shirt, black hydration vest with two soft flasks, black shorts and grey headband is mid-leap in profile over a turquoise mountain stream. He lands hard on the wet mossy boulder on the right, his shoe flicking droplets off the rock, and sprints on to the right without slowing, arms pumping. Side-on tracking shot at water level, the camera trucks right at his speed and keeps him in frame. Real-time speed. Natural stream ambience only.
```

**Ce qu'on doit voir.**
- Une réception franche, avec le poids du corps : le genou plie, le pied accroche le rocher.
- Une vraie vitesse de course, comme filmée en direct.
- Des gouttes d'eau qui retombent normalement (vers le bas, à vitesse réelle).
- Le même homme du début à la fin : visage, barbe, bandeau, gilet, flasques.

**Défauts éliminatoires.**
- Ralenti « IA » : il flotte en l'air, la réception dure une éternité.
- Jambes ou bras qui fondent, se dédoublent, se croisent mal ; pied qui traverse le rocher.
- Visage qui change, tenue qui change (couleur du t-shirt, gilet qui disparaît).
- Mains à 6 doigts.
- Eau qui coule à l'envers ou se fige.
- Un deuxième coureur ou une autre personne qui apparaît.
- Texte, logo ou filigrane.

**Fichiers à rendre.** `p37-veo.mp4` (prompt A, Veo 3.1 Lite, 4 s, 10 crédits) et `p37-omni.mp4` (prompt A, Omni Flash 1.2 en 720p, 4 s, 12 crédits).

---

## 5. Fiche P47 — Rires autour du feu (le plan d'acteurs)

**Pourquoi ce plan et pas la main tendue (img20).**
Le feu teste en même temps quatre visages, la peau, le regard et un vrai rire dans une lumière qui vacille : c'est exactement « on croit à de vrais acteurs ».
L'action est simple (ils sont assis et rient) ; la main tendue demande deux mains serrées qui tirent un corps vers le haut, ce que Veo rate le plus souvent (mains qui fusionnent, corps qui flotte).

**Rôle dans le film.** La respiration intime du bivouac (vers 49 s), juste avant que Léa sorte son téléphone. On pourra tenir ce plan 2 à 4 s sur un moment calme de la musique.

**Ce qu'il y a dans l'image.** Nuit, étoiles, crêtes noires au fond, deux tentes éclairées de l'intérieur (à gauche et à droite). Les quatre amis sont assis derrière le feu, de gauche à droite :
- **Tom** : doudoune bleu encre, cheveux blond roux bouclés, barbe de trois jours, il sourit et tient une popote en titane qui fume.
- **Léa** : doudoune vert forêt foncé, cheveux châtains détachés, couverture écossaise sur les genoux, elle sourit en regardant vers le bas.
- **Inès** : doudoune crème, tresses relevées, créoles dorées, elle rit la tête légèrement en arrière, une tasse en métal à la main.
- **Sami** : doudoune sable, bonnet gris, barbe noire, il raconte une histoire en faisant un geste des deux mains.
Au premier plan, les flammes ; en bas à gauche, le sac olive de Léa avec son petit écusson. Seule lumière : le feu, orange.

**Image à importer.** `img36.png`
Chemin : `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/footage/img36.png`

**Durée à choisir : 6 s.** Un rire a besoin de temps pour monter et redescendre, et on veut pouvoir tenir le plan 3 à 4 s. 8 s augmenterait le risque que les visages changent.

**Prompt A** (le rire continue, caméra presque immobile)

```
Live-action film scene shot on a cinema camera, 35mm film look, fine grain, shallow depth of field. Night bivouac in the mountains: four friends in puffer jackets sit close together behind a campfire, lit only by flickering orange firelight. On the right, the bearded man in a sand jacket and grey beanie finishes his story with a small shrug of both hands, and the group laughs naturally; the woman in the forest green jacket laughs softly, looking down, and blinks. Shoulders move with laughter, steam rises from the metal pot, sparks drift up. Static camera with a barely perceptible handheld drift. Real time. Natural crackling fire ambience only, no dialogue.
```

**Prompt B** (Léa éclate de rire, lent mouvement tournant autour du feu)

```
Live-action film scene shot on a cinema camera, 35mm film look, fine grain, shallow depth of field. Night bivouac in the mountains: four friends in puffer jackets sit behind a campfire, lit only by flickering orange firelight. The woman in the forest green jacket, second from left, lifts her eyes from the fire toward the storyteller on the right and bursts into genuine laughter, shoulders shaking, a strand of hair falling across her cheek. The others keep laughing, steam curls from the pot, sparks rise. Slow, smooth arc shot to the right around the fire at seated eye level. Real time. Natural fire ambience only, no dialogue.
```

**Ce qu'on doit voir.**
- De vrais visages : peau avec du grain, lumière du feu qui bouge sur les joues, yeux qui clignent, regards qui vont d'une personne à l'autre.
- Un rire crédible : il monte, les épaules bougent, ça ne reste pas un sourire figé.
- La vapeur de la popote, les étincelles, les flammes qui vivent.
- Les quatre personnes restent les mêmes, à la même place, avec les mêmes vêtements.

**Défauts éliminatoires.**
- Un visage qui change (traits, âge, couleur de peau, coiffure) ou qui se « lisse » comme du plastique.
- Bouche qui se déforme, dents qui bougent, rire grimaçant.
- Mains à 6 doigts ou doigts qui fusionnent (surveiller Sami, qui gesticule).
- Une personne en plus ou en moins.
- Tenue qui change de couleur ; bonnet qui apparaît ou disparaît.
- Quelqu'un qui parle avec des mots (on ne veut pas de dialogue).
- Texte, logo ou filigrane qui apparaît. Le petit écusson carré du sac en bas à gauche est normal, mais il ne doit pas se transformer en lettres.
- Ralenti flottant.

**Fichiers à rendre.** `p47-veo.mp4` (prompt A, Veo 3.1 Lite, 6 s, 10 crédits) et `p47-omni.mp4` (prompt A, Omni Flash 1.2 en 720p, 6 s, 18 crédits).

---

## 5 bis. Fiche bonus — un nouveau cadrage avec les mêmes acteurs (Omni seulement)

**Pourquoi.** C'est le test de « Omni peut tout créer comme un vrai studio ». Jusqu'ici, chaque vidéo part d'une de nos images et garde son cadrage. Ici, on donne l'image du feu comme **référence** (les acteurs, les tenues, le décor) et on demande un plan qui **n'existe pas** : un gros plan de Léa seule. Si Léa reste Léa, on pourra tourner de vrais champs-contrechamps au lieu d'animer 51 images fixes.

**Mode.** Dans la zone de prompt, au lieu de « Frames », choisis **Ingredients** (« Ingredients to Video », parfois « References » ; le libellé peut différer). Ajoute `img36.png` comme ingrédient.
Chemin : `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/footage/img36.png`

**Modèle : Omni Flash 1.2, 720p, 16:9, x1. Durée : 4 s.** Coût attendu : 12 crédits.

**Prompt**

```
Live-action film scene shot on a cinema camera, 35mm film look, fine grain, very shallow depth of field. Same night bivouac, same people and same clothes as in the reference image. Close-up on the woman in the forest green puffer jacket with loose brown hair, framed from the shoulders up, lit only by flickering orange campfire light from below. She listens to someone off-screen on her left, then breaks into a genuine laugh, eyes creasing, and looks back down at the fire. Soft out-of-focus glow of a lit tent behind her, a few sparks drifting up. Slow handheld push-in. Real time. Natural crackling fire ambience only, no dialogue.
```

**Ce qu'on doit voir.** La même Léa que sur l'image (visage, cheveux, doudoune vert forêt), dans la même lumière de feu, mais cadrée seule et de près.

**Défauts éliminatoires.** Une autre femme (visage différent), une autre tenue, un décor de jour ou sans feu, une image qui reprend simplement le cadrage d'origine à quatre, du texte, un ralenti flottant.

**Fichier à rendre.** `p47-omni-ref.mp4`.

---

## 6. Récapitulatif

| Plan | Image | Durée | Modèle | Prompt | Crédits | Fichier attendu |
|---|---|---|---|---|---|---|
| P26 — Seceda | `img45.png` | 6 s | Veo 3.1 Lite | A | 10 | `p26-veo.mp4` |
| P26 — Seceda | `img45.png` | 6 s | Omni Flash 1.2, 720p | A | 18 | `p26-omni.mp4` |
| P37 — saut du torrent | `img28.png` | 4 s | Veo 3.1 Lite | A | 10 | `p37-veo.mp4` |
| P37 — saut du torrent | `img28.png` | 4 s | Omni Flash 1.2, 720p | A | 12 | `p37-omni.mp4` |
| P47 — rires au feu | `img36.png` | 6 s | Veo 3.1 Lite | A | 10 | `p47-veo.mp4` |
| P47 — rires au feu | `img36.png` | 6 s | Omni Flash 1.2, 720p | A | 18 | `p47-omni.mp4` |
| Bonus — Léa seule | `img36.png` en ingrédient | 4 s | Omni Flash 1.2, 720p | bonus | 12 | `p47-omni-ref.mp4` |

Total : 7 vidéos, 90 crédits. Réglages communs : 16:9, x1, filigrane visible coupé ; « Frames » avec image de début seulement pour les six premières, « Ingredients » pour le bonus.

---

## 7. Comment me renvoyer les vidéos

Deux possibilités, au choix :
1. **Les déposer dans la conversation** (glisser les 6 fichiers dans la fenêtre).
2. **Les glisser dans le dossier** `/Users/fr168256/Projets/LKDV/lkdv/trailer/flow/clips/` puis m'écrire « c'est fait ».
   Ce dossier n'est jamais envoyé sur GitHub : les vidéos restent sur ton Mac.

À respecter :
- **Télécharge la version 1080p**, pas la 720p.
- **Garde exactement les noms indiqués** (`p26-veo.mp4`, `p26-omni.mp4`, `p37-veo.mp4`, `p37-omni.mp4`, `p47-veo.mp4`, `p47-omni.mp4`, `p47-omni-ref.mp4`) : c'est le nom qui me dit quel modèle a fait quelle vidéo.
- **Si une génération est manifestement ratée, ne la relance pas.** Envoie-la quand même : on veut connaître le vrai taux d'échec avant de décider de refaire tout le film. Seule exception : un refus ou une erreur de Flow (aucune vidéo produite, crédits rendus) ; tu peux alors relancer une fois et me le dire.
- Si tu as une remarque en regardant une vidéo (« celle-là, on y croit », « le visage bouge »), écris-la en une ligne : ton œil compte plus que le mien.

---

## Notes de vérification (pour l'équipe, pas pour Tony)

Revérifié le 14/11/2026 sur l'aide officielle Google Flow :
- Veo 3.1 Lite : 10 crédits par génération (5 pour Ultra), 4/6/8 s, 720p, « Frames to Video: First » et « First and last » disponibles en 16:9 (support.google.com/flow/answer/16352836 et 16526234).
- Coût par génération, pas par demande : une demande peut produire 2 vidéos, d'où le réglage x1 (16526234).
- Agrandissement 1080p : 0 crédit pour les abonnés Plus, Pro et Ultra (16526234).
- Filigrane visible : interrupteur « Visible watermarking » dans le menu sous la photo de profil, imposé en Inde, Corée du Sud, Vietnam (16353333).
- Crédits rendus en moins d'une heure si la génération échoue ou est bloquée ; option de projet « Return silent videos » (16353333).
- Veo 3.1 Fast et Quality retirés de Flow le 5/12/2026 ; Lite reste (16352836).

Omni Flash 1.2, revérifié le 14/11/2026 sur l'aide officielle Google Flow (16352836, 16526234) et le billet Google du 5/11/2026 (blog.google, « Gemini Omni 1.2 Flash ») :
- Abonnés Plus/Pro/Ultra : texte → vidéo, Frames → vidéo, Ingredients/References → vidéo et retouche vidéo → vidéo, de 3 à 15 s, dans les deux formats ; prolongation de 3 à 10 s ; agrandissement jusqu'en 1080p.
- Coût : 3 crédits par seconde en 720p jusqu'à 10 s, 6 crédits par seconde de la 11e à la 15e ; 1 crédit par seconde en 360p (2 de la 11e à la 15e) ; retouche au même tarif que la durée retouchée ; prolongation 3 crédits par seconde ajoutée en 720p ; agrandissement 1080p à 0 crédit jusqu'à 10 s, puis 1 crédit par seconde.
- Google annonce : meilleure tenue des visages, vêtements et décors d'un plan à l'autre et d'un angle à l'autre, retouche en conversation (changer la lumière, le décor, un objet sans tout régénérer), mouvements de caméra continus avec moins de sauts. Ce sont des annonces : l'essai sert à le vérifier sur nos plans.
- Nombre d'images de référence : 6 selon la documentation développeur de Google (aistudio.google.com/docs/omni) ; un guide tiers en annonce jusqu'à 10 dans Flow. Non vérifié dans l'interface.

Non revérifié sur une source officielle (repris de guides tiers récents ou des faits du 14/11) :
- Libellé exact du mode « Ingredients » / « References » et du choix 360p/720p pour Omni dans l'interface.
- Libellés exacts des menus : « New project », « Video » puis « Frames », « + Add start frame », icône Settings, sélecteur « x1 », option de téléchargement « 1080p » (guides digitaltatva.com, oct. 2026, et blog.laozhang.ai, nov. 2026). L'adresse `labs.google/fx/tools/flow` vient aussi d'un guide tiers ; un guide cite aussi `flow.google.com`.
- Cadence de 24 i/s des sorties Veo 3.1 Lite dans Flow : non trouvée dans l'aide Flow ; à mesurer avec ffprobe à la réception.
- Durée d'attente par vidéo (environ 80 s dans un test tiers).
