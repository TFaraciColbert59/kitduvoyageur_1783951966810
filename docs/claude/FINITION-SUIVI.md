# Suivi — Finition Communauté v2 et Carnet v2

Prompt de référence : `docs/claude/PROMPT-FINITION-COMMUNAUTE-CARNET.md`. Seul fichier d'état de ce chantier ; chiffres prouvés par le banc `tests/fidelity/`.

## Scores (banc de fidélité)

Banc : `tests/fidelity/` (config `fidelity.config.ts`, scénarios `scenarios/{communaute,carnet}.ts`). Passage du 2026-11-10. Projets joués : 360x780 clair, 390x844 clair, 430x932 clair. Pas encore joués : 360×780, 430×932, 768×1024.

Lancer : `bash tests/fidelity/build.sh` (un seul build, mode fixtures), puis `npx playwright test --config=tests/fidelity/fidelity.config.ts`, puis `node scripts/fidelity/report.mjs` (réécrit cette section et `tests/fidelity/out/galerie.html`). Variables : `FIDELITY_SIZES`, `FIDELITY_THEMES`, `FIDELITY_ONLY`, `FIDELITY_STRICT=1` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | 33 (23 conformes, 10 avec écart, 0 non atteignables, 0 en erreur) |
| Dont sombre sans référence (†) | 0 : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | 23 / 33 |
| Différence pixel moyenne | 4,8 % |
| Mesures DOM conformes | 1356 / 1356 (100,0 %) |

**Fond neutralisé (Communauté).** Le tiroir est en verre translucide : ses pixels dépendent du fond. L'app montre la photo réelle de `/communaute` et la page derrière, la maquette une illustration verte (X1, non comparable). Pour que le chiffre mesure le **tiroir seul**, le banc (`lib/neutral.ts`, banc uniquement, l'app réelle n'est jamais modifiée) rend invisible tout ce qui n'appartient pas au tiroir, peint le même aplat uni (`rgb(200, 200, 200)`) derrière lui dans les deux captures et ne compare que la zone du tiroir (le reste du cadre est masqué et retiré du dénominateur). `FIDELITY_RAW_BG=1` rejoue la capture brute (fond réel des deux côtés).

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (`masques`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

| Écran · état (rôle) | 360x780 clair | 390x844 clair | 430x932 clair |
| --- | --- | --- | --- |
| Création · publication · étape 1 (membre) | 19,8 % · 31/31 | 17,1 % · 31/31 | 15,2 % · 31/31 |
| Explorer · carnets · chargement (squelette) (membre) | 0,0 % · 30/30 ✓ | 0,0 % · 30/30 ✓ | 0,0 % · 30/30 ✓ |
| Explorer · carnets · erreur de chargement (membre) | 1,8 % · 25/25 ✓ | 1,5 % · 25/25 ✓ | 1,2 % · 25/25 ✓ |
| Explorer · carnets · chargé (invite) | 1,0 % · 38/38 ✓ | 0,6 % · 38/38 ✓ | 0,6 % · 38/38 ✓ |
| Explorer · carnets · vide (membre) | 0,6 % · 33/33 ✓ | 0,4 % · 33/33 ✓ | 0,2 % · 33/33 ✓ |
| Explorer · carnets · chargé (membre) | 1,0 % · 45/45 ✓ | 0,6 % · 45/45 ✓ | 0,6 % · 45/45 ✓ |
| Explorer · clubs · chargé (membre) | 17,0 % · 45/45 | 16,4 % · 45/45 | 13,4 % · 45/45 |
| Explorer · sorties · chargé (membre) | 13,2 % · 38/38 | 11,1 % · 38/38 | 11,3 % · 38/38 |
| Explorer · carnets · aperçu (appui long sur une tuile) (membre) | 1,0 % · 4/4 ✓ | 0,8 % · 4/4 ✓ | 1,1 % · 4/4 ✓ |
| Explorer · recherche · accueil de la recherche (membre) | 2,4 % · 114/114 | 1,8 % · 114/114 ✓ | 1,9 % · 114/114 ✓ |
| Explorer · recherche · résultats pour « ecrins » (membre) | 1,5 % · 49/49 ✓ | 1,2 % · 49/49 ✓ | 1,1 % · 49/49 ✓ |

### Fiche Carnet v2

| Écran · état (rôle) | 360x780 clair | 390x844 clair | 430x932 clair |
| --- | --- | --- | --- |

### Écarts triés par surface de différence (25 premiers)

| # | Scénario | Projet | Pixels différents | Bandes les plus différentes | Cadres app / maquette | Mesures en échec (3 plus grosses) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | communaute-creation-publication-etape1 | 430x932 clair | 54 567 px (15,2 %) | y 192–256 (75 %), y 256–320 (33 %), y 448–512 (16 %) | 430×932 / 430×932 | — |
| 2 | communaute-creation-publication-etape1 | 390x844 clair | 50 147 px (17,1 %) | y 192–256 (74 %), y 256–320 (33 %), y 448–512 (16 %) | 390×844 / 390×844 | — |
| 3 | communaute-creation-publication-etape1 | 360x780 clair | 48 796 px (19,8 %) | y 192–256 (74 %), y 256–320 (34 %), y 640–704 (23 %) | 360×780 / 360×780 | — |
| 4 | communaute-explorer-clubs | 430x932 clair | 41 401 px (13,4 %) | y 320–384 (44 %), y 832–896 (30 %), y 128–192 (23 %) | 430×932 / 430×932 | — |
| 5 | communaute-explorer-clubs | 390x844 clair | 39 086 px (16,4 %) | y 320–384 (45 %), y 640–704 (28 %), y 128–192 (25 %) | 390×844 / 390×844 | — |
| 6 | communaute-explorer-sorties | 430x932 clair | 37 243 px (11,3 %) | y 704–768 (28 %), y 512–576 (19 %), y 256–320 (14 %) | 430×932 / 430×932 | — |
| 7 | communaute-explorer-clubs | 360x780 clair | 36 391 px (17,0 %) | y 320–384 (44 %), y 640–704 (30 %), y 128–192 (26 %) | 360×780 / 360×780 | — |
| 8 | communaute-explorer-sorties | 360x780 clair | 30 107 px (13,2 %) | y 512–576 (32 %), y 576–640 (27 %), y 704–768 (22 %) | 360×780 / 360×780 | — |
| 9 | communaute-explorer-sorties | 390x844 clair | 29 688 px (11,1 %) | y 704–768 (31 %), y 512–576 (19 %), y 256–320 (13 %) | 390×844 / 390×844 | — |
| 10 | communaute-recherche-accueil | 430x932 clair | 5 125 px (1,9 %) | y 128–192 (8 %), y 192–256 (4 %), y 256–320 (3 %) | 430×932 / 430×932 | — |
| 11 | communaute-explorer-carnets-erreur | 360x780 clair | 4 355 px (1,8 %) | y 192–256 (14 %), y 256–320 (6 %) | 360×780 / 360×780 | — |
| 12 | communaute-explorer-carnets-erreur | 430x932 clair | 4 352 px (1,2 %) | y 192–256 (12 %), y 256–320 (5 %) | 430×932 / 430×932 | — |
| 13 | communaute-explorer-carnets-erreur | 390x844 clair | 4 305 px (1,5 %) | y 192–256 (13 %), y 256–320 (5 %) | 390×844 / 390×844 | — |
| 14 | communaute-recherche-accueil | 360x780 clair | 4 266 px (2,4 %) | y 128–192 (8 %), y 192–256 (5 %), y 256–320 (3 %) | 360×780 / 360×780 | — |
| 15 | communaute-recherche-accueil | 390x844 clair | 3 933 px (1,8 %) | y 128–192 (9 %), y 192–256 (5 %) | 390×844 / 390×844 | — |
| 16 | communaute-recherche-resultats | 430x932 clair | 3 496 px (1,1 %) | y 512–576 (8 %) | 430×932 / 430×932 | — |
| 17 | communaute-recherche-resultats | 360x780 clair | 3 413 px (1,5 %) | y 512–576 (6 %), y 192–256 (4 %), y 384–448 (2 %) | 360×780 / 360×780 | — |
| 18 | communaute-recherche-resultats | 390x844 clair | 3 236 px (1,2 %) | y 512–576 (4 %), y 192–256 (3 %), y 384–448 (2 %) | 390×844 / 390×844 | — |
| 19 | communaute-explorer-carnets-vide | 360x780 clair | 1 421 px (0,6 %) | y 256–320 (3 %), y 192–256 (3 %) | 360×780 / 360×780 | — |
| 20 | communaute-explorer-carnets-vide | 390x844 clair | 1 299 px (0,4 %) | y 256–320 (4 %) | 390×844 / 390×844 | — |
| 21 | communaute-peek-carnet | 430x932 clair | 1 213 px (1,1 %) | y 640–704 (5 %), y 448–512 (4 %), y 704–768 (3 %) | 430×932 / 430×932 | — |
| 22 | communaute-explorer-carnets-invite | 360x780 clair | 975 px (1,0 %) | y 704–768 (4 %), y 640–704 (3 %) | 360×780 / 360×780 | — |
| 23 | communaute-explorer-carnets | 360x780 clair | 975 px (1,0 %) | y 704–768 (4 %), y 640–704 (3 %) | 360×780 / 360×780 | — |
| 24 | communaute-peek-carnet | 360x780 clair | 896 px (1,0 %) | y 256–320 (4 %), y 576–640 (4 %), y 512–576 (3 %) | 360×780 / 360×780 | — |
| 25 | communaute-peek-carnet | 390x844 clair | 756 px (0,8 %) | y 576–640 (4 %), y 640–704 (4 %) | 390×844 / 390×844 | — |

### Écarts de mesure récurrents

| Élément | Propriété | Occurrences | Valeur app (exemple) | Valeur maquette (exemple) |
| --- | --- | --- | --- | --- |
| — | — | 0 | — | — |

### Non atteignable (raison écrite, rien d'inventé)

| Scénario | Projets | Raison |
| --- | --- | --- |
| — | — | — |

Galerie côte à côte (app | maquette | carte de diff) : `tests/fidelity/out/galerie.html` (ignorée par git ; régénérée par le rapport).

## Journal

| Date | Lot | Résultat | Preuve |
| --- | --- | --- | --- |
| 2026-11-09 | État des lieux | Communauté : 161 fait / 23 partiel / 13 reporté / 3 non fait (COUVERTURE-200), 2 bloqués J-08 ; Carnet : checklist 40 [x] / 5 [~] / 8 [ ], 3 failles RLS ouvertes | rapports scout, prompt §4 |
| 2026-11-10 | Carnet, passe 1 (46be4dc…17e180a) | Résumé 41,5 → 30,3 % px (mesures 48→64/69) ; J1 31,9 → 31,2 % (44→60/65) ; tiroirs 41–53 → 13–38 % (16→31/31) ; checklist l.27/36/38/61/63/76/78 faites, l.29/71/77 partielles | tsc 0, vitest carnet/compte 620/620, e2e finition 14/14, next build vert |
| 2026-11-10 | Sécurité carnet (a01454f, 8d082ad) | Auto-inscription, moments chez autrui, sortie d'intrus : fermés | pgTAP local 12/12 + 15/15, relecture architect, rollback rejouable ; non appliqué en production (pas d'accès) |
| 2026-11-10 | Migration moment_type (20261109100001) | Additive (2 colonnes + contraintes) | pgTAP local 8/8, rollback ×2, réapplication ×2 ; non appliquée en production |
| 2026-11-10 | Communauté, passe 1 (571173b…85b36f6) | 26 points partiels/non faits clos (4 dépendent de la prod) ; mesures 224 → 333/345 (96,5 %) ; contraste libellés 1,3 → 4,84:1 ; cibles < 44 px 32 → 0 ; pixels encore 34–85 % (fond photo vs illustration) | tsc 0, vitest community 396/396, next build vert, e2e 44 verts / 2 rouges d'Échap instables (11a rouge aussi sans le commit) |
| 2026-11-10 | Communauté, passe 2 (b0dc9e9…b2688a1) | Banc à fond neutralisé (aplat `rgb(200,200,200)` des deux côtés, zone = tiroir) : départ 0,5–26,8 % → 23/33 cellules ≤ 2 % ; mesures DOM 1356/1356 (360, 390, 430) ; invité : île « Se connecter » d'abord ; Échap 11a/6f : écouteur attendu | tsc 0, eslint 0 erreur, vitest community 396/396, next build vert, e2e Chromium (11a/6f/8b ×4) 12/12, axe 4/4 ; WebKit non testé ici (binaire non téléchargeable : accès réseau refusé par le proxy) |

### Passe 2 — écarts résiduels chiffrés (390×844, fond neutralisé)

| Scénario | Avant | Après | Reste, et pourquoi |
| --- | --- | --- | --- |
| Recherche accueil | 26,8 % | 1,8 % (2,4 % à 360) | Placeholder gardé à l'encre AA (`#46584D`, la maquette : `#8A968D`, 3:1), encre pleine des surtitres (FID-080), glyphes (anticrénelage). |
| Recherche résultats | 15,7 % | 1,2 % | Anticrénelage du texte surligné. |
| Peek carnet | 4,7 % | 0,8 % | Anticrénelage. |
| Carnets chargé / invité / vide / chargement / erreur | 4,9 / 5,2 / 3,9 / 0,5 / 2,3 % | 0,6 / 0,6 / 0,4 / 0,0 / 1,5 % | Erreur : icône danger et anticrénelage. |
| Clubs | 18,6 % | 16,4 % | **Données** : états d'adhésion (Rejoindre sombre, Membre clair, Demander), cadenas, blasons et libellés différents (fixtures contre `CLUBS` de la maquette), police mono de repli. Structure : mesures 45/45. |
| Sorties | 14,9 % | 11,1 % | **Données** : dates des billets, états d'inscription, cartes topo, météo, libellés « Billets / Liste » (maquette « Grille / Liste », décision Sorties#3). Mesures 38/38. |
| Création étape 1 | 18,3 % | 17,1 % | **Contenu du formulaire** non repris : cartes de format en verre, rangées d'audience à icône et radio à droite, aperçu illustré. Géométrie (corps, aperçu, pied, capsule) 31/31. Reste à faire. |

Écarts de produit volontaires, retirés ou masqués par le banc et listés ici : pilule « Mode invité · lecture seule » (ajout de l'app), compteurs « publications » contre « recherches » et « sorties » (décision documentée dans `SearchHome.tsx`), plaque des surtitres (AA), placeholder AA.

## Décisions ouvertes (Tony)

Voir prompt §5.

## Bloqué par Tony

Voir prompt §6.
