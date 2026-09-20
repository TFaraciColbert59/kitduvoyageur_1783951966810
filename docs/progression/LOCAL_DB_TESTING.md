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
| **Total P1** | **47/47** (le « 50 » annoncé dans les messages de commit P1 était une erreur d'arithmétique, corrigée ici) |
| progression_leaderboard (P3) | 48/48 (46 + 2 durcissement k-anonymat/alias) |
| progression_hardening | 12/12 |
| progression_leaderboard_adversarial | 10/10 |
| **Total moteur + classement** | **117/117** |

Tests TypeScript du même périmètre : `npm test -- tests/features/progression` → 97/97.

## Stabilisation — chaîne complète, base neuve, base héritée, rollback

Exécuté le 19/09/2026 sur trois conteneurs indépendants (`public.ecr.aws/supabase/postgres:17.6.1.141`) :

| Scénario | Procédure | Résultat |
|---|---|---|
| **Base neuve, chaîne complète** | baseline + auth + grants, puis **toutes** les migrations post-baseline (≈100 fichiers, de `20260911130000` à `20260920111000`) | **0 erreur**, 117/117 pgTAP |
| **Base héritée (moteur de démo 20260919)** | chaîne jusqu'à `20260919`, injection de projections inventées (Chamonix, rang codé, 380/950 pts) + solde économique, puis migrations canoniques | Migration OK, **réconciliation vérifiée** : archive `progression_legacy_snapshot` (2 lignes), projections démo purgées, journaux sans gain purgés, **solde économique intact (7)**, parcours canonique rejoué (40 pts), **rebuild reproduit 40**, aucun fantôme pour l'utilisateur sans gain |
| **Rollback** | les 12 descentes `migrations_down/2026092010*` en ordre inverse | **ROLLBACK COMPLET VÉRIFIÉ** : plus aucune table/fonction canonique, colonnes retirées de `reward_transactions`, gains reclassés `ADMIN_ADJUSTMENT` (aucune perte d'audit) |
| **Remigration** | réapplication des 12 migrations après rollback | **0 erreur**, suites ledger + durcissement vertes |

Précisions d'exécution :
- La chaîne complète exige le rôle **`supabase_admin`** (le rôle `postgres` du conteneur n'est pas propriétaire de `spatial_ref_sys`).
- Trois réparations additives de migrations préexistantes ont été nécessaires pour rejouer à froid : `20260713240000` (colonnes `country_sync_log`), `20260715120000` (colonnes `moderation_queue`), `20260917_phase1_security_fixes` (signatures de fonctions absentes + gardes `DO`).
- Les descentes sont idempotentes (rejouables) : `DROP ... IF EXISTS`, gardes `to_regclass`, `ALTER TABLE IF EXISTS`.

### Scripts de vérification utilisés

`apply-post-cutoff.sh` (chaîne complète), `apply-up-to-20260919.sh` + `apply-canonical.sh` (héritée), `legacy-verify.sql` (réconciliation + rebuild), `rollback-canonical.sh` + `rollback-verify.sql` (rollback). Ces scripts d'exécution ponctuelle n'ont pas été versionnés ; les commandes équivalentes sont ci-dessus et dans `ROLLBACK.md` (migrations_down).

## Nettoyage

```powershell
docker rm -f lkdv-test-db
```
