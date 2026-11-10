# Suivi — Finition Communauté v2 et Carnet v2

Prompt de référence : `docs/claude/PROMPT-FINITION-COMMUNAUTE-CARNET.md`. Seul fichier d'état de ce chantier ; chiffres prouvés par le banc `tests/fidelity/`.

## Scores (banc de fidélité)

Banc : `tests/fidelity/` (config `fidelity.config.ts`, scénarios `scenarios/{communaute,carnet}.ts`). Passage du 2026-11-10. Projets joués : 390x844 clair. Pas encore joués : 360×780, 430×932, 768×1024.

Lancer : `bash tests/fidelity/build.sh` (un seul build, mode fixtures), puis `npx playwright test --config=tests/fidelity/fidelity.config.ts`, puis `node scripts/fidelity/report.mjs` (réécrit cette section et `tests/fidelity/out/galerie.html`). Variables : `FIDELITY_SIZES`, `FIDELITY_THEMES`, `FIDELITY_ONLY`, `FIDELITY_STRICT=1` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | 11 (0 conformes, 11 avec écart, 0 non atteignables, 0 en erreur) |
| Dont sombre sans référence (†) | 0 : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | 0 / 11 |
| Différence pixel moyenne | 51,6 % |
| Mesures DOM conformes | 333 / 345 (96,5 %) |

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (`masques`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

| Écran · état (rôle) | 390x844 clair |
| --- | --- |
| Création · publication · étape 1 (membre) | 51,2 % · 18/19 |
| Explorer · carnets · chargement (squelette) (membre) | 37,1 % · 24/25 |
| Explorer · carnets · erreur de chargement (membre) | 53,9 % · 24/25 |
| Explorer · carnets · chargé (invite) | 49,2 % · 36/38 |
| Explorer · carnets · vide (membre) | 53,7 % · 33/33 |
| Explorer · carnets · chargé (membre) | 44,4 % · 44/45 |
| Explorer · clubs · chargé (membre) | 41,1 % · 43/45 |
| Explorer · sorties · chargé (membre) | 34,1 % · 36/38 |
| Explorer · carnets · aperçu (appui long sur une tuile) (membre) | 84,7 % · 3/4 |
| Explorer · recherche · accueil de la recherche (membre) | 55,2 % · 39/40 |
| Explorer · recherche · résultats pour « ecrins » (membre) | 63,3 % · 33/33 |

### Fiche Carnet v2

| Écran · état (rôle) | 390x844 clair |
| --- | --- |

### Écarts triés par surface de différence (25 premiers)

| # | Scénario | Projet | Pixels différents | Bandes les plus différentes | Cadres app / maquette | Mesures en échec (3 plus grosses) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | communaute-recherche-resultats | 390x844 clair | 205 221 px (63,3 %) | y 576–640 (94 %), y 704–768 (93 %), y 512–576 (92 %) | 390×844 / 390×844 | — |
| 2 | communaute-recherche-accueil | 390x844 clair | 181 689 px (55,2 %) | y 448–512 (80 %), y 640–704 (79 %), y 704–768 (77 %) | 390×844 / 390×844 | Champ de recherche · y : app 132px / maquette 130px |
| 3 | communaute-explorer-carnets-erreur | 390x844 clair | 177 350 px (53,9 %) | y 768–832 (95 %), y 704–768 (93 %), y 576–640 (92 %) | 390×844 / 390×844 | Mini-capsule (filtres) · (présence) : app ∅ / maquette ∅ |
| 4 | communaute-explorer-carnets-vide | 390x844 clair | 176 684 px (53,7 %) | y 704–768 (93 %), y 576–640 (92 %), y 640–704 (90 %) | 390×844 / 390×844 | — |
| 5 | communaute-creation-publication-etape1 | 390x844 clair | 168 569 px (51,2 %) | y 448–512 (84 %), y 192–256 (78 %), y 384–448 (78 %) | 390×844 / 390×844 | Formulaire · (présence) : app ∅ / maquette présent |
| 6 | communaute-explorer-carnets-chargement | 390x844 clair | 122 055 px (37,1 %) | y 448–512 (97 %), y 0–64 (72 %), y 512–576 (71 %) | 390×844 / 390×844 | Mini-capsule (filtres) · (présence) : app ∅ / maquette ∅ |
| 7 | communaute-peek-carnet | 390x844 clair | 118 792 px (84,7 %) | y 768–832 (89 %), y 512–576 (88 %), y 320–384 (87 %) | 390×844 / 390×844 | Aperçu (peek) · y : app 255.6px / maquette 238.6px |
| 8 | communaute-explorer-clubs | 390x844 clair | 111 995 px (41,1 %) | y 0–64 (73 %), y 384–448 (59 %), y 640–704 (57 %) | 390×844 / 390×844 | Tuile club · hauteur : app 242.8px / maquette 235.8px ; Tuile club · y : app 176px / maquette 170px |
| 9 | communaute-explorer-sorties | 390x844 clair | 103 580 px (34,1 %) | y 0–64 (73 %), y 704–768 (48 %), y 576–640 (45 %) | 390×844 / 390×844 | Tuile sortie · border-radius : app 0px / maquette 18px ; Tuile sortie · y : app 248px / maquette 240px |
| 10 | communaute-explorer-carnets | 390x844 clair | 62 226 px (44,4 %) | y 0–64 (73 %), y 768–832 (69 %), y 576–640 (60 %) | 390×844 / 390×844 | Tuile carnet · hauteur : app 314.4px / maquette 310.9px |
| 11 | communaute-explorer-carnets-invite | 390x844 clair | 60 210 px (49,2 %) | y 0–64 (75 %), y 128–192 (67 %), y 768–832 (62 %) | 390×844 / 390×844 | Tuile carnet · y : app 162px / maquette 132px ; Tuile carnet · hauteur : app 314.4px / maquette 310.9px |

### Écarts de mesure récurrents

| Élément | Propriété | Occurrences | Valeur app (exemple) | Valeur maquette (exemple) |
| --- | --- | --- | --- | --- |
| Communauté · Mini-capsule (filtres) | (présence) | 2 | ∅ | ∅ |
| Communauté · Tuile carnet | hauteur | 2 | 314.4px | 310.9px |
| Communauté · Formulaire | (présence) | 1 | ∅ | présent |
| Communauté · Tuile carnet | y | 1 | 162px | 132px |
| Communauté · Tuile club | y | 1 | 176px | 170px |
| Communauté · Tuile club | hauteur | 1 | 242.8px | 235.8px |
| Communauté · Tuile sortie | y | 1 | 248px | 240px |
| Communauté · Tuile sortie | border-radius | 1 | 0px | 18px |
| Communauté · Aperçu (peek) | y | 1 | 255.6px | 238.6px |
| Communauté · Champ de recherche | y | 1 | 132px | 130px |

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

## Décisions ouvertes (Tony)

Voir prompt §5.

## Bloqué par Tony

Voir prompt §6.
