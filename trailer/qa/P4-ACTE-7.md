# P4 — Acte 7 (P33–P39), landscape-director

**Fichiers modifiés** : `film/compositions/p33.html` … `p39.html`. Les gabarits sont remplacés par la mécanique de p31/p32 : l'image de la zone hf-footage alimente un canvas piloté par `FX.bindClock`, la caméra est bornée par `fit()`, le flou de mouvement vient de sous-images (obturateur long aux coupes) et le tremblé est à graine. La zone hf-footage, les durées et les hôtes n'ont pas bougé.

**Contrôles** (après la dernière retouche) :
- `npx hyperframes lint` : `0 errors, 0 warnings`.
- `npx hyperframes check --json` : `ok: true`.
- `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}` ✓.

**Preuves** : `qa/snapshots/p4-acte-7/*.jpg`, soit 23 JPEG en 1280×720 (226 Ko au plus). Ils couvrent le début, le milieu et la fin de chaque plan, plus les coupes 2007/2011, 2061/2065, 2112/2116, 2190/2194, 2243/2247, 2295/2299, 2376/2380 et 2427/2431. Je les ai toutes regardées : aucun bord découvert, aucun trou, aucun aplat noir, aucun texte, et le vert de P36 est intact.

| Plan | Mouvement | Raccord d'entrée |
|---|---|---|
| P33 | Impact (secousse amortie, roulis -2° → 0), poussée S 1,30 → 1,46, caméra nerveuse. Sortie : bascule vers les pieds (cy +330, S +0,30). | Sur le filé gauche de P32 (cx 1150 → 910, obturateur ×4 qui retombe). |
| P34 | Secousse d'impact, puis ralenti (poussée lente S 1,30 → 1,38). Sortie : poussée qui accélère (S +0,45). | Bascule vers le bas de P33 qui s'amortit (cy 420 → 560). |
| P35 | FPV : poussée continue, foulées en cy, roulis ±1,2°. Sortie : filé droit vers le bras (cx +260, S +0,20, roulis +2°). | Poussée de P34 qui s'amortit (S 1,25 → 1,37). |
| P36 | Dérive vers le brassard, écran vert intact, caméra exposée dans `window.__lkdvCam.p36(f)`. Sortie : panoramique droit + poussée. | Filé droit de P35 qui s'amortit (cx 980 → 1240, roulis +2° → 0). |
| P37 | Rampe de vitesse : arrivée rapide, quasi figé à l'apex (images 12 à 42), puis plongée à l'atterrissage (cy +260, S +0,20). | Panoramique droit de P36 (cx 760 → 900). |
| P38 ★ | Drone qui recule : S 1,55 → 1,10 en montant vers la paroi. Malik (≈ 15 px) reste lisible au tiers bas, au centre (vérifié au zoom sur l'image 2337). Sortie : poussée + glissé droit le long de la piste. | Plongée de P37 qui s'amortit (cy 560 → 700). |
| P39 | La caméra prend Clara (cx 880 → 1060). Sortie : filé droit qui accélère (cx +220, S +0,25, roulis +2°) vers le drone latéral de P40, sans image noire. | Glissé droit de P38 (cx 760 → 880). |

**Points faibles et non vérifiés** :
- P38 : l'entrée et la sortie sont très floues (≈ 8 images chacune). La paroi n'est nette qu'au milieu du plan, et le sommet est rogné en haut par le cadrage.
- Coupes P32→P33, P34→P35 et P38→P39 : obturateur long, donc 2 ou 3 images très floues de part et d'autre. C'est voulu pour le drop, mais à juger en lecture.
- P39 : les pieds de Malik sont coupés en bas (cadrage resserré pour garder les têtes).
- La vitesse aux raccords est estimée, pas mesurée.
- Je n'ai fait ni lecture vidéo continue (snapshots seulement), ni 9:16, ni étalonnage (hors périmètre).
