-- ============================================================================
-- T01 — Test de RESTAURATION ISOLÉE des 13 tables de points
--
-- Source : backups/phase1-2026-10-10T13-29-31-910Z/*.json
--          (snapshot prod du 2026-10-10T13:29:31.911Z, 13 tables + manifest.json)
-- Cible  : schéma `restore_t01` du container Docker LOCAL supabase_db_ai-finalization
--
-- ⚠ LOCAL UNIQUEMENT. Aucune connexion à la prod. Aucun objet `public.*` modifié :
--   tout est restauré dans le schéma jetable `restore_t01`.
--
-- ⚠ Rôle requis : `supabase_admin` (superuser local) car pg_read_file() l'exige.
--   `psql -U postgres` échoue avec « permission denied for function pg_read_file » :
--   le rôle `postgres` du container local n'est PAS superuser (vérifié).
--
-- Prérequis (exécutés avant ce script) :
--   1. docker exec supabase_db_ai-finalization bash -c "mkdir -p /tmp/t01"
--   2. docker cp backups/phase1-2026-10-10T13-29-31-910Z/<table>.json \
--        supabase_db_ai-finalization:/tmp/t01/<table>.json          (x13 + manifest.json)
--   3. Intégrité du transfert : sha256sum des 13 fichiers dans le container ==
--      manifest.json (13/13 conformes).
--
-- Usage :
--   docker cp scripts/ops/t01_restore_check.sql \
--     supabase_db_ai-finalization:/tmp/t01/t01_restore_check.sql
--   docker exec -i supabase_db_ai-finalization psql -U supabase_admin -d postgres \
--     -v ON_ERROR_STOP=1 -A -F "|" -f /tmp/t01/t01_restore_check.sql
--
-- Adaptations vs plan initial (documentées dans docs/phase1/RESTAURATION-2026-10-11.md) :
--   1) Rôle `supabase_admin` au lieu de `postgres` (pg_read_file superuser-only).
--   2) user_profiles.is_demo (NOT NULL DEFAULT false) est absente des JSON :
--      colonne ajoutée par la migration 20261010160000 (I2), postérieure au
--      snapshot. Injection du défaut de schéma (false) à l'insertion, pour
--      cette unique table. Aucune autre colonne ne manque (vérifié).
--
-- Nettoyage (optionnel, après inspection) :
--   docker exec -i supabase_db_ai-finalization psql -U supabase_admin -d postgres \
--     -c "DROP SCHEMA IF EXISTS restore_t01 CASCADE;"
-- ============================================================================

\set ON_ERROR_STOP on

\echo '=== 1. Schema isole ==============================================='
DROP SCHEMA IF EXISTS restore_t01 CASCADE;
CREATE SCHEMA restore_t01;

\echo '=== 2. Clones de structure (LIKE ... INCLUDING DEFAULTS/GENERATED/IDENTITY) ==='
CREATE TABLE restore_t01.user_profiles             (LIKE public.user_profiles             INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.loyalty_history           (LIKE public.loyalty_history           INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.loyalty_redemptions       (LIKE public.loyalty_redemptions       INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.reward_transactions       (LIKE public.reward_transactions       INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.progression_outbox        (LIKE public.progression_outbox        INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.progression_events        (LIKE public.progression_events        INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.user_progression          (LIKE public.user_progression          INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.user_season_progress      (LIKE public.user_season_progress      INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.orders                    (LIKE public.orders                    INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.progression_legacy_snapshot (LIKE public.progression_legacy_snapshot INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.reward_accounts           (LIKE public.reward_accounts           INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.kit_reports               (LIKE public.kit_reports               INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);
CREATE TABLE restore_t01.reward_config             (LIKE public.reward_config             INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);

\echo '=== 3. Insertions depuis les JSON (jsonb_populate_recordset) ======'

-- user_profiles : variante (is_demo absente du snapshot -> defaut de schema false)
INSERT INTO restore_t01.user_profiles
SELECT * FROM jsonb_populate_recordset(null::public.user_profiles,
  COALESCE((SELECT jsonb_agg(elem || '{"is_demo": false}'::jsonb)
            FROM jsonb_array_elements((SELECT pg_read_file('/tmp/t01/user_profiles.json')::jsonb)) AS elem),
           '[]'::jsonb));

-- Commande generique demandee (les 12 autres tables) :
--   INSERT INTO restore_t01.<t> SELECT * FROM jsonb_populate_recordset(null::public.<t>, (SELECT pg_read_file('/tmp/t01/<t>.json')::jsonb));
INSERT INTO restore_t01.loyalty_history      SELECT * FROM jsonb_populate_recordset(null::public.loyalty_history,      (SELECT pg_read_file('/tmp/t01/loyalty_history.json')::jsonb));
INSERT INTO restore_t01.loyalty_redemptions  SELECT * FROM jsonb_populate_recordset(null::public.loyalty_redemptions,  (SELECT pg_read_file('/tmp/t01/loyalty_redemptions.json')::jsonb));
INSERT INTO restore_t01.reward_transactions  SELECT * FROM jsonb_populate_recordset(null::public.reward_transactions,  (SELECT pg_read_file('/tmp/t01/reward_transactions.json')::jsonb));
INSERT INTO restore_t01.progression_outbox   SELECT * FROM jsonb_populate_recordset(null::public.progression_outbox,   (SELECT pg_read_file('/tmp/t01/progression_outbox.json')::jsonb));
INSERT INTO restore_t01.progression_events   SELECT * FROM jsonb_populate_recordset(null::public.progression_events,   (SELECT pg_read_file('/tmp/t01/progression_events.json')::jsonb));
INSERT INTO restore_t01.user_progression     SELECT * FROM jsonb_populate_recordset(null::public.user_progression,     (SELECT pg_read_file('/tmp/t01/user_progression.json')::jsonb));
INSERT INTO restore_t01.user_season_progress SELECT * FROM jsonb_populate_recordset(null::public.user_season_progress, (SELECT pg_read_file('/tmp/t01/user_season_progress.json')::jsonb));
INSERT INTO restore_t01.orders               SELECT * FROM jsonb_populate_recordset(null::public.orders,               (SELECT pg_read_file('/tmp/t01/orders.json')::jsonb));
INSERT INTO restore_t01.progression_legacy_snapshot SELECT * FROM jsonb_populate_recordset(null::public.progression_legacy_snapshot, (SELECT pg_read_file('/tmp/t01/progression_legacy_snapshot.json')::jsonb));
INSERT INTO restore_t01.reward_accounts      SELECT * FROM jsonb_populate_recordset(null::public.reward_accounts,      (SELECT pg_read_file('/tmp/t01/reward_accounts.json')::jsonb));
INSERT INTO restore_t01.kit_reports          SELECT * FROM jsonb_populate_recordset(null::public.kit_reports,          (SELECT pg_read_file('/tmp/t01/kit_reports.json')::jsonb));
INSERT INTO restore_t01.reward_config        SELECT * FROM jsonb_populate_recordset(null::public.reward_config,        (SELECT pg_read_file('/tmp/t01/reward_config.json')::jsonb));

\echo '=== 4a. CONTROLE A - compteurs restaures vs manifest.json ==='
SELECT table_name, manifest_rows, restored_rows, (restored_rows = manifest_rows) AS match
FROM (
            SELECT 'kit_reports'                AS table_name,   6 AS manifest_rows, (SELECT count(*) FROM restore_t01.kit_reports)                AS restored_rows
  UNION ALL SELECT 'loyalty_history',                             6, (SELECT count(*) FROM restore_t01.loyalty_history)
  UNION ALL SELECT 'loyalty_redemptions',                         0, (SELECT count(*) FROM restore_t01.loyalty_redemptions)
  UNION ALL SELECT 'orders',                                      3, (SELECT count(*) FROM restore_t01.orders)
  UNION ALL SELECT 'progression_events',                          0, (SELECT count(*) FROM restore_t01.progression_events)
  UNION ALL SELECT 'progression_legacy_snapshot',                 0, (SELECT count(*) FROM restore_t01.progression_legacy_snapshot)
  UNION ALL SELECT 'progression_outbox',                         15, (SELECT count(*) FROM restore_t01.progression_outbox)
  UNION ALL SELECT 'reward_accounts',                           111, (SELECT count(*) FROM restore_t01.reward_accounts)
  UNION ALL SELECT 'reward_config',                              12, (SELECT count(*) FROM restore_t01.reward_config)
  UNION ALL SELECT 'reward_transactions',                        31, (SELECT count(*) FROM restore_t01.reward_transactions)
  UNION ALL SELECT 'user_profiles',                             111, (SELECT count(*) FROM restore_t01.user_profiles)
  UNION ALL SELECT 'user_progression',                            9, (SELECT count(*) FROM restore_t01.user_progression)
  UNION ALL SELECT 'user_season_progress',                        9, (SELECT count(*) FROM restore_t01.user_season_progress)
) x
ORDER BY table_name;

\echo '=== 4b. CONTROLE B - fidelite : user_profiles.loyalty_points vs SUM(loyalty_history.points) ==='
SELECT
  (SELECT count(*) FROM restore_t01.user_profiles)  AS profiles,
  (SELECT count(*) FROM restore_t01.loyalty_history) AS journal_rows,
  (SELECT COALESCE(sum(points),0) FROM restore_t01.loyalty_history) AS journal_sum,
  (SELECT count(*) FROM restore_t01.user_profiles p
     LEFT JOIN (SELECT user_id, sum(points) AS s FROM restore_t01.loyalty_history GROUP BY user_id) h
            ON h.user_id = p.id
    WHERE COALESCE(p.loyalty_points,0) IS DISTINCT FROM COALESCE(h.s,0)) AS ecarts;

\echo '--- detail des ecarts (user | points_profil | somme_journal) :'
SELECT p.id, p.loyalty_points, h.s AS journal_sum
FROM restore_t01.user_profiles p
LEFT JOIN (SELECT user_id, sum(points) AS s FROM restore_t01.loyalty_history GROUP BY user_id) h
       ON h.user_id = p.id
WHERE COALESCE(p.loyalty_points,0) IS DISTINCT FROM COALESCE(h.s,0)
ORDER BY p.id;

\echo '--- journal : repartition par type :'
SELECT type, count(*) AS rows, COALESCE(sum(points),0) AS sum_points
FROM restore_t01.loyalty_history GROUP BY type ORDER BY type;

\echo '=== 4c. CONTROLE C - economique : reward_accounts vs SUM(reward_transactions) ==='
WITH tx AS (
  SELECT user_id,
         sum(points) FILTER (WHERE affects_balance IS NOT FALSE) AS sum_affects_balance,
         sum(points) FILTER (WHERE points > 0)                   AS sum_positive
  FROM restore_t01.reward_transactions GROUP BY user_id
)
SELECT
  (SELECT count(*) FROM restore_t01.reward_accounts)     AS accounts,
  (SELECT count(*) FROM restore_t01.reward_transactions) AS transactions,
  count(*) FILTER (WHERE COALESCE(a.available_points,0) IS DISTINCT FROM COALESCE(tx.sum_affects_balance,0)) AS ecarts_available,
  count(*) FILTER (WHERE COALESCE(a.lifetime_points,0)  IS DISTINCT FROM COALESCE(tx.sum_positive,0))        AS ecarts_lifetime
FROM restore_t01.reward_accounts a
LEFT JOIN tx ON tx.user_id = a.user_id;

\echo '--- detail des ecarts (user | available | ledger_bal | lifetime | ledger_pos) :'
WITH tx AS (
  SELECT user_id,
         sum(points) FILTER (WHERE affects_balance IS NOT FALSE) AS sum_affects_balance,
         sum(points) FILTER (WHERE points > 0)                   AS sum_positive
  FROM restore_t01.reward_transactions GROUP BY user_id
)
SELECT a.user_id, a.available_points, tx.sum_affects_balance, a.lifetime_points, tx.sum_positive
FROM restore_t01.reward_accounts a
LEFT JOIN tx ON tx.user_id = a.user_id
WHERE COALESCE(a.available_points,0) IS DISTINCT FROM COALESCE(tx.sum_affects_balance,0)
   OR COALESCE(a.lifetime_points,0)  IS DISTINCT FROM COALESCE(tx.sum_positive,0)
ORDER BY a.user_id;

\echo '=== 4d. CONTROLE D - progression : progression_events vs user_progression ==='
SELECT
  (SELECT count(*) FROM restore_t01.progression_events)                        AS events_rows,
  (SELECT COALESCE(sum(points_total),0) FROM restore_t01.progression_events)   AS events_points_total,
  (SELECT count(*) FROM restore_t01.user_progression)                          AS user_progression_rows,
  (SELECT COALESCE(sum(lifetime_points),0) FROM restore_t01.user_progression)  AS user_lifetime_total;

\echo '--- comparaison demandee : SUM(events.points_total) vs SUM(user_progression.lifetime_points) :'
SELECT
  (SELECT COALESCE(sum(points_total),0)::bigint FROM restore_t01.progression_events)   AS sum_events,
  (SELECT COALESCE(sum(lifetime_points),0)::bigint FROM restore_t01.user_progression)  AS sum_lifetime,
  (SELECT count(*) FROM restore_t01.user_progression up
     LEFT JOIN (SELECT user_id, sum(points_total) AS s FROM restore_t01.progression_events GROUP BY user_id) ev
            ON ev.user_id = up.user_id
    WHERE up.lifetime_points IS DISTINCT FROM COALESCE(ev.s,0)) AS users_sans_parite;

\echo '--- outbox : repartition par statut (contexte) :'
SELECT status, count(*) AS rows FROM restore_t01.progression_outbox GROUP BY status ORDER BY status;

\echo '=== 5. Fin - schema restore_t01 laisse en place pour inspection ==='
