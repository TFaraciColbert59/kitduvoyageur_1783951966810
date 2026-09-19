# Base de test locale (progression) — procédure éprouvée

Mise à jour : 19 septembre 2026. Cette procédure a été exécutée avec succès pour P1 (pgTAP 50/50).

## Pourquoi pas `supabase start` à froid

La chaîne `supabase start` sur base vierge échoue dans des migrations préexistantes (2026-07/28) : colonnes `country_sync_log.code_iso`, `moderation_queue.listing_id`/`soumis_par`, tables `groupe_*`/`user_payment_methods` absentes du dossier `migrations` (elles viennent de la base prod). Deux réparations additives ont été committées (`20260713240000`, `20260715120000`) mais la chaîne reste incomplète à froid. La procédure ci-dessous utilise la baseline officielle du dépôt.

## Procédure

```powershell
# 1. Conteneur Postgres Supabase (port 55432)
docker run -d --name lkdv-test-db -e POSTGRES_PASSWORD=postgres -p 55432:5432 public.ecr.aws/supabase/postgres:17.6.1.141

# 2. Extensions (fichier de reset, voir plus bas), baseline, auth, grants
docker cp supabase/baseline/prod_schema_20260911.sql lkdv-test-db:/tmp/baseline.sql
docker cp supabase/baseline/auth_integration.sql lkdv-test-db:/tmp/auth_integration.sql
docker cp supabase/baseline/grants.sql lkdv-test-db:/tmp/grants.sql
docker exec lkdv-test-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/reset.sql        # DROP SCHEMA + extensions
docker exec lkdv-test-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/baseline.sql
docker exec lkdv-test-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/auth_integration.sql
docker exec lkdv-test-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/grants.sql

# 3. Migrations post-baseline utiles (dans l'ordre), dont la progression
docker cp supabase/migrations/20260919_unified_progression_rankings.sql lkdv-test-db:/tmp/progression.sql
docker exec lkdv-test-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/progression.sql
# puis 20260920100000 → 20260920106000 de la même façon

# 4. Tests pgTAP
npx supabase test db --db-url "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable" `
  supabase/tests/database/progression_canonique_ledger.test.sql `
  supabase/tests/database/progression_canonique_outbox.test.sql `
  supabase/tests/database/progression_canonique_rules.test.sql `
  supabase/tests/database/progression_canonique_award.test.sql `
  supabase/tests/database/progression_canonique_consumer.test.sql `
  supabase/tests/database/progression_canonique_rebuild.test.sql `
  supabase/tests/database/progression_canonique_security.test.sql
```

`reset.sql` = `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;` puis `CREATE EXTENSION IF NOT EXISTS` pour : postgis, pgcrypto, "uuid-ossp", pgtap, pg_trgm, btree_gin, btree_gist, unaccent, citext, cube, earthdistance, hstore, vector (toutes `WITH SCHEMA public`), puis les GRANT sur le schéma.

## Résultats P1 (19/09/2026)

| Suite | Tests |
|---|---|
| progression_canonique_ledger | 8/8 |
| progression_canonique_outbox | 6/6 |
| progression_canonique_rules | 5/5 |
| progression_canonique_award | 8/8 |
| progression_canonique_consumer | 9/9 |
| progression_canonique_rebuild | 5/5 |
| progression_canonique_security | 6/6 |
| **Total** | **50/50** |

Tests TypeScript du même périmètre : `npm test -- tests/features/progression` → 51/51.

## Nettoyage

```powershell
docker rm -f lkdv-test-db
```
