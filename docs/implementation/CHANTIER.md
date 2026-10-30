# Chantier LKDV — suivi durable

Mandat : implémentation autonome du bundle du 29 octobre 2026, budget additionnel 0 €.

## Cible

- Dépôt : TFaraciColbert59/kitduvoyageur_1783951966810.
- Base : version publique vérifiée `312a51b22b24d6d4fb599cf5ef25cb4f97474e5d`.
- Branche : `codex/lkdv-autonomous-2026-10-29`.
- La branche est exclue des déploiements automatiques Vercel pour ne pas déclencher de coût ou publier un chantier incomplet.
- Aucun déploiement ni migration de production ne résulte de ce checkpoint.

## État au redémarrage

L'environnement de travail a été restauré avant publication des premiers correctifs. Les changements non publiés de la session précédente ne sont pas présents dans cette branche. Ils doivent être réappliqués et vérifiés; les résultats de cette ancienne session ne prouvent pas le code du checkpoint actuel.

## Priorités du premier lot

Les cases ci-dessous concernent l'implémentation source et ses tests locaux, jamais un déploiement ou une validation en production.

- [x] Purge des stories : vérifier auteur, bucket et origine des références avant suppression privilégiée.
- [x] Cache voyages/profil : isoler comptes et sessions, rejeter les réponses obsolètes.
- [x] Compte : neutraliser bootstrap et mutations tardifs d'une ancienne identité.
- [x] Courriels : échapper le texte à la frontière HTML et contrôler les liens.
- [ ] Paiements : reprise idempotente des étapes, stock, remboursements et royalties; migration testée avant activation.
- [x] Provider global : paralléliser les lectures réellement indépendantes.
- [x] Aperçu OpenGraph : délai global couvrant aussi le corps de réponse et les redirections.
- [x] SLO : empêcher qu'une mesure insuffisante soit un succès de validation.

## Preuves du lot 1

Commande d'intégration :

```sh
node_modules/.bin/vitest run --maxWorkers=2 src/lib/stories src/lib/notifications tests/notifications src/features/trips/client/__tests__/fetchMyTrips.test.ts src/contexts/__tests__/AuthContext.isolation.test.tsx src/features/trips/context/__tests__/ActiveTripContext.storage.test.ts src/features/hub/context/__tests__ tests/api/og-preview-deadline.spec.ts tests/observability/slo.spec.ts tests/observability/slo-load-gate.spec.ts
```

Résultat : 15 fichiers, 105 tests réussis. Revue indépendante supplémentaire : purge, courriel, OpenGraph et SLO, 64 tests réussis. Tests hors ligne, aucun courriel envoyé ni objet réel supprimé. Aucun gain chiffré de latence n'est revendiqué pour la parallélisation; les tests prouvent le démarrage concurrent de deux lectures indépendantes.

Limites du lot 1 : le bootstrap/runtime Compte nécessitait encore ses gardes d'identité (traitées au lot 2); l'expiration hors ligne conserve les règles préexistantes du cache local de voyages. Le transport HTTP ne fixe pas la résolution DNS validée (OpenGraph : risque distinct toujours à revalider). Les métriques SLO indépendantes restent des entrées de mesure à collecter réellement. Les paiements n'ont pas été modifiés par le lot 1.

## Vérification

### Reprise du 30 octobre — contrôles de fiabilité et secrets de démo

- [x] Fermer le contournement SLO par une valeur scalaire : les indicateurs échantillonnés exigent un objet, `valid === true` et un effectif entier suffisant.
- [x] Retirer les identifiants du seed et la publication de son mot de passe, y compris le chemin indirect `note` → résumé → journal. Les variables explicites sont validées avant création du client.
- [x] Ajouter une CI dédiée à la branche du chantier : typage et régressions hors ligne, runner Ubuntu standard, aucun secret ni déploiement, cache ou artefact ajouté.

Preuves locales : 66 tests ciblés sur 5 fichiers; intégration sécurité/fiabilité du lot 1 avec les nouveaux contrôles : 149 tests sur 18 fichiers. Contrôle TypeScript complet sans émission : code de sortie 0. La revue indépendante a repéré la fuite indirecte du seed; elle a été corrigée et son test a été reproduit rouge puis vert.

La suite générale du commit de base `f7d18e9` a été rejouée dans un worktree indépendant : 1 064 fichiers réussis, 45 en échec, 5 ignorés; 12 758 tests réussis, 114 en échec, 51 ignorés. Ces résultats ne sont pas une validation générale verte. Le navigateur Chromium reste indisponible localement : le téléchargement Playwright échoue. La CI ajoutée doit encore être observée après publication.

Les identifiants retirés restent dans l'historique Git : cette modification ne prouve aucune rotation de compte. Compte, reprise Stripe et optimisation de compilation restent des lots séparés tant que leurs dernières revues et vérifications ne sont pas terminées.

### Lot 2 — isolation Compte et reprise Stripe

- [x] Compte : rejeter les lectures, recherches, exports, écritures et callbacks d'une identité ou session expirée; reconstruire le runtime avant l'affichage du nouveau compte et séparer son stockage local par utilisateur.
- [x] Compte : annuler minuteries/animations, neutraliser les anciennes actions globales et supprimer le bootstrap redondant. La navigation de déconnexion attend l'identité locale vide du provider; elle ne prouve pas une déconnexion distante réussie.
- [x] Stripe : migration de reprise transactionnelle préparée et rejouée sur une base isolée; prix payés conservés, stock/encaissement/droits idempotents, reprises après panne et barrière de remboursement.
- [x] Stripe : refuser un nouveau paiement sans produit canonique représentable, un panier externalisé non enregistré ou une lecture d'attribution en erreur.
- [x] Compilation : retirer le callback webpack vide qui désactivait le worker par défaut de Next. Build complet avec lint/typage et génération des 50 pages réussi, heap maximal configuré à 4 Gio; aucun gain chiffré de latence ou mémoire n'est déduit de ce seul passage.

Revue indépendante Compte : tous les blocages corrigés; 22 tests d'intégration réels JSDOM réussis, plus 14 tests de visibilité. Revue indépendante Stripe : aucun nouveau blocage restant dans le diff. Rejeu SQL PostgreSQL 18.6/PGlite 0.5.13 : 160 instructions réussies, fonctions historiques incluses. Intégration locale : 244 tests sur 26 fichiers réussis. Le workflow du commit `2fb0a28` est réellement terminé avec succès : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/41017944567.

Le nouveau job PostgreSQL natif doit encore exécuter les scénarios multi-connexions après publication. La migration doit précéder le webhook lors d'une future livraison; aucune migration, paiement, modification de données ou publication de production n'a eu lieu. Les limites financières historiques restent explicites dans `docs/security/AUDVA03-stripe-checkout-resume.md`, notamment les remboursements précédant toute commande et les deltas concurrents. Aucun test navigateur réel ni validation visuelle exhaustive n'est revendiqué.

Actualisation après publication : **les deux jobs de la CI `ffbbd734` sont réussis**, y compris le véritable rejeu PostgreSQL 17 et les deux scénarios multi-connexions. Preuve : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/41019892499. Cela ne valide pas une migration du schéma complet de production.

### Lot 3 — export RGPD et release mobile

- [x] Export : pagination sur toutes les tables du registre existant et leurs enfants, ordre par clé primaire, contrôle des totaux, plages avançant du nombre de lignes reçu et lots de 100 identifiants de plans.
- [x] Export : budgets communs de lignes, octets source, requêtes et durée; aucune archive partielle acquittée en cas d'erreur ou de limite. Sujet toujours issu de la session authentifiée.
- [x] Mobile : séquence native partagée au niveau du module et gardes de propriétaire sur les réponses différées; une ancienne instance ne peut écraser la hauteur de navigation d'une nouvelle.
- [x] Release : configuration Capacitor sécurisée par défaut, opt-in de développement explicite, wrapper Node portable imposant le mode production et refusant le serveur de développement. `mobile:build` et les workflows iOS existants utilisent ce wrapper; leurs déclencheurs sont inchangés.

Export : 33 tests sur 3 fichiers réussis, incluant le vrai SDK Supabase sur un transport PostgREST simulé, limites de 37/1 000 lignes, 1 203 enfants, clés composites, pannes et annulation. Mobile : 65 tests sur 6 fichiers réussis. Revues indépendantes : aucun blocage restant dans ces deux lots. Typage complet local réussi (heap 4 Gio).

Limites : pagination sans instantané transactionnel commun; un export dépassant les limites demande un traitement asynchrone encore absent (réponse explicite 503). Pas de lecture des données réelles de production, pas de compilation native signée ni test UIKit sur appareil. Une recréation complète du WebView conservant son hôte natif reste à vérifier. Ces cases clôturent les correctifs source décrits, jamais l'ensemble du chantier.

Chaque lot doit conserver commande, résultat, commit et limites. Les tests ciblés sont rejoués après intégration. Les tests généraux en échec doivent être comparés au même commit de base avant attribution. Une correction source n'est pas une validation en production.

Les écrans, cartes, données réelles, base, API, accessibilité, animations, mode hors ligne, mobile et mesures de performance restent dans le périmètre intégral du bundle. Cette première liste ne clôture aucune des 16 phases.
