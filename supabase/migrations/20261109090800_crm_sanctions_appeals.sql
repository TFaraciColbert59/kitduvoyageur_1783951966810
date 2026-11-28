-- ═══════════════════════════════════════════════════════════════════════════
-- M08 — crm_sanctions_appeals  (03_MODELE_DE_DONNEES.md § 2 ; T-04 / T-05)
-- Avertissements gradués, expiration à 1 an, tolérance zéro, recours DSA
-- (6 mois) instruit par une autre personne que le décideur (sauf mode solo).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Avertissements
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.strikes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  reason_code     text,
  reason_text     text,
  severity        smallint not null default 1,
  source_audit_id bigint,
  issued_by       uuid,
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '1 year'),
  revoked_at      timestamptz,
  revoked_by      uuid,
  zero_tolerance  boolean not null default false,
  constraint strikes_severity_check check (severity between 1 and 3),
  constraint strikes_reason_check check (reason_text is null or length(reason_text) <= 2000),
  constraint strikes_window_check check (expires_at > issued_at)
);

create index if not exists strikes_user_idx on admin.strikes (user_id, issued_at desc);
create index if not exists strikes_live_idx on admin.strikes (user_id) where revoked_at is null;

alter table admin.strikes enable row level security;
revoke all on admin.strikes from public, anon, authenticated;
grant select on admin.strikes to authenticated;
grant select, insert, update on admin.strikes to service_role;

drop policy if exists strikes_read_staff on admin.strikes;
create policy strikes_read_staff on admin.strikes
  for select to authenticated using (admin.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- Recours (DSA art. 20) — 6 mois, décideur différent
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.appeals (
  id            uuid primary key default gen_random_uuid(),
  audit_id      bigint,
  user_id       uuid not null,
  reason_text   text not null,
  status        text not null default 'pending',
  decided_by    uuid,
  decided_at    timestamptz,
  decision_text text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '6 months'),
  constraint appeals_status_check check (status in ('pending','accepted','rejected','expired')),
  constraint appeals_reason_check check (length(btrim(reason_text)) between 3 and 4000)
);

create index if not exists appeals_pending_idx on admin.appeals (created_at) where status = 'pending';
create index if not exists appeals_user_idx on admin.appeals (user_id, created_at desc);

alter table admin.appeals enable row level security;
revoke all on admin.appeals from public, anon, authenticated;
grant select on admin.appeals to authenticated;
grant select, insert, update on admin.appeals to service_role;

drop policy if exists appeals_read_own_or_staff on admin.appeals;
create policy appeals_read_own_or_staff on admin.appeals
  for select to authenticated
  using ((select auth.uid()) = user_id or admin.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- Dépôt d'un recours (côté membre, depuis la notification)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.appeal_submit(p_audit_id bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_audit admin.audit_log;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'CRM : indiquez pourquoi vous contestez.' using errcode = '22023', hint = 'reason_required';
  end if;

  select * into v_audit from admin.audit_log al where al.id = p_audit_id;
  if not found then
    raise exception 'CRM : décision introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  -- Le recours est ouvert à la personne visée : soit directement (décision sur
  -- son compte), soit comme auteur du contenu modéré, soit comme destinataire
  -- d'un avertissement issu de cette décision.
  if v_audit.target_id <> v_me::text
     and not exists (select 1 from admin.strikes s where s.user_id = v_me and s.source_audit_id = p_audit_id)
     and not (
       case v_audit.target_type
         when 'post' then exists (select 1 from public.community_posts t
                                   where t.id = v_audit.target_id::uuid and t.author_id = v_me)
         when 'comment' then exists (select 1 from public.post_comments t
                                      where t.id = v_audit.target_id::uuid and t.author_id = v_me)
         when 'story' then exists (select 1 from public.post_stories t
                                    where t.id = v_audit.target_id::uuid and t.author_id = v_me)
         when 'carnet' then exists (select 1 from public.carnets t
                                     where t.id = v_audit.target_id::uuid and t.author_id = v_me)
         when 'place_review' then exists (select 1 from public.place_reviews t
                                           where t.id = v_audit.target_id::uuid and t.author_id = v_me)
         when 'product_review' then exists (select 1 from public.product_reviews t
                                             where t.id = v_audit.target_id::uuid and t.author_id = v_me)
         when 'listing' then exists (select 1 from public.marketplace_listings t
                                      where t.id = v_audit.target_id::uuid and t.owner_id = v_me)
         else false
       end
     ) then
    raise exception 'CRM : ce recours ne vous concerne pas.' using errcode = '42501', hint = 'not_allowed';
  end if;

  if v_audit.at < now() - interval '6 months' then
    raise exception 'CRM : le délai de recours (6 mois) est dépassé.' using errcode = 'P0001', hint = 'request_expired';
  end if;

  insert into admin.appeals (audit_id, user_id, reason_text)
  values (p_audit_id, v_me, btrim(p_reason))
  returning id into v_id;

  perform admin.log('appeal_submit', 'appeal', v_id::text, null, btrim(p_reason), null,
                    jsonb_build_object('audit_id', p_audit_id));

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending',
                            'message', 'Votre recours est enregistré. Une autre personne de l''équipe le réexaminera.');
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Décision d'un recours (T-04)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.appeal_decide(p_appeal uuid, p_decision text, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_a admin.appeals;
  v_audit admin.audit_log;
  v_solo boolean;
begin
  if v_me is null or exists (select 1 from admin.agents a where a.auth_user_id = v_me) then
    raise exception 'CRM : un agent ne tranche jamais un recours.' using errcode = '42501', hint = 'agent_cannot_validate';
  end if;
  if not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;
  if p_decision not in ('accepted','rejected') then
    raise exception 'CRM : décision attendue : accepted ou rejected.' using errcode = '22023', hint = 'invalid_params';
  end if;
  if nullif(btrim(p_text), '') is null then
    raise exception 'CRM : une motivation est requise.' using errcode = '22023', hint = 'reason_required';
  end if;

  select * into v_a from admin.appeals a where a.id = p_appeal for update;
  if not found then
    raise exception 'CRM : recours introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_a.status <> 'pending' then
    raise exception 'CRM : recours déjà tranché (%).', v_a.status using errcode = 'P0001', hint = 'not_pending';
  end if;

  if v_a.audit_id is not null then
    select * into v_audit from admin.audit_log al where al.id = v_a.audit_id;
    v_solo := admin.solo_mode();
    if v_audit.actor_id = v_me and not v_solo then
      raise exception 'CRM : une autre personne que le décideur doit trancher le recours.'
        using errcode = '42501', hint = 'self_approval';
    end if;
    if v_audit.actor_id = v_me and v_solo then
      -- mode solo : même personne, mais la décision est marquée solo au journal
      null;
    end if;
  end if;

  update admin.appeals
     set status = p_decision, decided_by = v_me, decided_at = now(), decision_text = btrim(p_text)
   where id = p_appeal;

  perform admin.log('appeal_decide', 'appeal', p_appeal::text, null, btrim(p_text),
                    jsonb_build_object('status', 'pending'),
                    jsonb_build_object('status', p_decision),
                    null, null, admin.solo_mode());

  perform admin.notify_member(v_a.user_id, 'appeal_decision', 'Votre recours a été examiné',
    case p_decision when 'accepted' then 'Votre recours est accepté. ' else 'Votre recours est refusé. ' end || btrim(p_text),
    '/compte/recours', 'appeal', p_appeal);

  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Avertissement (T-05) + expiration
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.strike_add(
  p_user uuid, p_reason_code text, p_reason_text text default null, p_audit_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_rc admin.reason_codes;
  v_id uuid;
  v_sev smallint := 1;
  v_zero boolean := false;
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if p_user is null then
    raise exception 'CRM : membre cible manquant.' using errcode = '22023', hint = 'invalid_params';
  end if;
  if nullif(btrim(p_reason_code), '') is null then
    raise exception 'CRM : code de motif requis.' using errcode = '22023', hint = 'reason_required';
  end if;

  select * into v_rc from admin.reason_codes rc where rc.code = p_reason_code and rc.active;
  if not found then
    raise exception 'CRM : code de motif inconnu (%).', p_reason_code using errcode = '22023', hint = 'invalid_params';
  end if;
  v_sev := v_rc.severity;
  v_zero := v_rc.zero_tolerance;

  insert into admin.strikes (user_id, reason_code, reason_text, severity, source_audit_id, issued_by, zero_tolerance)
  values (p_user, p_reason_code, nullif(btrim(p_reason_text), ''), v_sev, p_audit_id, v_me, v_zero)
  returning id into v_id;

  perform admin.log('strike_add', 'member', p_user::text, p_reason_code, p_reason_text, null,
                    jsonb_build_object('strike_id', v_id, 'severity', v_sev, 'zero_tolerance', v_zero),
                    null, null, admin.solo_mode());

  return jsonb_build_object('ok', true, 'strike_id', v_id, 'severity', v_sev,
                            'zeroTolerance', v_zero,
                            'expiresAt', (select expires_at from admin.strikes where id = v_id));
end;
$$;

create or replace function admin.strike_expire()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  with done as (
    select 1 from admin.strikes s
     where s.revoked_at is null and s.expires_at <= now()
     limit 0
  ) select count(*) into v_n from done;

  -- Les avertissements échus restent en base (preuve) mais ne comptent plus :
  -- la lecture "vivants" filtre expires_at > now(). On journalise le balayage.
  select count(*) into v_n from admin.strikes s where s.revoked_at is null and s.expires_at <= now();

  return jsonb_build_object('ok', true, 'expired', v_n);
end;
$$;

-- Échelle graduée : 1 avertissement = rappel, 2 = avertissement ferme,
-- 3 = suspension temporaire proposée, tolérance zéro = suspension immédiate.
create or replace function admin.strike_scale(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_live integer; v_zero boolean; v_recent integer;
begin
  if not admin.is_team_member((select auth.uid())) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select count(*), coalesce(bool_or(s.zero_tolerance), false),
         count(*) filter (where s.issued_at > now() - interval '90 days')
    into v_live, v_zero, v_recent
    from admin.strikes s
   where s.user_id = p_user and s.revoked_at is null and s.expires_at > now();

  return jsonb_build_object(
    'userId', p_user,
    'live', v_live,
    'recent90d', v_recent,
    'zeroTolerance', v_zero,
    'nextStep', case
                  when v_zero then 'suspension'
                  when v_live = 0 then 'rappel'
                  when v_live = 1 then 'avertissement_ferme'
                  when v_live = 2 then 'suspension_proposee'
                  else 'suspension'
                end
  );
end;
$$;

revoke all on function admin.appeal_submit(bigint, text) from public, anon;
revoke all on function admin.appeal_decide(uuid, text, text) from public, anon;
revoke all on function admin.strike_add(uuid, text, text, bigint) from public, anon;
revoke all on function admin.strike_expire() from public, anon, authenticated;
revoke all on function admin.strike_scale(uuid) from public, anon;

grant execute on function admin.appeal_submit(bigint, text) to authenticated;
grant execute on function admin.appeal_decide(uuid, text, text) to authenticated;
grant execute on function admin.strike_add(uuid, text, text, bigint) to authenticated;
grant execute on function admin.strike_expire() to service_role;
grant execute on function admin.strike_scale(uuid) to authenticated, service_role;

comment on table admin.appeals is
  'M08 LKDV Control : recours DSA (6 mois). Instruit par une autre personne que le décideur ; en mode solo, le super admin tranche et le journal porte solo = true.';
