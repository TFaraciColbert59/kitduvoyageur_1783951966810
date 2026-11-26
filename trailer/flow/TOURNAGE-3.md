# Tournage 3 — l'ouverture, les trois amis, le colis (15/11/2026)

Ce que tu as demandé, prêt à lancer dans Flow. Réglages communs : **Omni Flash 1.2, 720p, 16:9, x1**, téléchargement en **1080p**. Dépose les fichiers dans `trailer/flow/clips/` avec le nom indiqué.

| Vidéo | Mode | Durée | Crédits |
|---|---|---|---|
| 1. L'ouverture : nébuleuse, système solaire, Terre | Texte seul | 10 s | 30 |
| 2. La plongée vers la fenêtre (facultative) | Texte seul | 8 s | 24 |
| 3. Sami dit oui | Ingredients | 4 s | 12 |
| 4. Inès dit oui | Ingredients | 4 s | 12 |
| 5. Tom dit oui | Ingredients | 4 s | 12 |
| 6. Le colis | Ingredients | 5 s | 15 |

Total : 81 crédits sans la plongée, 105 avec. Si tes crédits sont comptés, l'ordre de priorité est : 1, 6, 3, 4, 5, puis 2.

---

## 1. L'ouverture — nébuleuse, création du système solaire, Terre

**Mode :** Text to Video (aucune image). **Durée :** 10 s. **Fichier :** `ouverture-1.mp4`.

Le film n'en gardera qu'environ 4 secondes, accélérées si besoin : 10 s laissent à Omni le temps de tout enchaîner sans bâcler. Si la première prise saute une étape (pas de Soleil qui s'allume, pas de planètes), relance une fois : `ouverture-2.mp4`.

```
Photorealistic cinematic space sequence in one single continuous forward camera move, no cuts. Shot like a large-format science documentary: real astrophotography detail, deep contrast, volumetric light, crisp focus, fine film grain, rich natural colour, bright and luminous.

Seconds 0 to 3: the camera glides forward through an immense glowing nebula. Towering pillars and thin veils of gas in magenta, violet, teal and gold, sharp dark dust lanes, thousands of pin-sharp stars with soft halos, light scattering through the clouds. The gas flows and curls slowly, alive.

Seconds 3 to 5: the camera accelerates as gas and dust spiral inward and collapse into a dense bright core. With a brilliant white-gold flash a newborn Sun ignites and a wave of light sweeps through the nebula.

Seconds 5 to 7.5: around the young Sun a vast glowing disc of dust and rock spins. Molten clumps collide and fuse into young planets that sweep along their orbits, leaving bright trails. The camera dives across the disc toward one small glowing world.

Seconds 7.5 to 10: that world cools as we rush toward it. Lava dims, oceans spread, white clouds form, continents appear. It becomes present-day Earth: vivid blue, sharp and real, the Sun rising on its thin glowing atmosphere, filling the frame as the camera keeps pushing in toward Europe.

Motion: fluid and smooth, constantly accelerating forward, no shake, no fades, no morphing. No text, no logos, no people, no spacecraft, no lens dirt. Sound: a deep cinematic rumble only, no music, no voice.
```

**Doit se voir :** quatre états qui s'enchaînent sans coupe : la nébuleuse pleine de couleurs, le Soleil qui s'allume, le disque et les planètes, la Terre d'aujourd'hui.
**À refaire si :** il y a une coupe ou un fondu entre deux tableaux, la Terre ressemble à un dessin, une étape manque, ou du texte apparaît.

## 2. La plongée vers la fenêtre de Léa (facultative)

Aujourd'hui, la descente de l'orbite à la fenêtre est faite en code. Si l'ouverture générée est belle, celle-ci permettrait d'avoir tout le début dans la même matière.

**Mode :** Text to Video. **Durée :** 8 s. **Fichier :** `plongee-1.mp4`.

```
Photorealistic cinematic continuous shot, no cuts, large-format documentary look, crisp focus, fine film grain. Start in low Earth orbit above Europe at dusk, the Sun low on the curved horizon. The camera plunges straight down, accelerating all the way: through thin high cirrus, into a thick sea of clouds that rushes past the lens, then bursts out below the clouds above an old European city at blue hour in the rain, wet slate rooftops, warm windows glowing. It keeps diving toward one attic window lit by warm lamp light, where a young woman in a cream sweater sits on the window seat, until the warm window fills the whole frame. Vertiginous, fluid, smooth acceleration, no shake, no fades. No text, no logos. Sound: rushing wind, then soft rain, no music, no voice.
```

**Doit se voir :** une seule chute, de l'orbite à la fenêtre éclairée, qui accélère.
**À refaire si :** il y a une coupe, la ville est de jour, ou la caméra s'arrête avant la fenêtre.

---

## 3, 4, 5. Les trois amis disent oui, chacun dans son plan

Dans le film actuel, ils sont tous les trois dans la même image, en trois volets. Ici, chacun a son plan, dans une situation différente. Chaque ami a son portrait découpé de l'image d'origine, à donner à Flow comme **référence** (mode **Ingredients**, pas image de départ).

Les portraits sont dans `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/footage/`.

On ne voit jamais l'écran de leur téléphone, seulement le dos : rien à incruster ensuite.

### 3. Sami — au bureau, au coucher du soleil

- [ ] **Référence :** `img11-sami.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p14a.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm sunset light. The same man as in the reference image: a bearded man in his thirties with dark curly hair and a grey beanie, denim shirt over a dark t-shirt, a watch on his wrist. He sits at a desk in an open-plan office at sunset, the city skyline glowing orange behind the tall window, a desk lamp on. His phone buzzes on the desk; he picks it up, reads, and bursts out laughing, throwing his head back and leaning back in his chair, then nods yes and types a quick reply with his thumb. We only see the back of the phone, never its screen. Medium shot, slow handheld push-in. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

### 4. Inès — dans sa cuisine, sa tasse à la main

- [ ] **Référence :** `img11-ines.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p14b.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm pendant-lamp light. The same woman as in the reference image: a young Black woman with long braids tied up in a high bun, sunglasses pushed up on her head, gold hoop earrings, a cream hoodie. She stands in a warm kitchen with green tiles and potted herbs, sipping from a speckled ceramic mug, steam rising. Her phone lights up in her other hand; she reads, grins wide over the rim of the mug, sets the mug down on the counter and does a small happy dance with a raised fist, then taps a reply. We only see the back of the phone, never its screen. Medium close shot, slow push-in. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

### 5. Tom — dans la rue, sous la pluie, la nuit

- [ ] **Référence :** `img11-tom.png` · **Durée :** 4 s · **Crédits :** 12 · **Fichier :** `p14c.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, night, warm street-lamp light and blurred traffic lights. The same man as in the reference image: a man in his late twenties with wet blond hair and stubble, a grey hoodie with the hood up under a navy rain jacket. He walks along a rainy city street at night, stops under a street lamp, pulls out his phone, reads, breaks into a huge smile and pumps his fist in the air, then laughs up at the rain. Rain streaks through the lamp light, the wet pavement shines. We only see the back of the phone, never its screen. Medium shot, handheld, slight push-in. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir, pour les trois :** le même visage que sur le portrait, une vraie joie, un geste qui dit oui.
**À refaire si :** le visage n'est pas celui du portrait, l'écran du téléphone est visible avec quelque chose dessus, ou il parle avec des mots.

---

## 6. Le colis — un beau packaging, le sac et ses modules

**Mode :** Ingredients, avec **deux références** :
- `img44.png` (Léa et son entrée), dans `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/footage/`
- `sac-lkdv-one-45-face.png` (le vrai sac), dans `/Users/fr168256/Projets/LKDV/lkdv/trailer/assets/ref/`

- [ ] **Durée :** 5 s · **Crédits :** 15 · **Fichier :** `p18-2.mp4`

```
Live-action film shot, cinema camera, 35mm look, fine grain, soft daylight from an open door. The same young woman as in the first reference image, in a chunky cream sweater, kneels on the wooden floor of her attic apartment entrance. In front of her sits a large premium shipping box in matte forest green with a clean minimalist design and no writing on it. She lifts the lid: inside, in moulded recycled-pulp trays lined with cream tissue paper, lies the backpack from the second reference image, olive green with a black base, black zips, a roll top and a small square black patch, surrounded by neatly arranged modular pouches in matching olive and lime green, each in its own compartment: a zip pouch, a bottle holder, a front pocket, rolled straps and black buckles. She gasps with delight, lifts the backpack out with both hands and holds it up, smiling. Slightly high three-quarter angle, slow push-in. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

**Doit se voir :** une boîte soignée, le sac olive au centre, les modules rangés autour, et sa joie quand elle le sort.
**À refaire si :** le sac n'est pas le nôtre (autre forme, autre couleur), du texte apparaît sur la boîte, ou son visage change.

Juste après ce plan, le film enchaînera sur le sac qui s'assemble en 3D, avec nos vrais modèles : ça, c'est fait en code, tu n'as rien à générer.
