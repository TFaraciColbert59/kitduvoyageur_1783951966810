-- ============================================================================
-- LKDV — AUDIT RLS & PERFORMANCE DB (LECTURE SEULE)
-- À exécuter dans le SQL Editor Supabase (ou psql) — n'écrit RIEN.
-- Plan performance §P2-2 : (select auth.uid()), index des requêtes chaudes,
-- pg_stat_statements top 20.
-- ============================================================================

-- 1. Policies avec auth.uid() NU (réévaluation par ligne = facteur 10-100).
--    Source : Supabase « RLS Performance and Best Practices ».
select schemaname, tablename, policyname,
       qual,
       with_check
from pg_policies
where schemaname = 'public'
  and (
    (qual like '%auth.uid()%' and qual not like '%(select auth.uid())%')
    or (with_check like '%auth.uid()%' and with_check not like '%(select auth.uid())%')
  )
order by tablename, policyname;

-- 2. Comptage global (KPI à suivre)
select
  count(*) filter (where qual like '%auth.uid()%') as policies_avec_uid,
  count(*) filter (where qual like '%auth.uid()%' and qual not like '%(select auth.uid())%') as policies_uid_nu
from pg_policies
where schemaname = 'public';

-- 3. Fonctions utilisées dans les policies : doivent être STABLE.
select p.proname, p.provolatile, p.prosecdef
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('can_read_trip', 'can_edit_trip')
order by p.proname;

-- 4. Index existants sur les colonnes des requêtes chaudes (audit C-25).
--    Croiser avec la liste attendue : trips(slug) UNIQUE, trips(user_id, start_date),
--    trip_steps(trip_id, day_number, order_index), trip_checklist_items(trip_id, ...),
--    group_members(user_id, status), group_members(group_id, status),
--    product_ownership(user_id), alerts(user_id, is_resolved),
--    materiel_loans(lender_id, status), crew_members(crew_id, status),
--    trip_collaborators(trip_id, user_id).
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'trips', 'trip_steps', 'trip_checklist_items', 'group_members',
    'product_ownership', 'alerts', 'materiel_loans', 'crew_members',
    'trip_collaborators', 'travel_groups'
  )
order by tablename, indexname;

-- 5. Top 20 requêtes par temps cumulé (nécessite pg_stat_statements).
select
  round(total_exec_time::numeric, 1) as total_ms,
  calls,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows,
  left(query, 120) as query
from pg_stat_statements
order by total_exec_time desc
limit 20;

-- 6. Tables sans policy RLS (fail-open accidentel ?).
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;
