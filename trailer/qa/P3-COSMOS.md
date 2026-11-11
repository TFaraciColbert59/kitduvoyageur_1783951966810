# P3 — cosmos-vfx : P52, P53, P54, halo du logo, transitions

Projet d'essai : `trailer/fx-lab/` (même arborescence relative que `trailer/film/` : `compositions/`, `lib/fx/`, `assets/`).
Rien n'a été écrit dans `trailer/film/`. Aucune image de Tony n'est présente : tout est en code, avec un emplacement prêt pour chaque plaque.
Rédigé au fur et à mesure ; ce qui n'est pas fait est noté « reporté ».

## État des contrôles (fx-lab, bobine complète de 17,483 s = 1 049 images)

- `npx hyperframes lint` : 0 erreur, 0 avertissement (7 fichiers).
- `npx hyperframes check --json` : `ok: true`, 0 erreur. Un seul avertissement gardé : `film_silent` (la bobine d'essai n'a pas de son ; le son appartient à `sound-designer`).
- `node tests/logo-sync.mjs` : la géométrie du logo codée dans `lib/fx/traces.js` est identique à `public/assets/logo-mark.svg` et à la copie `fx-lab/assets/logo-mark.svg`.
- `node tests/net-frame.mjs` : OK, net pour la première fois à F = 104 (voir P53–P54).

## 1. P53 et P54 — le final (terminé)

Fichiers : `fx-lab/compositions/p53.html` (104 images, `data-duration` 1,7333 s), `fx-lab/compositions/p54.html` (120 images, 2,000 s), `lib/fx/finale.js` (rendu commun), `lib/fx/traces.js` (simulation des tracés et géométrie du logo), `lib/fx/earth.js` + `lib/fx/earth-data.js` (Terre de nuit en code), `lib/fx/core.js` (graine mulberry32, bruit, courbes, horloge de scène).

- Une seule séquence F = 0…223 pour les deux plans : P53 dessine F 0–103, P54 F 104–223. La coupe est donc continue par construction.
- 2 600 tracés sauge, un par aventure : itinéraires de 20 points, marche à cap lissé avec lacets (pas de lignes droites), ancrés sur 96 villes et 15 massifs (Dolomites, Alpes, Pyrénées, Atlas, Corse…). Allumage F 0–40 (pointes crème), décollage et convergence F 26–100, tressage (oscillations qui se croisent) dont l'amplitude ne s'annule qu'à F 104.
- Instant net : F 104 = image 0 de P54 = image 3480 du film (58,00 s). Avant : tressage résiduel ≥ 0,32 unité de viewBox (≈ 4 px d'écart moyen) et flou ≥ 1,6 px. À F 104 : écart 0, flou 0, et le vrai logo (chemins SVG recopiés, contrôlés par test) est tracé net en crème, avec un bref éclair d'impact crème. Ensuite : fixe, recul de 5,5 % (sortie douce), la Terre et le halo sortent en fondu sur les 48 dernières images (0,8 s, comme la musique), le logo sur les 24 dernières ; la dernière image est l'encre et le limbe éteint.
- Mesure sur la simulation (`node tests/net-frame.mjs`) :
  F 103 (P53 dernière image) écart moyen 4,11 px, flou 1,60 px · F 104 (P54 image 0) 0,00 px, 0,00 px · F 105, 106 : 0,00 px.
- Mesure sur le rendu (variance du laplacien dans la boîte du logo, images du MP4 de 329 images) : P53 F95–F103 entre 679 et 868 ; P54 image 0 = 1 050, image 1 = 1 095, image 2 = 1 015, image 5 = 1 190. Le saut de netteté tombe exactement sur l'image 209 du rendu (= 3480 du film).
- Piège rencontré : `snapshot --at 15.483333` (6 décimales) tombe juste avant le début de P54 dans la bobine et montre encore P53 ; avec `--at 15.4833334` ou dans le rendu, l'image 0 de P54 est bien nette. Dans le film le début de P54 est 58,0 exactement, sans ambiguïté.
- Plaque img39 : variable `PLATE` en tête de script de `p53.html` et `p54.html` ; renseignée (`"assets/footage/img39.png"`), la plaque remplace la Terre en code (poussée lente, recul, fondus identiques) et le chargement passe par `window.__hf.buildReady`.
- Couleurs : fond encre `#0B1F17` (jamais noir pur), tracés sauge éclaircie, pointes et logo crème `#FAF8F5`. Aucun texte.

Preuves (JPEG < 400 Ko, extraites du rendu) dans `trailer/qa/snapshots/p3/` :
`render-p53-debut-f3376.jpg`, `render-p53-milieu-f3428.jpg`, `render-p53-fin-f3479.jpg`, `render-p54-img0-net-f3480.jpg`, `render-p54-img1-f3481.jpg`, `render-p54-img2-f3482.jpg`, `render-p54-milieu-f3539.jpg`, `render-p54-fin-f3599.jpg`, et la planche recadrée `net-planche-3479-3482.jpg` (regardée : doux et tressé à 3479, net à 3480, 3481, 3482).

Faible : la Terre en code est lisible mais pas photoréaliste (contours Natural Earth 1:110m, lumières semées, nuages lunaires approximatifs qui ne suivent pas la projection) ; pendant la convergence (≈ F 50–80) les tracés forment une nappe lumineuse assez confuse au-dessus de l'Europe ; le logo net est un trait crème épais (le vrai logo à 1,6 unité de trait), sans texture de fils visible à l'intérieur.

## 2. P52 — la remontée accélérée (terminé)

Fichier : `fx-lab/compositions/p52.html` (105 images, 1,75 s), avec `lib/fx/plates.js` (plaques en code) et `lib/fx/transitions.js` (`ascent`, `cloudPass`).

- Ville à l'heure bleue vue en plongée (img05 de remplacement : îlots, toits de zinc, lucarnes, avenue en diagonale avec feux en filés, pluie, fenêtre de Léa au centre) → on s'arrache en zoom arrière → traversée du nuage à l'envers (la trouée se referme, blanchiment) → stratosphère (mer de nuages, horizon incliné de 10° qui se redresse) → le ciel noircit et le limbe de l'orbite apparaît à l'endroit exact où il est à la première image de P53 (raccord « Orbite »).
- Accélération : progression `p^1.8`, flou radial proportionnel à la vitesse.
- Plaques de Tony : objet `PLATES = { img05, img04, img03 }` en tête de script ; une valeur renseignée remplace la plaque en code (chargement via `buildReady`).
- Preuves : `render-p52-debut-f3271.jpg`, `render-p52-milieu-f3323.jpg`, `render-p52-fin-f3375.jpg` (regardées).

Faible : la ville reste un quadrillage visiblement procédural ; la mer de nuages en perspective a des stries ; à cause de l'accélération, la ville occupe près des deux tiers du plan et le nuage puis la stratosphère passent très vite (voulu, mais à juger avec la musique).

## 3. Rendu 60 i/s de p52 + p53 + p54 (terminé)

`npx hyperframes render --start 12 --end 17.483333333333334 --fps 60 --quality draft --workers 2 -o ../qa/p3-p52-p54.mp4` (dans `fx-lab/`) : 1 min 22 s, 6,5 Mo.
`ffprobe -count_frames` : `nb_read_frames=329`, `r_frame_rate=60/1`, 1920×1080, durée 5,483333 s (105 + 104 + 120). Fichier : `trailer/qa/p3-p52-p54.mp4` (ignoré par git).
Poids : par tranche de 66 images, 15 à 20 s de capture pour 2 workers, soit ≈ 0,3 s par image dans le pire cas (fin de P53, convergence). Ce n'est pas un profil JavaScript image par image : la mesure vient des traces `capture_chunk` du rendu.

## 4. Halo du logo pour P01 (terminé)

Fichiers : `fx-lab/compositions/p01-halo.html` (calque transparent, identifiant `p01-halo`, 89 images = images 0–88 du film, P02 commence à 89), fonction `TR.limbHalo` dans `lib/fx/transitions.js`. Démonstration dessous : `compositions/fx-limb.html` (limbe en code à la place d'img01, poussée + roulis de 8°, éclat d'objectif, flash solaire de sortie sur les images 87–88).

- Le vrai logo (mêmes chemins que P54), flouté à 6 px au moins, écrasé dans l'épaisseur de l'atmosphère, masqué par l'anneau lumineux du limbe, en addition. Apparition images 8–34, dissolution granuleuse images 46–80, rien après 80.
- Réglages en tête de script : `HALO = { cx, cy, R, angle, size, intensity, appear, dissolve }` (cercle du limbe d'img01 en px, angle sur le limbe, −90 = sommet) et `MOTION = { push, roll, origin }`, qui doit reprendre exactement la poussée et le roulis de la scène p01 du film.
- Preuves (regardées) : `halo-p01-planche-recadree.jpg` (images 20, 35, 55, 70 recadrées : à 35 le logo se devine dans le liseré, flou ; à 70 il a disparu), `halo-p01-img20.jpg`, `halo-p01-img35.jpg`, `halo-p01-img55.jpg`, `halo-p01-img70.jpg`, `halo-p01-img88.jpg` (flash de sortie).
- Réglage fait à l'œil en deux passes : première version trop lisible (contour presque net), deuxième invisible, troisième retenue (flou 6 px, opacité 0,55). À rejuger sur img01 réelle.

Faible : non vérifié sur img01 (absente) ; la poussée/roulis du calque doivent être recopiés à la main depuis p01, sinon le logo glisse sur le limbe.

## 5. Bibliothèque de transitions et `FX.md` (terminé)

`fx-lab/lib/fx/transitions.js` : `solarFlash`, `radialBlur`, `cloudPass`, `glassPass`, `lensFlare`, `ember`, `ascent`, `limbHalo`. Documentation (signature, paramètres, exemple d'appel, plans) : `fx-lab/FX.md`. Démonstration : `compositions/fx-demos.html` (7 × 90 images sur plaques factices en code).
Le catalogue (`npx hyperframes catalog --tag transition`) a été parcouru : ses transitions (`flash-through-white`, `cinematic-zoom`, `light-leak`…) sont des transitions de shader entre scènes de la racine ; ici il fallait des effets dans le plan, à la palette du film, paramétrables par origine et appelables des deux côtés d'une coupe : écrits à la main sur canevas.

Preuves (une image par effet, regardées) : `fx1-flash-avant-coupe.jpg`, `fx1-flash-apres-coupe.jpg`, `fx2-flou-radial-chute.jpg`, `fx3-nuage-blanchiment.jpg`, `fx3-nuage-trouee.jpg`, `fx4-vitre-approche.jpg`, `fx4-vitre-passage.jpg`, `fx5-eclat-objectif.jpg`, `fx6-etincelle.jpg`, `fx7-remontee.jpg`.
Défauts vus et corrigés : bords rectangulaires des nappes de nuage (vignettage des textures), plaques trop petites sous le nuage, gouttes de vitre trop vives, bande d'encre en haut de la démonstration d'étincelle.

Faible : les plaques factices (salon, crêtes, feu) sont grossières, elles ne servent qu'à montrer l'effet ; la traversée de vitre est chargée au moment du passage (taches lumineuses nombreuses) ; l'étincelle maîtresse est petite à l'échelle du cadre ; le flash solaire, pour une coupe entre deux scènes, doit être appelé dans les deux scènes (la démonstration P01 ne montre que la moitié sortante, l'entrante est montrée dans `fx1`).

## 6. Bobine d'essai `fx-lab/index.html` (terminé)

Hôte = identifiant de scène, comme dans le film : `fx-limb` + `p01-halo` (0–89), `fx-demos` (89–720), `p52` (720–825), `p53` (825–929), `p54` (929–1049). Total 1 049 images, 17,483 s.
`npx hyperframes keyframes --shot` sur la convergence : fait (`keyframes-shot-p53.jpg`), mais l'outil ne voit rien dans un canevas (« 0 elements », il montre l'état final) ; la vraie preuve de convergence est la planche `p53-convergence-planche.jpg` (P53 F0, 20, 40, 60, 80, 103, extraites du rendu, regardée).

## Pour l'intégration dans `film/`

Copier tels quels `fx-lab/lib/fx/*.js` vers `film/lib/fx/`, `fx-lab/compositions/{p52,p53,p54,p01-halo}.html` vers `film/compositions/`, et monter les hôtes `p52` (start 54,516667 s = 3271/60), `p53` (56,266667 s), `p54` (58,0 s), `p01-halo` (0 s, au-dessus de p01, `z-index` supérieur). Les démonstrations (`fx-limb`, `fx-demos`) restent dans fx-lab.

## Ce qui reste faible ou reporté

- Réalisme : la Terre de nuit, la ville, les nuages et la stratosphère sont des plaques de code, lisibles mais pas photographiques ; aucune n'a été jugée contre les vraies images (absentes).
- Lisibilité des tracés : bonne à l'allumage (F 10–40) et à l'approche (F 90–103), confuse au milieu (F 50–80 : nappe blanche, le triangle apparaît d'abord comme une masse).
- Poids : ≈ 0,3 s par image au pire en capture (2 workers, rendu draft) ; pas de profil JavaScript image par image.
- Fin de P54 : le logo s'éteint sur les 24 dernières images et la dernière image est l'encre (choix « fin propre », réglable par `endFadeFrames` dans `finale.js`) : à valider par l'orchestrateur, qui pourrait préférer le logo tenu jusqu'à la dernière image.
- Reporté : aucune intégration dans `film/` (consigne) ; pas de son.
