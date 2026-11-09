# Suivi — Finition Communauté v2 et Carnet v2

Prompt de référence : `docs/claude/PROMPT-FINITION-COMMUNAUTE-CARNET.md`. Seul fichier d'état de ce chantier ; chiffres prouvés par le banc `tests/fidelity/`.

## Scores (banc de fidélité)

Banc : `tests/fidelity/` (config `fidelity.config.ts`, scénarios `scenarios/{communaute,carnet}.ts`). Passage du 2026-11-09. Projets joués : 390x844 clair, 390x844 sombre, 1440x900 clair, 1440x900 sombre. Pas encore joués : 360×780, 430×932, 768×1024.

Lancer : `bash tests/fidelity/build.sh` (un seul build, mode fixtures), puis `npx playwright test --config=tests/fidelity/fidelity.config.ts`, puis `node scripts/fidelity/report.mjs` (réécrit cette section et `tests/fidelity/out/galerie.html`). Variables : `FIDELITY_SIZES`, `FIDELITY_THEMES`, `FIDELITY_ONLY`, `FIDELITY_STRICT=1` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | 84 (0 conformes, 80 avec écart, 4 non atteignables, 0 en erreur) |
| Dont sombre sans référence (†) | 40 : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | 0 / 40 |
| Différence pixel moyenne | 52,6 % |
| Mesures DOM conformes | 851 / 1534 (55,5 %) |

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (`masques`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

| Écran · état (rôle) | 390x844 clair | 390x844 sombre | 1440x900 clair | 1440x900 sombre |
| --- | --- | --- | --- | --- |
| Création · publication · étape 1 (membre) | 52,3 % · 12/19 | 57,5 % · 12/19 † | 52,8 % · 7/19 | 60,0 % · 7/19 † |
| Explorer · carnets · chargement (squelette) (membre) | 55,3 % · 17/25 | 73,5 % · 17/25 † | 52,1 % · 10/25 | 80,2 % · 10/25 † |
| Explorer · carnets · erreur de chargement (membre) | 53,2 % · 17/25 | 53,2 % · 17/25 † | 50,7 % · 10/25 | 50,8 % · 10/25 † |
| Explorer · carnets · chargé (invite) | 51,0 % · 24/38 | 51,0 % · 24/38 † | 61,4 % · 16/38 | 61,7 % · 16/38 † |
| Explorer · carnets · vide (membre) | 54,8 % · 23/33 | 54,8 % · 23/33 † | 54,0 % · 15/33 | 54,3 % · 15/33 † |
| Explorer · carnets · chargé (membre) | 48,6 % · 30/45 | 48,7 % · 30/45 † | 52,6 % · 19/45 | 52,8 % · 19/45 † |
| Explorer · clubs · chargé (membre) | 42,1 % · 29/45 | 42,6 % · 29/45 † | 47,4 % · 19/45 | 46,4 % · 19/45 † |
| Explorer · sorties · chargé (membre) | 38,0 % · 24/38 | 38,2 % · 24/38 † | 44,9 % · 16/38 | 45,2 % · 16/38 † |
| Explorer · carnets · aperçu (appui long sur une tuile) (membre) | 82,5 % · 0/4 | 83,1 % · 0/4 † | 80,5 % · 0/4 | 81,0 % · 0/4 † |
| Explorer · recherche · accueil de la recherche (membre) | 58,5 % · 25/40 | 62,7 % · 25/40 † | 57,3 % · 17/40 | 60,8 % · 17/40 † |
| Explorer · recherche · résultats pour « ecrins » (membre) | 66,3 % · 23/33 | 66,8 % · 23/33 † | 53,1 % · 15/33 | 54,3 % · 15/33 † |

### Fiche Carnet v2

| Écran · état (rôle) | 390x844 clair | 390x844 sombre | 1440x900 clair | 1440x900 sombre |
| --- | --- | --- | --- | --- |
| Carnet · Jour 1 · chargé (participant) | 31,9 % · 44/65 | 31,9 % · 43/65 † | 41,3 % · 37/65 | 41,3 % · 36/65 † |
| Carnet · Résumé · chargé (participant) | 41,5 % · 48/69 | 41,5 % · 47/69 † | 50,8 % · 40/69 | 50,8 % · 39/69 † |
| Carnet · Résumé · vide (aucun moment, aucune étape) (participant) | 46,0 % · 44/64 | 46,0 % · 43/64 † | 52,2 % · 37/64 | 52,2 % · 36/64 † |
| Carnet · Résumé · chargé (visiteur) | 41,4 % · 48/69 | 41,4 % · 47/69 † | 51,2 % · 40/69 | 51,2 % · 39/69 † |
| Carnet · tiroir Chiffres · chargé, première lentille (participant) | 53,0 % · 16/31 | 53,0 % · 16/31 † | 62,2 % · 13/31 | 62,0 % · 13/31 † |
| Carnet · tiroir Équipage · chargé, première lentille (participant) | 52,0 % · 16/31 | 51,8 % · 16/31 † | 61,8 % · 13/31 | 61,9 % · 13/31 † |
| Carnet · tiroir · erreur de chargement du slot (participant) | non atteignable | non atteignable | non atteignable | non atteignable |
| Carnet · tiroir Fil de bord · chargé, première lentille (participant) | 50,2 % · 16/31 | 50,2 % · 16/31 † | 58,1 % · 13/31 | 58,2 % · 13/31 † |
| Carnet · tiroir Route · chargé, première lentille (participant) | 49,1 % · 16/31 | 49,1 % · 16/31 † | 59,7 % · 13/31 | 59,7 % · 13/31 † |
| Carnet · tiroir Sac · chargé, première lentille (participant) | 41,5 % · 16/31 | 41,5 % · 16/31 † | 51,4 % · 13/31 | 51,4 % · 13/31 † |

### Écarts triés par surface de différence (25 premiers)

| # | Scénario | Projet | Pixels différents | Bandes les plus différentes | Cadres app / maquette | Mesures en échec (3 plus grosses) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | communaute-recherche-resultats | 390x844 clair | 214 337 px (66,3 %) | y 576–640 (94 %), y 704–768 (93 %), y 512–576 (92 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 2 | communaute-recherche-accueil | 390x844 clair | 192 550 px (58,5 %) | y 512–576 (86 %), y 448–512 (82 %), y 640–704 (78 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 3 | communaute-explorer-carnets-chargement | 390x844 clair | 182 161 px (55,3 %) | y 448–512 (98 %), y 512–576 (95 %), y 384–448 (82 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 4 | communaute-explorer-carnets-vide | 390x844 clair | 180 455 px (54,8 %) | y 704–768 (93 %), y 576–640 (92 %), y 768–832 (90 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 5 | communaute-recherche-accueil | 1440x900 clair | 177 379 px (57,3 %) | y 448–512 (79 %), y 320–384 (69 %), y 640–704 (63 %) | 520×867 / 390×844 | Mini-capsule (filtres) · x : app 226px / maquette 103px ; Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) |
| 6 | communaute-explorer-carnets-erreur | 390x844 clair | 175 066 px (53,2 %) | y 704–768 (93 %), y 576–640 (92 %), y 640–704 (90 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 7 | communaute-creation-publication-etape1 | 390x844 clair | 172 137 px (52,3 %) | y 448–512 (87 %), y 384–448 (79 %), y 192–256 (78 %) | 390×844 / 390×844 | Capsule des 6 types · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des 6 types · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des 6 types · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 8 | communaute-explorer-carnets-vide | 1440x900 clair | 167 277 px (54,0 %) | y 448–512 (93 %), y 512–576 (92 %), y 640–704 (65 %) | 520×867 / 390×844 | Mini-capsule (filtres) · x : app 268px / maquette 155px ; Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) |
| 9 | communaute-creation-publication-etape1 | 1440x900 clair | 163 574 px (52,8 %) | y 384–448 (85 %), y 192–256 (73 %), y 448–512 (71 %) | 520×867 / 390×844 | Capsule des 6 types · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des 6 types · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des 6 types · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 10 | communaute-explorer-carnets-chargement | 1440x900 clair | 161 396 px (52,1 %) | y 448–512 (94 %), y 512–576 (88 %), y 384–448 (73 %) | 520×867 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 11 | communaute-recherche-resultats | 1440x900 clair | 160 519 px (53,1 %) | y 448–512 (89 %), y 512–576 (70 %), y 640–704 (65 %) | 520×867 / 390×844 | Mini-capsule (filtres) · x : app 226px / maquette 103px ; Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) |
| 12 | communaute-explorer-carnets-erreur | 1440x900 clair | 156 924 px (50,7 %) | y 448–512 (93 %), y 512–576 (92 %), y 640–704 (65 %) | 520×867 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 13 | communaute-explorer-sorties | 1440x900 clair | 127 565 px (44,9 %) | y 0–64 (63 %), y 704–768 (63 %), y 384–448 (57 %) | 520×867 / 390×844 | Mini-capsule (filtres) · x : app 343px / maquette 235px ; Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) |
| 14 | communaute-explorer-clubs | 1440x900 clair | 117 874 px (47,4 %) | y 0–64 (75 %), y 384–448 (68 %), y 640–704 (58 %) | 520×867 / 390×844 | Mini-capsule (filtres) · x : app 307px / maquette 199px ; Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) |
| 15 | communaute-explorer-sorties | 390x844 clair | 115 265 px (38,0 %) | y 0–64 (72 %), y 384–448 (48 %), y 576–640 (48 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 16 | communaute-explorer-clubs | 390x844 clair | 112 932 px (42,1 %) | y 0–64 (72 %), y 384–448 (62 %), y 640–704 (58 %) | 390×844 / 390×844 | Capsule des volets · background-color : app rgba(255, 255, 255, 0.65) / maquette rgba(0, 0, 0, 0) ; Capsule des volets · background-image : app none / maquette linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) ; Capsule des volets · backdrop-filter : app blur(28px) saturate(1.8) / maquette blur(7px) saturate(1.9) brightness(1.07) |
| 17 | carnet-tiroir-chiffres | 1440x900 clair | 103 558 px (62,2 %) | y 448–512 (95 %), y 384–448 (92 %), y 320–384 (85 %) | 430×900 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |
| 18 | carnet-tiroir-equipage | 1440x900 clair | 102 934 px (61,8 %) | y 384–448 (97 %), y 448–512 (97 %), y 320–384 (91 %) | 430×900 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |
| 19 | carnet-tiroir-chiffres | 390x844 clair | 102 774 px (53,0 %) | y 384–448 (95 %), y 512–576 (94 %), y 320–384 (88 %) | 390×844 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |
| 20 | carnet-tiroir-equipage | 390x844 clair | 100 875 px (52,0 %) | y 384–448 (96 %), y 320–384 (95 %), y 512–576 (94 %) | 390×844 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |
| 21 | carnet-tiroir-route | 1440x900 clair | 99 425 px (59,7 %) | y 384–448 (95 %), y 448–512 (95 %), y 320–384 (73 %) | 430×900 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |
| 22 | carnet-tiroir-fil | 390x844 clair | 97 402 px (50,2 %) | y 512–576 (87 %), y 256–320 (76 %), y 384–448 (74 %) | 390×844 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |
| 23 | carnet-tiroir-fil | 1440x900 clair | 96 745 px (58,1 %) | y 320–384 (76 %), y 448–512 (75 %), y 512–576 (67 %) | 430×900 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |
| 24 | communaute-peek-carnet | 390x844 clair | 96 476 px (82,5 %) | y 768–832 (90 %), y 64–128 (85 %), y 512–576 (85 %) | 390×844 / 390×844 | Aperçu (peek) · hauteur : app 786px / maquette 366.9px ; Aperçu (peek) · y : app 44px / maquette 238.6px ; Aperçu (peek) · largeur : app 374px / maquette 310px |
| 25 | carnet-tiroir-route | 390x844 clair | 95 231 px (49,1 %) | y 384–448 (96 %), y 512–576 (94 %), y 448–512 (86 %) | 390×844 / 390×844 | Barre des lentilles · background-color : app rgba(0, 0, 0, 0) / maquette rgba(255, 255, 255, 0.65) ; Barre des lentilles · background-image : app linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) / maquette linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) ; Barre des lentilles · backdrop-filter : app blur(7px) saturate(1.9) brightness(1.07) / maquette blur(28px) saturate(1.8) brightness(1.04) |

### Écarts de mesure récurrents

| Élément | Propriété | Occurrences | Valeur app (exemple) | Valeur maquette (exemple) |
| --- | --- | --- | --- | --- |
| Communauté · Tiroir | y | 20 | 23.2px | 48px |
| Communauté · Tiroir | hauteur | 20 | 802px | 782px |
| Communauté · Poignée | y | 18 | 23.2px | 48px |
| Communauté · Capsule des volets | background-color | 18 | rgba(255, 255, 255, 0.65) | rgba(0, 0, 0, 0) |
| Communauté · Capsule des volets | background-image | 18 | none | linear-gradient(rgba(255, 255, 255, 0.49), rgba(255, 255, 255, 0.33) 55%, rgba(255, 255, 255, 0.41)) |
| Communauté · Capsule des volets | backdrop-filter | 18 | blur(28px) saturate(1.8) | blur(7px) saturate(1.9) brightness(1.07) |
| Communauté · Capsule des volets | box-shadow | 18 | rgba(255, 255, 255, 0.95) 0px 1px 0px 0px inset, rgba(23, 43, 36, 0.08) 0px 4px 14px 0px | rgba(255, 255, 255, 0.9) 0px 1px 0px 0px inset, rgba(255, 255, 255, 0.45) 0px -1px 1px 0px inset, rgba(255, 255, 255, 0.28) 1px 0px 1px 0px inset, rgba(255, 255, 255, 0.28) -1px 0px 1px 0px inset, rgba(255, 255, 255, 0.14) 0px 0px 12px 0px inset, rgba(23, 43, 36, 0.14) 0px 0px 0px 0.5px, rgba(23, 43, 36, 0.12) 0px 8px 22px 0px |
| Communauté · Mini-capsule (filtres) | x | 14 | 268px | 155px |
| Communauté · Mini-capsule (filtres) | largeur | 14 | 161px | 181px |
| Communauté · Mini-capsule (filtres) | background-color | 14 | rgba(0, 0, 0, 0) | rgba(255, 255, 255, 0.65) |
| Carnet · Tiroir | y | 10 | 48px | 91px |
| Carnet · Tiroir | hauteur | 10 | 504px | 439.4px |
| Carnet · Capsule des 5 slots | x | 10 | 14px | 26px |
| Carnet · Capsule des 5 slots | largeur | 10 | 402px | 338px |
| Carnet · Capsule des 5 slots | hauteur | 10 | 36px | 56px |
| Carnet · Zone de contenu du slot | x | 10 | 14px | 12px |
| Carnet · Zone de contenu du slot | y | 10 | 122px | 173px |
| Carnet · Zone de contenu du slot | largeur | 10 | 402px | 366px |
| Carnet · Barre des lentilles | x | 10 | 276px | 187px |
| Carnet · Barre des lentilles | y | 10 | 512px | 490.4px |

### Non atteignable (raison écrite, rien d'inventé)

| Scénario | Projets | Raison |
| --- | --- | --- |
| carnet-tiroir-erreur | 1440x900 clair, 1440x900 sombre, 390x844 clair, 390x844 sombre | non atteignable : app : CarnetDrawerV2 n’a aucun état d’erreur de slot ni bouton « Réessayer » (CHECKLIST-100 l.76 ouverte) : rien à atteindre côté app |

Galerie côte à côte (app | maquette | carte de diff) : `tests/fidelity/out/galerie.html` (ignorée par git ; régénérée par le rapport).

## Journal

| Date | Lot | Résultat | Preuve |
| --- | --- | --- | --- |
| 2026-11-09 | État des lieux | Communauté : 161 fait / 23 partiel / 13 reporté / 3 non fait (COUVERTURE-200), 2 bloqués J-08 ; Carnet : checklist 40 [x] / 5 [~] / 8 [ ], 3 failles RLS ouvertes | rapports scout, prompt §4 |

## Décisions ouvertes (Tony)

Voir prompt §5.

## Bloqué par Tony

Voir prompt §6.
