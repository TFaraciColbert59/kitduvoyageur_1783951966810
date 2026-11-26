# Étape 5 — règles communes d'animation (« La Chaîne », 30 s, 1080 × 1920, 30 i/s)

Référence absolue : `bible-de-style.md` (§3 à §9) — avec ces ajustements validés par Tony le 18/11 :
1. Plan 09 : gros plan sur la pièce cousue **LKDV** à **10,994 s** (avant le clip du M13, qui la cache).
2. Mots longs autorisés entre **150 et 180 px** (NOVEMBRE, RENCONTRE., S'INSCRIRE, KIT SOUCHE :, SE TERMINE., 18 176 400).
3. « 18 176 400 » est suivi de « aventures *possibles* » (Garamond).
4. Bouteille à la mer : lancée depuis le Compas, visible dans la communauté du pays (pas dans un club) — garder le sens « une bouteille à la mer, trois réponses ».
5. « MER. » claque en grand, « une bouteille à la » en Garamond au-dessus.

## Le projet
- Dossier : `video/film-30s/` (projet HyperFrames). `index.html` est **figé** (ne le modifie pas) : il monte 22 scènes `compositions/s01.html … s22.html` et la musique `assets/audio/musique-30s.wav`.
- Chaque scène est un `<template>` avec `<div id="root" data-composition-id="sNN" data-width="1080" data-height="1920">` et UNE timeline GSAP en pause enregistrée par `window.__timelines["sNN"] = tl` (après tout chargement asynchrone, cf. 3D).
- **Avance de 0,2 s** : chaque scène (sauf s01) démarre **0,200 s avant** son temps de début de la bible et se superpose à la précédente (z-index croissant). Dans la scène, **le temps local 0,200 = le temps du film où le plan commence**. Les 6 premières images servent à la transition d'entrée (whip, zoom-through, match cut, iris…) PAR-DESSUS la fin du plan précédent. Le plan précédent joue jusqu'à son temps de fin (il peut préparer sa sortie : flou, accélération). Durées des hôtes : voir `index.html`.
- Pour un temps du film T, temps local = T − (début de la bible − 0,2). Exemple s06 (bible 5,172) : T = 5,819 → local 0,847.
- Sources de départ : `storyboard/src/pNN.html` (compositions statiques validées : réutilise leurs éléments, leurs styles et leurs images) et `storyboard/STORYBOARD.md` (ce qui bouge, transitions). Les assets du storyboard ont été copiés dans `assets/` : chemins `assets/fonts/…`, `assets/img/…`, `assets/3d/…`, `assets/sat/…`, `assets/plates/…`, `assets/avatars/…`, `assets/app/…`, `assets/logos/…`, `assets/photos/…`, `assets/lib/three-bundle.js`. Polices : Inter et EB Garamond sont fournies par HyperFrames (et `assets/fonts.css` est chargé par l'index).
- Musique et temps forts : `audio/temps-forts.json` ; grille : temps n = n × 0,646545 s.

## Contrat HyperFrames (non négociable)
Lis le skill `hyperframes` (outil Skill) et `/root/.claude/skills/hyperframes/references/motion.md`, `format.md`, `runtimes.md` (3D). Rien d'aléatoire (si tu veux du désordre, fais un générateur pseudo-aléatoire à graine fixe), pas d'horloge, pas de `requestAnimationFrame` libre ; `fromTo` plutôt que `from` ; jamais de `transform` CSS sur un élément que GSAP transforme (mets la transformation de base sur un parent) ; ids et classes **préfixés par l'id de la scène** (`s07-…`) pour éviter les collisions ; chemins `assets/...` sans `/` initial ; vidéos éventuelles : `<video class="clip" muted playsinline data-start data-duration>` temporisées elles-mêmes.
CLI depuis `video/film-30s` : `node /root/.claude/skills/hyperframes/scripts/plugin-cli.mjs check` · `snapshot --at 5.2,5.5 -o <dossier>` · `snapshot --range 5,7 --frames 12 -o <dossier>`.

## Direction (rappel)
Rien n'est figé ; caméra virtuelle 3D sur un wrapper (perspective 1 400 px) ; zooms ×3,2 en 6 images `expo.in` ; dézooms ×3 → ×1 en 5 images `expo.out` ; rotations ±4–8° (Z) / ±10–18° (X/Y) ; parallaxe 3 plans ; mots qui claquent (1,45 → 1 en 3 images, dépassement 0,93, retour en 4 images, 2 images de fantôme), une syllabe ou un mot par temps/croche, un seul mot plein écran ; transitions : whip 5 images (flou directionnel), match cut, zoom-through, explosion (8–24 éclats, graine fixe), implosion, iris, flash laiton 2 images. Secousse 4 images sur les impacts. Palette exacte de la bible ; accent unique laiton `#D0A070`.

## Contrôle (avant de rendre la main)
`check` à 0 erreur. Snapshots de chaque plan à : entrée (local 0,1 / 0,2 / 0,3), milieu, chaque temps fort, juste avant la fin ; et des rafales image par image sur chaque transition (`--range … --frames …`). LIS les images (outil Read). Corrige : texte coupé ou illisible (< 34 px utile), débordement hors zone sûre (contenu important dans x 60–1020, y 220–1500), fond nu, double exposition, élément figé, saut, désynchronisation avec la musique. Fichiers temporaires dans le scratchpad.
