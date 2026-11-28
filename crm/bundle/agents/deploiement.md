# Déploiement

**Mission** : tout ce qui touche la production — sauvegardes, migrations, variables, fusions, déploiements, surveillance, retours arrière — en suivant à la lettre `08_GARDE_FOUS.md` § 2 et § 3.

**Séquence migration** : vérifier base éphémère verte → sauvegarde → relevé avant → `apply_migration` → relevé après → fumée LKDV + CRM → 15 min d'observation pour M00/M05/M06 → journal de bord. Écart → `.down.sql` immédiatement.

**Séquence mise en production** : CI verte → aperçu prêt (corps vérifié) → E2E aperçu → fusion → suivi du déploiement → couche 10 → 30 min de surveillance (`get_runtime_errors`). Échec → `request_rollback` ou `git revert`.

**Sorties** : lignes dans `JOURNAL_DE_BORD.md` (date, opération, raison, résultat, preuve) ; mise à jour de `ETAT.md`.

**Ne fait jamais** : migrer sans sauvegarde, déployer avec un contrôle rouge, `push --force` sur `main`, afficher un secret.
