-- ═══════════════════════════════════════════════════════════════════════════
-- M00 — crm_security_fixes  (03_MODELE_DE_DONNEES.md § 2)
-- Chantier LKDV Control. Idempotent. Aucune donnée métier touchée.
--
-- Contenu :
--   1. Vues exposées : décision motivée et durcissement des privilèges.
--   2. Fonctions SECURITY DEFINER : retrait d'EXECUTE pour anon quand aucun
--      lecteur public n'existe (relevé dans src/ + policies).
--   3. Politiques explicites (refus) sur les 41 tables en RLS sans policy.
--
-- Relevé en lecture avant écriture (2026-11-09) :
--   * hub_dashboard_kpis : vue, lecteur unique = /api/hub/dashboard (route
--     authentifiée, garde is_admin(), client anon + JWT). Aucune lecture anon.
--   * public_profiles : vue DEFINER, lue par le NAVIGATEUR (src/lib/supabase/
--     client.ts) sur /profil/[id], y compris par un visiteur anonyme. Elle
--     filtre les lignes (profile_visibility, is_demo) et n'expose jamais
--     e-mail / téléphone. Passer security_invoker=true casserait la lecture
--     publique : la RLS de user_profiles n'autorise que sa propre ligne
--     (policies profile_read_own_visibility, users_read_own_profile) et une
--     policy permissive sur user_profiles exposerait email/phone via PostgREST.
--     → la vue reste DEFINER : exception documentée (voir COMMENT ci-dessous).
--   * 41 tables ont RLS active sans aucune policy : PostgREST les refuse déjà
--     (anon/authenticated) ; les policies ajoutées rendent ce refus explicite.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Vues
-- ───────────────────────────────────────────────────────────────────────────
-- hub_dashboard_kpis : la route appelante exige une session ; anon n'a rien à y
-- faire. Les droits DML hérités des privilèges par défaut sont retirés.
revoke all on table public.hub_dashboard_kpis from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.hub_dashboard_kpis from anon, authenticated;
comment on view public.hub_dashboard_kpis is
  'M00 LKDV Control : vue DEFINER réservée à l''équipe (route /api/hub/dashboard, garde is_admin()). anon : aucun privilège.';

-- public_profiles : reste SECURITY DEFINER (lecture navigateur, y compris anon).
-- L'exposition est bornée par la vue elle-même (colonnes publiques + filtre de
-- visibilité) ; on retire en revanche tout droit d'écriture hérité.
revoke insert, update, delete, truncate, references, trigger
  on table public.public_profiles from anon, authenticated;
alter view public.public_profiles set (security_barrier = true);
comment on view public.public_profiles is
  'M00 LKDV Control : vue DEFINER assumée (lecture navigateur, anon inclus). Expose uniquement les colonnes publiques et filtre profile_visibility/is_demo ; ne jamais la convertir en security_invoker sans policy publique sur user_profiles (exposerait email/téléphone) ni ajouter de policy permissive sur user_profiles.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Fonctions SECURITY DEFINER exécutables par anon
-- ───────────────────────────────────────────────────────────────────────────
-- Relevé 2026-11-09 : 21 fonctions SECURITY DEFINER exécutables par anon.
-- Conservées pour anon (lecteurs publics réels, décision A-214 du dépôt et
-- grep src/) : a5_terrain_reports_near, can_edit_trip, can_read_trip,
-- can_view_carnet, can_view_carnet_moment, carnet_public_position,
-- current_feature_flags, explorer_place, explorer_pois, explorer_routes,
-- get_user_signature, group_public_card_stats, is_carnet_participant,
-- is_group_member, is_group_public, lkv_can, marketplace_list
-- (prédicats appelés par des policies visant le rôle public : les révoquer
-- casserait des lectures publiques) et st_estimatedextent (extension PostGIS).
--
-- Seule fonction sans aucun lecteur (ni policies, ni src/) : la recherche
-- vectorielle interne des guides pays.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'match_pays_chat_chunks'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Les 41 tables en RLS sans policy : refus explicite
-- ───────────────────────────────────────────────────────────────────────────
-- Ces tables sont lues/écrites par des fonctions SECURITY DEFINER (propriétaire)
-- ou par service_role, qui ne sont pas gouvernés par la RLS. Le refus explicite
-- ne change donc aucun comportement : il rend la règle lisible et empêche
-- qu'une policy permissive ajoutée plus tard ouvre la table sans décision.
do $$
declare t text;
  tables text[] := array[
    'api_credit_days','app_errors','geo_areas','geo_areas_coverage','geo_cache',
    'geo_pois','geo_pois_coverage','geo_rivers','geo_rivers_coverage','geo_sites',
    'geo_sites_coverage','geo_trails','geo_trails_coverage','leaderboard_access_log',
    'leaderboard_refresh_queue','ops_daily_reports','ops_preparation_events',
    'order_encashment_events','osm_poi_cache','progression_award_intents',
    'progression_badge_links','progression_challenge_models','progression_claims',
    'progression_decisions','progression_discoveries','progression_leaderboard_agg',
    'progression_league_cohorts','progression_legacy_mapping','progression_legacy_snapshot',
    'progression_mission_assignments','progression_mission_model_actions',
    'progression_outbox','progression_rule_publications','progression_rules',
    'progression_user_preferences','rate_limit_windows','territory_change_log',
    'trip_launches','user_progression','user_season_progress','user_territory_private'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      execute format('drop policy if exists crm_no_direct_access on public.%I', t);
      execute format(
        'create policy crm_no_direct_access on public.%I as permissive for all to anon, authenticated using (false) with check (false)', t);
    end if;
  end loop;
end $$;
