# INCRUSTATION-1 — vraies captures dans les téléphones du film (ui-builder, 13/11)

Méthode : l'écran est incrusté DANS l'image source (espace 1920×1080) que le canvas du plan photographie avec sa propre
caméra (`camAt`) et son flou de mouvement multi-échantillons : la capture suit l'écran au pixel, sans calque séparé.
`film/lib/phone/phone.js` (`LKDVPhone.compositor`) : homographie par triangles (grille 8×16 + passe 5×11 dessous), coins
arrondis, teinte de scène, reflet qui glisse avec la caméra, netteté de la plaque, fondus d'états. Plaques percées
recadrées sur l'écran (`tools/phone/crop_plate.py`, 30 Ko–1,2 Mo, versionnables) dans `film/assets/phone/`, captures en
645×1398 dans `film/assets/phone/screens/` (`tools/phone/prep_screens.py`). Branchement : `node tools/phone/wire-film.mjs`
(ajout seul : images cachées, `lib/phone/phone.js`, source du canvas ; caméra et durée inchangées).

| Plan | Image → capture | État | Preuve |
|---|---|---|---|
| P12 | img40 → E02a→b→c→d (fondus i10–15, 23–28, 35–40) | fait | p12-debut-milieu-fin-zoom.jpg |
| P13 | img41 → E03 | fait | p13-… (pouce devant, lisible) |
| P16 | img42 → E05a→E05b (i50–62) | fait | p16-… ; 2 croix sombres du haut encore visibles (≈2 px) |
| P17 | img43 → E06 | fait | p17-… ; coins du haut hors cadre imposés (tools/phone/img43.corners.json) ; le pouce tombe sur « Commander · 5 pièces · 471 € » (cache « 5 pièces ») |
| P25 | img18 → E07 | fait | p25-… |
| P29 | img46 → E08 | fait | p29-… |
| P31 | img22 → E09 | fait | p31-… ; téléphone horizontal, haut de l'appli à gauche (ordre détecté) ; écran ≈130×70 px, illisible par nature |
| P36 | img27 → E10 | fait | p36-… (coins tenus, lisible) |
| P48 | img37 → E11x (provisoire) | fait | p48-… ; niveau 0,8, teinte 0,35 (nuit) |
| P49 | img37 → E12 | fait | p49-… ; idem nuit |
| P51 | img38 → E13 | fait | p51-… ; idem nuit |
| P07 | img07 → E01a→E01b (i46–56) | fait | p07-debut-milieu-fin-zoom.jpg (pouce devant, lisible) |
| P09 | img07 → E01b sous la photo du lac déjà ouverte par le plan | fait (base seulement) | p09-six-images.jpg : rond de pupille, tape, poussée et dernière image (lac plein cadre = P10) inchangés ; le liseré vert de son masque d'exécution (132 px à 8,90 s) a disparu |
| P15 | — (E4 sans capture) | non fait, écran laissé tel quel | — |

Vert résiduel : 0 pixel vert pur (g > r+90, g > b+90, g > 180) sur les 33 images (début/milieu/fin des 11 plans) et les 9 images de P07/P09, 0 dans la zone de l'écran.

## Contrôles (relancés après la dernière retouche, P09)
- `film/` : `npx hyperframes lint` → `0 errors, 0 warnings`
- `film/` : `npx hyperframes check --json` → `ok: true` ; lint, runtime, layout, motion, contrast, craft, audio, hdr : 0 erreur, 0 avertissement
- `trailer/` : `node tools/timeline/compare-timeline.mjs` → `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}`

## Ce qui reste faible (dit franchement)
- Glissement : aucun par construction (l'écran est dans l'image que la caméra photographie) ; vérifié à l'œil sur 3 instants par plan, pas image par image.
- P17 : coins du haut hors cadre, imposés (aspect 1290:2796) ; si l'écran réel d'img43 n'est pas exactement vertical, l'erreur reste invisible hors du bas.
- P16 : img42 a 4 croix sombres dans l'écran ; les 2 du bas sont percées, les 2 du haut (près de l'encoche) restent, ≈2 px à l'image.
- P31 : téléphone horizontal, capture portrait couchée (haut de l'appli à gauche) ; écran ≈130×70 px, illisible par nature.
- P48–P51 (nuit) : niveau 0,8 et teinte 0,35, jugé à l'œil ; aucune lueur de l'écran sur les mains (pas de rétro-éclairage simulé).
- Flou : netteté de la plaque + flou de mouvement du plan (multi-échantillons) ; pas de flou de mise au point variable.
- Défauts réels de l'app visibles dans les captures : « Mixte · Dolomitenblick » (P13), carte « Centre-Val de Loire » sous un carnet Dolomites (P07).
- 9:16 non traité. P15 (E4) sans capture : écran vert laissé tel quel.
- Poids : `film/assets/phone/` ≈ 12 Mo (plaques 30 Ko–1,2 Mo, captures 0,3–0,9 Mo), chaque fichier < 2 Mo, donc versionnable sans dossier ignoré.
