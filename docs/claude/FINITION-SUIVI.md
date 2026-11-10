# Suivi — Finition Communauté v2 et Carnet v2

Prompt de référence : `docs/claude/PROMPT-FINITION-COMMUNAUTE-CARNET.md`. Seul fichier d'état de ce chantier ; chiffres prouvés par le banc `tests/fidelity/`.

## Scores (banc de fidélité)

Banc : `tests/fidelity/` (config `fidelity.config.ts`, scénarios `scenarios/{communaute,carnet}.ts`). Passage du 2026-11-09. Projets joués : 390x844 clair, 430x932 clair. Pas encore joués : 360×780, 430×932, 768×1024.

Lancer : `bash tests/fidelity/build.sh` (un seul build, mode fixtures), puis `npx playwright test --config=tests/fidelity/fidelity.config.ts`, puis `node scripts/fidelity/report.mjs` (réécrit cette section et `tests/fidelity/out/galerie.html`). Variables : `FIDELITY_SIZES`, `FIDELITY_THEMES`, `FIDELITY_ONLY`, `FIDELITY_STRICT=1` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | 32 (0 conformes, 30 avec écart, 2 non atteignables, 0 en erreur) |
| Dont sombre sans référence (†) | 0 : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | 0 / 30 |
| Différence pixel moyenne | 40,0 % |
| Mesures DOM conformes | 1022 / 1184 (86,3 %) |

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (`masques`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

| Écran · état (rôle) | 390x844 clair | 430x932 clair |
| --- | --- | --- |
| Explorer · carnets · chargement (squelette) (membre) | 55,3 % · 17/25 | 53,5 % · 17/25 |
| Explorer · carnets · erreur de chargement (membre) | 53,3 % · 17/25 | 54,2 % · 17/25 |
| Explorer · carnets · chargé (invite) | 51,0 % · 24/38 | 52,8 % · 24/38 |
| Explorer · carnets · vide (membre) | 54,9 % · 23/33 | 55,9 % · 23/33 |
| Explorer · carnets · chargé (membre) | 48,6 % · 30/45 | 49,3 % · 30/45 |
| Explorer · carnets · aperçu (appui long sur une tuile) (membre) | 82,0 % · 0/4 | 83,4 % · 0/4 |

### Fiche Carnet v2

| Écran · état (rôle) | 390x844 clair | 430x932 clair |
| --- | --- | --- |
| Carnet · Jour 1 · chargé (participant) | 31,2 % · 60/65 | 30,2 % · 60/65 |
| Carnet · Résumé · chargé (participant) | 30,3 % · 64/69 | 30,8 % · 64/69 |
| Carnet · Résumé · vide (aucun moment, aucune étape) (participant) | 43,3 % · 57/64 | 44,0 % · 57/64 |
| Carnet · Résumé · chargé (visiteur) | 30,3 % · 64/69 | 30,8 % · 64/69 |
| Carnet · tiroir Chiffres · chargé, première lentille (participant) | 18,8 % · 31/31 | 16,1 % · 31/31 |
| Carnet · tiroir Équipage · chargé, première lentille (participant) | 13,1 % · 31/31 | 11,8 % · 31/31 |
| Carnet · tiroir · erreur de chargement du slot (participant) | non atteignable | non atteignable |
| Carnet · tiroir Fil de bord · chargé, première lentille (participant) | 37,7 % · 31/31 | 42,0 % · 31/31 |
| Carnet · tiroir Route · chargé, première lentille (participant) | 22,6 % · 31/31 | 23,7 % · 31/31 |
| Carnet · tiroir Sac · chargé, première lentille (participant) | 25,5 % · 31/31 | 23,6 % · 31/31 |

### Écarts triés par surface de différence (25 premiers)

| # | Scénario | Projet | Pixels différents | Bandes les plus différentes | Cadres app / maquette | Mesures en échec (3 plus grosses) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | communaute-explorer-carnets-vide | 430x932 clair | 224 220 px (55,9 %) | y 832–896 (96 %), y 640–704 (95 %), y 576–640 (90 %) | 430×932 / 430×932 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 2 | communaute-explorer-carnets-erreur | 430x932 clair | 217 251 px (54,2 %) | y 640–704 (95 %), y 576–640 (90 %), y 832–896 (90 %) | 430×932 / 430×932 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 3 | communaute-explorer-carnets-chargement | 430x932 clair | 214 268 px (53,5 %) | y 448–512 (98 %), y 512–576 (93 %), y 384–448 (87 %) | 430×932 / 430×932 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 4 | communaute-explorer-carnets-chargement | 390x844 clair | 182 161 px (55,3 %) | y 448–512 (98 %), y 512–576 (95 %), y 384–448 (82 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 5 | communaute-explorer-carnets-vide | 390x844 clair | 180 808 px (54,9 %) | y 704–768 (93 %), y 576–640 (92 %), y 768–832 (90 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 6 | communaute-explorer-carnets-erreur | 390x844 clair | 175 368 px (53,3 %) | y 704–768 (93 %), y 576–640 (92 %), y 640–704 (90 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 7 | communaute-peek-carnet | 430x932 clair | 111 146 px (83,4 %) | y 832–896 (91 %), y 0–64 (86 %), y 64–128 (86 %) | 430×932 / 430×932 | Aperçu (peek) · hauteur : app 874px / maquette 366.9px ; Aperçu (peek) · y : app 44px / maquette 282.6px ; Aperçu (peek) · largeur : app 414px / maquette 310px |
| 8 | carnet-resume-vide | 430x932 clair | 106 771 px (44,0 %) | y 384–448 (88 %), y 448–512 (86 %), y 512–576 (81 %) | 430×932 / 430×932 | Capsule de jours · x : app 373px / maquette 233px ; Capsule de jours · largeur : app 35px / maquette 175px ; Pastille titre · largeur : app 167.7px / maquette 141.3px |
| 9 | carnet-tiroir-fil | 430x932 clair | 101 115 px (42,0 %) | y 576–640 (80 %), y 384–448 (76 %), y 512–576 (62 %) | 430×932 / 430×932 | — |
| 10 | communaute-peek-carnet | 390x844 clair | 95 922 px (82,0 %) | y 768–832 (90 %), y 64–128 (85 %), y 512–576 (85 %) | 390×844 / 390×844 | Aperçu (peek) · hauteur : app 786px / maquette 366.9px ; Aperçu (peek) · y : app 44px / maquette 238.6px ; Aperçu (peek) · largeur : app 374px / maquette 310px |
| 11 | carnet-resume-vide | 390x844 clair | 84 391 px (43,3 %) | y 320–384 (86 %), y 384–448 (84 %), y 512–576 (79 %) | 390×844 / 390×844 | Capsule de jours · x : app 333px / maquette 193px ; Capsule de jours · largeur : app 35px / maquette 175px ; Pastille titre · largeur : app 167.7px / maquette 141.3px |
| 12 | carnet-resume-visiteur | 430x932 clair | 74 305 px (30,8 %) | y 576–640 (81 %), y 512–576 (62 %), y 448–512 (61 %) | 430×932 / 430×932 | Carte du carnet (verre) · border-radius : app 24px / maquette 0px ; Carte-jour · y : app 333.2px / maquette 326.5px ; Bouton « Ouvrir le carnet » · y : app 173.2px / maquette 176.2px |
| 13 | carnet-resume-participant | 430x932 clair | 74 256 px (30,8 %) | y 576–640 (81 %), y 512–576 (62 %), y 448–512 (61 %) | 430×932 / 430×932 | Carte du carnet (verre) · border-radius : app 24px / maquette 0px ; Carte-jour · y : app 333.2px / maquette 326.5px ; Bouton « Ouvrir le carnet » · y : app 173.2px / maquette 176.2px |
| 14 | carnet-tiroir-fil | 390x844 clair | 72 955 px (37,7 %) | y 384–448 (78 %), y 512–576 (66 %), y 256–320 (54 %) | 390×844 / 390×844 | — |
| 15 | carnet-j1-participant | 430x932 clair | 72 901 px (30,2 %) | y 576–640 (70 %), y 384–448 (61 %), y 512–576 (57 %) | 430×932 / 430×932 | Carte-jour · (présence) : app ∅ / maquette ∅ ; Carte du carnet (verre) · border-radius : app 24px / maquette 0px ; Bouton « Ouvrir le carnet » · y : app 173.2px / maquette 176.2px |
| 16 | communaute-explorer-carnets-invite | 430x932 clair | 65 797 px (52,8 %) | y 0–64 (78 %), y 832–896 (67 %), y 128–192 (66 %) | 430×932 / 430×932 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 17 | communaute-explorer-carnets | 430x932 clair | 65 759 px (49,3 %) | y 0–64 (74 %), y 448–512 (67 %), y 832–896 (66 %) | 430×932 / 430×932 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 18 | carnet-j1-participant | 390x844 clair | 60 409 px (31,2 %) | y 512–576 (67 %), y 384–448 (64 %), y 448–512 (53 %) | 390×844 / 390×844 | Carte-jour · (présence) : app ∅ / maquette ∅ ; Carte du carnet (verre) · border-radius : app 24px / maquette 0px ; Bouton « Ouvrir le carnet » · y : app 173.2px / maquette 176.2px |
| 19 | carnet-resume-participant | 390x844 clair | 58 621 px (30,3 %) | y 512–576 (60 %), y 448–512 (58 %), y 384–448 (48 %) | 390×844 / 390×844 | Carte du carnet (verre) · border-radius : app 24px / maquette 0px ; Carte-jour · y : app 333.2px / maquette 326.5px ; Bouton « Ouvrir le carnet » · y : app 173.2px / maquette 176.2px |
| 20 | carnet-resume-visiteur | 390x844 clair | 58 615 px (30,3 %) | y 512–576 (60 %), y 448–512 (58 %), y 384–448 (48 %) | 390×844 / 390×844 | Carte du carnet (verre) · border-radius : app 24px / maquette 0px ; Carte-jour · y : app 333.2px / maquette 326.5px ; Bouton « Ouvrir le carnet » · y : app 173.2px / maquette 176.2px |
| 21 | carnet-tiroir-route | 430x932 clair | 57 220 px (23,7 %) | y 512–576 (53 %), y 384–448 (50 %), y 576–640 (35 %) | 430×932 / 430×932 | — |
| 22 | carnet-tiroir-sac | 430x932 clair | 56 911 px (23,6 %) | y 384–448 (47 %), y 448–512 (42 %), y 256–320 (35 %) | 430×932 / 430×932 | — |
| 23 | communaute-explorer-carnets | 390x844 clair | 56 888 px (48,6 %) | y 0–64 (72 %), y 448–512 (72 %), y 768–832 (64 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 24 | communaute-explorer-carnets-invite | 390x844 clair | 55 000 px (51,0 %) | y 0–64 (76 %), y 448–512 (69 %), y 128–192 (65 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 25 | carnet-tiroir-sac | 390x844 clair | 49 356 px (25,5 %) | y 256–320 (48 %), y 384–448 (47 %), y 512–576 (32 %) | 390×844 / 390×844 | — |

### Écarts de mesure récurrents

| Élément | Propriété | Occurrences | Valeur app (exemple) | Valeur maquette (exemple) |
| --- | --- | --- | --- | --- |
| Communauté · Tiroir | y | 10 | 44px | 48px |
| Communauté · Tiroir | hauteur | 10 | 786px | 782px |
| Communauté · Poignée | y | 10 | 44px | 48px |
| Communauté · Capsule des volets | background-color | 10 | rgba(255, 255, 255, 0.65) | rgba(0, 0, 0, 0) |
| Communauté · Capsule des volets | background-image | 10 | none | linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) |
| Communauté · Capsule des volets | backdrop-filter | 10 | blur(28px) saturate(1.8) | blur(7px) saturate(1.9) brightness(1.07) |
| Communauté · Capsule des volets | box-shadow | 10 | rgba(255, 255, 255, 0.95) 0px 1px 0px 0px inset, rgba(23, 43, 36, 0.08) 0px 4px 14px 0px | rgba(255, 255, 255, 0.9) 0px 1px 0px 0px inset, rgba(255, 255, 255, 0.45) 0px -1px 1px 0px inset, rgba(255, 255, 255, 0.28) 1px 0px 1px 0px inset, rgba(255, 255, 255, 0.28) -1px 0px 1px 0px inset, rgba(255, 255, 255, 0.14) 0px 0px 12px 0px inset, rgba(23, 43, 36, 0.14) 0px 0px 0px 0.5px, rgba(23, 43, 36, 0.12) 0px 8px 22px 0px |
| Carnet · Carte du carnet (verre) | border-radius | 8 | 24px | 0px |
| Carnet · Bouton « Ouvrir le carnet » | x | 8 | 223px | 225.2px |
| Carnet · Bouton « Ouvrir le carnet » | y | 8 | 173.2px | 176.2px |
| Carnet · Bouton « Ouvrir le carnet » | largeur | 8 | 141px | 138.8px |
| Communauté · Mini-capsule (filtres) | x | 6 | 175px | 155px |
| Communauté · Mini-capsule (filtres) | largeur | 6 | 161px | 181px |
| Communauté · Mini-capsule (filtres) | background-color | 6 | rgba(0, 0, 0, 0) | rgba(255, 255, 255, 0.65) |
| Carnet · Carte-jour | y | 4 | 333.2px | 326.5px |
| Communauté · Mini-capsule (filtres) | (présence) | 4 | présent | ∅ |
| Communauté · Tuile carnet | x | 4 | 9px | 22px |
| Communauté · Tuile carnet | largeur | 4 | 372px | 346px |
| Communauté · Tuile carnet | hauteur | 4 | 330.6px | 310.9px |
| Carnet · Carte-jour | (présence) | 2 | ∅ | ∅ |

### Non atteignable (raison écrite, rien d'inventé)

| Scénario | Projets | Raison |
| --- | --- | --- |
| carnet-tiroir-erreur | 390x844 clair, 430x932 clair | non atteignable : app : CarnetDrawerV2 n’a aucun état d’erreur de slot ni bouton « Réessayer » (CHECKLIST-100 l.76 ouverte) : rien à atteindre côté app |

Galerie côte à côte (app | maquette | carte de diff) : `tests/fidelity/out/galerie.html` (ignorée par git ; régénérée par le rapport).

## Journal

| Date | Lot | Résultat | Preuve |
| --- | --- | --- | --- |
| 2026-11-09 | État des lieux | Communauté : 161 fait / 23 partiel / 13 reporté / 3 non fait (COUVERTURE-200), 2 bloqués J-08 ; Carnet : checklist 40 [x] / 5 [~] / 8 [ ], 3 failles RLS ouvertes | rapports scout, prompt §4 |
| 2026-11-10 | Carnet, passe 1 (46be4dc…17e180a) | Résumé 41,5 → 30,3 % px (mesures 48→64/69) ; J1 31,9 → 31,2 % (44→60/65) ; tiroirs 41–53 → 13–38 % (16→31/31) ; checklist l.27/36/38/61/63/76/78 faites, l.29/71/77 partielles | tsc 0, vitest carnet/compte 620/620, e2e finition 14/14, next build vert |
| 2026-11-10 | Sécurité carnet (a01454f, 8d082ad) | Auto-inscription, moments chez autrui, sortie d'intrus : fermés | pgTAP local 12/12 + 15/15, relecture architect, rollback rejouable ; non appliqué en production (pas d'accès) |
| 2026-11-10 | Migration moment_type (20261109100001) | Additive (2 colonnes + contraintes) | pgTAP local 8/8, rollback ×2, réapplication ×2 ; non appliquée en production |
| 2026-11-09 | Carnet · lot finition (branche `worktree-agent-af359c35138b559f1`) | Résumé 41,5 → 30,3 % de pixels (mesures 48/69 → 64/69), les 5 tiroirs 41–53 → 13–38 % (mesures 16/31 → 31/31), 390×844 et 430×932 clair ; 620 tests Vitest, 14/14 e2e `carnet-v2-finition`, `tsc` 0, ESLint 0 erreur, `next build` vert. Pas sous 2 % : illustration de la maquette contre le jeu du banc, anticrénelage, carte | `tests/fidelity/out/`, `docs/audit/carnet-v2-2026-11-09/captures/`, `handoff/carnet-v2/CHECKLIST-100.md` |

## Décisions ouvertes (Tony)

Voir prompt §5.

## Bloqué par Tony

Voir prompt §6.
