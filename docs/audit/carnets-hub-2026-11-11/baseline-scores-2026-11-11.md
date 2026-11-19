## Scores (banc de fidélité)

Banc : `tests/fidelity/` (config `fidelity.config.ts`, scénarios `scenarios/{communaute,carnet}.ts`). Passage du 2026-11-11. Projets joués : 390x844 clair, 430x932 clair. Pas encore joués : 360×780, 430×932, 768×1024.

Lancer : `bash tests/fidelity/build.sh` (un seul build, mode fixtures), puis `npx playwright test --config=tests/fidelity/fidelity.config.ts`, puis `node scripts/fidelity/report.mjs` (réécrit cette section et `tests/fidelity/out/galerie.html`). Variables : `FIDELITY_SIZES`, `FIDELITY_THEMES`, `FIDELITY_ONLY`, `FIDELITY_STRICT=1` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | 46 (0 conformes, 40 avec écart, 6 non atteignables, 0 en erreur) |
| Dont sombre sans référence (†) | 0 : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | 2 / 40 |
| Différence pixel moyenne | 7,8 % |
| Mesures DOM conformes | 1862 / 1946 (95,7 %) |

**Fond neutralisé (Communauté).** Le tiroir est en verre translucide : ses pixels dépendent du fond. L'app montre la photo réelle de `/communaute` et la page derrière, la maquette une illustration verte (X1, non comparable). Pour que le chiffre mesure le **tiroir seul**, le banc (`lib/neutral.ts`, banc uniquement, l'app réelle n'est jamais modifiée) rend invisible tout ce qui n'appartient pas au tiroir, peint le même aplat uni (`rgb(200, 200, 200)`) derrière lui dans les deux captures et ne compare que la zone du tiroir (le reste du cadre est masqué et retiré du dénominateur). `FIDELITY_RAW_BG=1` rejoue la capture brute (fond réel des deux côtés).

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (`masques`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

| Écran · état (rôle) | 390x844 clair | 430x932 clair |
| --- | --- | --- |

### Fiche Carnet v2

| Écran · état (rôle) | 390x844 clair | 430x932 clair |
| --- | --- | --- |
| Carnet · carte du bas · carte indisponible (WebGL refusé) (participant) | non atteignable | non atteignable |
| Carnet · Résumé · chargement (squelette) (participant) | 3,5 % · 0/0 | 3,2 % · 0/0 |
| Carnet · feuille Créer · étape 2 : formulaire d’un moment texte (participant) | 8,7 % · 0/0 | 8,7 % · 0/0 |
| Carnet · Résumé · hors ligne (participant) | non atteignable | non atteignable |
| Carnet · Jour 1 · chargé (participant) | 3,7 % · 119/122 | 3,4 % · 119/122 |
| Carnet · Jour 1 · mode modification (participant) | 10,1 % · 94/97 | 9,0 % · 94/97 |
| Carnet · Résumé · mode modification (participant) | 11,5 % · 94/97 | 10,9 % · 94/97 |
