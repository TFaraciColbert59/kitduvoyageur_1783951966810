# UI-LIB — bibliothèque d'interface du trailer (pour les agents de scène)

Fichiers : `assets/lkdv-tokens.css` (jetons + polices), `assets/lkdv-ui.css` (composants `lk-`), `assets/js/lkdv-ui.js` (`LKDV.ui`). Galerie vivante : `qa/tmp/ui-lib/gallery/compositions/gallery.html` (16:9) et `gallery-v/` (9:16), régénérées par `node qa/tmp/ui-lib/make-gallery.mjs`. Les formes reproduisent l'app (Compas, `Island`, `Chip`, `Spinner`, `FloatingLiquidTabBar`) ; le contenu reste sans phrases : pictos, avatars en initiales, anneaux, barres, quelques chiffres.

## 0. Règles qui valent pour toute scène

- **Aucune couleur littérale** dans tes scènes : `var(--lkv-*)`, `var(--cp-*)`, `var(--sage-*)`, `var(--ink-*)`, `var(--lk-stone)`, `var(--lk-paper)`. **`--lk-paper` (#FBFAF6) est la seule valeur hors dépôt** (storyboard) ; `--lk-stone` (#F5F2EC) existe dans le dépôt sous `--cv2-light-page`.
- **Au plus 6 panneaux à `backdrop-filter` visibles à la fois** par scène (`.lk-glass`, `.lk-sheet-glass`, `.lk-tabbar`). Les petites surfaces (`lk-flat`, `lk-prov`, `lk-avatar`, `lk-item`, `lk-chip`) n'ont pas de flou : en abuser est sans risque.
- **Ne mets jamais `opacity` < 1, `filter`, `clip-path` ou `mask` sur un ANCÊTRE d'un panneau de verre** : le verre ne voit plus le décor (il devient plat). Anime l'opacité du panneau lui-même (`springIn` / `popOut` sur `#mon-panneau`), pas celle de son conteneur. `transform` sur un ancêtre est sans danger. Exception tolérée : fondu de groupe ≤ 0,13 s (la galerie le fait à 2,9 s).
- **N'anime jamais `.lk-phone`** (il porte l'échelle). Anime ses enfants. Pas de `transform` CSS sur un élément que GSAP anime ; départs d'état dans `fromTo`, jamais `from`, jamais `repeat: -1`.
- **Taille de texte** : rien sous 18 unités logiques (= 28 px réels en 16:9, plancher du `check`). Chiffres : `class="lk-num"` (Manrope 800, chiffres tabulaires). Capitales techniques : `lk-mono` (Plex Mono).
- **Aucun libellé** : si tu as besoin d'un « titre », utilise `lk-row__line` (barre grise). Les seuls mots du film : ceux de 0:04 et du logo.
- **Plein soleil** : ajoute `class="lk-outdoor"` sur un conteneur (la colonne par exemple) posé au-dessus de neige ou de ciel clair : verre 0,9 / 30 px.

## 1. Colonne, échelle, bandes

```html
<div class="lk-col" id="ui-a3-col"><div class="lk-phone"> … composants … </div></div>
<script> var m = LKDV.ui.mountColumn(document.querySelector('[data-composition-id="ui-a3"]')); </script>
```
- `.lk-phone` = surface logique de **390 × 693** (un téléphone). `mountColumn(root[, {el, x}])` lit `LKDV.format(root)`, place `.lk-col` (16:9 : 608 × 1080 à x = 656 ; 9:16 : échelle 1080/608, soit 1080 × 1918 à x = 0) et pose `--lk-s` (1,559 en 16:9, 2,769 en 9:16), `--lk-band-top`, `--lk-band-bottom`. Retour `{col, phone, s, vertical}`. Tu peux écrire le `.lk-col` à la main (recommandé : éditable) ou laisser `mountColumn` le créer.
- Bande utile (logique) : 16:9 de 35 à 658 ; **9:16 de 61 à 480** (rien d'essentiel au-dessus de 168 px ni sous 1330 px réels). Place l'essentiel dans `.lk-safe` (`top/bottom` calés) ou avec `top: var(--lk-band-top)` ; le tiroir et la capsule du bas peuvent déborder sous la bande en 9:16 (décor interactif, non essentiel).
- Tous les composants s'écrivent aux tailles iOS de l'app ; ils paraissent ×1,56 (16:9) ou ×2,77 (9:16).
- Utilitaires : `lk-abs`, `lk-fill`, `lk-safe`, `lk-stack-v`, `lk-stack-h`, `lk-center`, `lk-num`, `lk-mono`.

## 2. Pictos (méthode unique : masque CSS + `currentColor`)

```html
<span class="lk-ic" data-ic="tent"></span>      <!-- 24 -->  <span class="lk-ic lk-ic--l" data-ic="van"></span> <!-- s 18 · m 24 · l 32 · xl 44 ; ou style="--lk-ic:36px" -->
```
Couleur = `color` du parent. 160 pictos de l'app (`assets/icons/sf/`) + 15 ajoutés (`assets/icons/extra/` : van, snowflake, camera, sneaker, watch, wheelchair, run, feather, bookmark-fill, play-fill, pause-fill, satellite, hot-spring, paddle, bottle) + `logo` (logo-mark.svg). Le nom doit exister dans `lkdv-ui.css` (`[data-ic="…"]`), sinon le picto est invisible. Régénération : `node qa/tmp/ui-lib/gen-icons.mjs <racine du projet>`. Ne pas utiliser `<img>` ni SVG inline pour ces pictos.

## 3. Composants (balisage minimal)

**Verre** : `class="lk-glass"` (+ `border-radius`), tiroir `lk-sheet-glass`, surface plate `lk-flat`.

**Barre de saisie IA** `lk-ask` (hauteur 60) :
```html
<div class="lk-ask lk-glass"><span class="lk-avatar">L</span><div class="lk-ask__txt"><span id="t"></span><i class="lk-caret" id="c"></i></div><button class="lk-send" id="send"><span class="lk-ic" data-ic="arrow-right"></span></button></div>
```
Texte tapé par `typeText`. `lk-send--s` (40), `.is-pressed` (état statique). **Spinner** : `<span class="lk-spinner"></span>` (`--sm`, `--lg`, `--inverted` sur îlot, `--accent`), tourné par `LKDV.ui.spin`.

**Pastille-picto** `lk-pill` (+ `--round`) : `<span class="lk-pill lk-glass"><span class="lk-ic" data-ic="calendar"></span><b class="lk-num">10</b></span>`.

**Provenance** (couleurs et pictos fixes) : `lk-prov lk-prov--pret|occasion|location|achat` avec picto `handshake | recycle | calendar | tag` ; tailles `--s`, défaut 40, `--l`. Raccourci : `LKDV.ui.provHTML('pret')`. Teintes : sage `--cp-good`, ambre `--cp-warn`, bleu `--cp-info`, Stone dérivé de `--stone-*`.

**Avatar** `lk-avatar` (`--s` 36, 44, `--l` 68) : `<span class="lk-avatar">L</span>` ; variantes `--on` (sage allumé), `--empty` (cercle en pointillés), `--ink` (sur îlot sombre). Groupe qui se chevauche : `<span class="lk-avatars">…</span>`.

**Îlot** `lk-island` : `<div class="lk-island"><span class="lk-avatar lk-avatar--on lk-avatar--s">H</span><span class="lk-ic" data-ic="bottle"></span><span class="lk-island__sp"></span><b class="lk-num">3</b></div>`. Avec progression : classe `lk-island--prog` et un `<div class="lk-bar"><i></i></div>` en dernier enfant.

**Carte / tiroir / onglets** : `lk-card lk-glass` ; `lk-sheet lk-sheet-glass lk-sheet--low|mid|high` (300 / 440 / 620, ou `style="--lk-sheet-h:330px"`) avec `<i class="lk-sheet__grab"></i>` ; `lk-seg` (`<span class="is-on">picto</span>` …).

**Ligne** `lk-row` : `<div class="lk-row"><span class="lk-row__tile"><span class="lk-ic lk-ic--s" data-ic="route"></span></span><i class="lk-row__line" style="--w:52%"></i><b class="lk-num lk-row__val">1 322</b><span class="lk-ic lk-row__chev" data-ic="chevron-right"></span></div>`.

**Pastille** `lk-chip` (`data-tone` good | warn | bad | soft | info ; défaut neutre) : `<span class="lk-chip" data-tone="good"><span class="lk-ic lk-ic--s" data-ic="check"></span><span>6/38</span></span>`.

**Barre** `lk-bar` (`--thick`, `data-tone` warn | bad) : `<div class="lk-bar"><i id="b"></i></div>` + `barTo`. **Jauge de compétence** `lk-skill` : `<div class="lk-skill"><span class="lk-skill__ic"><span class="lk-ic lk-ic--s" data-ic="compass"></span></span><div class="lk-bar lk-bar--thick"><i></i></div><b class="lk-num lk-skill__plus">+25</b></div>`.

**Anneau de confiance** `lk-ring` (`--big` 170, taille libre `--lk-ring`) :
```html
<div class="lk-ring"><svg viewBox="0 0 100 100"><circle class="lk-ring__bg" cx="50" cy="50" r="44"/><circle class="lk-ring__fg" id="r" cx="50" cy="50" r="44" pathLength="100" transform="rotate(-90 50 50)"/></svg>
<div class="lk-ring__ctr"><span class="lk-avatar lk-avatar--l">M</span></div><b class="lk-num lk-ring__num lk-flat">96</b></div>
```
Variante sans avatar : `lk-ring lk-ring--num` (chiffre au centre). `ringTo(tl, "#r", 0, 0.96, at, dur)`.

**Coche** `lk-check` (`--l`, `--soft`) ; **double coche** `lk-check lk-check--double` avec picto `check-check`. **Pastille d'objet connecté** `lk-obj lk-glass` : picto `satellite` seul, picto `watch` + `<b class="lk-num">14,2</b>`, picto `battery` + `<span class="lk-bar"><i></i></span>` (jauge 82 %). **Onde** `<span class="lk-ping"></span>` (+ `ping`). **Étape cochée** `lk-tick` : pastille de verre avec picto et `<span class="lk-check">` en coin (pile de l'acte 2).

**Capsule de navigation** `lk-tabbar` : `<div class="lk-tabbar"><i class="lk-tabbar__lens"></i><span class="lk-tab is-active"><span class="lk-ic" data-ic="home"></span></span> …` avec les 5 onglets réels `home`, `compass`, `users`, `send`, `user`. **Capsule d'étapes** `lk-steps lk-glass` : `<i class="lk-steps__lens"></i>` puis 5 `<span class="lk-step">` : `map`, `users`, `ticket`, `shield-check`, `backpack` (Où, Nous, Résa, Verdict, Kit). Lentille : `lensTo(tl, lens, de, vers, at, dur)`.

**Réticule** `lk-reticle` (plein cadre, hors colonne ; `--lk-ret-w/h`, `--lk-ret-fs` 28 px réels) : 4 `<i class="lk-reticle__c lk-reticle__c--tl|tr|bl|br">` + `<span class="lk-reticle__lbl lk-reticle__lbl--t">408 M</span>`. Coins 1 px blanc 60 %, chiffres Plex Mono en capitales.

**Téléphone générique** `lk-device` (`--lk-dev-w/h`) : `<div class="lk-device"><div class="lk-device__screen"><i class="lk-device__isl"></i> …contenu… </div></div>` ; aucune marque. Hors colonne : à échelle réelle, dimensionne-le à la main.

**Carnet** : page `lk-page` (`--lk-pg-w/h`) avec `lk-page__photo` (`--x --y --w --h --ph`), lignes manuscrites `lk-scrib` (+ `--b`, `--c` ; `--x --y --w`) et filets `lk-rule` ; effet d'écriture `write(tl, el, at, dur)`. Couverture : `<div class="lk-cover"><i class="lk-cover__logo"></i></div>` (logo en creux par ombres teintées). Aucune ligne n'est du texte lisible.

**Objets du kit** : `lk-item` (fantôme en pointillés ; `--l` 84) : `<i class="lk-item"><span class="lk-ic" data-ic="tent"></span><b class="lk-item__lit"><span class="lk-ic" data-ic="tent"></span></b><span class="lk-prov lk-prov--pret">…</span></i>` ; allumé = `lightUp` (ou classe `is-on` en statique). 12 objets : `LKDV.ui.ITEMS12` (tent, backpack, sneaker, shirt, bed-double, flame, battery, compass, droplet, thermometer, map, watch). Grille : `<div class="lk-grid38" id="g"></div>` puis `var cells = LKDV.ui.fillGrid38(document.getElementById('g'))` (38 cellules, provenance tirée de `LKDV.hash`, ou `{kinds:[…38 clés]}` pour la fixer). Points « 8 sur 10 » : `<span class="lk-dots"><i class="is-on"></i>…</span>`.

## 4. Aides de mouvement `LKDV.ui` (pures, `tl` = timeline de la scène, temps `at` en secondes locales)

| Aide | Effet |
| --- | --- |
| `springIn(tl, cible, at, {dur 0.25, zeta 0.8, from 0.86, x, y, origin})` | entrée ressort : scale 0,86 → 1 (ease ressort fermé), opacité 0 → 1 en 0,12 s ; la cible est invisible avant `at` |
| `popOut(tl, cible, at, {dur 0.13, to 0.92})` | sortie (≈ 50 % de l'entrée) |
| `press(tl, bouton, at)` | bouton d'envoi : enfoncé en 0,08 s puis ressort |
| `typeText(tl, el, texte, at, cps=40)` → temps de fin | frappe déterministe (un caractère = 1/40 s) |
| `caret(tl, el, at, dur)` | clignotement fini du curseur |
| `countTo(tl, el, de, vers, at, dur, format)` | compteur ; formats `LKDV.ui.fmt.int / thousands (1 322) / dec1 (14,2) / plus (+25) / pct` |
| `ringTo(tl, cercle, de, vers, at, dur)` | anneau (fractions 0–1) |
| `barTo(tl, i, de, vers, at, dur)` | barre par `clip-path` |
| `spin(tl, spinner, at, dur, tours)` | rotation du Spinner, linéaire, finie |
| `lensTo(tl, lentille, de, vers, at, dur)` | lentille des capsules (indices 0–4) |
| `ping(tl, el, at, dur)` | onde unique de `lk-ping` |
| `write(tl, ligne, at, dur)` | écriture d'une ligne `lk-scrib` |
| `lightUp(tl, cellules, at, {dur, stagger})` | allume des objets et leurs pastilles |
| `provHTML`, `itemHTML`, `fillGrid38`, `springEase(zeta, dur)` | générateurs et ease ressort |

Les cibles sont des éléments ou des sélecteurs (`"#mon-id"`, uniques sur la page assemblée : préfixe tes ids par la scène). Une même cible peut recevoir plusieurs aides ; seul le premier tween fixe l'état de départ au montage. Les aides de texte (`typeText`, `countTo`) passent par `onUpdate` : vérifié en lecture avant, arrière et par sauts (snapshots à 3,9 s, 1 s puis 0,5 s).

## 5. Ce qu'il ne faut pas faire

- Pas de couleur en dur, pas de noir pur, pas d'ombre sans teinte encre (utilise `--cp-shadow`, `--cp-pg-sh`, `--cp-island-shadow`).
- Pas de texte nu sur une image : toujours sur du verre ou une pastille.
- Pas de 7e panneau flouté ; pas de `opacity` sur le parent d'un verre ; pas d'animation de `.lk-phone`.
- Pas de phrase, pas de libellé : une barre `lk-row__line` tient lieu de titre.
- Pas de picto hors liste (ni `<img>`), pas de changement de couleur ou de picto d'une provenance.
- Pas de `Date.now()`, `Math.random()`, `repeat: -1`, `from()`.

## 6. Écarts au design system (non résolus)

- **Paper `#FBFAF6`** : absent du dépôt (valeur du storyboard) ; **Stone `#F5F2EC`** : dépôt = `--cv2-light-page` seulement.
- Les pastilles `info` et `stone` n'existent pas dans `.cp-chip` ni dans `Chip.tsx` : tons dérivés des jetons (`--lkv-info`, `--stone-300`) à alpha comparable.
- Le Spinner de l'app prend `--glass-label` (non recopié) : remplacé par `--cp-ink` (ink-900).
- La capsule du bas de l'app est sombre par défaut (`rgba(23,29,26,.76)`) ; elle suit ici la consigne (verre clair `blur(24px) saturate(1.5)`, repli `app-tint.css` 0,55).
- Tailles : 18 unités logiques minimum (28 px réels) au lieu des 13/17 iOS, par exigence de lisibilité ; les composants sont donc un peu plus grands que dans l'app.
- Contraste mesuré par `check` : le texte encre de `lk-ask` sur verre à 0,6 devant un ciel moyen tombe à 4,49:1 (limite 4,5) ; sur fond clair ou avec `lk-outdoor` il passe.
