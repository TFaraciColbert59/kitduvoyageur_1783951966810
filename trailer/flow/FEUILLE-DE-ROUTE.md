# Feuille de route du tournage — Omni Flash 1.2

Tout le film au sol (plans P06 à P51) est tourné dans Google Flow avec **Omni Flash 1.2**, à partir de nos images. Un prompt par plan. L'espace du début, la remontée et le logo final sont faits en code : rien à générer pour eux.

**Budget.** 43 vidéos pour 46 plans (trois vidéos servent chacune à deux plans), **486 crédits** si tout passe du premier coup. Tu as 800 crédits : il reste **314 crédits de reprises**, soit environ 28 plans à refaire. Omni coûte 3 crédits par seconde.

## 1. Réglages (une seule fois)

Les libellés peuvent différer un peu selon la version de Flow.

1. Ouvre Flow dans Chrome, avec le compte de l'abonnement Google AI Pro.
2. Photo de profil (en haut à droite) : coupe **Visible watermarking** (filigrane visible). Note ton solde de crédits.
3. Crée un projet : `LKDV film`.
4. Dans la zone de prompt : **Video**, puis **Frames** (image de départ).
5. Réglages (icône en haut à droite de la zone de prompt) :
   - Modèle : **Omni Flash 1.2**
   - Résolution : **720p** (pas 360p)
   - Format : **16:9**
   - Nombre de résultats : **x1**
6. Avant chaque envoi, vérifie le coût affiché : **3 crédits par seconde** (9 pour 3 s, 12 pour 4 s, 15 pour 5 s). S'il est plus élevé, n'envoie pas.

## 2. Pour chaque plan

1. Importe l'image indiquée comme **image de départ**. Elles sont dans `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/footage/`. Laisse l'image de fin vide (sauf pour P46, c'est écrit dans sa fiche).
2. Règle la **durée** indiquée.
3. Copie le prompt en entier, colle, envoie.
4. Regarde la vidéo une fois, en comparant avec la ligne « Doit se voir ».
5. Télécharge en **1080p** (agrandissement gratuit).
6. Renomme le fichier avec le nom indiqué et glisse-le dans `/Users/fr168256/Projets/LKDV/lkdv/trailer/flow/clips/`.
7. Coche la case.

## 3. Quand refaire un plan

Refais-le **une seule fois**, avec le même prompt, si tu vois un de ces défauts, ou celui de la ligne « À refaire si » :

- un visage qui change ou qui devient lisse comme du plastique ;
- une main ou un membre déformé, un personnage en plus ou en moins ;
- un ralenti flottant, ou une image figée où seule la caméra bouge ;
- le décor qui se transforme ;
- du texte, un logo ou une interface qui apparaît (y compris sur un écran de téléphone, qui doit rester vert) ;
- la tenue qui change.

Nomme la reprise avec `-2` (par exemple `p26-2.mp4`) et **garde les deux fichiers**. Si la reprise est ratée aussi, n'insiste pas : passe au plan suivant, je réécrirai le prompt.

Si Flow refuse une génération (aucune vidéo produite), les crédits sont rendus : relance une fois, sinon note « refusé » et passe au suivant.

## 4. Ordre de travail

1. **Commence par ces trois plans**, les plus difficiles : **P47** (visages au feu), **P37** (saut du coureur), **P26** (marcheurs minuscules). Ils coûtent 36 crédits à eux trois.
2. Si on y croit, continue dans l'ordre du film, de P06 à P51.
3. Si les trois sont ratés, arrête-toi là et écris-le-moi : on change de méthode avant de dépenser le reste.

## 5. Quand tu as fini

Écris-moi « c'est fait » (ou « j'en suis à P30 » si tu t'arrêtes en route). Les vidéos du dossier `flow/clips/` restent sur ton Mac, elles ne partent jamais sur GitHub. Si un plan t'a frappé, en bien ou en mal, dis-le en une ligne.

---

## Acte 3 — Déclic

### P06 — Léa rêve à la fenêtre
- [ ] **Image :** `img06.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p06.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm lamplight, blue window light. A young woman in a cream sweater, jeans, grey socks hugs her knees on a window seat, phone in hand, rain on the glass. She lifts her eyes to the rainy rooftops, then looks back down at the phone, smiling. Steam curls from the mug. Slow lateral tracking shot right. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** son regard monte vers la fenêtre puis redescend sur le téléphone, la pluie coule sur la vitre. **À refaire si :** son visage change en cours de plan, ou elle pose le téléphone.

### P07 + P09 — Le pouce défile, ralentit, puis tape
- [ ] **Image :** `img07.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p07.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, lamplight. POV close-up of hands in cream knit sleeves holding a phone. The right thumb flicks up twice, slows, then taps once. Rain runs down the window. Slow push-in. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le pouce droit glisse vers le haut deux fois, s'arrête, puis tape une fois ; l'écran reste vert et entier. **À refaire si :** une image ou du texte apparaît sur l'écran, ou les doigts se déforment.

### P08 — Le lac dans la pupille
- [ ] **Image :** `img08.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p08.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, macro lens, dim warm light. Extreme close-up of a freckled woman's hazel eye, a small turquoise mountain lake reflected in her pupil. The pupil widens slightly, she blinks once, and the reflection is still there. Lashes tremble with her breath. Very slow push-in toward the pupil. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** un vrai œil vivant, un clignement, le petit reflet turquoise du lac dans la pupille du début à la fin. **À refaire si :** le reflet du lac disparaît, ou l'œil change de couleur ou de forme.

### P10 — Le lac devient réel
- [ ] **Image :** `img09.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p10.mp4`

```
Live-action aerial shot, cinema camera, 35mm look, fine grain, low morning sun from the left. A clear turquoise alpine lake with pale stones under the surface, golden larches on the shores, a sharp snow-dusted limestone peak behind. Ripples slide under the camera, thin mist drifts at the foot of the cliffs. Low drone fly-over, gliding forward just above the water toward the peak. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** on avance au ras de l'eau turquoise, l'eau bouge, la montagne reste la même. **À refaire si :** les sommets changent de forme, ou un personnage ou un bateau apparaît.

## Acte 4 — Décision

### P11 — Léa se lève d'un bond
- [ ] **Image :** `img10.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p11.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm lamplight and blue dusk window light. A young woman in a chunky cream sweater and jeans springs up from a window seat, phone in her right hand, beaming. She rises to standing in one burst toward the right of the frame, her ponytail swinging. Rain runs down the window. Shoulder-mounted handheld follow. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** elle finit de se lever d'un seul élan vers la droite, les cheveux bougent, elle sourit. **À refaire si :** elle se rassoit ou se fige, ou le téléphone change de main ou disparaît.

### P12 — Le Compas : « Où »
- [ ] **Image :** `img40.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p12.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, lamplight. Over-the-shoulder close-up: a woman in a cream sweater holds a phone in her left hand. Her right index taps the screen, then swipes up. Slow lateral slide right. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** l'index droit tape puis remonte sur l'écran vert, le téléphone reste bien visible. **À refaire si :** une image apparaît sur l'écran, ou la main cache tout l'écran.

### P13 + P15 — « Nous » puis l'itinéraire
- [ ] **Image :** `img41.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p13.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, candlelight. Over-the-shoulder shot of a woman in a cream sweater holding a phone. Her right thumb taps three spots, then rests. Hair stirs. Slow push-in. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** trois petits tapotements du pouce, puis une pause ; la caméra s'approche doucement de l'écran vert. **À refaire si :** quelque chose s'affiche sur l'écran, ou le pouce traverse l'écran.

### P14 — Sami, Inès et Tom disent oui
- [ ] **Image :** `img11.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p14.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, evening light. Split screen, three fixed vertical panels. Each person bursts with joy at a phone: a bearded man in denim laughs, head back; a woman with braids in a cream hoodie laughs over her mug; a hooded man in a navy jacket pumps his fist in the rain. Static camera. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** trois vraies joies en même temps, les trois volets restent séparés et à leur place. **À refaire si :** les volets se mélangent ou bougent, ou un visage change.

### P16 — Kit Studio, le total fond
- [ ] **Image :** `img42.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p16.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, lamplight. Top-down: a woman in cream knitwear lies prone on a bed, phone flat before her. She lowers her hand from her mouth, smiling widely. Slow push-in. The phone screen is a flat solid bright green and stays exactly like that for the whole shot, with its four small black corner marks: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** sa main quitte sa bouche, un grand sourire tenu ; le téléphone reste à plat sur le lit, écran vert entier. **À refaire si :** elle prend le téléphone ou le couvre, ou son visage change.

### P17 — Le pouce sur « Commander »
- [ ] **Image :** `img43.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p17.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm lamplight. Macro close-up of hands in cream knit sleeves holding a phone. The right thumb presses the lower screen once, firmly, and lifts. Very slow push-in. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** un appui franc du pouce, bien net, puis le pouce se relève. **À refaire si :** le pouce a une forme bizarre ou un ongle en double, ou l'écran change de couleur.

### P18 — Le colis : le sac sort du carton
- [ ] **Image :** `img44.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p18.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, soft daylight from an open door. A young woman in a cream sweater kneels behind an open box of tissue paper, hands on an olive backpack. She lifts it fully out of the box toward her, smiling in delight. Tissue paper rustles, a strand of hair falls. Slight low-angle slow push-in. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** elle sort le sac du carton avec un vrai sourire, le papier de soie bouge. **À refaire si :** le petit écusson carré du sac se change en lettres, ou le sac change de forme ou de couleur.

### P19 — Elle remplit le sac
- [ ] **Image :** `img12.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p19.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, soft window daylight from the left. Top-down shot of hiking gear laid out in rows on a white bed around an open olive backpack; a woman's hands hold a small camping stove at the opening. She lowers the stove into the backpack and her hands come back out empty. Fabric shifts. Quick overhead push-in. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** les mains déposent le réchaud dans le sac et ressortent vides, tout le matériel reste en place. **À refaire si :** des objets apparaissent, disparaissent ou bougent seuls sur le lit.

## Acte 5 — Départ

### P20 — Le clac de la boucle
- [ ] **Image :** `img13.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p20.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm natural side light. Extreme close-up of two hands at waist height holding the two halves of a black plastic hip-belt buckle over a dark green zip jacket, olive backpack padding on both sides. The hands push the halves together until the buckle snaps shut, then give the strap a short firm tug. The jacket fabric shifts as she breathes. Locked-off macro shot with a faint handheld drift. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** les deux moitiés de la boucle qui s'emboîtent d'un coup sec, puis la sangle tirée. **À refaire si :** la boucle ne se ferme pas ou se déforme, des doigts en trop ou des mains qui fusionnent.

### P21 — Elle dévale l'escalier
- [ ] **Image :** `img14.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p21.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm wall-lamp light mixed with soft daylight from a skylight. Top-down view into a deep spiral staircase with wooden steps, brass edges and a wrought-iron railing. A young woman in a dark green jacket with a large olive backpack runs down the steps, following the curve toward the right, backpack and hair bouncing with each stride. Top-down camera panning slightly to follow her. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** elle descend vite, marche après marche, en suivant la courbe vers la droite. **À refaire si :** elle monte au lieu de descendre, ou l'escalier se tord et change de forme.

### P22 — Les Dolomites défilent
- [ ] **Image :** `img15.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p22.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, soft golden dawn light. Through a train window, the faint reflection of a smiling woman with dark curly hair looks out at a Dolomites valley: autumn larches, a village with a church spire, pale peaks lit pink. The landscape slides past from right to left, the near meadow streaking with motion blur while the peaks move slowly. Her reflection blinks and keeps smiling. Locked-off camera on the window with light train vibration. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le paysage qui file derrière la vitre, et le reflet de son visage qui reste en place. **À refaire si :** le reflet disparaît ou se déforme, ou le paysage reste figé.

### P23 — Retrouvailles, la tente tendue
- [ ] **Image :** `img16.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p23.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, cold pink dawn light. Four hikers with backpacks on a gravel yard by a stone mountain hut, jagged peaks behind. On the left, a bearded man in a sand jacket and grey beanie hands a rolled grey tent to a laughing woman in a dark green fleece; she hugs it to her chest. Behind them, the other two finish a high five. Breath steams in the cold air. Slow push-in at chest height. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** la tente qui passe des mains de l'homme au bonnet à celles de la femme en vert, et de vrais rires. **À refaire si :** un visage change, la tente fond dans les mains, ou une personne apparaît ou disparaît.

### P24 — Premiers pas sur le sentier
- [ ] **Image :** `img17.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p24.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, low golden sunrise backlight. Ground-level view of a rocky mountain trail with frosted grass: a hiker's worn brown leather boots and dusty trousers walk toward the camera, the raised boot coming down onto the gravel and kicking up a puff of glowing dust. Other hikers follow a few steps behind, out of focus. Low tracking shot moving backward at ground level, keeping pace with the boots. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** des pas réguliers qui viennent vers nous, la poussière qui s'éclaire au soleil. **À refaire si :** les pieds glissent sans marcher, ou une chaussure change de forme.

### P25 — Le suivi démarre
- [ ] **Image :** `img18.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p25.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm sunrise backlight. Close-up of a woman's chest and lower face: dark green fleece, olive backpack straps, a phone clipped in a black holster on her left shoulder strap, mountain ridges and a trail behind. She takes a slow deep breath, shoulders rising under the straps, and a small smile forms. Loose hair strands glow in the wind. Slow push-in toward the phone. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le téléphone net sur la bretelle, une respiration et un petit sourire. **À refaire si :** l'écran du téléphone n'est plus vert uni, ou le téléphone sort du cadre ou devient flou.

## Acte 6 — Montagne

### P26 — Seceda, quatre points sur la crête ★
- [ ] **Image :** `img45.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p26.mp4`

```
Live-action aerial shot, cinema camera, 35mm look, fine grain, soft dawn light. A grassy alpine ridge crosses the frame diagonally, dropping on the left into a pale limestone cliff, rock spires behind, a sea of clouds below. Four tiny hikers with backpacks walk in single file up the grass slope toward the left, legs moving, long shadows following them. The grass ripples in the wind; the clouds drift slowly, keeping their shape. Slow lateral drone drift to the left at constant height. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** quatre marcheurs qui montent vers la gauche en marchant vraiment, nuages et montagnes stables. **À refaire si :** les marcheurs descendent vers la droite ou glissent sans bouger les jambes, ou les nuages bouillonnent.

### P27 — Tre Cime, le groupe au lever du soleil ★
- [ ] **Image :** `img19.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p27.mp4`

```
Live-action aerial shot, cinema camera, 35mm look, fine grain, golden sunrise light from the right. Above a rocky limestone ridge, a narrow path climbs toward three giant rock towers rising over valleys full of mist. Four tiny hikers with backpacks walk up the path in single file toward the right, backs to the camera. Thin mist drifts slowly in the valleys, keeping its shape. Smooth FPV forward flight over the ridge, descending gently toward the hikers. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** la caméra qui plonge doucement vers le groupe qui monte vers les trois tours. **À refaire si :** les trois tours changent de forme ou de nombre, ou les marcheurs vont vers la gauche.

### P28 — La main tendue, les rires
- [ ] **Image :** `img20.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p28.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm sunrise light. Low-angle shot on a rocky summit edge: a bearded man with curly blond hair in a navy jacket crouches above and grips the hand of a laughing woman in a dark green fleece with an olive backpack, distant rock towers behind. He pulls and she climbs up the last step onto the rock, both laughing, her ponytail blowing in the wind. Low-angle handheld camera tilting up slightly as she rises. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** une vraie traction, le poids du corps, et deux rires francs. **À refaire si :** les deux mains fusionnent ou ont trop de doigts, elle flotte vers le haut, ou un visage change.

### P29 — Le cockpit à 6,4 km
- [ ] **Image :** `img46.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p29.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm golden morning light. Medium close-up of a smiling woman with curly brown hair and hoop earrings, dark green fleece, olive backpack, a phone in a black holster on her left shoulder strap, three rock towers softly out of focus behind. She catches her breath after the climb and slowly turns her gaze across the view, loose strands lifting in the wind. Slow push-in toward the phone. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le téléphone net au premier plan, son visage vivant derrière. **À refaire si :** l'écran n'est plus vert uni, ou son visage change pendant le plan.

### P30 — Sorapis, face au lac de la photo ★
- [ ] **Image :** `img09b.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p30.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, low golden sun backlighting larches on the left. High wide view of a turquoise mountain lake beneath a huge pale rock peak. A tiny woman with an olive backpack stands on a flat white boulder at the near shore, her back to the camera; she slowly raises a phone with both hands toward the lake. Light ripples cross the water, the larches sway gently. Slow, steady elevated push-in. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** la petite silhouette immobile sur le rocher qui lève le téléphone, l'eau qui vit. **À refaire si :** la silhouette disparaît, se dédouble ou marche, ou le pic change de forme.

### P31 — La même photo que dans le carnet
- [ ] **Image :** `img22.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p31.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, bright clear daylight. Over the shoulder of a woman with a brown ponytail, dark green fleece and olive backpack, standing at the edge of a turquoise mountain lake under a pale spiky peak. She holds a phone horizontally in both hands, steadies it and presses the top edge with her right index finger to take the photo. Her ponytail moves in the breeze, the water ripples. Slow push-in over her shoulder. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le téléphone tenu à deux mains, bien stable, puis le petit appui du doigt. **À refaire si :** l'écran n'est plus vert uni, ou le téléphone change de taille ou de forme.

### P32 — Le coureur traverse le cadre
- [ ] **Image :** `img23.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p32.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, bright midday sun. On a rocky mountain trail above a deep valley, four hikers with backpacks walk away from the camera toward the right. In the foreground, a trail runner in a light t-shirt, black vest and black shorts sprints past them toward the right, heavily motion-blurred. Dust lifts from his footsteps. Fast pan to the right following the runner. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le coureur qui file vers la droite et la caméra qui part avec lui. **À refaire si :** le coureur va vers la gauche, ou les marcheurs s'arrêtent ou se déforment.

## Acte 7 — Coureur

### P33 — Sur le balcon au-dessus du vide
- [ ] **Image :** `img24.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p33.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, hard midday sun. A muscular trail runner with a grey headband, sweat-soaked light t-shirt, black hydration vest with two soft flasks, black shorts and a phone armband runs fast along a narrow cliff path toward the camera, a sheer drop to a green valley on the right. Arms pump, feet strike the rock, his shadow races beside him. Fast backward tracking shot ahead of him at his speed, the rock wall streaking past. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** une vraie vitesse de course, des foulées franches au bord du vide. **À refaire si :** il court au ralenti ou sur place, ou ses jambes se croisent mal.

### P34 — Impact sur la pierre
- [ ] **Image :** `img25.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p34.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, low warm backlight. Extreme close-up at ground level of a dusty dark trail-running shoe with a black sock striking a pale limestone rock. The sole presses into the rock, a burst of dust and small stones flies up and to the right, then the foot rolls forward and pushes off out of frame. Grit falls back to the ground. Static ground-level camera with a slight handheld shake. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** l'appui qui écrase la pierre, la poussière et les cailloux qui volent puis retombent. **À refaire si :** la chaussure change de forme ou de couleur, ou les cailloux restent suspendus en l'air.

### P35 — Descente technique
- [ ] **Image :** `img26.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p35.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, bright summer sun. From just behind and above, a trail runner in a sweaty light t-shirt, black vest, black shorts and grey headband descends a steep rocky trail, arms spread wide for balance, a phone strapped to his right arm. Below, the path zigzags down a green valley beside a white mountain stream. He hops from rock to rock at full speed. FPV follow shot close behind him, flying down the trail at his speed. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** des appuis rapides de rocher en rocher, les bras qui équilibrent. **À refaire si :** il ralentit ou flotte, ou le sentier en lacets se transforme.

## Acte 7 — Coureur (suite)

### P36 — Le brassard en pleine course
- [ ] **Image :** `img27.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p36.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, harsh sunlight. Close-up of a sweaty runner's arm with a phone in a black armband. He runs hard: the arm pumps, sweat drips. Handheld tracking shot on the armband. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le bras qui balance au rythme de la course, la sueur qui coule, le téléphone vert net et entier dans le brassard. **À refaire si :** l'écran vert affiche quoi que ce soit ou sort du cadre ; le bras se déforme.

### P37 — Le saut au-dessus du torrent
- [ ] **Image :** `img28.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p37.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm backlit afternoon sun. A trail runner in a light grey t-shirt and black hydration vest is mid-leap in profile over a turquoise stream, heading right. He lands his front foot on the big mossy boulder, knee bending, and drives into his next stride. Splash water falls back. Low camera at water level, locked off. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** une réception franche sur le rocher de droite, genou qui plie, et la reprise de course à vraie vitesse. **À refaire si :** il flotte au ralenti ou le pied traverse le rocher ; les jambes fondent ou se dédoublent.

### P38 — La paroi de la Tofana ★
- [ ] **Image :** `img47.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p38.mp4`

```
Live-action aerial shot, cinema camera, 35mm look, fine grain, late afternoon sun. A huge orange Dolomite rock wall rises above a grey scree slope. A tiny trail runner in a white t-shirt runs left along a thin path across the scree, a small dust plume trailing behind him. Clouds drift slowly. Slow drone pull-back, revealing more of the wall. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le point blanc du coureur qui avance vers la gauche sur le sentier, avec sa traînée de poussière, et la paroi immense. **À refaire si :** le coureur s'arrête, disparaît ou court vers la droite ; la paroi se déforme.

### P39 — Le salut entre le coureur et la cycliste
- [ ] **Image :** `img29.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p39.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, golden hour backlight. On a gravel track among golden larches, a runner in a light t-shirt and black vest jogs toward camera, waving. A woman in a burgundy jersey on a loaded olive gravel bike passes him, waving back with a big smile, and pedals on to the right. Dust rises. Pan right, following her. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** les deux saluts et les sourires, puis la caméra qui suit la cycliste vers la droite. **À refaire si :** une main a trop de doigts ou se déforme ; le vélo roule à l'envers ou les roues fondent.

## Acte 8 — Cycliste

### P40 — Le gravel au bord du lac doré ★
- [ ] **Image :** `img30.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p40.mp4`

```
Live-action aerial shot, cinema camera, 35mm look, fine grain, golden hour, low sun on the left. A calm alpine lake mirrors snowy peaks and golden larches. On the gravel track along the shore, a tiny cyclist in a burgundy jersey pedals briskly to the right, her long shadow beside her. Lateral drone tracking shot to the right at her speed. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** la petite cycliste qui pédale vers la droite, la caméra qui glisse avec elle, le lac qui reflète les sommets. **À refaire si :** elle glisse sans pédaler ou roule vers la gauche ; les montagnes ou leur reflet se transforment.

### P41 — La roue dans les gravillons
- [ ] **Image :** `img31.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p41.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm low sunset backlight. Low close-up beside the front wheel of a loaded olive gravel bike, the rider's shoe on the pedal. The bike rolls fast to the right over white gravel; the knobby tyre kicks stones and dust toward the camera. Low tracking shot with the wheel. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** la roue qui tourne vite, les gravillons projetés qui retombent, le pied qui appuie sur la pédale. **À refaire si :** la roue tourne à l'envers ou se déforme ; les cailloux flottent au ralenti.

### P42 — L'épingle vue du ciel ★
- [ ] **Image :** `img32.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p42.mp4`

```
Live-action aerial shot, cinema camera, 35mm look, fine grain, warm low sun. Top-down view of a white gravel track snaking in an S through golden and dark green larches. A small cyclist in a burgundy jersey with a backpack leans through the bend and rides toward the upper right, her long shadow following on the gravel. Slow top-down drone rotation, keeping the bend centered. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** la cycliste qui avance dans l'épingle vers le haut à droite, son ombre qui la suit, la lente rotation de l'image. **À refaire si :** elle fait demi-tour ou sort de la piste ; la piste change de forme pendant la rotation.

### P43 — Les lacets du Passo Giau ★
- [ ] **Image :** `img48.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p43.mp4`

```
Live-action aerial shot, cinema camera, 35mm look, fine grain, warm sunset light, sun low on the left. A winding mountain road curls through golden alpine meadows below a jagged rock tower and a long Dolomite ridge. A tiny cyclist in a burgundy jersey rides to the right along the road, a long shadow beside her. The grass ripples in the wind. Slow drone rise. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le minuscule point bordeaux qui avance vers la droite dans les lacets, le drone qui monte lentement. **À refaire si :** la cycliste disparaît ou se dédouble ; la tour rocheuse ou la route changent de forme.

### P44 — Les bras levés
- [ ] **Image :** `img33.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p44.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, golden sunset backlight. A woman in a burgundy jersey and grey helmet rides a gravel bike toward camera on a dusty track, both arms raised high, the sun behind her head. She shouts with joy, laughing, as she rolls closer. Dust glows, her hair stirs. Low-angle static camera on the ground. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** un vrai cri de joie sur son visage, les bras levés, le vélo qui avance vers la caméra. **À refaire si :** le visage se déforme ou change ; les mains gantées ont trop de doigts.

### P45 — Le salut au bivouac
- [ ] **Image :** `img34.png` · **Durée :** 3 s · **Crédits :** 9 · **Fichier :** `p45.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, pink and violet dusk light. In the foreground on the left, a woman in a burgundy jersey rides a loaded olive gravel bike to the right, waving, blurred by speed. Behind her, four hikers setting up two tents around a small campfire wave back and smile. Flames flicker, smoke rises. Static camera. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** la cycliste qui traverse le premier plan vers la droite pendant que le groupe lui répond. **À refaire si :** un randonneur change de visage ou de tenue ; une personne apparaît ou disparaît.

## Acte 9 — Bivouac

### P46 — La nuit tombe sur le bivouac
- [ ] **Image de début :** `img35a.png` · **Image de fin :** `img35b.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p46.mp4`

```
Live-action time-lapse, cinema camera, 35mm look, fine grain. Locked-off wide shot of a mountain bivouac: four friends sit around a small campfire between two glowing tents, jagged Dolomite peaks behind. The pink dusk sky darkens into deep night, stars appear and the Milky Way rises in an arch over the peaks. The tents and fire glow brighter as the land turns dark. Static camera. Time-lapse, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le ciel rose qui devient nuit noire, les étoiles et la Voie lactée qui apparaissent, le décor immobile. **À refaire si :** les montagnes ou les tentes bougent ou se transforment ; les personnes s'agitent ou changent.

### P47 — Rires autour du feu
- [ ] **Image :** `img36.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p47.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, flickering firelight at night. Four friends sit behind a campfire. On the right, the bearded man in a sand jacket and grey beanie shrugs both hands and the group laughs; the woman in the dark green jacket laughs softly, looking down. Steam rises, sparks drift up. Very slow arc to the right. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** un vrai rire partagé, les épaules qui bougent, la lumière du feu qui vit sur les visages. **À refaire si :** un visage change ou devient lisse comme du plastique ; les mains de l'homme de droite ont trop de doigts.

### P48 + P49 — Léa publie son carnet
- [ ] **Image :** `img37.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p48.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm firelight at night. Over-the-shoulder close-up of a woman in a dark green puffer, phone in both hands. She smiles, then her right thumb taps once low on the screen. Static camera. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** son sourire en regardant l'écran, puis un seul appui net du pouce en bas de l'écran, téléphone toujours net et entier. **À refaire si :** l'écran vert affiche quoi que ce soit ; les doigts fusionnent ou le téléphone change de forme.

### P50 — Le bivouac sous la Voie lactée ★
- [ ] **Image :** `img49.png` · **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p50.mp4`

```
Live-action aerial night shot, cinema camera, 35mm look, fine grain, starlight. A dark alpine meadow lies below jagged Dolomite peaks and a bright Milky Way arch. In the middle, a tiny bivouac: two glowing tents and a small campfire with four people around it, a thin thread of smoke rising. Slow drone pull-back and rise, the camp shrinking to a point of light. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le bivouac qui devient un minuscule point de lumière dans l'immensité, sous un ciel qui ne bouge pas. **À refaire si :** les étoiles tournent ou scintillent en masse ; le feu ou les tentes disparaissent.

## Acte 10 — Final

### P51 — Noah dans le bus de nuit
- [ ] **Image :** `img38.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p51.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, night bus light. A young man with messy curls and white earbuds sits by a rainy bus window, phone in hand. He freezes, staring at the screen. Rain runs down the glass. Slow push-in. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** le garçon qui s'arrête net sur l'écran, la pluie qui coule, les lumières de la ville qui défilent dehors. **À refaire si :** l'écran vert affiche quoi que ce soit ou sort du cadre ; le visage change pendant la poussée.
