# Déploiement existant et protection — 10 octobre 2026, 17:09 UTC

Lecture GitHub REST authentifiée via gh, dépôt TFaraciColbert59/kitduvoyageur_1783951966810. Aucun déploiement déclenché par cette lecture.

Production actuelle déclarée par GitHub/Vercel : deployment 6983937209, SHA f4696770a18b61e528be7bc61f215b15f1c6e5a2, success à 16:54:55Z, URL https://kitduvoyageur-1783951966810-g1pb9hrtw.vercel.app. Production précédente : 6983809374, SHA 373689c6a552d5a8e98fb54920c01467761f9916, success à 16:43:46Z, URL https://kitduvoyageur-1783951966810-nhdyor9fs.vercel.app. L'alias public avait répondu HTTP 200 ; les URL immuables doivent encore être sondées et comparées. Ce statut n'est pas une vérification des parcours authentifiés.

Branche main protégée ; ruleset 22982405 impose PR, résolution des commentaires et checks quality-gates, lighthouse, bundle-analysis, build-ios, visual-tests. Aucun approbateur humain requis (count 0) mais ces checks ne peuvent être contournés. Rulesets actifs interdisent suppression et non-fast-forward. Intégration par PR après revue/tests ; pas de push direct main.

Retour arrière prévu : déploiement applicatif du commit sain précédent avec migrations additives conservées ; arrêt des deux nouveaux jobs via leur down sans suppression de logs/protections/droits. Les downs historiques de verrouillage/démo/réconciliation ne sont pas une restauration admissible en production. Accès Vercel API/CLI de promotion non confirmé ; la disponibilité d'un URL précédent et d'un bouton ne prouve pas une restauration opérationnelle. Le chemin git revert + PR vérifiée utilise l'intégration existante si les contrôles passent.
