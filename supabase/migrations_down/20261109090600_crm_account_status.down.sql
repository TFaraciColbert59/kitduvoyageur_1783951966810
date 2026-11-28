-- M06 — rollback.
-- Les colonnes de statut NE SONT PAS SUPPRIMÉES (DROP COLUMN interdit sur une
-- table LKDV, garde-fou § 1.1). On retire les policies, la fonction publique et
-- on restaure le déclencheur d'origine.
do $$
declare t text;
  tables constant text[] := array[
    'community_posts','post_comments','post_stories',
    'carnet_comments','carnet_day_comments','carnet_moment_comments','carnets',
    'club_topics','club_topic_replies','clubs','club_events',
    'place_reviews','product_reviews','reviews','qa_answers',
    'messages','group_members','hike_sessions',
    'trip_notes','trip_expenses','trip_steps','follow_requests'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists compte_actif_pour_ecrire on public.%I', t);
  end loop;
end $$;

drop function if exists admin.expire_suspensions();
drop function if exists public.my_account_status();
drop function if exists public.account_can_write();

create or replace function public.guard_user_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path TO 'public', 'pg_temp'
as $function$
DECLARE
  privileged_change boolean := false;
BEGIN
  IF auth.role() IS NULL OR auth.role() NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    privileged_change :=
      NEW.role IS DISTINCT FROM 'user'
      OR NEW.trust_score IS DISTINCT FROM 50
      OR NEW.is_suspended_groups IS DISTINCT FROM false
      OR NEW.suspended_from_groups_at IS NOT NULL
      OR NEW.two_fa_enabled IS DISTINCT FROM false
      OR NEW.loyalty_points IS DISTINCT FROM 0
      OR NEW.loyalty_level IS DISTINCT FROM 'Explorateur'
      OR NEW.xp IS DISTINCT FROM 0
      OR NEW.level IS DISTINCT FROM 1;
  ELSE
    privileged_change :=
      NEW.role IS DISTINCT FROM OLD.role
      OR NEW.trust_score IS DISTINCT FROM OLD.trust_score
      OR NEW.is_suspended_groups IS DISTINCT FROM OLD.is_suspended_groups
      OR NEW.suspended_from_groups_at IS DISTINCT FROM OLD.suspended_from_groups_at
      OR NEW.two_fa_enabled IS DISTINCT FROM OLD.two_fa_enabled
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points
      OR NEW.loyalty_level IS DISTINCT FROM OLD.loyalty_level
      OR NEW.xp IS DISTINCT FROM OLD.xp
      OR NEW.level IS DISTINCT FROM OLD.level;
  END IF;
  IF privileged_change THEN
    RAISE EXCEPTION 'user_profiles: colonne de privilège protégée (role, trust_score, suspension, 2FA, email, loyalty, xp, level)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $function$;
