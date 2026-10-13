# T05 — Contrat runtime et sélection des règles v2

10 octobre 2026, environnement local `/workspace/kitduvoyageur_1783951966810`. Commit de base au contrôle final : `d8aeac7e0873af4084b5749e0db772e34014ed85`. Tranche non committée, soumise à revue et intégration par l’orchestrateur.

## Résultat

`src/features/progression/domain/v2Contract.ts` définit les 29 identifiants, quatre familles et compétences, états de décision/projection et unités séparées. Aucun taux XP/argent ni pouvoir lié au niveau n’est défini. Les types publics sont en lecture seule. Le parseur de date métier exige un horodatage UTC complet, seconde ou milliseconde, et vérifie le calendrier réel ; le rollover silencieux de `Date.parse` ne peut accepter le 30 février.

`src/features/progression/server/v2RuleRegistry.ts` est marqué `server-only`. Zod refuse les montants non entiers/hors bornes, poids négatifs/fractionnaires ou somme différente de 100, compétences supplémentaires, quotas invalides, scopes communs erronés, clés historiques modifiées, action absente/dupliquée, version inconsistante et changement des dix seuils. Montants, familles, poids, quotas et caps de famille doivent correspondre à l’annexe revue. L’annexe est elle-même contrôlée contre le document économique par le vérificateur indépendant déjà livré. Une évolution économique future exige donc mise à jour explicite de la référence, validation documentaire et nouvelle publication ; un payload reçu ne suffit pas.

La sélection valide les registres avant usage puis recherche la règle à **la date métier originale**, dans l’intervalle `[effective_from,effective_until)`. L’ordre des versions dans le tableau et la date du worker ne choisissent pas le barème. Une version retirée reste interprétable pour son intervalle historique. Un chevauchement est refusé, aucune priorité arbitraire ne choisit entre deux versions. Date future, invalide, avant effet, règle fermée et annexe entièrement fermée rendent une raison explicite ; une configuration structurellement invalide lève une erreur de validation.

La date d’entrée est conservée exactement dans le résultat, qui est gelé. L’immutabilité **persistée** de cette date et sa provenance serveur restent à implémenter dans les intentions et contraintes SQL T06–T08 : cette fonction en lecture ne remplace pas une contrainte de base. Elle ne recherche ni ne rejoue une transaction historique et ne touche aucun journal.

## Preuves

- `npm test -- tests/features/progression/v2Contract.spec.ts tests/features/progression/v2Registry.spec.ts` : **86 tests réussis** dans deux fichiers, sortie 0, 17:05:40 UTC. Le contrat ajoute 44 tests et l’annexe conserve 42 tests.
- Tests négatifs : limites de montants/poids/quotas, dérive pourtant dans une borne globale, family cap, preuve/claims absents, idempotence et seuils modifiés, activation commerciale/publique interdite, date métier invalide/future et publication nulle/invalide.
- Frontières : instant avant début refusé, début accepté, dernière milliseconde ancienne sélectionnée, fin ancienne exclue/début nouvelle accepté. Arrivée tardive conserve l’ancienne version même retirée. Chevauchement, règle individuelle fermée et effets absents refusés.
- Le précédent TS2345 du test d’annexe est corrigé par une table `ruleCases` explicitement typée avant `it.each`. Aucun `tsc` concurrent n’a été lancé ; le contrôle global appartient à l’orchestrateur.

## État et limites

Implémenté et testé localement ; pas encore intégré, déployé ou activé. Le registre embarqué est toujours `draft_closed`, sans dates et avec 29 règles fermées. Les jeux `published` des tests sont des fixtures synthétiques locales, aucune publication réelle. Les nouvelles portes financières et ligues restent structurellement fermées dans cette première version du contrat.

Le moteur legacy, ses routes, hooks, migrations, montants et allocations historiques n’ont pas été modifiés dans cette sous-tranche. Le contrat runtime est disponible au futur consommateur ; il n’est pas encore branché à l’attribution. Aucun test SQL, concurrence, preuve métier, restauration, appareils ou environnement distant n’est revendiqué.

Prochaine action : revue racine des trois fichiers de code/tests, contrôle types au jalon, puis raccordement séquentiel aux intentions et au moteur transactionnel sous conditions P0. Ne déclarer T05 entièrement sorti avant validation de ses dépendances T04 et intégration de ses appelants.

Complément orchestrateur 20:51 UTC : revue indépendante a corrigé le couplage des archives au draft courant. Références approuvées immuables par version, inconnues refusées, test45ancien/46futurfixture prouve sélection tardive. Formules/claims/preuves/conditions doivent correspondre à leur référence aussi. Red2poisons puis green109 tests dans trois suites (contrat47, annexe42, helper20). Aucun barème2.1 publié : fixtures uniquement.
