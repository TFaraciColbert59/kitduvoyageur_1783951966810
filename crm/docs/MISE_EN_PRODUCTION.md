# Mise en production du socle `admin` — actions prêtes pour Tony

La règle `08_GARDE_FOUS.md` § 2.2 interdit toute migration de production sans sauvegarde `pg_dump` via `SUPABASE_DB_URL`. Ce secret est absent : rien n'a été appliqué. Voici la séquence exacte, prête à exécuter.

1. Poser les secrets GitHub Actions (Settings → Secrets and variables → Actions) :
   - `SUPABASE_DB_URL` : chaîne « Session pooler » de Supabase (mot de passe de la base inclus) ;
   - `BACKUP_PASSPHRASE` : phrase longue, conservée hors du dépôt.
2. Lancer la sauvegarde : Actions → « Sauvegarde de la base » → Run workflow (branche `main`). Vérifier l'artefact `lkdv-<date>.dump.gpg`.
3. Appliquer les migrations CRM, dans l'ordre, une par une, avec les advisors avant/après :
   `supabase/migrations/20261109*_crm_*.sql` (M00 → M15). Chaque fichier a son `.down.sql` dans `supabase/migrations_down/`.
   Après M00, M05 et M06 : attendre 15 minutes et consulter `app_errors`, les journaux PostgREST et `get_runtime_errors` Vercel.
4. Exposer le schéma `admin` à PostgREST (API de gestion Supabase) :
   `GET /v1/projects/icxyvwzfjbflcbqukpfz/postgrest` puis
   `PATCH` avec `{"db_schema":"public,graphql_public,admin"}` (conserver les schémas déjà exposés).
5. Régénérer les types : `cd crm && npm run gen:types` (nécessite la CLI Supabase), puis redéployer le CRM.
6. Rejouer les tests : `gh workflow run crm-ci.yml` (ou push) ; puis les tests E2E avec un compte de test (`crm/tests/README.md`).

Retour arrière : appliquer les `.down.sql` dans l'ordre inverse (M15 → M00), restaurer la sauvegarde si nécessaire.
