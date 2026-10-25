# Revue indépendante — tranche préparatoire Progression 2.0

Date : 10 octobre 2026, Europe/Paris. Environnement de lecture :
`/workspace/kitduvoyageur_1783951966810`. Objet immuable :
`/tmp/lkdv-v2-review.patch`, diff préparé avant correction des constats de cette
revue. Aucun test relancé, aucun code modifié, aucune écriture distante ni commit
effectué par le reviewer. Ce fichier constitue son seul changement.

Lectures : AGENTS.md, CLAUDE.md, économie complète, T04/T05/T10 de
`tasks/todo.md`, cinq rapports de preuves demandés, diff et sources nécessaires
pour confronter les clés historiques, le DTO, les routes, l'authentification et
les tokens. Le workflow de revue indépendante demandé correspond au skill local
`.agents/skills/requesting-code-review/SKILL.md` ; cette revue est le contrôle
demandé par l'orchestrateur, sans nouvelle délégation.

## Verdict de conformité

**Corrections demandées avant intégration : un écart de clé historique dans
l'annexe T05.** Les montants, allocations, quotas, familles et phases des 29
actions concordent avec les tableaux de l'économie. Les dix seuils demeurent
identiques. Les règles et avantages nouveaux sont fermés, sans intégration au
moteur. Les textes des niveaux ne promettent plus de qualification, permission
ou avantage commercial ; les identités historiques sont conservées.

Les préparations T04/T05/T10 demeurent partielles, conformément aux rapports :
cette revue ne valide aucune sortie P0, activation P1, preuve SQL ou livraison
complète de T10. Préparer des changements indépendants pendant P0 fermé est
documenté par D04 ; ces changements ne lèvent pas les dépendances.

## Verdict de qualité du code

**Corrections demandées sur la protection statique des clés ; autres changements
runtime et frontières de tests acceptables dans le périmètre annoncé.** Le GET
du cron est la même fonction que POST : authentification, configuration, taille
de lot et purge restent inchangées. Les tests ajoutés exercent le GET autorisé
et interdit, sans remplacer les preuves encore nécessaires de planification et
de reprise réelle.

La carte masque immédiatement le profil d'un autre compte, attend la session,
vérifie le propriétaire de la réponse et nettoie les requêtes avec AbortController
et une garde de résultat tardif. La lecture secondaire n'empêche plus l'affichage
du profil. Les tests montent réellement le composant et couvrent erreurs,
retry, déconnexion, réponse ancienne et classement tardif. Tous les tokens
`--lkv-*` utilisés existent dans `src/styles/tokens.css`, y compris bordures et
focus. Le retrait du cache par URL supprime un risque inter-comptes ; la perte
de déduplication et l'absence d'invalidation après gain sont explicitement suivies
comme travail T10 restant, pas dissimulées comme critères satisfaits.

Les mocks de rate-limit réparent une frontière d'unité sans enlever la garde
réseau ni changer le contrôle de production. Les huit nouveaux cas vérifient
les refus 429/503, le scope, le mode fermé et l'absence d'appel métier. Les
contrôles rapportés ne sont pas présentés ici comme réexécutés.

## Constat actionnable

**[P2] Conserver la véritable clé historique des avis et vérifier les clés exactes.**

- Emplacement : `docs/progression/2.0/rules-registry.json:679`.
- Clé déclarée : `place_review:<place_id>`.
- Source réelle : `src/features/progression/server/producerHooks.ts:123` et
  `:126` utilisent `sourceType='place_review'` avec
  `sourceId=\`${userId}:${placeId}\`` ; la clé historique est donc
  `place_review:<user_id>:<place_id>`.
- Le nouveau vérificateur `scripts/verify/progression-v2-registry.mjs:70`
  accepte toute chaîne non vide comme `legacy_key`. Il ne détecte pas cet
  écart, malgré l'annonce de conservation des sept modèles historiques dans
  `registry-report.md`. Les six autres modèles de l'annexe correspondent aux
  producteurs lus.
- Conséquence : pas d'émission actuelle puisque le registre reste fermé et
  n'est pas consommé. Une future migration ou résolution de replay fondée sur
  ce modèle perdrait toutefois la correspondance aux gains historiques et
  pourrait traiter un fait ancien comme nouveau. La conservation des clés
  est une exigence explicite de T05 et du mandat.
- Correction : remettre le segment utilisateur, vérifier les sept modèles
  exacts à partir des contrats producteurs ou d'une fixture historique revue,
  et ajouter un test adversarial qui modifie une clé non vide. Conserver la
  portée privée par utilisateur et aucune version du barème dans la clé.

## Travaux restant suivis, sans régression attribuée à ce diff

T04 : observation de job, panne/reprise, grants et santé effective demeurent à
prouver. T05 : registre serveur, sélection à date métier et contrat économique
runtime demeurent à terminer. T10 : query privée mutualisée, invalidation après
gain, parcours intégré T09 et vérifications appareils demeurent à terminer.
La divergence d'arrondi TS historique 45 XP → 31/14, déjà documentée dans
`registry-report.md`, n'est pas introduite par ce diff ; la nouvelle répartition
entière TS/SQL doit être vérifiée avant activation en préservant l'historique.
Les limites de sauvegarde, migrations distantes, restauration et déploiement du
rapport P0 restent applicables. Aucun de ces points ne devient une réussite du
fait de cette revue.

## Complément T04 — sonde de santé

À la demande de l'orchestrateur, lecture complémentaire du diff local de
`scripts/ops/progression_outbox_health.mjs` et du nouveau
`tests/ops/progression-health.test.mjs`. Ce complément est distinct du patch
immuable initial. **Conformité et qualité : acceptables, aucun constat
actionnable relevé dans ce complément.**

Les cinq compteurs utilisent des requêtes HEAD avec `count: 'exact'`, sans
rapatrier une liste potentiellement tronquée par la limite REST. Les deux
lectures de dates sont triées par `created_at` croissant et limitées à une
ligne, avec `pending` et `failed` inclus. Une file connue vide n'entraîne pas
de lecture de dates. Les seuils 15/30 minutes comparent des durées non arrondies,
les dead sont comptés séparément, les erreurs et dates manquantes échouent
fermées. Importer la fonction ne lance ni appel ni CLI.

Les cinq tests Node annoncés par l'orchestrateur couvrent file vide, compteur
1500, dead, frontière 15 minutes +1 ms, retard leaderboard et lecture impossible.
Ils n'ont pas été relancés par le reviewer. La sonde production en lecture seule
rapportée avec backlog leaderboard=9 et exit 1 est un état dégradé attendu,
pas un résultat rouge de cette suite. La sonde reste une observation répartie
en plusieurs lectures, sans snapshot transactionnel ; elle ne prouve ni
réparation du backlog ni planification/reprise d'un job.

## Revue du correctif de clé historique

Relecture limitée à `/tmp/lkdv-registry-fix.patch`, le 10 octobre 2026,
Europe/Paris. Aucun test relancé. Les **42 tests réussis** et le vérificateur
réussi sont des preuves rapportées par l'agent auteur, pas des exécutions de
ce reviewer. Le contrôle TypeScript global reste confié à l'orchestrateur.

**Constat P2 précédent : traité.** Le template de l'avis devient
`place_review:<user_id>:<place_id>`, conforme à `producerHooks.ts:123` et
`:126`. Les sept templates historiques ont désormais une comparaison exacte,
obligatoire même sans argument de code producteur. La CLI passe également les
hooks réels ; leur parseur confronte les couples `sourceType`/`sourceId` observés
aux sept templates. Une dérive de syntaxe non reconnue échoue via le nombre
attendu et les comparaisons, au lieu de valider une clé quelconque. Les tests
mutent chaque clé en conservant une chaîne non vide, et retirent spécifiquement
l'utilisateur côté annexe et côté hooks pour reproduire le défaut initial.

**Correction TS du tuple : cohérente à la lecture.** Le retour explicite
`[string, number]` préserve les valeurs et donne à `it.each` le type attendu
pour son index numérique ; aucune assertion n'est retirée.

**Verdicts après correction : conformité de la tranche préparatoire acceptable ;
qualité du code acceptable.** Aucun nouveau défaut actionnable identifié dans
ce correctif. Ces verdicts remplacent les demandes de correction initiales,
sans déclarer T04/T05/T10 terminées ni lever leurs conditions d'intégration,
de types/build et d'activation.
