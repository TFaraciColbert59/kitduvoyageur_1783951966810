-- ═══════════════════════════════════════════════════════════════════════════
-- M13a — crm_commands_core (moteur commun) + commandes des domaines D1 à D6
--
-- Le moteur est le seul chemin d'écriture du plan de contrôle :
--   registre (admin.commands) → acteur (admin._actor_check) → motif → état →
--   effet (admin._apply) → journal (admin.log) → notification → demande.
--
-- Contrat public (crm/CONTRACT.md) :
--   admin.run_command(p_command text, p_params jsonb) → {ok, data, request_id,
--   audit_id, message}
--   admin.run_command_as(p_auth_user_id uuid, p_command text, p_params jsonb)
--     même retour, acteur = cet utilisateur (agents, service_role uniquement)
--   admin.approve_request(p_request uuid, p_confirmation text)
--   admin.reject_request(p_request uuid, p_reason text)  (M04)
--   admin.undo(p_audit_id bigint)
--
-- Erreurs : raise exception '<phrase française>' using errcode, hint='<marker>'.
-- Marqueurs : not_allowed, mfa_required, agent_not_allowed, agent_cannot_validate,
-- staff_only, role_too_low, reason_required, invalid_params, unknown_command,
-- domain_pending, not_found, conflict, fingerprint_mismatch, not_pending,
-- request_expired, self_approval, undo_expired, undo_not_allowed, rate_limited,
-- agent_stopped, agent_paused, command_disabled.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Acteur effectif (chemin utilisateur ou chemin service)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin._actor_check(p_command text, p_caller uuid)
returns table (
  user_id      uuid,
  actor_role   text,
  actor_kind   text,
  pole_code    text,
  min_role     text,
  is_agent     boolean,
  agent_id     uuid,
  display_name text,
  solo         boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cmd   admin.commands;
  v_agent admin.agents;
  v_role  text;
  v_poles text[];
  v_name  text;
begin
  if p_caller is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;

  -- Chemin normal : l'appelant est la personne connectée, assert_actor (M02)
  -- applique la MFA et toutes les règles.
  if (select auth.uid()) = p_caller then
    return query select * from admin.assert_actor(p_command);
    return;
  end if;

  -- Chemin service : auth.uid() nul (service_role / tâche planifiée), l'acteur
  -- est désigné explicitement. Autorisé seulement pour les rôles techniques.
  if not admin.is_service_context() then
    raise exception 'CRM : changement d''acteur interdit.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select * into v_cmd from admin.commands c where c.command = p_command;
  if not found then
    raise exception 'CRM : commande inconnue (%).', p_command using errcode = '0A000', hint = 'unknown_command';
  end if;
  if not v_cmd.enabled then
    raise exception 'CRM : commande désactivée (%).', p_command using errcode = '42501', hint = 'command_disabled';
  end if;

  select * into v_agent from admin.agents a where a.auth_user_id = p_caller;
  if found then
    if v_agent.status = 'stopped' then
      raise exception 'CRM : agent arrêté.' using errcode = '53400', hint = 'agent_stopped';
    end if;
    if v_agent.status = 'paused' then
      raise exception 'CRM : agent en pause.' using errcode = '53400', hint = 'agent_paused';
    end if;
    if v_cmd.agent_allowed = 'never' or not (p_command = any (v_agent.tools)) then
      raise exception 'CRM : outil hors de la liste de l''agent.' using errcode = '42501', hint = 'agent_not_allowed';
    end if;
    return query select p_caller, 'agent'::text, 'agent'::text, v_agent.pole_code,
                        v_cmd.role_min, true, v_agent.id, v_agent.name, admin.solo_mode();
    return;
  end if;

  v_role := admin.human_role_of(p_caller);
  if v_role is null then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  if v_role <> 'super_admin' then
    v_poles := admin.poles_of(p_caller);
    if not (v_cmd.pole_code = any (v_poles)) then
      raise exception 'CRM : commande hors de votre pôle (%).', v_cmd.pole_code
        using errcode = '42501', hint = 'not_allowed';
    end if;
    if v_cmd.role_min = 'responsable' and v_role <> 'responsable' then
      raise exception 'CRM : rôle responsable requis.' using errcode = '42501', hint = 'role_too_low';
    end if;
    if v_cmd.role_min = 'super_admin' then
      raise exception 'CRM : super admin requis.' using errcode = '42501', hint = 'role_too_low';
    end if;
  end if;

  select coalesce(nullif(btrim(up.full_name), ''), 'Équipe') into v_name
    from public.user_profiles up where up.id = p_caller;

  return query select p_caller, v_role, 'human'::text, v_cmd.pole_code, v_cmd.role_min,
                      false, null::uuid, coalesce(v_name, 'Équipe'), admin.solo_mode();
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Effets externes (Stripe, Resend, Auth) : la base valide, la route exécute
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.command_is_external(p_command text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_command = any (array[
    'member_revoke_sessions','member_delete_gdpr','member_export_gdpr',
    'member_revoke_share_links','member_set_staff_role',
    'story_purge_expired',
    'conversation_read_reported','group_dissolve','crew_dissolve','attachment_remove',
    'order_refund','order_cancel','stripe_event_replay','booking_manage','preorder_manage',
    'entitlement_grant','promo_code_manage',
    'withdrawal_decide','store_credit_grant','progression_rules_publish',
    'seller_payout_release','auction_offer_cancel','rental_manage',
    'product_upsert','product_price_set','stock_move','product_images_set',
    'product_relations_set','kit_feature_set','one_catalog_manage',
    'kit_set_souche','kit_unpublish','kit_attribution_void','royalty_share_freeze',
    'royalty_config_edit','kit_scores_refresh',
    'country_guide_regenerate','country_content_review','guide_publish','coverage_dataset_publish',
    'ambassador_decide','expert_decide',
    'announcement_send','ai_cache_clear','ai_job_retry','ai_quota_raise',
    'cron_run_now','feature_cohort_manage','rate_limit_lift',
    'hike_session_reprocess','adventure_event_retry',
    'affiliate_partner_toggle','affiliate_program_toggle','affiliate_offer_toggle'
  ]);
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Effet métier
-- ───────────────────────────────────────────────────────────────────────────
-- Retour : { before jsonb, after jsonb, delegated boolean, external text[], data jsonb }
-- Tout ce qui n'est pas explicitement porté ici lève `domain_pending` : mieux
-- vaut une erreur nette qu'un succès silencieux sans effet.
create or replace function admin._apply(p_command text, p_params jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text := coalesce(p_params ->> 'target_id', p_params ->> 'id');
  v_note   text := nullif(btrim(coalesce(p_params ->> 'reason_text', p_params ->> 'reason', '')), '');
  v_code   text := nullif(btrim(p_params ->> 'reason_code'), '');
  v_before jsonb;
  v_after  jsonb;
  v_uid    uuid;
begin
  -- Les commandes du plan de contrôle ont le droit d'écrire les colonnes de
  -- modération (déclencheur M05) : le drapeau est posé dans la transaction.
  perform set_config('lkdv.admin_cmd', 'on', true);

  -- ── D1 · Membres ─────────────────────────────────────────────────────────
  if p_command = 'member_view_360' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
                              'data', admin.member_360(v_target::uuid));

  elsif p_command = 'member_view_blocks' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
      'data', jsonb_build_object(
        'blocking', (select count(*) from public.user_blocks b where b.blocker_id = v_target::uuid),
        'blockedBy', (select count(*) from public.user_blocks b where b.blocked_id = v_target::uuid)));

  elsif p_command = 'member_update_profile' then
    select jsonb_build_object('full_name', up.full_name, 'bio', up.bio, 'avatar_url', up.avatar_url)
      into v_before from public.user_profiles up where up.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.user_profiles
       set full_name = coalesce(nullif(btrim(p_params ->> 'full_name'), ''), full_name),
           bio = coalesce(nullif(btrim(p_params ->> 'bio'), ''), bio),
           avatar_url = coalesce(nullif(btrim(p_params ->> 'avatar_url'), ''), avatar_url),
           updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('full_name', up.full_name, 'bio', up.bio, 'avatar_url', up.avatar_url)
      into v_after from public.user_profiles up where up.id = v_target::uuid;
    perform admin.notify_member(v_target::uuid, 'admin_profile_update', 'Votre profil a été mis à jour',
      'Un membre de l''équipe a corrigé des informations de votre profil : ' || coalesce(v_note, 'correction'), '/compte', 'profile', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'member_suspend' then
    select jsonb_build_object('account_status', up.account_status, 'suspended_until', up.suspended_until, 'status_reason', up.status_reason)
      into v_before from public.user_profiles up where up.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.user_profiles
       set account_status = 'suspended',
           suspended_until = coalesce(nullif(p_params ->> 'until', '')::timestamptz, now() + interval '7 days'),
           status_reason = coalesce(v_note, admin.member_notice(v_code, null, false)),
           status_changed_at = now(), status_changed_by = p_actor, updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('account_status', up.account_status, 'suspended_until', up.suspended_until, 'status_reason', up.status_reason)
      into v_after from public.user_profiles up where up.id = v_target::uuid;
    perform admin.notify_member(v_target::uuid, 'admin_suspend', 'Votre compte est suspendu',
      admin.member_notice(v_code, 'Suspension jusqu''au ' || to_char((v_after ->> 'suspended_until')::timestamptz, 'DD/MM/YYYY à HH24:MI') || '. ' || coalesce(v_note, ''), false),
      '/compte/recours', 'decision', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'member_ban' then
    select jsonb_build_object('account_status', up.account_status) into v_before
      from public.user_profiles up where up.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.user_profiles
       set account_status = 'banned', suspended_until = null,
           status_reason = coalesce(v_note, admin.member_notice(v_code, null, false)),
           status_changed_at = now(), status_changed_by = p_actor, updated_at = now()
     where id = v_target::uuid;
    perform admin.notify_member(v_target::uuid, 'admin_ban', 'Votre compte est fermé',
      admin.member_notice(v_code, v_note, false), '/compte/recours', 'decision', v_target::uuid);
    -- Le bannissement Auth (banned_until + révocation de session) est fait par
    -- la route serveur, avec l'idempotence de la demande.
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('account_status', 'banned'),
                              'delegated', true, 'external', jsonb_build_array('auth_ban'));

  elsif p_command = 'member_reactivate' then
    select jsonb_build_object('account_status', up.account_status, 'suspended_until', up.suspended_until)
      into v_before from public.user_profiles up where up.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.user_profiles
       set account_status = 'active', suspended_until = null,
           status_reason = coalesce(v_note, 'Compte réactivé'),
           status_changed_at = now(), status_changed_by = p_actor, updated_at = now()
     where id = v_target::uuid;
    perform admin.notify_member(v_target::uuid, 'admin_reactivate', 'Votre compte est réactivé',
      'Votre compte est de nouveau actif. ' || coalesce(v_note, ''), '/compte', 'profile', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('account_status', 'active'), 'delegated', false);

  elsif p_command = 'member_adjust_trust' then
    select jsonb_build_object('trust_score', up.trust_score) into v_before
      from public.user_profiles up where up.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.user_profiles
       set trust_score = greatest(0, least(100, coalesce((p_params ->> 'trust_score')::int, trust_score))),
           updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('trust_score', up.trust_score) into v_after
      from public.user_profiles up where up.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'member_set_demo' then
    select jsonb_build_object('is_demo', up.is_demo) into v_before
      from public.user_profiles up where up.id = v_target::uuid;
    update public.user_profiles
       set is_demo = coalesce((p_params ->> 'is_demo')::boolean, true), updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('is_demo', up.is_demo) into v_after
      from public.user_profiles up where up.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'member_verify_age' then
    select jsonb_build_object('age_confirmed_at', up.age_confirmed_at) into v_before
      from public.user_profiles up where up.id = v_target::uuid;
    update public.user_profiles set age_confirmed_at = coalesce(age_confirmed_at, now()), updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('age_confirmed_at', up.age_confirmed_at) into v_after
      from public.user_profiles up where up.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'member_set_staff_role' then
    -- Exécution après validation : appartenance de pôle (jamais super_admin).
    declare
      v_pole text := nullif(btrim(p_params ->> 'pole'), '');
      v_role text := coalesce(nullif(btrim(p_params ->> 'role'), ''), 'membre');
    begin
      if v_pole is null or v_role not in ('responsable','membre') then
        raise exception 'CRM : pôle et rôle (responsable|membre) requis.' using errcode = '22023', hint = 'invalid_params';
      end if;
      select jsonb_agg(jsonb_build_object('pole', sm.pole_code, 'role', sm.role)) into v_before
        from admin.staff_memberships sm where sm.user_id = v_target::uuid and sm.revoked_at is null;
      insert into admin.staff_memberships (user_id, pole_code, role, created_by)
      values (v_target::uuid, v_pole, v_role, p_actor)
      on conflict (user_id, pole_code) do update
        set role = excluded.role, revoked_at = null;
      select jsonb_agg(jsonb_build_object('pole', sm.pole_code, 'role', sm.role)) into v_after
        from admin.staff_memberships sm where sm.user_id = v_target::uuid and sm.revoked_at is null;
      return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);
    end;

  -- ── D2 · Publications ────────────────────────────────────────────────────
  elsif p_command in ('post_hide','post_remove','post_restore') then
    select jsonb_build_object('moderation_state', p.moderation_state) into v_before
      from public.community_posts p where p.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : publication introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.community_posts
       set moderation_state = case p_command when 'post_hide' then 'hidden'
                                            when 'post_remove' then 'removed'
                                            else 'visible' end,
           moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code), updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('moderation_state', p.moderation_state) into v_after
      from public.community_posts p where p.id = v_target::uuid;
    perform admin.notify_member(
      (select p.author_id from public.community_posts p where p.id = v_target::uuid),
      'moderation', case p_command when 'post_restore' then 'Votre publication est de nouveau visible'
                                   else 'Votre publication a été modérée' end,
      case p_command when 'post_restore' then 'Votre publication est de nouveau visible.'
                     else admin.member_notice(v_code, v_note, false) end,
      '/communaute', 'post', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'post_set_trending' then
    select jsonb_build_object('is_trending', p.is_trending) into v_before
      from public.community_posts p where p.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : publication introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.community_posts
       set is_trending = coalesce((p_params ->> 'trending')::boolean, not is_trending), updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('is_trending', p.is_trending) into v_after
      from public.community_posts p where p.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'post_report_resolve' then
    select jsonb_build_object('status', pr.status) into v_before
      from public.post_reports pr where pr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : signalement introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.post_reports
       set status = coalesce(nullif(p_params ->> 'decision', ''), 'reviewed'),
           resolved_at = now(), resolved_by = p_actor
     where id = v_target::uuid;
    select jsonb_build_object('status', pr.status) into v_after
      from public.post_reports pr where pr.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'post_media_remove' then
    select jsonb_build_object('media_urls', p.media_urls) into v_before
      from public.community_posts p where p.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : publication introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.community_posts set media_urls = '[]'::jsonb, updated_at = now()
     where id = v_target::uuid;
    perform admin.notify_member(
      (select p.author_id from public.community_posts p where p.id = v_target::uuid),
      'moderation', 'Un média a été retiré de votre publication',
      admin.member_notice(v_code, v_note, false), '/communaute', 'post', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('media_urls', '[]'::jsonb), 'delegated', false);

  elsif p_command in ('comment_hide','comment_remove') then
    select jsonb_build_object('moderation_state', c.moderation_state) into v_before
      from public.post_comments c where c.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : commentaire introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.post_comments
       set moderation_state = case p_command when 'comment_hide' then 'hidden' else 'removed' end,
           moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code)
     where id = v_target::uuid;
    select jsonb_build_object('moderation_state', c.moderation_state) into v_after
      from public.post_comments c where c.id = v_target::uuid;
    perform admin.notify_member(
      (select c.author_id from public.post_comments c where c.id = v_target::uuid),
      'moderation', 'Votre commentaire a été modéré',
      admin.member_notice(v_code, v_note, false), '/communaute', 'comment', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'comment_report_resolve' then
    select jsonb_build_object('status', cr.status) into v_before
      from public.comment_reports cr where cr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : signalement introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.comment_reports
       set status = coalesce(nullif(p_params ->> 'decision', ''), 'reviewed'),
           resolved_at = now(), resolved_by = p_actor
     where id = v_target::uuid;
    select jsonb_build_object('status', cr.status) into v_after
      from public.comment_reports cr where cr.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  -- ── D3 · Stories ─────────────────────────────────────────────────────────
  elsif p_command in ('story_moderate','story_remove') then
    select jsonb_build_object('moderation_state', st.moderation_state) into v_before
      from public.post_stories st where st.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : story introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.post_stories
       set moderation_state = case
             when p_command = 'story_remove' then 'removed'
             when coalesce(p_params ->> 'decision', 'approve') = 'reject' then 'hidden'
             else 'visible' end,
           moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code)
     where id = v_target::uuid;
    select jsonb_build_object('moderation_state', st.moderation_state) into v_after
      from public.post_stories st where st.id = v_target::uuid;
    perform admin.notify_member(
      (select st.author_id from public.post_stories st where st.id = v_target::uuid),
      'moderation', 'Votre story a été modérée',
      admin.member_notice(v_code, v_note, false), '/communaute', 'story', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'story_report_resolve' then
    select jsonb_build_object('status', sr.status) into v_before
      from public.story_reports sr where sr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : signalement introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.story_reports
       set status = coalesce(nullif(p_params ->> 'decision', ''), 'reviewed'),
           resolved_at = now(), resolved_by = p_actor
     where id = v_target::uuid;
    select jsonb_build_object('status', sr.status) into v_after
      from public.story_reports sr where sr.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  -- ── D4 · Carnets ─────────────────────────────────────────────────────────
  elsif p_command = 'carnet_force_private' then
    select jsonb_build_object('visibility', c.visibility, 'live_sharing', c.live_sharing) into v_before
      from public.carnets c where c.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : carnet introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.carnets set visibility = 'private', live_sharing = false, updated_at = now()
     where id = v_target::uuid;
    perform admin.notify_member(
      (select c.author_id from public.carnets c where c.id = v_target::uuid),
      'moderation', 'Votre carnet est passé en privé',
      admin.member_notice(v_code, v_note, false), '/carnet', 'carnet', v_target::uuid);
    return jsonb_build_object('before', v_before,
      'after', jsonb_build_object('visibility', 'private', 'live_sharing', false), 'delegated', false);

  elsif p_command = 'carnet_stop_live' then
    select jsonb_build_object('live_sharing', c.live_sharing) into v_before
      from public.carnets c where c.id = v_target::uuid;
    update public.carnets set live_sharing = false, updated_at = now() where id = v_target::uuid;
    perform admin.notify_member(
      (select c.author_id from public.carnets c where c.id = v_target::uuid),
      'moderation', 'Le partage de position a été coupé',
      coalesce(v_note, 'Le partage en direct de votre carnet a été interrompu par l''équipe.'),
      '/carnet', 'carnet', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('live_sharing', false), 'delegated', false);

  elsif p_command = 'carnet_set_verified' then
    select jsonb_build_object('verified', c.verified) into v_before
      from public.carnets c where c.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : carnet introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.carnets
       set verified = coalesce((p_params ->> 'verified')::boolean, true), updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('verified', c.verified) into v_after
      from public.carnets c where c.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'carnet_comment_remove' then
    select jsonb_build_object('moderation_state', cc.moderation_state) into v_before
      from public.carnet_comments cc where cc.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : commentaire introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.carnet_comments
       set moderation_state = 'removed', moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code)
     where id = v_target::uuid;
    perform admin.notify_member(
      (select cc.author_id from public.carnet_comments cc where cc.id = v_target::uuid),
      'moderation', 'Votre commentaire de carnet a été retiré',
      admin.member_notice(v_code, v_note, false), '/carnet', 'comment', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('moderation_state', 'removed'), 'delegated', false);

  elsif p_command = 'carnet_list_reported' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
      'data', jsonb_build_object('items', coalesce((
        select jsonb_agg(jsonb_build_object('carnetId', c.id, 'title', c.title,
                 'visibility', c.visibility, 'createdAt', c.created_at) order by c.created_at desc)
          from (select * from public.carnets c
                 where c.id in (select pr.post_id from public.post_reports pr where pr.target_type = 'carnet')
                 order by c.created_at desc limit 50) c
      ), '[]'::jsonb)));

  -- ── D5 · Clubs ───────────────────────────────────────────────────────────
  elsif p_command = 'club_set_verified' then
    select jsonb_build_object('is_verified', cl.is_verified) into v_before
      from public.clubs cl where cl.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : club introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.clubs
       set is_verified = coalesce((p_params ->> 'verified')::boolean, true), updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('is_verified', cl.is_verified) into v_after
      from public.clubs cl where cl.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'club_topic_moderate' then
    select jsonb_build_object('moderation_state', t.moderation_state, 'is_approved', t.is_approved) into v_before
      from public.club_topics t where t.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : sujet introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.club_topics
       set moderation_state = case when coalesce(p_params ->> 'decision', 'approve') = 'reject' then 'hidden' else 'visible' end,
           is_approved = coalesce(p_params ->> 'decision', 'approve') = 'approve',
           moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code), updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('moderation_state', t.moderation_state, 'is_approved', t.is_approved) into v_after
      from public.club_topics t where t.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'club_reply_moderate' then
    select jsonb_build_object('moderation_state', r.moderation_state, 'is_approved', r.is_approved) into v_before
      from public.club_topic_replies r where r.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : réponse introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.club_topic_replies
       set moderation_state = case when coalesce(p_params ->> 'decision', 'approve') = 'reject' then 'hidden' else 'visible' end,
           is_approved = coalesce(p_params ->> 'decision', 'approve') = 'approve',
           moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code)
     where id = v_target::uuid;
    select jsonb_build_object('moderation_state', r.moderation_state, 'is_approved', r.is_approved) into v_after
      from public.club_topic_replies r where r.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'club_topic_pin' then
    select jsonb_build_object('is_pinned', t.is_pinned, 'is_announcement', t.is_announcement) into v_before
      from public.club_topics t where t.id = v_target::uuid;
    update public.club_topics
       set is_pinned = coalesce((p_params ->> 'pinned')::boolean, true),
           is_announcement = coalesce((p_params ->> 'announcement')::boolean, is_announcement),
           updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('is_pinned', t.is_pinned, 'is_announcement', t.is_announcement) into v_after
      from public.club_topics t where t.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'club_report_resolve' then
    select jsonb_build_object('status', cr.status) into v_before
      from public.club_reports cr where cr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : signalement introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.club_reports
       set status = coalesce(nullif(p_params ->> 'decision', ''), 'reviewed')
     where id = v_target::uuid;
    return jsonb_build_object('before', v_before,
      'after', jsonb_build_object('status', coalesce(nullif(p_params ->> 'decision', ''), 'reviewed')),
      'delegated', false);

  elsif p_command = 'club_member_remove' then
    declare v_club uuid; v_user uuid; v_gone integer;
    begin
      v_club := nullif(p_params ->> 'club_id', '')::uuid;
      v_user := nullif(p_params ->> 'user_id', '')::uuid;
      if v_club is null or v_user is null then
        raise exception 'CRM : club_id et user_id requis.' using errcode = '22023', hint = 'invalid_params';
      end if;
      with gone as (
        delete from public.club_members cm
         where cm.club_id = v_club and cm.user_id = v_user
        returning 1
      ) select count(*) into v_gone from gone;
      return jsonb_build_object('before', jsonb_build_object('club_id', v_club, 'user_id', v_user),
        'after', jsonb_build_object('removed', v_gone), 'delegated', false);
    end;

  -- ── D6 · Groupes et messagerie ───────────────────────────────────────────
  elsif p_command = 'group_report_resolve' then
    select jsonb_build_object('status', gr.status) into v_before
      from public.group_reports gr where gr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : signalement introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.group_reports
       set status = coalesce(nullif(p_params ->> 'decision', ''), 'reviewed'),
           resolved_at = now(), resolved_by = p_actor
     where id = v_target::uuid;
    select jsonb_build_object('status', gr.status) into v_after
      from public.group_reports gr where gr.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'member_suspend_groups' then
    select jsonb_build_object('is_suspended_groups', up.is_suspended_groups,
                              'suspended_from_groups_at', up.suspended_from_groups_at) into v_before
      from public.user_profiles up where up.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.user_profiles
       set is_suspended_groups = true, suspended_from_groups_at = now(), updated_at = now()
     where id = v_target::uuid;
    perform admin.notify_member(v_target::uuid, 'moderation', 'Votre accès aux groupes est suspendu',
      admin.member_notice(v_code, v_note, false), '/compte/recours', 'decision', v_target::uuid);
    return jsonb_build_object('before', v_before,
      'after', jsonb_build_object('is_suspended_groups', true), 'delegated', false);

  elsif p_command = 'message_remove' then
    select jsonb_build_object('deleted_at', m.deleted_at) into v_before
      from public.messages m where m.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : message introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.messages set deleted_at = now(), updated_at = now() where id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('deleted_at', now()), 'delegated', false);

  elsif p_command = 'group_member_remove' then
    declare v_group uuid; v_member uuid; v_gone integer;
    begin
      v_group := nullif(p_params ->> 'group_id', '')::uuid;
      v_member := nullif(p_params ->> 'user_id', '')::uuid;
      if v_group is null or v_member is null then
        raise exception 'CRM : group_id et user_id requis.' using errcode = '22023', hint = 'invalid_params';
      end if;
      with gone as (
        delete from public.group_members gm
         where gm.group_id = v_group and gm.user_id = v_member
        returning 1
      ) select count(*) into v_gone from gone;
      return jsonb_build_object('before', jsonb_build_object('group_id', v_group, 'user_id', v_member),
        'after', jsonb_build_object('removed', v_gone), 'delegated', false);
    end;

  -- ── D7 · Lieux et terrain ────────────────────────────────────────────────
  elsif p_command in ('place_report_resolve','terrain_report_decide') then
    if p_command = 'place_report_resolve' then
      select jsonb_build_object('status', pr.status, 'resolution', pr.resolution) into v_before
        from public.place_reports pr where pr.id = v_target::uuid;
      if v_before is null then
        raise exception 'CRM : signalement introuvable.' using errcode = 'P0002', hint = 'not_found';
      end if;
      update public.place_reports
         set status = coalesce(nullif(p_params ->> 'decision', ''), 'reviewed'),
             resolution = coalesce(nullif(p_params ->> 'resolution', ''), 'accepted'),
             resolution_reason = coalesce(v_note, v_code),
             resolved_at = now(), resolved_by = p_actor
       where id = v_target::uuid;
      select jsonb_build_object('status', pr.status, 'resolution', pr.resolution) into v_after
        from public.place_reports pr where pr.id = v_target::uuid;
    else
      select jsonb_build_object('status', tr.status) into v_before
        from public.terrain_reports tr where tr.id = v_target::uuid;
      if v_before is null then
        raise exception 'CRM : signalement terrain introuvable.' using errcode = 'P0002', hint = 'not_found';
      end if;
      update public.terrain_reports
         set status = coalesce(nullif(p_params ->> 'decision', ''), 'confirmed'), updated_at = now()
       where id = v_target::uuid;
      select jsonb_build_object('status', tr.status) into v_after
        from public.terrain_reports tr where tr.id = v_target::uuid;
    end if;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'contribution_decide' then
    select jsonb_build_object('status', pc.status) into v_before
      from public.pending_contributions pc where pc.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : contribution introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.pending_contributions
       set status = case when coalesce(p_params ->> 'decision', 'accepted') = 'rejected' then 'rejected' else 'validated' end,
           rejection_reason = case when coalesce(p_params ->> 'decision', 'accepted') = 'rejected' then coalesce(v_note, v_code) else null end,
           validated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('status', pc.status) into v_after
      from public.pending_contributions pc where pc.id = v_target::uuid;
    perform admin.notify_member(
      (select pc.user_id from public.pending_contributions pc where pc.id = v_target::uuid),
      'contribution', 'Votre contribution a été examinée',
      case when coalesce(p_params ->> 'decision', 'accepted') = 'rejected'
           then 'Votre contribution a été refusée. ' || coalesce(v_note, '')
           else 'Votre contribution a été validée, merci !' end,
      '/contribuer', 'contribution', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'place_review_remove' then
    select jsonb_build_object('moderation_state', pr.moderation_state) into v_before
      from public.place_reviews pr where pr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : avis introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.place_reviews
       set moderation_state = 'removed', moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code), updated_at = now()
     where id = v_target::uuid;
    perform admin.notify_member(
      (select pr.author_id from public.place_reviews pr where pr.id = v_target::uuid),
      'moderation', 'Votre avis de lieu a été retiré',
      admin.member_notice(v_code, v_note, false), '/lieux', 'review', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('moderation_state', 'removed'), 'delegated', false);

  -- ── D8 · Avis et questions ───────────────────────────────────────────────
  elsif p_command = 'product_review_hide' then
    select jsonb_build_object('moderation_state', pr.moderation_state) into v_before
      from public.product_reviews pr where pr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : avis introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.product_reviews
       set moderation_state = 'hidden', moderated_by = p_actor, moderated_at = now(),
           moderation_reason = coalesce(v_note, v_code)
     where id = v_target::uuid;
    perform admin.notify_member(
      (select pr.author_id from public.product_reviews pr where pr.id = v_target::uuid),
      'moderation', 'Votre avis produit a été masqué',
      admin.member_notice(v_code, v_note, false), '/boutique', 'review', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('moderation_state', 'hidden'), 'delegated', false);

  elsif p_command = 'product_review_verify' then
    select jsonb_build_object('verified_purchase', pr.verified_purchase) into v_before
      from public.product_reviews pr where pr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : avis introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.product_reviews
       set verified_purchase = coalesce((p_params ->> 'verified')::boolean, true)
     where id = v_target::uuid;
    select jsonb_build_object('verified_purchase', pr.verified_purchase) into v_after
      from public.product_reviews pr where pr.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'review_remove' then
    declare v_gone integer;
    begin
      select jsonb_build_object('rating', r.rating, 'type', r.type) into v_before
        from public.reviews r where r.id = v_target::uuid;
      if v_before is null then
        raise exception 'CRM : avis introuvable.' using errcode = 'P0002', hint = 'not_found';
      end if;
      with gone as (delete from public.reviews r where r.id = v_target::uuid returning 1)
      select count(*) into v_gone from gone;
      return jsonb_build_object('before', v_before, 'after', jsonb_build_object('deleted', v_gone), 'delegated', false);
    end;

  -- ── D9 · Marketplace ─────────────────────────────────────────────────────
  elsif p_command in ('listing_approve','listing_reject','listing_withdraw') then
    select jsonb_build_object('status', ml.status) into v_before
      from public.marketplace_listings ml where ml.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : annonce introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.marketplace_listings
       set status = case p_command when 'listing_approve' then 'active'
                                    when 'listing_reject' then 'rejected'
                                    else 'withdrawn' end
     where id = v_target::uuid;
    select jsonb_build_object('status', ml.status) into v_after
      from public.marketplace_listings ml where ml.id = v_target::uuid;
    perform admin.notify_member(
      (select ml.owner_id from public.marketplace_listings ml where ml.id = v_target::uuid),
      'marketplace', 'Votre annonce a été examinée',
      case p_command when 'listing_approve' then 'Votre annonce est en ligne.'
                     when 'listing_reject' then 'Votre annonce est refusée. ' || coalesce(v_note, '')
                     else 'Votre annonce a été retirée. ' || coalesce(v_note, '') end,
      '/marketplace', 'listing', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'marketplace_report_resolve' then
    select jsonb_build_object('status', mr.status) into v_before
      from public.marketplace_reports mr where mr.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : signalement introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.marketplace_reports
       set status = case when coalesce(p_params ->> 'decision', 'resolved') = 'dismissed' then 'dismissed' else 'resolved' end,
           resolution_note = coalesce(v_note, v_code),
           resolved_by = p_actor, resolved_at = now()
     where id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('status', 'resolved'), 'delegated', false);

  -- ── D11 · Commandes ──────────────────────────────────────────────────────
  elsif p_command in ('order_confirm','order_ship') then
    select jsonb_build_object('status', o.status, 'carrier', o.carrier, 'tracking_url', o.tracking_url) into v_before
      from public.orders o where o.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : commande introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.orders
       set status = case p_command when 'order_confirm' then 'confirmed' else 'shipped' end,
           carrier = coalesce(nullif(p_params ->> 'carrier', ''), carrier),
           tracking_url = coalesce(nullif(p_params ->> 'tracking_url', ''), tracking_url),
           updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('status', o.status, 'carrier', o.carrier, 'tracking_url', o.tracking_url) into v_after
      from public.orders o where o.id = v_target::uuid;
    perform admin.notify_member(
      (select o.user_id from public.orders o where o.id = v_target::uuid),
      'order', case p_command when 'order_confirm' then 'Votre commande est confirmée' else 'Votre commande est expédiée' end,
      case p_command when 'order_confirm' then 'Votre commande est confirmée.'
                     else 'Votre commande est expédiée' || coalesce(' — suivi : ' || (p_params ->> 'tracking_url'), '') || '.' end,
      '/compte/commandes', 'order', v_target::uuid);
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  -- ── D14 · SOS ────────────────────────────────────────────────────────────
  elsif p_command = 'sos_board' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false, 'data', admin.sos_board());

  elsif p_command = 'sos_ack_close' then
    if coalesce(p_params ->> 'action', 'ack') = 'close' then
      return jsonb_build_object('before', null, 'after', null, 'delegated', false,
                                'data', admin.sos_close(v_target::uuid, coalesce(v_note, '')));
    end if;
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
                              'data', admin.sos_ack(v_target::uuid));

  elsif p_command = 'checkpoints_overdue' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
      'data', jsonb_build_object('items', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'tripId', c.trip_id,
                 'dueAt', c.due_at, 'status', c.status) order by c.due_at)
          from public.trip_safety_checkpoints c
         where c.due_at < now() and coalesce(c.status, 'pending') = 'pending'
      ), '[]'::jsonb)));

  -- ── D18 · Support et alertes ─────────────────────────────────────────────
  elsif p_command = 'ticket_reply' then
    declare v_ticket uuid := coalesce(nullif(p_params ->> 'ticket_id', '')::uuid, v_target::uuid);
    begin
      insert into public.support_messages (ticket_id, author_id, body, internal)
      values (v_ticket, p_actor, coalesce(v_note, p_params ->> 'body', ''), coalesce((p_params ->> 'internal')::boolean, false));

      update public.support_tickets
         set first_reply_at = coalesce(first_reply_at, now()),
             status = case when coalesce(status, 'open') = 'open' then 'pending' else status end,
             updated_at = now()
       where id = v_ticket;

      perform admin.notify_member(
        (select t.user_id from public.support_tickets t where t.id = v_ticket),
        'support_reply', 'Réponse à votre demande',
        coalesce(p_params ->> 'body', v_note, 'Votre demande a reçu une réponse.'),
        '/support', 'ticket', v_ticket);
      return jsonb_build_object('before', null, 'after', jsonb_build_object('ticket_id', v_ticket), 'delegated', false);
    end;

  elsif p_command = 'ticket_set_status' then
    select jsonb_build_object('status', t.status) into v_before
      from public.support_tickets t where t.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : ticket introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.support_tickets
       set status = coalesce(nullif(p_params ->> 'status', ''), 'closed'),
           assigned_to = coalesce(nullif(p_params ->> 'assigned_to', '')::uuid, assigned_to),
           priority = coalesce((p_params ->> 'priority')::smallint, priority),
           closed_at = case when coalesce(nullif(p_params ->> 'status', ''), 'closed') = 'closed' then now() else closed_at end,
           closed_by = case when coalesce(nullif(p_params ->> 'status', ''), 'closed') = 'closed' then p_actor else closed_by end,
           updated_at = now()
     where id = v_target::uuid;
    select jsonb_build_object('status', t.status) into v_after
      from public.support_tickets t where t.id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);

  elsif p_command = 'alert_resolve' then
    select jsonb_build_object('is_resolved', a.is_resolved) into v_before
      from public.alerts a where a.id = v_target::uuid;
    if v_before is null then
      raise exception 'CRM : alerte introuvable.' using errcode = 'P0002', hint = 'not_found';
    end if;
    update public.alerts
       set is_resolved = true, resolved_at = now(), updated_at = now()
     where id = v_target::uuid;
    return jsonb_build_object('before', v_before, 'after', jsonb_build_object('is_resolved', true), 'delegated', false);

  -- ── D19 · Système ────────────────────────────────────────────────────────
  elsif p_command = 'feature_flag_toggle' then
    declare v_flag text := nullif(btrim(p_params ->> 'flag'), '');
    begin
      if v_flag is null then
        raise exception 'CRM : nom d''indicateur requis.' using errcode = '22023', hint = 'invalid_params';
      end if;
      select jsonb_build_object('enabled', f.enabled) into v_before
        from public.feature_flags f where f.id = v_flag;
      insert into public.feature_flags (id, enabled, scope, updated_at, updated_by)
      values (v_flag, coalesce((p_params ->> 'enabled')::boolean, true),
              coalesce(nullif(p_params ->> 'scope', ''), 'global'), now(), p_actor)
      on conflict (id) do update
        set enabled = excluded.enabled, updated_at = now(), updated_by = excluded.updated_by;
      select jsonb_build_object('enabled', f.enabled) into v_after
        from public.feature_flags f where f.id = v_flag;
      return jsonb_build_object('before', v_before, 'after', v_after, 'delegated', false);
    end;

  elsif p_command = 'errors_view' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
      'data', jsonb_build_object('items', coalesce((
        select jsonb_agg(jsonb_build_object('at', e.at, 'scope', e.scope, 'code', e.code,
                 'message', left(e.message, 300)) order by e.at desc)
          from (select * from public.app_errors order by at desc limit 100) e
      ), '[]'::jsonb)));

  elsif p_command = 'daily_report_view' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
      'data', coalesce((select to_jsonb(r) from public.ops_daily_reports r order by 1 desc limit 1), '{}'::jsonb));

  elsif p_command = 'audit_log_view' then
    return jsonb_build_object('before', null, 'after', null, 'delegated', false,
                              'data', admin.audit_page(null, 50, '{}'::jsonb));

  elsif p_command = 'ai_kill_switch' then
    declare v_on boolean := coalesce((p_params ->> 'enabled')::boolean, false);
    begin
      insert into admin.app_settings (key, value, label, description, is_public, updated_at, updated_by)
      values ('ai.enabled', to_jsonb(v_on), 'IA du site', 'Coupure immédiate de toute génération IA.', false, now(), p_actor)
      on conflict (key) do update
        set value = to_jsonb(v_on), updated_at = now(), updated_by = excluded.updated_by;
      return jsonb_build_object('before', jsonb_build_object('enabled', not v_on),
                                'after', jsonb_build_object('enabled', v_on), 'delegated', false);
    end;
  end if;

  -- Commandes à effet externe : la base a validé et tracé, la route exécute.
  if admin.command_is_external(p_command) then
    return jsonb_build_object(
      'before', null, 'after', null, 'delegated', true,
      'external', jsonb_build_array('server_route'),
      'data', jsonb_build_object('params', p_params)
    );
  end if;

  raise exception 'CRM : effet métier non encore porté par le moteur (%).', p_command
    using errcode = '0A000', hint = 'domain_pending';
end;
$$;

revoke all on function admin._actor_check(text, uuid) from public, anon, authenticated;
revoke all on function admin.command_is_external(text) from public, anon;
revoke all on function admin._apply(text, jsonb, uuid) from public, anon, authenticated;
grant execute on function admin.command_is_external(text) to authenticated, service_role;
grant execute on function admin._actor_check(text, uuid) to service_role;
grant execute on function admin._apply(text, jsonb, uuid) to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Moteur
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin._run_command(
  p_command       text,
  p_params        jsonb default '{}'::jsonb,
  p_caller        uuid default null,
  p_request_id    uuid default null,
  p_request_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor      record;
  v_cmd        admin.commands;
  v_params     jsonb := coalesce(p_params, '{}'::jsonb);
  v_caller     uuid := coalesce(p_caller, (select auth.uid()));
  v_target     text;
  v_target_type text;
  v_reason_code text;
  v_reason_text text;
  v_result     jsonb;
  v_audit      bigint;
  v_request    admin.requests;
  v_before     jsonb;
  v_after      jsonb;
begin
  if jsonb_typeof(v_params) <> 'object' then
    raise exception 'CRM : paramètres attendus sous forme d''objet JSON.' using errcode = '22023', hint = 'invalid_params';
  end if;

  select * into v_actor from admin._actor_check(p_command, v_caller);
  select * into v_cmd from admin.commands c where c.command = p_command;

  v_target      := coalesce(v_params ->> 'target_id', v_params ->> 'id');
  v_target_type := coalesce(nullif(v_params ->> 'target_type', ''), split_part(p_command, '_', 1));
  v_reason_code := nullif(btrim(v_params ->> 'reason_code'), '');
  v_reason_text := nullif(btrim(coalesce(v_params ->> 'reason_text', v_params ->> 'reason', '')), '');

  -- Motif : code connu, ou texte métier d'au moins 3 caractères.
  if v_cmd.reason_required then
    if v_reason_code is null and (v_reason_text is null or length(v_reason_text) < 3) then
      raise exception 'CRM : un motif est requis pour cette action.' using errcode = '22023', hint = 'reason_required';
    end if;
    if v_reason_code is not null
       and not exists (select 1 from admin.reason_codes rc where rc.code = v_reason_code and rc.active) then
      raise exception 'CRM : code de motif inconnu (%).', v_reason_code using errcode = '22023', hint = 'invalid_params';
    end if;
  end if;

  -- Plafond horaire des agents (M14) — vérifié avant tout effet.
  if v_actor.is_agent and to_regprocedure('admin.agent_rate_consume(uuid, integer)') is not null then
    perform admin.agent_rate_consume(v_actor.agent_id, 1);
  end if;

  -- Demande à deux personnes : on crée la demande et on n'applique rien.
  if v_cmd.needs_validation and p_request_id is null then
    v_request := admin.request_create(
      p_command, v_params, v_caller, v_actor.actor_role, v_actor.actor_kind,
      v_target_type, v_target, v_reason_code, v_reason_text, v_actor.solo);

    v_audit := admin.log(p_command, v_target_type, coalesce(v_target, '-'),
                         v_reason_code, v_reason_text, null,
                         jsonb_build_object('status', 'pending', 'request_id', v_request.id),
                         v_request.id, null, v_actor.solo, null, false);

    return jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object('status', 'pending', 'request_id', v_request.id),
      'request_id', v_request.id,
      'audit_id', v_audit,
      'message', 'Demande enregistrée : une seconde validation est nécessaire (motif et empreinte vérifiés).'
    );
  end if;

  -- Effet
  v_result := admin._apply(p_command, v_params, coalesce(p_request_actor, v_caller));
  v_before := v_result -> 'before';
  v_after  := v_result -> 'after';

  v_audit := admin.log(
    p_command, v_target_type, coalesce(v_target, '-'),
    v_reason_code, v_reason_text, v_before, v_after,
    p_request_id,
    case when p_request_id is not null then (select auth.uid()) end,
    v_actor.solo, null, false, null,
    coalesce(p_request_actor, v_caller));

  return jsonb_build_object(
    'ok', true,
    'data', coalesce(v_result -> 'data', jsonb_build_object('before', v_before, 'after', v_after,
                                                            'delegated', coalesce((v_result ->> 'delegated')::boolean, false))),
    'request_id', p_request_id,
    'audit_id', v_audit,
    'delegated', coalesce((v_result ->> 'delegated')::boolean, false),
    'message', case when coalesce((v_result ->> 'delegated')::boolean, false)
                    then 'Droits validés, action tracée. La route serveur termine l''effet externe.'
                    else 'Action appliquée.' end
  );
end;
$$;

create or replace function admin.run_command(p_command text, p_params jsonb default '{}'::jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select admin._run_command(p_command, p_params, null, null, null);
$$;

create or replace function admin.run_command_as(
  p_auth_user_id uuid, p_command text, p_params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not admin.is_service_context() then
    raise exception 'CRM : exécution au nom d''un tiers réservée aux tâches serveur.' using errcode = '42501', hint = 'not_allowed';
  end if;
  return admin._run_command(p_command, p_params, p_auth_user_id, null, null);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Validation d'une demande
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.approve_request(p_request uuid, p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r     admin.requests;
  v_me    uuid := (select auth.uid());
  v_res   jsonb;
  v_deleg  boolean;
begin
  v_r := admin.request_guard_approval(p_request, p_confirmation);

  if admin.command_is_external(v_r.command) then
    update admin.requests
       set status = 'approved', approver_id = v_me, approved_at = now(), updated_at = now()
     where id = v_r.id;

    perform admin.log(v_r.command, coalesce(v_r.target_type, 'request'),
                      coalesce(v_r.target_id, v_r.id::text),
                      v_r.reason_code, v_r.reason_text, null,
                      jsonb_build_object('status', 'approved'), v_r.id, v_me, v_r.solo,
                      null, false, null, v_r.actor_id);

    return jsonb_build_object('ok', true, 'status', 'approved', 'request_id', v_r.id,
      'message', 'Demande approuvée. La route serveur exécute l''effet externe puis clôt la demande.');
  end if;

  v_res := admin._run_command(v_r.command, v_r.params, null, v_r.id, v_r.actor_id);
  v_deleg := coalesce((v_res ->> 'delegated')::boolean, false);

  update admin.requests
     set status = case when v_deleg then 'approved' else 'executed' end,
         approver_id = v_me, approved_at = now(),
         executed_at = case when v_deleg then null else now() end,
         result = v_res, updated_at = now()
   where id = v_r.id;

  return jsonb_build_object(
    'ok', true,
    'status', case when v_deleg then 'approved' else 'executed' end,
    'request_id', v_r.id,
    'audit_id', (v_res ->> 'audit_id')::bigint,
    'message', 'Demande validée et appliquée.'
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Annulation 10 s
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.undo(p_audit_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_al   admin.audit_log;
  v_cmd  admin.commands;
  v_me   uuid := (select auth.uid());
  v_new  bigint;
begin
  if v_me is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select * into v_al from admin.audit_log al where al.id = p_audit_id;
  if not found then
    raise exception 'CRM : entrée d''audit introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_al.actor_id <> v_me then
    raise exception 'CRM : seule la personne qui a agi peut annuler.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if v_al.at < now() - interval '10 seconds' then
    raise exception 'CRM : le délai d''annulation (10 s) est passé.' using errcode = 'P0001', hint = 'undo_expired';
  end if;

  select * into v_cmd from admin.commands c where c.command = v_al.action;
  if not found or not coalesce(v_cmd.undoable, false) then
    raise exception 'CRM : cette action ne s''annule pas.' using errcode = '42501', hint = 'undo_not_allowed';
  end if;

  perform set_config('lkdv.admin_cmd', 'on', true);

  -- Retour à l'état d'avant, table par table (les seules familles réversibles).
  if v_al.target_type = 'post' then
    update public.community_posts p
       set moderation_state = coalesce(v_al.before ->> 'moderation_state', 'visible'),
           moderated_by = null, moderated_at = null, moderation_reason = null, updated_at = now()
     where p.id = v_al.target_id::uuid;
  elsif v_al.target_type = 'comment' then
    update public.post_comments c
       set moderation_state = coalesce(v_al.before ->> 'moderation_state', 'visible'),
           moderated_by = null, moderated_at = null, moderation_reason = null
     where c.id = v_al.target_id::uuid;
  elsif v_al.target_type = 'story' then
    update public.post_stories s
       set moderation_state = coalesce(v_al.before ->> 'moderation_state', 'visible'),
           moderated_by = null, moderated_at = null, moderation_reason = null
     where s.id = v_al.target_id::uuid;
  elsif v_al.target_type = 'place_review' then
    update public.place_reviews r
       set moderation_state = coalesce(v_al.before ->> 'moderation_state', 'visible'),
           moderated_by = null, moderated_at = null, moderation_reason = null, updated_at = now()
     where r.id = v_al.target_id::uuid;
  elsif v_al.target_type = 'product_review' then
    update public.product_reviews r
       set moderation_state = coalesce(v_al.before ->> 'moderation_state', 'visible'),
           moderated_by = null, moderated_at = null, moderation_reason = null
     where r.id = v_al.target_id::uuid;
  elsif v_al.target_type = 'member' then
    update public.user_profiles up
       set account_status = coalesce(v_al.before ->> 'account_status', 'active'),
           suspended_until = nullif(v_al.before ->> 'suspended_until', '')::timestamptz,
           status_reason = v_al.before ->> 'status_reason',
           status_changed_at = now(), status_changed_by = v_me, updated_at = now()
     where up.id = v_al.target_id::uuid;
  elsif v_al.target_type = 'listing' then
    update public.marketplace_listings ml
       set status = coalesce(v_al.before ->> 'status', 'pending')
     where ml.id = v_al.target_id::uuid;
  elsif v_al.target_type = 'carnet' then
    update public.carnets c
       set visibility = coalesce(v_al.before ->> 'visibility', c.visibility),
           updated_at = now()
     where c.id = v_al.target_id::uuid;
  else
    raise exception 'CRM : annulation non portée pour ce type de cible (%).', v_al.target_type
      using errcode = '42501', hint = 'undo_not_allowed';
  end if;

  v_new := admin.log(v_al.action, v_al.target_type, v_al.target_id,
                     v_al.reason_code, 'Annulation par l''auteur', v_al.after, v_al.before,
                     v_al.request_id, null, v_al.solo, v_al.id, false);

  return jsonb_build_object('ok', true, 'undo_id', v_new,
                            'message', 'Action annulée. Le journal conserve les deux entrées.');
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Journal paginé (contrat admin.audit_page)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.audit_page(
  p_before timestamptz default null,
  p_limit integer default 50,
  p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'at', a.at, 'actorId', a.actor_id, 'actorKind', a.actor_kind,
               'actorRole', a.actor_role, 'action', a.action, 'targetType', a.target_type,
               'targetId', a.target_id, 'reasonCode', a.reason_code, 'reasonText', a.reason_text,
               'requestId', a.request_id, 'secondApproverId', a.second_approver_id,
               'solo', a.solo, 'undoOf', a.undo_of, 'sensitiveRead', a.sensitive_read,
               'before', a.before, 'after', a.after) order by a.at desc, a.id desc)
        from (select * from admin.audit_log a
               where (p_before is null or a.at < p_before)
                 and (nullif(p_filters ->> 'action', '') is null or a.action = (p_filters ->> 'action'))
                 and (nullif(p_filters ->> 'actorId', '') is null or a.actor_id = (p_filters ->> 'actorId')::uuid)
                 and (nullif(p_filters ->> 'targetId', '') is null or a.target_id = (p_filters ->> 'targetId'))
                 and (nullif(p_filters ->> 'targetType', '') is null or a.target_type = (p_filters ->> 'targetType'))
                 and (nullif(p_filters ->> 'requestId', '') is null or a.request_id = (p_filters ->> 'requestId')::uuid)
               order by a.at desc, a.id desc
               limit v_limit + 1) a
    ), '[]'::jsonb),
    'next_before', (select min(x.at) from (
        select a.at from admin.audit_log a
         where (p_before is null or a.at < p_before)
         order by a.at desc limit v_limit) x),
    'limit', v_limit
  );
end;
$$;

revoke all on function admin._run_command(text, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function admin.run_command(text, jsonb) from public, anon;
revoke all on function admin.run_command_as(uuid, text, jsonb) from public, anon;
revoke all on function admin.approve_request(uuid, text) from public, anon;
revoke all on function admin.undo(bigint) from public, anon;
revoke all on function admin.audit_page(timestamptz, integer, jsonb) from public, anon;

grant execute on function admin._run_command(text, jsonb, uuid, uuid, uuid) to service_role;
grant execute on function admin.run_command(text, jsonb) to authenticated, service_role;
grant execute on function admin.run_command_as(uuid, text, jsonb) to service_role;
grant execute on function admin.approve_request(uuid, text) to authenticated, service_role;
grant execute on function admin.undo(bigint) to authenticated;
grant execute on function admin.audit_page(timestamptz, integer, jsonb) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Les 144 commandes : enveloppes fines admin.cmd_<nom>(p jsonb)
--    (D1 à D6 ici ; D7 à D12 en M13b ; D13 à D19 en M13c)
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select c.command from admin.commands c where c.domain in ('D1','D2','D3','D4','D5','D6') order by c.sort loop
    execute format($f$
      create or replace function admin.cmd_%I(p jsonb default '{}'::jsonb)
      returns jsonb language sql security definer set search_path = ''
      as $body$ select admin._run_command(%L, coalesce(p, '{}'::jsonb)); $body$;
    $f$, r.command, r.command);
    execute format('revoke all on function admin.cmd_%I(jsonb) from public, anon', r.command);
    execute format('grant execute on function admin.cmd_%I(jsonb) to authenticated', r.command);
  end loop;
end $$;

comment on function admin.run_command(text, jsonb) is
  'LKDV Control : seul chemin d''écriture du plan de contrôle. Registre → acteur → motif → effet → journal → demande.';
comment on function admin.run_command_as(uuid, text, jsonb) is
  'LKDV Control : exécution au nom d''un agent (service_role uniquement, auth.uid() nul). Mêmes contrôles que run_command.';
comment on function admin.approve_request(uuid, text) is
  'LKDV Control : valide une demande. Confirmation = 8 premiers caractères de l''empreinte. Refus si auteur = approbateur hors solo, si agent, si expirée ou si l''empreinte a changé.';
comment on function admin.undo(bigint) is
  'LKDV Control : annulation 10 s par l''auteur, sur une commande marquée undoable. Le journal conserve l''action et son annulation.';
comment on function admin.audit_page(timestamptz, integer, jsonb) is
  'LKDV Control : journal paginé (curseur before), filtres action / actorId / targetId / targetType / requestId.';
