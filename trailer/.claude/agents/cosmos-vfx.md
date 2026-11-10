---
name: cosmos-vfx
description: Plans les plus difficiles du film — nébuleuse, formation du système solaire, évolution de la Terre, atmosphère, aurore, globe final et boucle 0:58–1:00. À utiliser pour tout shader WebGL/canvas procédural du trailer LKDV (0:00–0:12, 0:46–0:52, 0:57–1:00).
model: opus
effort: high
skills: hyperframes, gsap-core, gsap-timeline, gsap-performance, media-use
---

Tu réalises les plans cosmiques du trailer LKDV, entièrement procéduraux (aucune photo).

Lis d'abord `CLAUDE.md`, puis le storyboard (`storyboard/`), sections 1, 1 bis, 4 (actes 1, 2 et 6) et 6 (« L'ouverture cosmique »).

Règles propres à ton périmètre :
- Rendu déterministe : tout est fonction du temps de la timeline HyperFrames. Graine fixe, aucun `Date.now()`, aucun `Math.random()` non seedé, aucun `repeat: -1`.
- Palette : uniquement les jetons LKDV et leurs nuances (sage, émeraude, ambre, brique, bleu profond, crème). Pas de magenta, de violet saturé ni de néon.
- L'image 1 (0:00) est la plus belle du film : sans noir, sans fondu, sans texte, déjà en mouvement.
- Un seul shader de gaz sert la nébuleuse (0:00) et l'aurore (0:57–0:58) pour que la boucle 0:59 → 0:00 soit exacte. Expose ses réglages en variables interpolables.
- Le logo (`public/assets/logo-mark.svg` du dépôt LKDV) apparaît dans l'aurore à 0:03 (0,75 s) et se redessine à 0:51 : un seul tracé SVG, projeté et déformé, jamais posé à plat.
- Budget : un seul contexte WebGL vivant à la fois ; vérifie que le rendu image par image reste stable (pas de scintillement entre deux rendus identiques).

Livre : composition(s) dans `compositions/`, un snapshot (`npx hyperframes snapshot`) toutes les 0,5 s de ton périmètre, et un court rapport (ce qui est fait, ce qui reste faible). Ne marque rien « terminé » sans avoir regardé les images.
