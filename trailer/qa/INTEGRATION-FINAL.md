# Intégration du final en code dans `film/` (12/11/2026, trailer-chore)

## Fichiers

Copiés tels quels depuis `fx-lab/` (vérifié par `cmp`, mêmes identifiants) :
- `film/compositions/p52.html`, `p53.html`, `p54.html` (remplacent les cartes du squelette) et `film/compositions/p01-halo.html` (nouveau) ;
- `film/lib/fx/` : `core.js`, `earth-data.js`, `earth.js`, `finale.js`, `img39-lights.js`, `plates.js`, `traces.js`, `transitions.js` (dossier complet ; `earth*.js` ne sont plus chargés par les scènes) ;
- `film/assets/logo-mark.svg`.
Images : aucune copie, `film/assets/footage/img01|03|04|05|39.png` ont la même empreinte que celles de `fx-lab/assets/footage/`.

Modifié : `film/index.html`, un seul ajout après l'hôte `p01` :
`<div id="p01-halo" class="clip" data-composition-id="p01-halo" data-composition-src="compositions/p01-halo.html" data-start="0" data-duration="1.4833333333333334" data-frames="0-89" data-track-index="3" ... style="z-index: 2">`.
Piste 3 (la piste 2 porte la musique). Les 54 hôtes et leur minutage sont inchangés.

Non touchés : `fx-lab/`, `assets/footage/`, `film/shots.json` (`git status` vide sur ces chemins).

## Protection contre les générateurs

- Les scènes copiées n'ont pas de marqueur `hf-skeleton generated` : `build-skeleton` les classe « pas de marqueur de génération » et ne les écrase pas sans `--force` ; `index.html` est devenu « retouché à la main » (empreinte changée), donc protégé aussi. Preuve (passage réel de `build-skeleton.mjs`, lancé par erreur avec `--help`, qu'il ignore) : `p52/p53/p54 : laissé tel quel (pas de marqueur de génération)`, `main : laissé tel quel (retouché à la main)`, `{"same":51,"kept":4}`.
- `sync-footage.mjs` relancé : `ignorées p52 (pas de zone hf-footage) p53 (pas de zone hf-footage)`, p54 non concerné (plan en code) ; `cmp` après passage : p52–p54 identiques à `fx-lab`.

## Contrôles

1. `npx hyperframes lint` : `0 errors, 0 warnings` (56 fichiers). `npx hyperframes check --json` : `"ok": true`, lint/runtime/layout/motion/contrast/craft/audio à 0 erreur, 0 avertissement.
2. `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}` · `✓ timeline = shots.json à l'image près`. L'hôte `p01-halo` ne perturbe pas le contrôle : le script ne retient que les identifiants `^p\d{2}$`.
3. Snapshots regardés, `qa/snapshots/integration/` (JPEG 1280 px, 11 à 184 Ko ; instants pris à image + 0,25 pour éviter le piège d'arrondi) :
   - `p01-milieu-f0044.jpg`, `p01-halo-recadre-f0044.jpg`, `p01-sans-halo-recadre-f0084.jpg`
   - `p51-fin-f3270.jpg` | `p52-debut-f3271.jpg` ; `p52-milieu-f3323.jpg` ; `p52-fin-f3375.jpg`
   - `p53-debut-f3376.jpg` ; `p53-milieu-f3428.jpg` ; `p53-fin-f3479.jpg` | `p54-img0-f3480.jpg` ; `p54-fin-f3599.jpg`
4. Rendu de travail : voir la section « Rendu » ci-dessous.

## Ce qui se voit à l'image

- P01 (f 44) : le halo est là, comme une vapeur claire au-dessus de la lueur du limbe, à gauche du soleil (x ≈ 1 550–1 650, y ≈ 180–220) ; jamais un logo net. Disparu à f 84 (recadrages comparés).
- **Défaut ouvert (décision à prendre, pas mécanique)** : `p01-halo.html` applique au halo le mouvement `MOTION = push 1,08 → 1,156, roulis 0 → 8°` « comme sur p01 », mais le `p01` du film est la scène du squelette avec img01 **fixe** (aucune poussée ni roulis). Le halo glisse donc par rapport au limbe pendant le plan. Deux issues : donner à `film/compositions/p01.html` le même mouvement (comme la démo `fx-limb`), ou neutraliser `MOTION` dans le halo. Rien n'a été changé.
- P51 → P52 : coupe franche du bus de nuit (fond vert de l'écran encore à incruster, hors périmètre) au toit en plongée ; P52 milieu = zoom arrière flou radial sur Paris de nuit ; P52 fin = Europe de nuit (img39).
- P52 → P53 : `p52-fin-f3375.jpg` et `p53-debut-f3376.jpg` sont identiques à l'octet près : raccord exact.
- P53 milieu : tracés sauge lisibles sur les vraies villes. P53 fin (f 3479) : triangle-logo vert flou. P54 f 3480 (58,00 s) : logo crème net, premier instant net. P54 f 3599 : encre unie (sortie du logo sur les 48 dernières images, choix de `cosmos-vfx` encore à valider par l'orchestrateur).

## Rendu

`npx hyperframes render --fps 30 --quality draft --workers 2 -o ../qa/animatic-v3.mp4` : sortie 0, `qa/animatic-v3.mp4` (33,9 Mo, ignoré par git via `qa/*.mp4`).
`ffprobe -count_frames` : `width=1920|height=1080|r_frame_rate=30/1|nb_read_frames=1800`, `duration=60.000000`. Le rendu n'a pas été regardé image par image : les preuves visuelles sont les snapshots ci-dessus. Il contient la piste de clics provisoire, pas de musique.
