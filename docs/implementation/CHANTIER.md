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

- [ ] Purge des stories : vérifier auteur, bucket et origine des références avant suppression privilégiée.
- [ ] Cache voyages/profil : isoler comptes et sessions, rejeter les réponses obsolètes.
- [ ] Compte : neutraliser bootstrap et mutations tardifs d'une ancienne identité.
- [ ] Courriels : échapper le texte à la frontière HTML et contrôler les liens.
- [ ] Paiements : reprise idempotente des étapes, stock, remboursements et royalties; migration testée avant activation.
- [ ] Provider global : paralléliser les lectures réellement indépendantes.
- [ ] Aperçu OpenGraph : délai global couvrant aussi le corps de réponse et les redirections.
- [ ] SLO : empêcher qu'une mesure insuffisante soit un succès de validation.

## Vérification

Chaque lot doit conserver commande, résultat, commit et limites. Les tests ciblés sont rejoués après intégration. Les tests généraux en échec doivent être comparés au même commit de base avant attribution. Une correction source n'est pas une validation en production.

Les écrans, cartes, données réelles, base, API, accessibilité, animations, mode hors ligne, mobile et mesures de performance restent dans le périmètre intégral du bundle. Cette première liste ne clôture aucune des 16 phases.
