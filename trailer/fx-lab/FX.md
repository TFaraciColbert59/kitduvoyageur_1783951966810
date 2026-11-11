# Bibliothèque d'effets LKDV (`lib/fx/`)

Fichiers JS chargés localement (`<script src="lib/fx/…">` dans la scène, chemins relatifs au projet), sans réseau.
Tous attachent leurs fonctions à `window.LKDVFX` et ne se chargent qu'une fois par page.
Règle commune : chaque effet est une **fonction pure de ses entrées** (image ou temps local, paramètres). Les seuls états sont des caches construits une fois à graine fixe (textures de bruit, particules, gouttes). Aucun `Math.random()`, aucune horloge.

Ordre de chargement : `core.js` puis, selon le besoin, `plates.js`, `earth-data.js`, `earth.js`, `traces.js`, `transitions.js`, `finale.js`.

## Socle (`core.js`)

| Fonction | Rôle |
|---|---|
| `FX.bindClock(id, frames, render)` | Crée la timeline GSAP de la scène (durée `frames/60`), appelle `render(t, frame)` quand l'image change (relue aussi à chaque `hf-seek`). Retourne `{ tl, redraw }` ; la scène fait `window.__timelines[id] = clock.tl`. Le temps vient de la timeline de la scène : il est **local** au plan. |
| `FX.mulberry32(seed)`, `FX.hash2(x, y, seed)` | Aléatoire à graine. |
| `FX.noise2`, `FX.fbm(x, y, octaves, seed)` | Bruit de valeur et fBm. |
| `FX.ease.*`, `FX.smooth`, `FX.ramp`, `FX.lerp`, `FX.clamp` | Courbes. |
| `FX.zoomBlur(ctx, src, ox, oy, amount, samples)` | Flou de zoom par empilement (coût : `samples` copies plein cadre). |
| `FX.RGB` | Palette : `ink` #0B1F17, `forest`, `sage` #5B7F55, `sageLight`, `sagePale`, `stone` #FAF8F5. |

Gabarit de scène :

```html
<canvas id="pNN-canvas" width="1920" height="1080" data-layout-allow-overflow></canvas>
<script src="lib/fx/core.js"></script>
<script src="lib/fx/transitions.js"></script>
<script>
  (function () {
    var FX = window.LKDVFX, ctx = document.getElementById("pNN-canvas").getContext("2d");
    var clock = FX.bindClock("pNN", 54, function (t, f) { /* dessiner l'image f */ });
    window.__timelines["pNN"] = clock.tl;
  })();
</script>
```

## Les effets (`transitions.js`)

### 1. Flash solaire de coupe
`TR.solarFlash(ctx, f, { cut, pre = 2, post = 2, origin = [1440, 270], intensity = 1, color = FX.RGB.stone })` → enveloppe (0–1).
Blanchit l'image autour de la coupe : `pre` images avant `cut`, `post` images après (2 à 4 au total). Se pose en dernier, par-dessus l'image. Dans le film, la coupe sépare deux scènes : appeler l'effet dans **les deux** (sortante avec `cut = nombre d'images du plan`, entrante avec `cut = 0`), même origine et intensité.
Exemple (fin de P01, 89 images) : `TR.solarFlash(ctx, f, { cut: 89, pre: 2, post: 2, origin: [1880, 330] })` ; début de P02 : `TR.solarFlash(ctx, f, { cut: 0, pre: 2, post: 2, origin: [1880, 330] })`.
Plans : P01→P02, P26→P27, P39→P40.

### 2. Flou radial de chute
`TR.radialBlur(ctx, src, { amount = 0.06, origin = [960, 540], samples = 10, shake = 0, frame, seed = 3 })`.
Dessine `src` (canevas ou image) flouté en zoom autour d'`origin`, avec une vibration à graine de `shake` px (dépend de `frame`, donc reproductible).
Exemple (P03, chute qui s'accélère) : `TR.radialBlur(ctx, plaque, { amount: 0.12 * FX.ease.inQuad(f / 53), shake: 2 + 6 * f / 53, frame: f })`.
Plans : P02→P03, P03, P05.

### 3. Traversée de nuage
`TR.cloudPass(ctx, p, { clouds, hole = false, origin = [960, 540], density = 1, seed = 404 })` → blanchiment (0–1).
`p` ∈ [0, 1] : les nappes arrivent sur la caméra, blanchiment au milieu, puis avec `hole: true` une couche se déchire en trouée autour d'`origin` (le fond redevient visible à travers). Joué avec `p` décroissant, c'est la remontée (P52). `clouds` = `FX.Plates.shared("clouds", 404)` pour partager les textures.
Exemple (P03→P04, sur les 20 dernières images de P03 et tout P04) : dessiner le fond (stratosphère puis ville quand le blanchiment est fort), puis `TR.cloudPass(ctx, p, { clouds, hole: true, origin: [960, 540] })`.
Plans : P03→P04, P04, P52.

### 4. Traversée de vitre
`TR.glassPass(ctx, outC, inC, p, { rect = [x, y, w, h], pass = 0.62, drops = 140, seed = 6, warm = [255,214,160], intensity = 1 })`.
`outC` = l'image vue de dehors (la fenêtre occupe `rect`), `inC` = l'intérieur. Jusqu'à `p = pass` on plonge vers la fenêtre (zoom exponentiel, flou de zoom, l'intérieur visible dans la fenêtre derrière un reflet et des gouttes) ; au passage, éclat chaud ; après, l'intérieur se pose (léger recadrage) pendant que les gouttes grossissent, se floutent et s'effacent.
Exemple (fin de P05 → début de P06) : `TR.glassPass(ctx, plaqueVille, plaqueLea, p, { rect: [938, 526, 44, 28] })`.
Plans : P05→P06 (la fenêtre de Léa, drop 1 à 5,41 s : mettre `pass` sur l'image 325).

### 5. Éclat d'objectif
`TR.lensFlare(ctx, { sun = [1498, 238], intensity = 1, color = [250,236,210], ghosts })`.
Voile autour du soleil, perte de contraste légère et cinq petites taches sur l'axe soleil → centre (sauge, crème, bleu pâle). Volontairement sobre : pas d'étoile, pas d'anneau arc-en-ciel.
Exemple (P01, le soleil perce) : `TR.lensFlare(ctx, { sun: [1880, 330], intensity: 0.2 + 0.8 * FX.smooth(10, 70, f) })`.
Plans : P01, P27 (lever sur les Tre Cime), P40, P43 si le soleil est dans le cadre.

### 6. Étincelle qui monte
`TR.ember(ctx, t, { origin = [960, 929], count = 46, span = 1.6, seed = 47, heroStart = 0.2, heroDuration = 1.3, rise = 864, color = [255,190,110], intensity = 1 })` → position `[x, y]` de l'étincelle maîtresse (ou `null`).
Gerbe de particules précalculées (naissance, vie, vitesse, balancement) et une étincelle maîtresse qui monte en ralentissant, avec traînée. La position retournée sert à faire suivre la caméra (voir la démonstration : bascule vers le ciel).
Exemple (P47 → P50) : `var hero = TR.ember(ctx, t, { origin: [980, 900], heroStart: 0.3, rise: 900 });`.
Plans : P47 (feu), raccord vers P50 (le ciel).

### 7. Remontée accélérée
`TR.ascent(ctx, stages, p, { accel = 2.2, blur = 0.05, samples = 9, origin })` → progression accélérée `u`.
`stages = [{ from, to, fadeIn, draw(c, u, local) }]` : chaque étage dessine sa plaque dans un tampon (zoom arrière, nuage…), `u = p^accel`, puis le tampon est flouté radialement en proportion de la vitesse.
Exemple : `compositions/p52.html` (ville → nuage → stratosphère, `accel: 1.8, blur: 0.07`).
Plans : P52.

### D. Logo fondu dans le halo du limbe
`TR.limbHalo(ctx, f, { cx = 1650, cy = 2820, R = 2600, angle = -104, size = 300, intensity = 1, appear = [8, 34], dissolve = [46, 80] })` → visibilité (0–1).
Le vrai logo (chemins de `traces.js`), flouté (≥ 6 px), écrasé dans l'épaisseur de l'atmosphère, masqué par l'anneau lumineux du limbe, puis dissous par un bruit granuleux. Jamais net ; invisible avant l'image 8 et après l'image 80.
Scène prête : `compositions/p01-halo.html` (calque transparent, 90 images), réglages `HALO` (cercle du limbe d'img01, angle, taille, intensité) et `MOTION` (doit reprendre la poussée et le roulis de p01).
Plans : P01.

## Plaques et final

- `plates.js` : `FX.Plates.shared(nom, graine)` construit une plaque une fois par page : `city` (img05 de remplacement), `clouds`, `strato` (img03), `limb` (img01), `ridges`, `campfire`, `room` (démonstrations).
- `earth.js` + `earth-data.js` : Terre de nuit (projection orthographique, contours Natural Earth 1:110m, lumières semées). `tools/bake-earth.mjs` régénère `earth-data.js`.
- `traces.js` : simulation des 2 600 tracés et géométrie du logo (`NET_FRAME = 104`). `finale.js` : rendu commun de P53–P54 (`FX.Finale.create(canvas).render(F)`, F = 0…223).

## Tests

- `node tests/logo-sync.mjs` : la géométrie du logo dans `traces.js` est identique à `public/assets/logo-mark.svg`.
- `node tests/net-frame.mjs` : le logo n'est net qu'à partir de F = 104 (image 3480).
