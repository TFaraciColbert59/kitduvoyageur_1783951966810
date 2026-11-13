# Parité visuelle — captures et différences justifiées

- Base : http://localhost:4100
- Captures : 6 / 48
- Non capturé : 42
- Date : 2026-11-09T04:46:49.583Z

## Différences globales

| ID | Différence constatée | Justification |
| --- | --- | --- |
| G1 | Les captures montrent des contenus de test « [TEST CRM] » et des comptes is_demo, jamais les contenus de la maquette. | 07_VERIFICATION § 2 : les preuves ne contiennent aucune donnée réelle ; la maquette est un jeu fictif figé. |
| G2 | Les métriques vivantes (compte à rebours, temps réel, compteurs) diffèrent d'une capture à l'autre. | Ce sont des états réels et non des valeurs figées ; le contrôle porte sur le gabarit, la densité et les tons, pas sur les chiffres. |
| G3 | Polices système (SF Pro sur macOS, Inter ailleurs) au lieu du rendu exact de la maquette HTML. | 05_UI_UX_DESIGN § 1 : les polices sont celles du système LKDV ; la substitution est prévue par le design. |
| G4 | Bandeau hors-ligne, bannière de session et chip « mode solo » peuvent apparaître selon l'état du poste. | États prévus par 05_UI_UX_DESIGN § 6 et EX-ROLE-07 ; leur présence dépend de la session, pas d'un écart de design. |
| G5 | Les suggestions IA sont absentes quand la brique NVIDIA est éteinte. | Garde-fou § 4 : une brique dont le secret manque reste désactivée derrière un indicateur ; l'écran ne doit pas inventer de suggestion. |
| G6 | Les images de contenus sont grisées et floutées jusqu'à action explicite. | 05_UI_UX_DESIGN § 8 contrôle 25 (bien-être) — la maquette montre l'état « net au survol », pas l'état par défaut. |

## Différences par écran

| Écran | ID | Différence constatée | Justification |
| --- | --- | --- | --- |
| a-traiter | S01 | Le groupe « Contributions » peut être absent quand aucune contribution n'est en attente. | 05_UI_UX_DESIGN § 6 : un groupe sans élément n'affiche pas de titre vide ; l'état vide est testé séparément. |
| cas-moderation | S02 | Le bandeau « décision déjà prise » remplace la carte d'actions sur un cas traité. | Contrôle 24 et idempotence : un cas déjà décidé ne propose plus les mêmes actions. |
| membre-360 | S03 | E-mail et téléphone masqués (« to•••@… ») au lieu d'être visibles. | Contrôle 21 : données personnelles masquées par défaut, dévoilement motivé et journalisé. |
| membre-360 | S04 | Les champs absents affichent « non renseigné » au lieu d'une valeur de la maquette. | Prompt maître § 2.4 : aucune donnée inventée dans le produit. |
| commande | S05 | Les montants et numéros de commande viennent des commandes Stripe de test. | Garde-fou § 1.6 : aucun paiement réel ; les montants sont ceux du mode test. |
| valider-demande | S06 | En mode solo, l'étape « second humain » affiche la mention d'auto-validation au lieu de l'attente. | EX-ROLE-07 : le super admin seul valide en deux temps, avec mention explicite de sa responsabilité. |
| equipe-agents | S07 | Les agents affichent leur état réel (actif, en pause, arrêté) et leur budget consommé du jour. | Loi 9 (le coût est une ressource) : les chiffres sont mesurés, jamais décoratifs. |
| journal | S08 | Les lignes du journal sont horodatées à l'exécution et portent des pastilles « validé seul » / « accès sensible ». | Loi 3 (tout est audité) : le journal montre l'état réel des actions, pas un exemple figé. |
| sos | S09 | La carte de position peut être absente si la géolocalisation n'est pas autorisée ; le 112 reste toujours visible. | Contrôle 37 : les urgences doivent rester utilisables sur téléphone même sans position. |
| pole-confiance | S10 | Le pôle Confiance réutilise le gabarit Main avec la file filtrée sur son pôle : seules les lignes du pôle apparaissent, et les onglets « File », « Rechercher », « Réglages du pôle » remplacent le contenu de la maquette. | 05_UI_UX_DESIGN § 3 : chaque pôle est une vue filtrée du gabarit Main ; la maquette ne montre qu'un seul pôle à titre d'exemple. |
| pole-membres | S11 | Le pôle Membres réutilise le gabarit Main avec la file filtrée sur son pôle : seules les lignes du pôle apparaissent, et les onglets « File », « Rechercher », « Réglages du pôle » remplacent le contenu de la maquette. | 05_UI_UX_DESIGN § 3 : chaque pôle est une vue filtrée du gabarit Main ; la maquette ne montre qu'un seul pôle à titre d'exemple. |
| pole-commerce | S12 | Le pôle Commerce réutilise le gabarit Main avec la file filtrée sur son pôle : seules les lignes du pôle apparaissent, et les onglets « File », « Rechercher », « Réglages du pôle » remplacent le contenu de la maquette. | 05_UI_UX_DESIGN § 3 : chaque pôle est une vue filtrée du gabarit Main ; la maquette ne montre qu'un seul pôle à titre d'exemple. |
| pole-contenus | S13 | Le pôle Contenus réutilise le gabarit Main avec la file filtrée sur son pôle : seules les lignes du pôle apparaissent, et les onglets « File », « Rechercher », « Réglages du pôle » remplacent le contenu de la maquette. | 05_UI_UX_DESIGN § 3 : chaque pôle est une vue filtrée du gabarit Main ; la maquette ne montre qu'un seul pôle à titre d'exemple. |
| pole-produit-ia | S14 | Le pôle Produit et IA réutilise le gabarit Main avec la file filtrée sur son pôle : seules les lignes du pôle apparaissent, et les onglets « File », « Rechercher », « Réglages du pôle » remplacent le contenu de la maquette. | 05_UI_UX_DESIGN § 3 : chaque pôle est une vue filtrée du gabarit Main ; la maquette ne montre qu'un seul pôle à titre d'exemple. |
| pole-croissance | S15 | Le pôle Croissance réutilise le gabarit Main avec la file filtrée sur son pôle : seules les lignes du pôle apparaissent, et les onglets « File », « Rechercher », « Réglages du pôle » remplacent le contenu de la maquette. | 05_UI_UX_DESIGN § 3 : chaque pôle est une vue filtrée du gabarit Main ; la maquette ne montre qu'un seul pôle à titre d'exemple. |
| pole-technique | S16 | Le pôle Technique réutilise le gabarit Main avec la file filtrée sur son pôle : seules les lignes du pôle apparaissent, et les onglets « File », « Rechercher », « Réglages du pôle » remplacent le contenu de la maquette. | 05_UI_UX_DESIGN § 3 : chaque pôle est une vue filtrée du gabarit Main ; la maquette ne montre qu'un seul pôle à titre d'exemple. |

## Non capturé

| Écran | Taille | Statut | Motif |
| --- | --- | --- | --- |
| a-traiter | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-confiance | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-membres | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-commerce | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-contenus | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-produit-ia | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-croissance | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-technique | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| cas-moderation | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| membre-360 | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| commande | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| valider-demande | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| equipe-agents | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| journal | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| sos | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| catalogue | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| contenus | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| reglages | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| ia | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| technique | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| entrainement | 1440x1040 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| a-traiter | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-confiance | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-membres | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-commerce | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-contenus | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-produit-ia | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-croissance | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| pole-technique | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| cas-moderation | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| membre-360 | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| commande | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| valider-demande | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| equipe-agents | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| journal | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| sos | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| catalogue | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| contenus | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| reglages | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| ia | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| technique | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
| entrainement | 390x844 | skipped | identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) |
