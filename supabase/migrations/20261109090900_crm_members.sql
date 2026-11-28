-- ═══════════════════════════════════════════════════════════════════════════
-- M09 — crm_members  (03_MODELE_DE_DONNEES.md § 2 ; EX-SEC-07 ; T-06 / T-07 / T-09)
-- Fiche membre 360°, notes internes, affichage journalisé des données
-- personnelles, ouverture encadrée d'un document d'identité.
--
-- EX-SEC-07 : les documents d'identité (trip_documents) ne sont jamais visibles
-- des tiers, des pôles ni des agents. Seul le super admin, avec motif, pour
-- 15 minutes, et chaque ouverture est journalisée.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Notes internes
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.member_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  body       text not null,
  author_id  uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pinned     boolean not null default false,
  constraint member_notes_body_check check (length(btrim(body)) between 2 and 4000)
);

create index if not exists member_notes_user_idx on admin.member_notes (user_id, created_at desc);

alter table admin.member_notes enable row level security;
revoke all on admin.member_notes from public, anon, authenticated;
grant select on admin.member_notes to authenticated;
grant select, insert, update on admin.member_notes to service_role;

drop policy if exists member_notes_read_staff on admin.member_notes;
create policy member_notes_read_staff on admin.member_notes
  for select to authenticated using (admin.is_staff());

create or replace function admin.note_add(p_user uuid, p_body text, p_pinned boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if p_user is null or nullif(btrim(p_body), '') is null then
    raise exception 'CRM : membre et note requis.' using errcode = '22023', hint = 'invalid_params';
  end if;

  insert into admin.member_notes (user_id, body, author_id, pinned)
  values (p_user, btrim(p_body), v_me, coalesce(p_pinned, false))
  returning id into v_id;

  perform admin.log('note_add', 'member', p_user::text, null, left(btrim(p_body), 500), null,
                    jsonb_build_object('note_id', v_id));

  return jsonb_build_object('ok', true, 'note_id', v_id);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Fiche 360°
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.member_360(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_up public.user_profiles;
  v_stats jsonb;
  v_notes jsonb;
  v_timeline jsonb;
  v_strikes jsonb;
begin
  if not admin.is_team_member((select auth.uid())) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  select * into v_up from public.user_profiles up where up.id = p_user;
  if not found then
    raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  select jsonb_build_object(
           'posts', (select count(*) from public.community_posts p where p.author_id = p_user),
           'comments', (select count(*) from public.post_comments c where c.author_id = p_user),
           'carnets', (select count(*) from public.carnets c where c.author_id = p_user),
           'clubs', (select count(*) from public.club_members m where m.user_id = p_user),
           'reviews', (select count(*) from public.reviews r where r.user_id = p_user),
           'orders', (select count(*) from public.orders o where o.user_id = p_user),
           'spentEur', (select coalesce(sum(o.total_eur), 0) from public.orders o
                         where o.user_id = p_user and coalesce(o.payment_state, 'pending') = 'paid'),
           'reportsAgainst', (
             select count(*) from public.post_reports pr
              join public.community_posts p on p.id = pr.post_id
             where p.author_id = p_user
           ),
           'strikesLive', (select count(*) from admin.strikes s
                            where s.user_id = p_user and s.revoked_at is null and s.expires_at > now()),
           'ticketsOpen', (select count(*) from public.support_tickets st
                            where st.user_id = p_user and coalesce(st.status, 'open') in ('open','pending','waiting')),
           'appealsPending', (select count(*) from admin.appeals a
                               where a.user_id = p_user and a.status = 'pending'),
           'lastActivity', greatest(
             coalesce((select max(created_at) from public.community_posts where author_id = p_user), 'epoch'::timestamptz),
             coalesce((select max(created_at) from public.post_comments where author_id = p_user), 'epoch'::timestamptz)
           )
         ) into v_stats;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'body', n.body, 'authorId', n.author_id,
           'createdAt', n.created_at, 'pinned', n.pinned) order by n.pinned desc, n.created_at desc), '[]'::jsonb)
    into v_notes
    from (select * from admin.member_notes mn where mn.user_id = p_user order by mn.created_at desc limit 10) n;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'reasonCode', s.reason_code, 'reasonText', s.reason_text,
           'severity', s.severity, 'issuedAt', s.issued_at, 'expiresAt', s.expires_at,
           'revokedAt', s.revoked_at, 'zeroTolerance', s.zero_tolerance) order by s.issued_at desc), '[]'::jsonb)
    into v_strikes
    from admin.strikes s where s.user_id = p_user;

  select coalesce(jsonb_agg(jsonb_build_object(
           'at', a.at, 'action', a.action, 'actorRole', a.actor_role,
           'actorKind', a.actor_kind, 'reasonCode', a.reason_code,
           'reasonText', a.reason_text) order by a.at desc), '[]'::jsonb)
    into v_timeline
    from (select * from admin.audit_log al
           where al.target_type in ('member','user_profile') and al.target_id = p_user::text
           order by al.at desc limit 20) a;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_up.id,
      'handle', v_up.handle,
      'fullName', v_up.full_name,
      'avatarUrl', v_up.avatar_url,
      'bio', v_up.bio,
      'location', v_up.location,
      'createdAt', v_up.created_at,
      'trustScore', v_up.trust_score,
      'level', v_up.level,
      'xp', v_up.xp,
      'loyaltyPoints', v_up.loyalty_points,
      'loyaltyLevel', v_up.loyalty_level,
      'isDemo', v_up.is_demo,
      'accountStatus', v_up.account_status,
      'suspendedUntil', v_up.suspended_until,
      'statusReason', v_up.status_reason,
      'twoFaEnabled', v_up.two_fa_enabled,
      -- Les coordonnées ne sortent JAMAIS ici : admin.reveal_pii, motivé et journalisé.
      'emailMasked', regexp_replace(coalesce(v_up.email, ''), '^(.).*@', '\1***@'),
      'phoneMasked', case when coalesce(v_up.phone, '') = '' then null else '***' || right(v_up.phone, 2) end
    ),
    'staff', jsonb_build_object(
      'role', admin.human_role_of(p_user),
      'poles', to_jsonb(admin.poles_of(p_user)),
      'superAdmin', admin.is_super_admin_for(p_user),
      'agent', (select jsonb_build_object('id', a.id, 'name', a.name, 'status', a.status)
                  from admin.agents a where a.auth_user_id = p_user)
    ),
    'stats', v_stats,
    'strikes', v_strikes,
    'notes', v_notes,
    'timeline', v_timeline,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'orderNumber', o.order_number, 'status', o.status,
               'totalEur', o.total_eur, 'createdAt', o.created_at,
               'refundedCents', o.refunded_merchandise_cents) order by o.created_at desc)
        from (select * from public.orders o where o.user_id = p_user order by o.created_at desc limit 10) o
    ), '[]'::jsonb),
    'solo', admin.solo_mode()
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Coordonnées : affichage motivé et journalisé (T-06)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.reveal_pii(p_user uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_up public.user_profiles;
  v_audit bigint;
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if exists (select 1 from admin.agents a where a.auth_user_id = v_me) then
    raise exception 'CRM : un agent n''accède jamais aux coordonnées.' using errcode = '42501', hint = 'agent_not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) < 5 then
    raise exception 'CRM : indiquez le motif de la consultation (5 caractères minimum).' using errcode = '22023', hint = 'reason_required';
  end if;

  select * into v_up from public.user_profiles up where up.id = p_user;
  if not found then
    raise exception 'CRM : membre introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  v_audit := admin.log('reveal_pii', 'member', p_user::text, null, btrim(p_reason), null,
                       jsonb_build_object('fields', array['email','phone']),
                       null, null, false, null, true);

  return jsonb_build_object(
    'email', v_up.email,
    'phone', case when coalesce(v_up.phone, '') = '' then null else v_up.phone end,
    'revealed_until', now() + interval '15 minutes',
    'audit_id', v_audit
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Document d'identité : super admin seul, motif, 15 minutes, journalisé (T-07)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.open_identity_document(p_document uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_doc public.trip_documents;
  v_audit bigint;
begin
  if v_me is null or not admin.is_super_admin_for(v_me) then
    raise exception 'CRM : seul un super admin peut ouvrir un document d''identité.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if exists (select 1 from admin.agents a where a.auth_user_id = v_me) then
    raise exception 'CRM : un agent n''ouvre jamais un document d''identité.' using errcode = '42501', hint = 'agent_not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) < 5 then
    raise exception 'CRM : indiquez le motif de l''ouverture (5 caractères minimum).' using errcode = '22023', hint = 'reason_required';
  end if;

  select * into v_doc from public.trip_documents d where d.id = p_document;
  if not found then
    raise exception 'CRM : document introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  v_audit := admin.log('open_identity_document', 'document', p_document::text, null, btrim(p_reason),
                       jsonb_build_object('trip_id', v_doc.trip_id, 'category', v_doc.category::text),
                       null, null, null, false, null, true);

  -- L'URL signée est produite côté serveur (service_role) ; la base ne rend
  -- que la référence et la fenêtre de 15 minutes, jamais un jeton durable.
  return jsonb_build_object(
    'document_id', v_doc.id,
    'file_url', v_doc.file_url,
    'file_name', v_doc.file_name,
    'mime_type', v_doc.mime_type,
    'revealed_until', now() + interval '15 minutes',
    'audit_id', v_audit,
    'note', 'Fenêtre de 15 minutes. Toute nouvelle ouverture repasse par cette fonction et laisse une trace.'
  );
end;
$$;

revoke all on function admin.note_add(uuid, text, boolean) from public, anon;
revoke all on function admin.member_360(uuid) from public, anon;
revoke all on function admin.reveal_pii(uuid, text) from public, anon;
revoke all on function admin.open_identity_document(uuid, text) from public, anon;

grant execute on function admin.note_add(uuid, text, boolean) to authenticated;
grant execute on function admin.member_360(uuid) to authenticated, service_role;
grant execute on function admin.reveal_pii(uuid, text) to authenticated;
grant execute on function admin.open_identity_document(uuid, text) to authenticated;

comment on function admin.member_360(uuid) is
  'M09 LKDV Control : fiche agrégée (profil, statistiques, avertissements, notes, historique). Coordonnées masquées : admin.reveal_pii.';
comment on function admin.open_identity_document(uuid, text) is
  'M09 LKDV Control : EX-SEC-07 — super admin seul, motif obligatoire, fenêtre 15 min, journal sensible. Jamais un pôle, jamais un agent.';
