# Suivi — Finition Communauté v2 et Carnet v2

Prompt de référence : `docs/claude/PROMPT-FINITION-COMMUNAUTE-CARNET.md`. Seul fichier d'état de ce chantier ; chiffres prouvés par le banc `tests/fidelity/`.

## Scores (banc de fidélité)

Banc : `tests/fidelity/` (config `fidelity.config.ts`, scénarios `scenarios/{communaute,carnet}.ts`). Passage du 2026-11-11. Projets joués : 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair, 1440x900 clair. Thème sombre non joué : la maquette n'a pas de rendu sombre. 768/1440 : comparaison de cadre (maquette = téléphone 390 dans un cadre, app = colonne applicative), non représentative du rendu.

Lancer : `bash tests/fidelity/build.sh` (un seul build, mode fixtures), puis `npx playwright test --config=tests/fidelity/fidelity.config.ts`, puis `node scripts/fidelity/report.mjs` (réécrit cette section et `tests/fidelity/out/galerie.html`). Variables : `FIDELITY_SIZES`, `FIDELITY_THEMES`, `FIDELITY_ONLY`, `FIDELITY_STRICT=1` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | 270 (27 conformes, 220 avec écart, 23 non atteignables, 0 en erreur) |
| Dont sombre sans référence (†) | 0 : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | 35 / 247 |
| Différence pixel moyenne | 13,8 % |
| Mesures DOM conformes | 9271 / 11378 (81,5 %) |

**Fond neutralisé (Communauté).** Le tiroir est en verre translucide : ses pixels dépendent du fond. L'app montre la photo réelle de `/communaute` et la page derrière, la maquette une illustration verte (X1, non comparable). Pour que le chiffre mesure le **tiroir seul**, le banc (`lib/neutral.ts`, banc uniquement, l'app réelle n'est jamais modifiée) rend invisible tout ce qui n'appartient pas au tiroir, peint le même aplat uni (`rgb(200, 200, 200)`) derrière lui dans les deux captures et ne compare que la zone du tiroir (le reste du cadre est masqué et retiré du dénominateur). `FIDELITY_RAW_BG=1` rejoue la capture brute (fond réel des deux côtés).

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (`masques`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

| Écran · état (rôle) | 360x780 clair | 390x844 clair | 430x932 clair | 768x1024 clair | 1440x900 clair |
| --- | --- | --- | --- | --- | --- |
| Création · carnet · étape 1 : Infos (membre) | 10,3 % · 28/31 | 9,5 % · 28/31 | 8,2 % · 28/31 | 18,9 % · 13/31 | 15,1 % · 13/31 |
| Création · carnet · étape 2 : Tracé (membre) | 31,9 % · 28/31 | 35,7 % · 28/31 | 34,9 % · 28/31 | 42,3 % · 13/31 | 42,7 % · 13/31 |
| Création · carnet · étape 3 : Jours (membre) | 7,0 % · 28/31 | 6,2 % · 28/31 | 5,2 % · 28/31 | 13,5 % · 13/31 | 13,1 % · 13/31 |
| Création · carnet · étape 4 : Partage (membre) | 10,0 % · 28/31 | 9,7 % · 28/31 | 7,8 % · 28/31 | 16,9 % · 13/31 | 16,6 % · 13/31 |
| Création · club · étape 1 : Identité (membre) | 14,5 % · 28/31 | 14,4 % · 28/31 | 16,0 % · 28/31 | 26,8 % · 13/31 | 22,5 % · 13/31 |
| Création · club · étape 2 : Univers (membre) | 17,9 % · 28/31 | 16,1 % · 28/31 | 14,1 % · 28/31 | 24,4 % · 13/31 | 24,3 % · 13/31 |
| Création · club · étape 3 : Adhésion (membre) | 13,5 % · 28/31 | 15,2 % · 28/31 | 13,0 % · 28/31 | 23,8 % · 13/31 | 22,3 % · 13/31 |
| Création · club · étape 4 : Publication (membre) | 17,7 % · 28/31 | 18,7 % · 28/31 | 15,8 % · 28/31 | 25,5 % · 13/31 | 24,2 % · 13/31 |
| Création · kit · étape 1 : Inventaire (membre) | 16,2 % · 28/31 | 16,0 % · 28/31 | 18,3 % · 28/31 | 32,8 % · 13/31 | 28,8 % · 13/31 |
| Création · kit · étape 2 : Compléter (membre) | 15,4 % · 28/31 | 13,8 % · 28/31 | 15,3 % · 28/31 | 27,7 % · 13/31 | 24,2 % · 13/31 |
| Création · kit · étape 3 : Partager (membre) | 9,6 % · 28/31 | 8,3 % · 28/31 | 6,9 % · 28/31 | 15,6 % · 13/31 | 13,7 % · 13/31 |
| Création · publication · étape 2 : Contenu (membre) | 10,8 % · 31/31 | 9,6 % · 31/31 | 7,7 % · 31/31 | 22,8 % · 14/31 | 21,7 % · 14/31 |
| Création · publication · étape 3 : Diffusion (membre) | 12,8 % · 31/31 | 11,0 % · 31/31 | 9,3 % · 31/31 | 23,1 % · 14/31 | 21,7 % · 14/31 |
| Création · publication · étape 1 (membre) | 1,8 % · 112/116 | 1,5 % · 112/116 | 1,1 % · 112/116 | 18,0 % · 68/116 | 20,8 % · 68/116 |
| Création · sortie · étape 1 : Activité et lieu (membre) | 6,9 % · 28/31 | 7,0 % · 31/31 | 10,0 % · 31/31 | 20,3 % · 14/31 | 18,5 % · 14/31 |
| Création · sortie · étape 2 : Itinéraire (membre) | 13,6 % · 28/31 | 12,2 % · 31/31 | 10,5 % · 31/31 | 22,1 % · 14/31 | 22,2 % · 14/31 |
| Création · sortie · étape 3 : Participants (membre) | 10,4 % · 28/31 | 8,2 % · 31/31 | 6,3 % · 31/31 | 18,4 % · 14/31 | 18,5 % · 14/31 |
| Création · sortie · étape 4 : Sécurité (membre) | 10,3 % · 28/31 | 8,5 % · 31/31 | 9,1 % · 31/31 | 15,6 % · 14/31 | 17,1 % · 14/31 |
| Création · story · étape 1 : Média (membre) | 9,2 % · 31/31 | 8,2 % · 31/31 | 7,1 % · 31/31 | 15,4 % · 14/31 | 14,6 % · 14/31 |
| Création · story · étape 2 : Édition (membre) | 12,7 % · 31/31 | 11,5 % · 31/31 | 11,2 % · 31/31 | 20,7 % · 14/31 | 21,5 % · 14/31 |
| Création · story · étape 3 : Diffusion (membre) | 14,7 % · 31/31 | 14,3 % · 31/31 | 11,9 % · 31/31 | 24,4 % · 14/31 | 25,5 % · 14/31 |
| Explorer · carnets · chargement (squelette) (membre) | 0,0 % · 30/30 ✓ | 0,0 % · 30/30 ✓ | 0,0 % · 30/30 ✓ | 4,3 % · 16/30 | 5,2 % · 16/30 |
| Explorer · carnets · erreur de chargement (membre) | 1,7 % · 25/25 ✓ | 1,5 % · 25/25 ✓ | 1,2 % · 25/25 ✓ | 3,4 % · 15/25 | 4,8 % · 15/25 |
| Explorer · carnets · chargé (invite) | 0,9 % · 38/38 ✓ | 0,6 % · 38/38 ✓ | 0,6 % · 38/38 ✓ | 19,1 % · 22/38 | 19,2 % · 22/38 |
| Explorer · carnets · vide (membre) | 0,1 % · 33/33 ✓ | 0,2 % · 33/33 ✓ | 0,1 % · 33/33 ✓ | 7,7 % · 21/33 | 9,6 % · 21/33 |
| Explorer · carnets · chargé (membre) | 1,0 % · 45/45 ✓ | 0,6 % · 45/45 ✓ | 0,6 % · 45/45 ✓ | 18,9 % · 27/45 | 19,5 % · 27/45 |
| Explorer · clubs · chargé (membre) | 1,2 % · 114/114 ✓ | 0,2 % · 114/114 ✓ | 1,4 % · 114/114 ✓ | 33,0 % · 75/114 | 22,4 % · 75/114 |
| Explorer · sorties · chargé (membre) | 1,5 % · 174/174 ✓ | 1,2 % · 174/174 ✓ | 1,1 % · 174/174 ✓ | 26,3 % · 112/174 | 26,5 % · 112/174 |
| Explorer · carnets · aperçu (appui long sur une tuile) (membre) | 0,8 % · 4/4 ✓ | 0,7 % · 4/4 ✓ | 0,8 % · 4/4 ✓ | 11,5 % · 2/4 | 9,8 % · 2/4 |
| Explorer · recherche · accueil de la recherche (membre) | 3,0 % · 115/116 | 2,3 % · 115/116 | 1,3 % · 115/116 | 20,3 % · 77/116 | 18,6 % · 77/116 |
| Explorer · recherche · résultats pour « ecrins » (membre) | 1,5 % · 49/49 ✓ | 1,2 % · 49/49 ✓ | 0,8 % · 49/49 ✓ | 20,2 % · 31/49 | 11,9 % · 31/49 |

### Fiche Carnet v2

| Écran · état (rôle) | 360x780 clair | 390x844 clair | 430x932 clair | 768x1024 clair | 1440x900 clair |
| --- | --- | --- | --- | --- | --- |
| Carnet · carte du bas · carte indisponible (WebGL refusé) (participant) | non atteignable | non atteignable | non atteignable | non atteignable | non atteignable |
| Carnet · Résumé · chargement (squelette) (participant) | 5,2 % · 0/0 | 4,3 % · 0/0 | 4,0 % · 0/0 | 22,0 % · 0/0 | non atteignable |
| Carnet · feuille Créer · étape 2 : formulaire d’un moment texte (participant) | 9,0 % · 0/0 | 8,7 % · 0/0 | 8,7 % · 0/0 | 30,2 % · 0/0 | non atteignable |
| Carnet · Résumé · hors ligne (participant) | non atteignable | non atteignable | non atteignable | non atteignable | non atteignable |
| Carnet · Jour 1 · chargé (participant) | 4,4 % · 119/122 | 3,7 % · 119/122 | 3,4 % · 119/122 | 23,3 % · 77/122 | 23,5 % · 77/122 |
| Carnet · Jour 1 · mode modification (participant) | 11,8 % · 94/97 | 10,1 % · 94/97 | 9,1 % · 94/97 | 22,5 % · 63/97 | 22,8 % · 63/97 |
| Carnet · Résumé · mode modification (participant) | 12,7 % · 94/97 | 11,5 % · 94/97 | 10,9 % · 94/97 | 19,6 % · 64/97 | 19,9 % · 64/97 |
| Carnet · tiroir Fil de bord · mode modification, pilules « Modifier » (participant) | non atteignable | non atteignable | non atteignable | 19,8 % · 21/31 | 19,1 % · 21/31 |
| Carnet · Résumé · chargé (participant) | 3,9 % · 99/102 | 3,6 % · 99/102 | 3,2 % · 99/102 | 20,7 % · 67/102 | 20,7 % · 67/102 |
| Carnet · Résumé · vide (aucun moment, aucune étape) (participant) | 10,0 % · 78/86 | 9,1 % · 78/86 | 7,4 % · 78/86 | 18,8 % · 52/86 | non atteignable |
| Carnet · Résumé · chargé (visiteur) | 3,9 % · 99/102 | 3,6 % · 99/102 | 3,4 % · 99/102 | 21,9 % · 67/102 | non atteignable |
| Carnet · stories · visionneuse ouverte depuis la couverture (visiteur) | 0,0 % · 9/26 | 0,0 % · 9/26 | 0,0 % · 9/26 | 0,0 % · 6/26 | non atteignable |
| Carnet · tiroir Chiffres · chargé, lentille « Dénivelé » (participant) | 10,1 % · 31/31 | 9,7 % · 31/31 | 9,3 % · 31/31 | 33,2 % · 21/31 | 32,0 % · 21/31 |
| Carnet · tiroir Chiffres · chargé, première lentille (participant) | 10,0 % · 31/31 | 9,7 % · 31/31 | 9,3 % · 31/31 | 32,5 % · 21/31 | 31,1 % · 21/31 |
| Carnet · tiroir Équipage · chargé, lentille « Réactions » (participant) | 15,3 % · 31/31 | 13,3 % · 31/31 | 11,9 % · 31/31 | 35,8 % · 21/31 | 35,0 % · 21/31 |
| Carnet · tiroir Équipage · chargé, première lentille (participant) | 9,4 % · 31/31 | 7,8 % · 31/31 | 6,7 % · 31/31 | 31,7 % · 21/31 | 30,2 % · 21/31 |
| Carnet · tiroir · erreur de chargement du slot (participant) | non atteignable | non atteignable | non atteignable | non atteignable | non atteignable |
| Carnet · tiroir Fil de bord · chargé, lentille « Médias » (participant) | 15,3 % · 31/31 | 12,6 % · 31/31 | 10,5 % · 31/31 | 29,1 % · 21/31 | 28,6 % · 21/31 |
| Carnet · tiroir Fil de bord · chargé, première lentille (participant) | 4,8 % · 31/31 | 4,4 % · 31/31 | 4,2 % · 31/31 | 34,9 % · 21/31 | 33,8 % · 21/31 |
| Carnet · tiroir Route · chargé, lentille « Altitude » (participant) | 10,7 % · 31/31 | 12,1 % · 31/31 | 9,2 % · 31/31 | 32,8 % · 21/31 | 31,4 % · 21/31 |
| Carnet · tiroir Route · chargé, première lentille (participant) | 8,9 % · 31/31 | 9,2 % · 31/31 | 8,1 % · 31/31 | 31,2 % · 21/31 | 29,9 % · 21/31 |
| Carnet · tiroir Sac · chargé, lentille « Verdicts » (participant) | 7,5 % · 31/31 | 6,1 % · 31/31 | 5,5 % · 31/31 | 33,8 % · 21/31 | 32,8 % · 21/31 |
| Carnet · tiroir Sac · chargé, première lentille (participant) | 7,4 % · 31/31 | 6,0 % · 31/31 | 5,4 % · 31/31 | 31,0 % · 21/31 | 31,1 % · 21/31 |

### Écarts triés par surface de différence (25 premiers)

| # | Scénario | Projet | Pixels différents | Bandes les plus différentes | Cadres app / maquette | Mesures en échec (3 plus grosses) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | communaute-creation-carnet-etape2 | 768x1024 clair | 121 324 px (42,3 %) | y 576–640 (78 %), y 640–704 (77 %), y 512–576 (76 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 642px / maquette 512px |
| 2 | communaute-creation-carnet-etape2 | 1440x900 clair | 120 483 px (42,7 %) | y 576–640 (78 %), y 640–704 (76 %), y 512–576 (76 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 3 | communaute-creation-carnet-etape2 | 430x932 clair | 120 142 px (34,9 %) | y 640–704 (85 %), y 576–640 (83 %), y 512–576 (83 %) | 430×932 / 430×932 | Corps du formulaire · y : app 272px / maquette 258px ; Corps du formulaire · hauteur : app 586px / maquette 600px ; Aperçu du formulaire · hauteur : app 136px / maquette 122px |
| 4 | communaute-creation-carnet-etape2 | 390x844 clair | 98 632 px (35,7 %) | y 576–640 (84 %), y 512–576 (81 %), y 640–704 (80 %) | 390×844 / 390×844 | Corps du formulaire · y : app 272px / maquette 258px ; Corps du formulaire · hauteur : app 498px / maquette 512px ; Aperçu du formulaire · hauteur : app 136px / maquette 122px |
| 5 | communaute-creation-kit-etape1 | 768x1024 clair | 97 402 px (32,8 %) | y 768–832 (75 %), y 320–384 (73 %), y 384–448 (52 %) | 520×991 / 390×844 | Corps du formulaire · hauteur : app 695px / maquette 534px ; Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px |
| 6 | communaute-creation-kit-etape1 | 1440x900 clair | 84 078 px (28,8 %) | y 384–448 (60 %), y 320–384 (54 %), y 768–832 (52 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 7 | communaute-creation-kit-etape2 | 768x1024 clair | 82 356 px (27,7 %) | y 768–832 (55 %), y 576–640 (35 %), y 448–512 (33 %) | 520×991 / 390×844 | Corps du formulaire · hauteur : app 695px / maquette 534px ; Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px |
| 8 | communaute-creation-club-etape1 | 768x1024 clair | 79 418 px (26,8 %) | y 768–832 (77 %), y 704–768 (33 %), y 64–128 (32 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 638.8px / maquette 536px |
| 9 | communaute-creation-story-etape3 | 1440x900 clair | 76 081 px (25,5 %) | y 768–832 (32 %), y 512–576 (32 %), y 64–128 (32 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 10 | communaute-creation-club-etape4 | 768x1024 clair | 75 649 px (25,5 %) | y 192–256 (46 %), y 768–832 (39 %), y 384–448 (37 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 638.8px / maquette 536px |
| 11 | communaute-creation-story-etape3 | 768x1024 clair | 74 025 px (24,4 %) | y 640–704 (40 %), y 768–832 (38 %), y 704–768 (33 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 666px / maquette 522px |
| 12 | communaute-creation-carnet-etape2 | 360x780 clair | 73 716 px (31,9 %) | y 512–576 (84 %), y 576–640 (82 %), y 640–704 (53 %) | 360×780 / 360×780 | Corps du formulaire · y : app 272px / maquette 258px ; Corps du formulaire · hauteur : app 434px / maquette 448px ; Aperçu du formulaire · hauteur : app 136px / maquette 122px |
| 13 | communaute-creation-club-etape2 | 768x1024 clair | 72 303 px (24,4 %) | y 256–320 (51 %), y 192–256 (45 %), y 768–832 (39 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 638.8px / maquette 536px |
| 14 | communaute-creation-club-etape2 | 1440x900 clair | 70 928 px (24,3 %) | y 384–448 (58 %), y 256–320 (54 %), y 192–256 (33 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 15 | communaute-explorer-clubs | 768x1024 clair | 70 844 px (33,0 %) | y 320–384 (48 %), y 384–448 (40 %), y 64–128 (38 %) | 520×991 / 390×844 | Mini-capsule (filtres) · y : app 942.2px / maquette 790px ; Bouton de tri · y : app 942.2px / maquette 790px ; Tiroir · hauteur : app 926px / maquette 782px |
| 16 | communaute-creation-club-etape3 | 768x1024 clair | 70 789 px (23,8 %) | y 448–512 (50 %), y 192–256 (47 %), y 768–832 (39 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 638.8px / maquette 536px |
| 17 | communaute-creation-kit-etape2 | 1440x900 clair | 70 584 px (24,2 %) | y 448–512 (38 %), y 64–128 (32 %), y 320–384 (32 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 18 | communaute-creation-club-etape4 | 1440x900 clair | 70 459 px (24,2 %) | y 768–832 (32 %), y 384–448 (32 %), y 64–128 (32 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 19 | communaute-creation-post-etape3 | 768x1024 clair | 69 994 px (23,1 %) | y 256–320 (46 %), y 192–256 (39 %), y 768–832 (38 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 628px / maquette 484px |
| 20 | communaute-creation-post-etape2 | 768x1024 clair | 69 207 px (22,8 %) | y 256–320 (64 %), y 192–256 (40 %), y 768–832 (39 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 628px / maquette 484px |
| 21 | communaute-creation-sortie-etape2 | 768x1024 clair | 65 647 px (22,1 %) | y 192–256 (41 %), y 448–512 (41 %), y 768–832 (38 %) | 520×991 / 390×844 | Pied de formulaire · y : app 922.2px / maquette 770px ; Tiroir · hauteur : app 926px / maquette 782px ; Corps du formulaire · hauteur : app 686px / maquette 542px |
| 22 | communaute-creation-club-etape1 | 1440x900 clair | 65 568 px (22,5 %) | y 192–256 (45 %), y 768–832 (43 %), y 320–384 (29 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 23 | communaute-creation-club-etape3 | 1440x900 clair | 65 024 px (22,3 %) | y 448–512 (42 %), y 192–256 (32 %), y 64–128 (32 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 24 | communaute-creation-sortie-etape2 | 1440x900 clair | 64 828 px (22,2 %) | y 448–512 (51 %), y 768–832 (49 %), y 256–320 (48 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |
| 25 | communaute-creation-post-etape2 | 1440x900 clair | 64 754 px (21,7 %) | y 320–384 (51 %), y 768–832 (49 %), y 256–320 (32 %) | 520×867 / 390×844 | Tiroir · largeur : app 430px / maquette 374px ; Capsule des 6 types · largeur : app 402px / maquette 346px ; Corps du formulaire · largeur : app 430px / maquette 374px |

### Écarts de mesure récurrents

| Élément | Propriété | Occurrences | Valeur app (exemple) | Valeur maquette (exemple) |
| --- | --- | --- | --- | --- |
| Communauté · Corps du formulaire | y | 79 | 280.2px | 258px |
| Communauté · Corps du formulaire | hauteur | 79 | 518px | 512px |
| Communauté · Tiroir | x | 60 | 45px | 8px |
| Communauté · Tiroir | y | 60 | 56.2px | 48px |
| Communauté · Tiroir | largeur | 60 | 430px | 374px |
| Communauté · Tiroir | hauteur | 60 | 802px | 782px |
| Communauté · Aperçu du formulaire | hauteur | 59 | 136px | 122px |
| Communauté · Capsule des 6 types | x | 42 | 59px | 22px |
| Communauté · Capsule des 6 types | y | 42 | 74.2px | 66px |
| Communauté · Capsule des 6 types | largeur | 42 | 402px | 346px |
| Communauté · Corps du formulaire | x | 42 | 45px | 8px |
| Communauté · Corps du formulaire | largeur | 42 | 430px | 374px |
| Communauté · Pied de formulaire | x | 42 | 45px | 8px |
| Communauté · Pied de formulaire | y | 42 | 798.2px | 770px |
| Communauté · Pied de formulaire | largeur | 42 | 430px | 374px |
| Communauté · Aperçu du formulaire | x | 40 | 59px | 22px |
| Communauté · Aperçu du formulaire | y | 40 | 138.2px | 130px |
| Communauté · Aperçu du formulaire | largeur | 40 | 402px | 346px |
| Carnet · Bouton « Ouvrir le carnet » | x | 28 | 261.9px | 224.2px |
| Carnet · Bouton « Ouvrir le carnet » | largeur | 28 | 142.1px | 139.8px |

### Non atteignable (raison écrite, rien d'inventé)

| Scénario | Projets | Raison |
| --- | --- | --- |
| carnet-carte-indisponible | 1440x900 clair, 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair | non atteignable : maquette : la maquette n’a pas d’état « Carte indisponible » (carte dessinée en SVG, sans WebGL) ; couvert par CompteMapUnavailable.test.tsx (mock du contexte WebGL) |
| carnet-chargement | 1440x900 clair | non atteignable : app : Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4029/carnets/00000000-0000-4000-8000-0000000010ad |
| carnet-creer-etape2 | 1440x900 clair | non atteignable : app : Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4029/carnets/749e9e8c-9540-5a73-8b6c-6ab07264f62f |
| carnet-hors-ligne | 1440x900 clair, 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair | non atteignable : maquette : la maquette ne montre aucun état hors ligne (bandeau « Hors ligne » : texte de la spec § 8, sans rendu de référence) ; couvert par CarnetFinition.test.tsx « hors ligne » |
| carnet-resume-vide | 1440x900 clair | non atteignable : app : Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4029/carnets/00000000-0000-4000-8000-00000000e0e0 |
| carnet-resume-visiteur | 1440x900 clair | non atteignable : app : Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4029/carnets/749e9e8c-9540-5a73-8b6c-6ab07264f62f |
| carnet-stories | 1440x900 clair | non atteignable : app : Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4029/carnets/00000000-0000-4000-8000-0000000051f0 |
| carnet-tiroir-erreur | 1440x900 clair, 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair | non atteignable : app : CarnetDrawerV2 n’a aucun état d’erreur de slot ni bouton « Réessayer » (CHECKLIST-100 l.76 ouverte) : rien à atteindre côté app |
| carnet-modif-tiroir-fil | 360x780 clair, 390x844 clair, 430x932 clair | non atteignable : app : Error: étape 4 (app) {"click":{"css":".lkdv-ig-stat","nth":0}} : TimeoutError: locator.click: Timeout 8000ms exceeded. |

Galerie côte à côte (app | maquette | carte de diff) : `tests/fidelity/out/galerie.html` (ignorée par git ; régénérée par le rapport).

## Journal

| Date | Lot | Résultat | Preuve |
| --- | --- | --- | --- |
| 2026-11-09 | État des lieux | Communauté : 161 fait / 23 partiel / 13 reporté / 3 non fait (COUVERTURE-200), 2 bloqués J-08 ; Carnet : checklist 40 [x] / 5 [~] / 8 [ ], 3 failles RLS ouvertes | rapports scout, prompt §4 |
| 2026-11-11 | Communauté, passe 2 (b0dc9e9…e4d3d1d) | Banc à fond neutralisé (zone du tiroir seule). 390×844 : Recherche accueil 26,8 → 1,8 %, résultats 15,7 → 1,2 %, peek 4,7 → 0,8 %, carnets 0,6 %, invité 0,6 %, vide 0,4 %, erreur 1,5 %, chargement 0,0 % ; Clubs 16,4 %, Sorties 11,1 %, Création étape 1 17,1 % ; 23/33 cellules sous 2 % ; mesures 1356/1356 | tsc 0, vitest community 396/396, build vert, e2e Chromium verts (Échap 12/12), axe 4/4 ; WebKit non jouable (binaire non téléchargeable) |
| 2026-11-10 | Carnet, passe 1 (46be4dc…17e180a) | Résumé 41,5 → 30,3 % px (mesures 48→64/69) ; J1 31,9 → 31,2 % (44→60/65) ; tiroirs 41–53 → 13–38 % (16→31/31) ; checklist l.27/36/38/61/63/76/78 faites, l.29/71/77 partielles | tsc 0, vitest carnet/compte 620/620, e2e finition 14/14, next build vert |
| 2026-11-10 | Sécurité carnet (a01454f, 8d082ad) | Auto-inscription, moments chez autrui, sortie d'intrus : fermés | pgTAP local 12/12 + 15/15, relecture architect, rollback rejouable ; non appliqué en production (pas d'accès) |
| 2026-11-10 | Migration moment_type (20261109100001) | Additive (2 colonnes + contraintes) | pgTAP local 8/8, rollback ×2, réapplication ×2 ; non appliquée en production |
| 2026-11-10 | Communauté, passe 1 (571173b…85b36f6) | 26 points partiels/non faits clos (4 dépendent de la prod) ; mesures 224 → 333/345 (96,5 %) ; contraste libellés 1,3 → 4,84:1 ; cibles < 44 px 32 → 0 ; pixels encore 34–85 % (fond photo vs illustration) | tsc 0, vitest community 396/396, next build vert, e2e 44 verts / 2 rouges d'Échap instables (11a rouge aussi sans le commit) |
| 2026-11-10 | Carnet · passe 2 (branche `worktree-agent-a786990054a55d737`) | Mode modification complet (Server Actions zod), note vocale réelle, tiroir Carnet réel, stories, lentilles et fiches de la maquette ; banc élargi à 23 scénarios × 4 tailles. Moyennes à 430 clair : Résumé 30,8 → 3,2 %, J1 30,2 → 3,5 %, tiroirs 24–42 → 4,6–12,6 %. axe 0 critique / 0 sérieux. | `tests/fidelity/out/`, `handoff/carnet-v2/CHECKLIST-100.md` |
| 2026-11-11 | Communauté, passe 3 (629212b…) | Clubs 16,4 → 0,3 % (390), Sorties 11,4 → 1,3 %, Création publication étape 1 17,3 → 1,6 %, Recherche accueil 2,1 → 1,0 % (360 : 1,9 → 1,4 %) ; 360/390/430 : toutes les cellules Explorer et Recherche sous 2 %, mesures 100 % ; 20 scénarios de création (étapes 2-4 de chaque type) ajoutés, 5 à 36 % (contenu propre à chaque formulaire) ; contraste des libellés 2,63 → 6,51:1, cibles < 44 px 66 → 0 | tsc 0, eslint 0 erreur, vitest community 401/401, next build vert, e2e Chromium mobile 46 verts / 12 sautés (base réelle ou drapeau), axe 12/12, audit transverses (50 états, 124 libellés) |

## Communauté v2 · passe 3 : tableau avant / après (banc, fond neutralisé, thème clair)

Cellule = % de pixels différents (objectif ≤ 2 %), à 360 / 390 / 430. « Avant » = début de passe 3.

| Écran · état | Avant | Après |
| --- | --- | --- |
| Explorer · carnets (chargé / invité / vide / erreur / chargement) | 1,0·0,6·0,6 / 1,0·0,6·0,6 / 0,9·0,5·0,1 / 1,8·1,5·1,2 / 0 | 1,0·0,6·0,6 / 1,0·0,6·0,6 / 0,1·0,1·0,1 / 1,8·1,5·1,3 / 0 |
| Explorer · clubs | 17,1 · 16,4 · 13,7 | 0,4 · 0,3 · 1,8 |
| Explorer · sorties | 13,9 · 11,4 · 11,3 | 0,8 · 1,3 · 1,3 |
| Recherche · accueil | 1,9 · 2,1 · 2,0 | 1,4 · 1,0 · 0,6 |
| Recherche · résultats | 1,6 · 1,1 · 1,0 | 1,4 · 1,0 · 1,3 |
| Aperçu (appui long) | 1,0 · 0,8 · 1,1 | 1,0 · 0,8 · 1,1 |
| Création · publication · étape 1 | 19,8 · 17,3 · 15,8 | 1,8 · 1,6 · 1,1 |
| Création · publication · étapes 2 / 3 | non scénarisées (1er passage : 28,4 / 27,1 à 390) | 11,2·9,8·8,2 / 13,4·11,4·9,7 |
| Création · story · étapes 1-3 | idem (12,1 / 21,3 / 19,6) | 9,3·8,4·7,2 / 12,8·11,7·11,6 / 15,5·14,6·12,7 |
| Création · carnet · étapes 1-4 | idem (22,4 / 38,4 / 10,1 / 23,5) | 10,4·10,0·8,6 / 31,9·35,8·35,0 / 7,3·6,5·5,4 / 11,2·10,1·8,4 |
| Création · sortie · étapes 1-4 | idem (16,5 / 20,4 / 14,0 / 24,5) | 7,1·7,2·10,4 / 14,1·12,5·10,8 / 11,0·8,5·6,6 / 10,6·8,4·9,2 |
| Création · kit · étapes 1-3 | idem (16,7 / 17,6 / 20,2) | 15,9·17,7·18,0 / 15,8·14,3·15,7 / 9,9·8,7·7,2 |
| Création · club · étapes 1-4 | idem (23,0 / 29,3 / 24,0 / 25,0) | 14,6·14,6·16,4 / 18,2·16,6·14,6 / 13,8·15,5·14,0 / 20,7·18,8·16,0 |

Restes, avec raison :
- **Création, étapes 2-4 et étapes 1 des cinq autres types** : le contenu des formulaires diffère de la maquette champ par champ (rangées d'inventaire du kit, carte et choix du tracé du carnet, champs et textes d'aide du club et de la sortie, aperçus propres à chaque type, cartes MapLibre contre carte dessinée). Rien n'est masqué : chiffres bruts. Prochaine passe, par formulaire.
- **Création, étape 1** : libellé « Photo » contre « Photo / vidéo » (vidéo reportée en publication, 01-SPEC § 6), fond du bouton « Retour » désactivé, glyphes de texte (masqués), 4 mesures sur 116.
- **Recherche accueil** : la saisie est masquée (placeholder #46584D à 7:1, AA, contre #8A968D à 2,9:1 de la maquette : accessibilité assumée) ; démasquée, 1,8 à 2,5 % selon la taille (mesuré avant le masquage). Position, police et décalage de 2 px de la saisie sont mesurés.
- **Sorties, Clubs** : carte topo du billet, textes de données, chiffres en police mono masqués ; jeu de données = jeu exact de la maquette (tests/fidelity/scenarios/maquetteData.ts), fixtures de recette inchangées.
- Joué le 2026-11-11 : 768 et 1440 px (comparaison de cadre, non représentative) ; thème sombre non comparable (maquette sans rendu sombre, †) ; WebKit non joué (binaire indisponible).

## Décisions ouvertes (Tony) — état au 2026-11-11

Chaque décision est écrite avec la valeur appliquée aujourd'hui et l'option recommandée ;
le chantier ne se déclare pas 100 % tant qu'une ligne n'est pas tranchée.

| # | Décision | Appliqué aujourd'hui | Recommandation |
| --- | --- | --- | --- |
| D1 | **Édition du carnet** : spec (menu de la pastille titre + `+`) ou crayon rond du 07/11 ? | Spec `handoff/carnet-v2` (menu + `+`) | Garder la spec : un seul chemin d'édition, banc vert ; le crayon peut revenir derrière un réglage sans régression |
| D2 | **Équipage › Commentaires** : lentille séparée ou dans « Réactions » ? | Dans « Réactions » | Garder dans « Réactions » : la maquette n'a pas de 6ᵉ lentille, et les commentaires de moment vivent déjà dans la fiche du moment |
| D3 | **Chips 28 px** de la Communauté contre la règle 44 px | 44 px partout (0 cible < 44 px sur les deux écrans) | Garder 44 px (accessibilité) ; la maquette 28 px reste une dérogation documentée |
| D4 | **Ombre de l'île** en `rgba(0,0,0,.35)` | Ombre à l'encre `rgba(11,31,23,…)` | Garder l'encre (règle du design système) |
| D5 | **13 points reportés** de la Communauté (`01-SPEC-PRODUIT.md` §6) | Reportés, listés dans `COUVERTURE-200.md` | Rester reportés sauf décision contraire ; ils ne bloquent ni la fiche ni le hub |
| D6 | **Accès anonyme** à `/carnets` : middleware = session obligatoire | Session obligatoire, `/connexion?next=/carnets` | Garder : l'app est réservée aux connectés (consentement et RLS) ; ouvrir la fiche publique est un chantier produit à part |
| D7 | **Écart résiduel de fidélité** (voir section Scores) : accepter les causes nommées ou relancer une passe ? | Causes nommées ici (anticrénelage 1–3 %, icônes lucide partagées, champs 16 px anti-zoom iOS, stories masquées, cadre 768/1440) | Accepter : ce sont des choix UX/accessibilité assumés, aucun n'est un défaut fonctionnel ; une passe dédiée peut viser les icônes dessinées |
| D8 | **iPhone réel & WebKit** | Non testés ici (aucun appareil, binaire WebKit non téléchargeable dans cet environnement) | Recette rapide sur l'URL de production depuis un iPhone réel |
| D9 | **Formulaires de création, étapes 2 à 4** (écarts 8–36 % au banc) : la maquette dessine des formulaires simplifiés ; l'app implémente les champs réels (objets du kit, aperçus, carte, questions d'adhésion) | Champs réels, chrome et étape 1 alignés sur la maquette | Garder le fonctionnel réel : les champs portent des données indispensables (inventaire, aperçus, validation) que la maquette ne dessine pas ; l'alignement se limite au chrome (fait) |
| D10 | **Icônes des tiroirs** (écarts 4,6–12,6 %) : primitives lucide partagées avec `/compte` contre icônes dessinées de la maquette | Lucide (cohérence inter-écrans, une seule famille) | Garder Lucide : la cohérence du système prime sur le dessin de la maquette ; une passe d'icônes dédiées est possible plus tard |
| D11 | **Champs des feuilles à 16 px** (mode modification, création : 9–12 %) contre 12,5 px dans la maquette | 16 px (évite le zoom iOS au focus) | Garder 16 px : contrainte iOS réelle, la maquette est en dessous du seuil d'accessibilité |
| D12 | **Stories : zone sûre** (32 px app contre 70 px maquette ; bouton ··· 44 px contre 34) | Safe-area réelle de l'appareil, cibles 44 px | Garder : la maquette simule une safe-area ; la règle 44 px est non négociable |

## Bloqué par Tony / hors périmètre de cet environnement

- **iPhone réel** : recette tactile/safe-areas à faire sur appareil (l'URL de production est prête).
- **WebKit** : binaire non téléchargeable dans cet environnement ; le banc tourne en Chromium.
- Le reste de l'ancien blocage est levé : accès base de production opérationnel (MCP), migrations
  appliquées, drapeaux `NEXT_PUBLIC_COMMUNAUTE_V2` / `NEXT_PUBLIC_CARNET_V2` posés en production,
  déploiement vérifié.

## Clôture du chantier (2026-11-11)

- Communauté v2 : `COUVERTURE-200.md` = **0 partiel, 0 non fait, 13 reportés** (décision D5), création
  des 6 types scénarisée, axe 12/12, cibles 44 px 0 dérogation, contrastes AA.
- Fiche Carnet v2 : `CHECKLIST-100.md` = **0 case ouverte** ; migrations appliquées en production ;
  portes vertes ; axe 0 critique/sérieux ; pixel : causes résiduelles nommées (D7).
- Banc de fidélité rejoué le 2026-11-11 sur 360×780, 390×844, 430×932, 768×1024, 1440×900 (clair),
  **285 tests verts**, 270 cellules mesurées : 27 conformes, 220 avec écart, 23 non atteignables.
  - **Tailles mobiles 360/390/430 (représentatives)** : **34 cellules ≤ 2 %**, moyenne 8,2 %,
    **mesures DOM 96,4 %**, 12 non atteignables (états sans référence maquette : hors ligne,
    carte WebGL indisponible, erreur de slot forcée — couverts par les tests RTL).
  - **768/1440** : moyenne 22,4 % et mesures 58 % = **mesure de cadre**, pas de rendu (la maquette
    affiche un téléphone 390 dans un cadre, l'app une colonne applicative) : chiffres conservés
    pour la trace, non comptés comme écarts de l'app.
  - Sombre : non joué, la maquette n'a pas de rendu sombre (†) ; couvert par les tokens et l'axe.
  - Accessibilité : axe 0 critique/0 sérieux sur la fiche (participant, 5 tiroirs, tiroir Carnet,
    mode modification + feuille, visiteur) à 430, et **6/6 rejoués à 768 et 1440** (les 3 échecs du
    premier passage venaient de deux bancs concurrents sur la même machine, rejoués seuls : verts).
- Les 220 cellules en écart sont toutes triées : causes nommées ci-dessous et dans la section
  « Écart résiduel » de `CHECKLIST-100.md` — aucune n'est un défaut fonctionnel non identifié.
  Décisions D9 à D12 : formulaires réels contre formulaires dessinés, icônes Lucide partagées,
  champs 16 px anti-zoom, safe-area réelle et cibles 44 px.
- Sombre : la maquette n'a pas de rendu sombre (moins de 3 % de pixels changent en clair/sombre) ;
  le thème sombre est couvert par les tests de tokens et l'axe, pas par une comparaison pixel.

