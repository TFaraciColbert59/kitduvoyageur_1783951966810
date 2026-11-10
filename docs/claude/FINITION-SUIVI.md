# Suivi — Finition Communauté v2 et Carnet v2

Prompt de référence : `docs/claude/PROMPT-FINITION-COMMUNAUTE-CARNET.md`. Seul fichier d'état de ce chantier ; chiffres prouvés par le banc `tests/fidelity/`.

## Scores (banc de fidélité)

Banc : `tests/fidelity/` (config `fidelity.config.ts`, scénarios `scenarios/{communaute,carnet}.ts`). Passage du 2026-11-10. Projets joués : 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair. Pas encore joués : 360×780, 430×932, 768×1024.

Lancer : `bash tests/fidelity/build.sh` (un seul build, mode fixtures), puis `npx playwright test --config=tests/fidelity/fidelity.config.ts`, puis `node scripts/fidelity/report.mjs` (réécrit cette section et `tests/fidelity/out/galerie.html`). Variables : `FIDELITY_SIZES`, `FIDELITY_THEMES`, `FIDELITY_ONLY`, `FIDELITY_STRICT=1` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | 114 (0 conformes, 101 avec écart, 13 non atteignables, 0 en erreur) |
| Dont sombre sans référence (†) | 0 : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | 4 / 101 |
| Différence pixel moyenne | 21,2 % |
| Mesures DOM conformes | 4056 / 4557 (89,0 %) |

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (`masques`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

| Écran · état (rôle) | 360x780 clair | 390x844 clair | 430x932 clair | 768x1024 clair |
| --- | --- | --- | --- | --- |
| Création · publication · étape 1 (membre) | — | 51,2 % · 18/19 | 53,6 % · 18/19 | — |
| Explorer · carnets · chargement (squelette) (membre) | — | 37,0 % · 24/25 | 34,7 % · 24/25 | — |
| Explorer · carnets · erreur de chargement (membre) | — | non atteignable | 55,4 % · 24/25 | — |
| Explorer · carnets · chargé (invite) | — | 49,2 % · 36/38 | 48,4 % · 36/38 | — |
| Explorer · carnets · vide (membre) | — | 53,4 % · 33/33 | 55,3 % · 33/33 | — |
| Explorer · carnets · chargé (membre) | — | 44,4 % · 44/45 | 44,4 % · 44/45 | — |
| Explorer · clubs · chargé (membre) | — | 41,2 % · 43/45 | 38,7 % · 43/45 | — |
| Explorer · sorties · chargé (membre) | — | 34,5 % · 36/38 | 33,8 % · 36/38 | — |
| Explorer · carnets · aperçu (appui long sur une tuile) (membre) | — | 84,8 % · 3/4 | 84,3 % · 3/4 | — |
| Explorer · recherche · accueil de la recherche (membre) | — | 55,3 % · 39/40 | 58,7 % · 39/40 | — |
| Explorer · recherche · résultats pour « ecrins » (membre) | — | 63,2 % · 33/33 | 64,6 % · 33/33 | — |

### Fiche Carnet v2

| Écran · état (rôle) | 360x780 clair | 390x844 clair | 430x932 clair | 768x1024 clair |
| --- | --- | --- | --- | --- |
| Carnet · carte du bas · carte indisponible (WebGL refusé) (participant) | non atteignable | non atteignable | non atteignable | non atteignable |
| Carnet · Résumé · chargement (squelette) (participant) | 3,7 % · 0/0 | 3,3 % · 0/0 | 3,0 % · 0/0 | 20,9 % · 0/0 |
| Carnet · feuille Créer · étape 2 : formulaire d’un moment texte (participant) | 9,3 % · 0/0 | 8,8 % · 0/0 | 8,7 % · 0/0 | 30,3 % · 0/0 |
| Carnet · Résumé · hors ligne (participant) | non atteignable | non atteignable | non atteignable | non atteignable |
| Carnet · Jour 1 · chargé (participant) | 4,3 % · 118/122 | 3,8 % · 118/122 | 3,5 % · 118/122 | 23,8 % · 76/122 |
| Carnet · Jour 1 · mode modification (participant) | 11,9 % · 94/97 | 10,4 % · 94/97 | 9,3 % · 94/97 | 23,1 % · 63/97 |
| Carnet · Résumé · mode modification (participant) | 13,0 % · 94/97 | 11,9 % · 94/97 | 11,2 % · 94/97 | 20,0 % · 64/97 |
| Carnet · tiroir Fil de bord · mode modification, pilules « Modifier » (participant) | 23,1 % · 27/31 | 19,5 % · 31/31 | 9,2 % · 27/31 | 38,3 % · 21/31 |
| Carnet · Résumé · chargé (participant) | 4,0 % · 99/102 | 3,6 % · 99/102 | 3,2 % · 99/102 | 21,0 % · 67/102 |
| Carnet · Résumé · vide (aucun moment, aucune étape) (participant) | 10,1 % · 78/86 | 9,3 % · 78/86 | 7,5 % · 78/86 | 18,9 % · 52/86 |
| Carnet · Résumé · chargé (visiteur) | 4,0 % · 99/102 | 3,6 % · 99/102 | 3,5 % · 99/102 | 22,3 % · 67/102 |
| Carnet · stories · visionneuse ouverte depuis la couverture (visiteur) | 0,0 % · 9/26 | 0,0 % · 9/26 | 0,0 % · 9/26 | 0,0 % · 6/26 |
| Carnet · tiroir Chiffres · chargé, lentille « Dénivelé » (participant) | 10,0 % · 31/31 | 10,0 % · 31/31 | 9,6 % · 31/31 | 34,0 % · 21/31 |
| Carnet · tiroir Chiffres · chargé, première lentille (participant) | 9,8 % · 31/31 | 9,9 % · 31/31 | 9,6 % · 31/31 | 33,3 % · 21/31 |
| Carnet · tiroir Équipage · chargé, lentille « Réactions » (participant) | 15,5 % · 31/31 | 14,2 % · 31/31 | 12,6 % · 31/31 | 36,2 % · 21/31 |
| Carnet · tiroir Équipage · chargé, première lentille (participant) | 9,7 % · 31/31 | 9,1 % · 31/31 | 7,2 % · 31/31 | 32,8 % · 21/31 |
| Carnet · tiroir · erreur de chargement du slot (participant) | non atteignable | non atteignable | non atteignable | non atteignable |
| Carnet · tiroir Fil de bord · chargé, lentille « Médias » (participant) | 15,3 % · 31/31 | 12,5 % · 31/31 | 10,5 % · 31/31 | 30,1 % · 21/31 |
| Carnet · tiroir Fil de bord · chargé, première lentille (participant) | 5,2 % · 31/31 | 4,9 % · 31/31 | 4,6 % · 31/31 | 36,3 % · 21/31 |
| Carnet · tiroir Route · chargé, lentille « Altitude » (participant) | 11,5 % · 31/31 | 12,4 % · 31/31 | 9,5 % · 31/31 | 33,3 % · 21/31 |
| Carnet · tiroir Route · chargé, première lentille (participant) | 10,5 % · 31/31 | 11,2 % · 31/31 | 10,0 % · 31/31 | 31,7 % · 21/31 |
| Carnet · tiroir Sac · chargé, lentille « Verdicts » (participant) | 7,9 % · 31/31 | 6,7 % · 31/31 | 6,0 % · 31/31 | 34,2 % · 21/31 |
| Carnet · tiroir Sac · chargé, première lentille (participant) | 7,1 % · 31/31 | 6,4 % · 31/31 | 5,9 % · 31/31 | 32,3 % · 21/31 |

### Écarts triés par surface de différence (25 premiers)

| # | Scénario | Projet | Pixels différents | Bandes les plus différentes | Cadres app / maquette | Mesures en échec (3 plus grosses) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | communaute-recherche-resultats | 430x932 clair | 254 921 px (64,6 %) | y 640–704 (95 %), y 576–640 (92 %), y 512–576 (91 %) | 430×932 / 430×932 | — |
| 2 | communaute-recherche-accueil | 430x932 clair | 235 401 px (58,7 %) | y 832–896 (82 %), y 640–704 (81 %), y 448–512 (80 %) | 430×932 / 430×932 | Champ de recherche · y : app 132px / maquette 130px |
| 3 | communaute-explorer-carnets-erreur | 430x932 clair | 222 091 px (55,4 %) | y 832–896 (99 %), y 640–704 (95 %), y 576–640 (90 %) | 430×932 / 430×932 | Mini-capsule (filtres) · (présence) : app ∅ / maquette ∅ |
| 4 | communaute-explorer-carnets-vide | 430x932 clair | 221 502 px (55,3 %) | y 640–704 (95 %), y 576–640 (90 %), y 768–832 (88 %) | 430×932 / 430×932 | — |
| 5 | communaute-creation-publication-etape1 | 430x932 clair | 214 689 px (53,6 %) | y 768–832 (85 %), y 448–512 (82 %), y 192–256 (78 %) | 430×932 / 430×932 | Formulaire · (présence) : app ∅ / maquette présent |
| 6 | communaute-recherche-resultats | 390x844 clair | 204 842 px (63,2 %) | y 576–640 (94 %), y 704–768 (93 %), y 512–576 (92 %) | 390×844 / 390×844 | — |
| 7 | communaute-recherche-accueil | 390x844 clair | 181 913 px (55,3 %) | y 448–512 (81 %), y 640–704 (79 %), y 704–768 (76 %) | 390×844 / 390×844 | Champ de recherche · y : app 132px / maquette 130px |
| 8 | communaute-explorer-carnets-vide | 390x844 clair | 175 863 px (53,4 %) | y 704–768 (93 %), y 576–640 (92 %), y 640–704 (90 %) | 390×844 / 390×844 | — |
| 9 | communaute-creation-publication-etape1 | 390x844 clair | 168 481 px (51,2 %) | y 448–512 (83 %), y 384–448 (78 %), y 192–256 (77 %) | 390×844 / 390×844 | Formulaire · (présence) : app ∅ / maquette présent |
| 10 | communaute-explorer-carnets-chargement | 430x932 clair | 139 075 px (34,7 %) | y 448–512 (95 %), y 384–448 (82 %), y 0–64 (75 %) | 430×932 / 430×932 | Mini-capsule (filtres) · (présence) : app ∅ / maquette ∅ |
| 11 | communaute-explorer-clubs | 430x932 clair | 131 883 px (38,7 %) | y 0–64 (75 %), y 384–448 (54 %), y 128–192 (51 %) | 430×932 / 430×932 | Tuile club · hauteur : app 242.8px / maquette 235.8px ; Tuile club · y : app 176px / maquette 170px |
| 12 | communaute-peek-carnet | 430x932 clair | 131 702 px (84,3 %) | y 832–896 (93 %), y 576–640 (90 %), y 512–576 (88 %) | 430×932 / 430×932 | Aperçu (peek) · y : app 299.6px / maquette 282.6px |
| 13 | communaute-explorer-sorties | 430x932 clair | 124 891 px (33,8 %) | y 0–64 (75 %), y 896–932 (85 %), y 704–768 (45 %) | 430×932 / 430×932 | Tuile sortie · border-radius : app 0px / maquette 18px ; Tuile sortie · y : app 248px / maquette 240px |
| 14 | communaute-explorer-carnets-chargement | 390x844 clair | 121 942 px (37,0 %) | y 448–512 (97 %), y 0–64 (72 %), y 512–576 (71 %) | 390×844 / 390×844 | Mini-capsule (filtres) · (présence) : app ∅ / maquette ∅ |
| 15 | communaute-peek-carnet | 390x844 clair | 118 977 px (84,8 %) | y 768–832 (91 %), y 448–512 (88 %), y 512–576 (88 %) | 390×844 / 390×844 | Aperçu (peek) · y : app 255.6px / maquette 238.6px |
| 16 | communaute-explorer-clubs | 390x844 clair | 112 233 px (41,2 %) | y 0–64 (73 %), y 384–448 (59 %), y 640–704 (57 %) | 390×844 / 390×844 | Tuile club · hauteur : app 242.8px / maquette 235.8px ; Tuile club · y : app 176px / maquette 170px |
| 17 | communaute-explorer-sorties | 390x844 clair | 104 648 px (34,5 %) | y 0–64 (73 %), y 704–768 (49 %), y 576–640 (45 %) | 390×844 / 390×844 | Tuile sortie · border-radius : app 0px / maquette 18px ; Tuile sortie · y : app 248px / maquette 240px |
| 18 | communaute-explorer-carnets | 430x932 clair | 69 398 px (44,4 %) | y 0–64 (75 %), y 832–896 (63 %), y 640–704 (62 %) | 430×932 / 430×932 | Tuile carnet · hauteur : app 339.4px / maquette 335.9px |
| 19 | communaute-explorer-carnets-invite | 430x932 clair | 66 810 px (48,4 %) | y 0–64 (77 %), y 832–896 (72 %), y 128–192 (71 %) | 430×932 / 430×932 | Tuile carnet · y : app 162px / maquette 132px ; Tuile carnet · hauteur : app 339.4px / maquette 335.9px |
| 20 | communaute-explorer-carnets | 390x844 clair | 62 239 px (44,4 %) | y 0–64 (73 %), y 768–832 (69 %), y 576–640 (60 %) | 390×844 / 390×844 | Tuile carnet · hauteur : app 314.4px / maquette 310.9px |
| 21 | communaute-explorer-carnets-invite | 390x844 clair | 60 208 px (49,2 %) | y 0–64 (75 %), y 128–192 (67 %), y 768–832 (63 %) | 390×844 / 390×844 | Tuile carnet · y : app 162px / maquette 132px ; Tuile carnet · hauteur : app 314.4px / maquette 310.9px |
| 22 | carnet-resume-vide | 768x1024 clair | 27 387 px (18,9 %) | y 0–64 (43 %), y 512–576 (37 %), y 448–512 (31 %) | 430×1024 / 390×844 | Capsule de jours · x : app 373px / maquette 193px ; Carte du carnet (verre) · hauteur : app 603.5px / maquette 439.4px ; Capsule de jours · largeur : app 35px / maquette 175px |
| 23 | carnet-tiroir-equipage-2 | 768x1024 clair | 24 807 px (36,2 %) | y 320–384 (45 %), y 64–128 (44 %), y 256–320 (39 %) | 430×1024 / 390×844 | Tiroir · hauteur : app 603.6px / maquette 439.4px ; Zone de contenu du slot · hauteur : app 521.6px / maquette 357.4px ; Barre des lentilles · y : app 614.6px / maquette 490.4px |
| 24 | carnet-tiroir-sac-2 | 768x1024 clair | 23 467 px (34,2 %) | y 64–128 (43 %), y 128–192 (43 %), y 0–64 (38 %) | 430×1024 / 390×844 | Tiroir · hauteur : app 603.6px / maquette 439.4px ; Zone de contenu du slot · hauteur : app 521.6px / maquette 357.4px ; Barre des lentilles · y : app 614.6px / maquette 490.4px |
| 25 | carnet-tiroir-chiffres-2 | 768x1024 clair | 23 306 px (34,0 %) | y 64–128 (44 %), y 0–64 (38 %), y 128–192 (36 %) | 430×1024 / 390×844 | Tiroir · hauteur : app 603.6px / maquette 439.4px ; Zone de contenu du slot · hauteur : app 521.6px / maquette 357.4px ; Barre des lentilles · y : app 614.6px / maquette 490.4px |

### Écarts de mesure récurrents

| Élément | Propriété | Occurrences | Valeur app (exemple) | Valeur maquette (exemple) |
| --- | --- | --- | --- | --- |
| Carnet · Bouton « Ouvrir le carnet » | x | 24 | 193px | 195.2px |
| Carnet · Bouton « Ouvrir le carnet » | largeur | 24 | 141px | 138.8px |
| Carnet · Bouton d’état (En route / Terminé) | largeur | 20 | 159px | 161.2px |
| Carnet · Barre des lentilles | x | 13 | 157px | 139px |
| Carnet · Tiroir | y | 11 | 51px | 91px |
| Carnet · Tiroir | largeur | 11 | 406px | 366px |
| Carnet · Tiroir | hauteur | 11 | 603.6px | 439.4px |
| Carnet · Capsule des 5 slots | y | 11 | 69px | 109px |
| Carnet · Capsule des 5 slots | largeur | 11 | 378px | 338px |
| Carnet · Zone de contenu du slot | y | 11 | 133px | 173px |
| Carnet · Zone de contenu du slot | largeur | 11 | 406px | 366px |
| Carnet · Zone de contenu du slot | hauteur | 11 | 521.6px | 357.4px |
| Carnet · Barre des lentilles | y | 11 | 614.6px | 490.4px |
| Carnet · Capsule de jours | x | 9 | 303px | 163px |
| Carnet · Vue du jour (swipe) | hauteur | 6 | 92.3px | 212.3px |
| Carnet · Pastille titre | y | 6 | 11px | 51px |
| Carnet · Bouton « + » (barre du haut) | x | 6 | 302px | 262px |
| Carnet · Bouton « + » (barre du haut) | y | 6 | 11px | 51px |
| Carnet · Carte du carnet (verre) | y | 6 | 51px | 91px |
| Carnet · Carte du carnet (verre) | largeur | 6 | 406px | 366px |

### Non atteignable (raison écrite, rien d'inventé)

| Scénario | Projets | Raison |
| --- | --- | --- |
| carnet-carte-indisponible | 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair | non atteignable : maquette : la maquette n’a pas d’état « Carte indisponible » (carte dessinée en SVG, sans WebGL) ; couvert par CompteMapUnavailable.test.tsx (mock du contexte WebGL) |
| carnet-hors-ligne | 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair | non atteignable : maquette : la maquette ne montre aucun état hors ligne (bandeau « Hors ligne » : texte de la spec § 8, sans rendu de référence) ; couvert par CarnetFinition.test.tsx « hors ligne » |
| carnet-tiroir-erreur | 360x780 clair, 390x844 clair, 430x932 clair, 768x1024 clair | non atteignable : app : CarnetDrawerV2 n’a aucun état d’erreur de slot ni bouton « Réessayer » (CHECKLIST-100 l.76 ouverte) : rien à atteindre côté app |
| communaute-explorer-carnets-erreur | 390x844 clair | non atteignable : app : Error: étape 2 (app) {"waitFor":{"css":"[data-testid=\"communaute-v2-explore\"]"}} : TimeoutError: locator.waitFor: Timeout 12000ms exceeded. |

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

## Décisions ouvertes (Tony)

Voir prompt §5.

## Bloqué par Tony

Voir prompt §6.
