# T05 — Reconstruction de l’annexe de règles

Date : 10 octobre 2026. Environnement : `/workspace/kitduvoyageur_1783951966810`, Node/Vitest local. Base de travail : `373689c6a552d5a8e98fb54920c01467761f9916`. Les changements de cette tranche restent non committés pour intégration par l’orchestrateur.

## Livrables et statut

`docs/progression/2.0/rules-registry.json` reproduit les 29 actions de l’économie, leurs montants, poids en pourcentages entiers, famille d’action, nombres d’actions jour/semaine/saison, preuves et phases. Les dix seuils de niveau sont conservés. Les sept producteurs existants gardent leur identifiant et leur modèle de clé historique ; les clés restent scopées par utilisateur et source canonique, sans version du barème.

Les formules de durée active, nouveauté, débrief final et avis avec preuve de visite sont explicites. Les plafonds d’XP des quatre familles restent distincts des nombres d’actions. `cap_group` réunit exactement activité, préparation et rôles de prêt ; les claims expriment aussi les exclusions correction/accessibilité, entretien/réparation et photo/carnet. Dates métier, grâce saisonnière, arrondis entiers, refus du gain entier, droits historiques et trois unités commerciales sont documentés.

**Implémenté et testé : annexe de conception et contrôle statique reproductible. Non intégré au moteur, non déployé, non activé.** Toutes les règles ont `enabled=false`, `effective_from=null`, `effective_until=null`. Les nouveaux avantages, ligues et classement 1 km restent fermés. Ni RPC, ni migration, ni environnement distant, ni solde n’a été modifié. Une preuve écrite dans le registre est une exigence à développer, pas une preuve d’existence du producteur.

## Contrôles exécutés

- `node scripts/verify/progression-v2-registry.mjs` : succès, 29 actions, dix niveaux et sept identifiants historiques vérifiés.
- `npm test -- tests/features/progression/v2Registry.spec.ts` : 34 tests réussis. Les tests changent les montants, poids, quotas, preuves, dates et flags de chaque action, modifient aussi l’économie source, et vérifient le refus des divergences. Ils couvrent les quotas communs, producteurs historiques, nouveautés, activation économique, bons, exclusions et durées de prêt.
- Conservation des entiers par l’allocateur TS existant pour chaque montant entier situé entre le minimum et le maximum de chaque règle : succès. Ce contrôle ne prouve ni concurrence SQL ni intégration applicative des futurs producteurs.
- `npm run type-check` lancé, puis arrêté à la demande de l’orchestrateur pour éviter un contrôle global concurrent ; résultat non revendiqué. Le contrôle global relève de l’intégration racine.

Le vérificateur relit les tableaux Markdown de l’économie à chaque exécution : montants, allocations, quotas, preuves, phases, familles, niveaux, plafonds d’XP, parts et fidélité. Il extrait les propositions de bons du texte source. Les formules et certaines contraintes écrites en prose utilisent des ancres source et des contrôles sémantiques explicites. Une nouvelle mise en forme qui casse une ancre exige une revue ; le script ne réécrit jamais silencieusement la spécification.

## Décisions, divergences et limites

1. L’annexe JSON mentionnée n’était pas incluse parmi les trois pièces. Cette reconstruction est fidèle aux pièces et reste une spécification fermée. Aucun ancien barème ou gain n’est recalculé.
2. L’économie annonce « 24 comportements explicitement sans XP », mais son tableau groupe ces comportements dans **13 lignes**. Le registre conserve exactement les 13 lignes plutôt qu’inventer 24 identifiants. Ce regroupement n’autorise aucun gain pour les comportements cités. La politique générale ferme conversion XP/argent et dépendance des fonctions essentielles aux XP.
3. Les 22 nouveaux identifiants sont des noms de conception, non des producteurs déjà branchés. `place_report_accepted` suit le nom cité par l’économie. La première publication devra confronter ces identifiants au schéma réel et garder les correspondances historiques sans nouveau crédit.
4. Les preuves textuelles font autorité ; les `claim_groups` sont des scopes de conception. Le moteur devra calculer leurs clés depuis des faits canoniques, sous propriété serveur et transaction, et non depuis un texte envoyé par le client. Les délais anti-collusion et confirmations ne sont pas attestés par ce JSON.
5. **Divergence T09 observée dans l’allocateur historique TS :** 45 XP avec Explorer 70 % / Préparer 30 % produit actuellement 31/14. Les restes mathématiques sont égaux et la priorité fixe Explorer impose 32/13 pour les nouvelles allocations. Les produits flottants ne sont pas exactement égaux. Ce constat a été transmis à l’orchestrateur ; aucun contrat partagé n’a été modifié dans cette tranche. Le registre exige la priorité Explorer, Préparer, Partager, Entraider. Les allocations historiques doivent rester inchangées. Le test d’annexe atteste conservation du total, **pas** conformité du tie-break ni parité TS/SQL. Les tests SQL de T09 restent nécessaires.
6. Aucun financement, encaissement, population réelle, résultat mobile, restauration ou contrôle de concurrence n’est inventé. Les gates ne pourront être ouvertes qu’après les preuves applicatives et opérationnelles des tâches correspondantes.

## Suite concrète

Intégrer cette annexe après revue, compléter T05 (contrats/unités/états du moteur) et T09 (répartition entière exacte TS/SQL). Garder les gates d’émission fermées jusqu’à preuve de sortie P0 et validation source → intention → attribution → transaction → événement → projection → affichage.

## Correction après revue indépendante — clés historiques

Le 10 octobre 2026 à 18:55 Europe/Paris, la revue a identifié une divergence de la matrice historique : `PRODUCER_MATRIX.md` indique encore `place_review:<place_id>`, tandis que `producerHooks.ts` transmet effectivement `sourceType='place_review'` et `sourceId=\`${userId}:${placeId}\``. La clé réelle est donc **`place_review:<user_id>:<place_id>`**. Le registre initial suivait la matrice ; il est corrigé pour préserver la clé actuelle, conformément à la consigne de vérifier l’état réel. Aucun comportement applicatif n’a changé.

Le vérificateur compare maintenant chacun des sept templates historiques à sa valeur exacte, même lorsque le contrat producteur n’est pas passé en paramètre. La CLI et les tests lisent aussi les sept couples `sourceType`/`sourceId` dans le fichier de hooks réel et refusent une dérive. La simple présence d’une chaîne non vide ne vaut plus contrôle de compatibilité. Une mutation par clé, ainsi que la suppression spécifique de l’utilisateur dans la clé d’avis côté registre et côté hooks, sont couvertes.

Le tuple des données `it.each` est explicitement typé `[string, number]` pour corriger l’erreur TS2345 relevée par le contrôle global de l’orchestrateur. Aucun second `tsc` n’a été lancé dans cette tranche.

Contrôles après correction :

- `node scripts/verify/progression-v2-registry.mjs` : succès.
- `npm test -- tests/features/progression/v2Registry.spec.ts` : tentative interrompue par l’absence temporaire de `node_modules/.bin/vitest` pendant la réinstallation des dépendances.
- `node node_modules/vitest/vitest.mjs run tests/features/progression/v2Registry.spec.ts` : **42 tests réussis**, sortie 0 (16:55:30 UTC). Exécution directe du même lanceur Vitest disponible, sans modifier les dépendances.

La spécification reste fermée et non publiée ; aucun fichier hors du périmètre de cette annexe n’a été modifié.
