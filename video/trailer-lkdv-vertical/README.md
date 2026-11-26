# Trailer LKDV vertical (9:16) — « Une phrase suffit »

Version TikTok / Reels / Shorts du trailer `video/trailer-lkdv` : 37 s, 1080 × 1920, 30 i/s, **recomposée scène par scène** (pas un 16:9 dans un bandeau). Même histoire, mêmes sources, mêmes règles (`video/MOTION.md`, `video/brand.md`).

| Film | Scène | Ce qui se passe |
| --- | --- | --- |
| 0,00–3,25 | `vmontage` | cartes photo sur le temps, « Là où la carte se termine. », le paysage du Compas devient le monde |
| 3,25–4,90 | `vquestions` | « Mais avant de partir… », six questions s'empilent puis sont balayées |
| 4,90–7,35 | `vcompas` | la phrase se tape, clic « Préparer mon aventure » à 6,92 ; la musique s'ouvre à 7,00 |
| 7,25–12,62 | `vcarte` | vol satellite vertical vers Gavarnie, tracé D → 1 → 2 → A, « D+ 2 750 m · 44 km » |
| 12,62–20,12 | `vkit3d` | sac LKDV ONE 45 L en 3D (vrais `.glb`), Forêt → Sauge → Pierre, modules M04 et M13 |
| 20,12–25,74 | `vterrain` | téléphone : randonnée 42:05, refuges, hors ligne |
| 25,74–31,37 | `vpartage` | carnet, club, sortie : « Raconte. Rejoins. Repars. » |
| 31,37–37,00 | `vfin` | « Une phrase. Tout le voyage. », badge LKDV (impact à 33,25), lekitduvoyageur.fr |

- Zone sûre réseaux : aucun texte sous y = 1420 ni dans les 120 px de droite.
- Musique : « Ambient Uplift » (Soundrider/Dope, CC BY 3.0) lue à partir de 19,265 s — **créditer dans la description**.
- Carte : `assets/map/gavarnie-v.mp4`, cuite avec une copie verticale de `bake-basemap.mjs` (même centre, zoom 11,1 ; positions des étapes projetées en Web Mercator).
- Rendu : `npx hyperframes@0.9.56 render --output renders/trailer-lkdv-9x16.mp4 --quality delivery --workers 3`, puis normalisation à −14 LUFS (`loudnorm` en deux passes, image copiée).
- Teaser 15 s : extrait du rendu vertical (accroche, plongée sur la carte, sac 3D, badge), voir `renders/`.
