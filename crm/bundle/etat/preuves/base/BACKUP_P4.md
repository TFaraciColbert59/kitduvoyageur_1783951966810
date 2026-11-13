# Sauvegarde avant migration de production (08_GARDE_FOUS § 2.2)

Tentative du 2026-11-09 05:13 : workflow `.github/workflows/db-backup.yml` déclenché par API (`workflow_dispatch`, run 42560633757).
Résultat : run « success » mais étapes 3 à 5 **sautées** — l'étape 2 « Secrets présents ? » a conclu `ready=false`.

| Secret | Attendu | Constat |
| --- | --- | --- |
| `SUPABASE_DB_URL` | chaîne Postgres directe | absent des secrets GitHub |
| `BACKUP_PASSPHRASE` | phrase de chiffrement | absent des secrets GitHub |

Conséquence appliquée : **aucune migration de production n'est appliquée** (règle 08 § 2.2). Le code, les migrations et les tests sont livrés ; ils sont vérifiés sur base éphémère en CI. La liste des commandes prêtes à lancer figure dans `crm/docs/MISE_EN_PRODUCTION.md`.
