-- LKDV Control — compléments M09/M10 : contexte équipe, détail commande, file agent.
--
-- Ces trois RPC sont au contrat (crm/CONTRACT.md) et consommées par l'UI, la
-- session serveur et le serveur MCP. Aucune donnée métier n'est modifiée ici :
-- lectures contrôlées uniquement.
--
-- Marqueurs d'erreur (contrat backend) : not_allowed, mfa_required, role_too_low,
-- invalid_params, not_found.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. admin.my_context() — contexte d'appel de la personne (shell CRM)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_aal     text := coalesce((select auth.jwt()) ->> 'aal', 'aal1');
  v_role    text;
  v_poles   jsonb;
  v_staff   boolean;
  v_name    text;
  v_email   text;
begin
  if v_uid is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;

  -- Le contexte porte le rôle : jamais de lecture sans second facteur.
  if v_aal <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  v_staff := admin.is_staff();
  v_role  := admin.my_role();

  if not coalesce(v_staff, false) or v_role is null then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object('code', sm.pole_code, 'role', sm.role)
             order by p.sort, sm.pole_code
           ),
           '[]'::jsonb
         )
    into v_poles
    from admin.staff_memberships sm
    join admin.poles p on p.code = sm.pole_code
   where sm.user_id = v_uid
     and sm.revoked_at is null;

  select nullif(btrim(up.full_name), '')
    into v_name
    from public.user_profiles up
   where up.id = v_uid;

  select nullif(btrim(u.email), '')
    into v_email
    from auth.users u
   where u.id = v_uid;

  return jsonb_build_object(
    'role', v_role,
    'poles', coalesce(v_poles, '[]'::jsonb),
    'solo', admin.solo_mode(),
    'staff', true,
    'display_name', v_name,
    'email', v_email
  );
end;
$$;

revoke all on function admin.my_context() from public, anon;
grant execute on function admin.my_context() to authenticated, service_role;

comment on function admin.my_context() is
  'LKDV Control : contexte d''appel (rôle, pôles, mode solo, nom, e-mail) — aal2 et appartenance à l''équipe exigées.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. admin.order_detail(p_order_id uuid) — commande, client, paiement, lignes
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.order_detail(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order    record;
  v_items    jsonb;
  v_actions  jsonb;
  v_payment  jsonb;
  v_intent   text;
begin
  perform admin.assert_staff();

  select o.*, up.full_name as customer_name
    into v_order
    from public.orders o
    left join public.user_profiles up on up.id = o.user_id
   where o.id = p_order;

  if v_order.id is null then
    raise exception 'Commande introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  -- Colonnes optionnelles lues via to_jsonb : ne cassent pas si LKDV évolue.
  v_intent := coalesce(
    to_jsonb(v_order) ->> 'stripe_payment_intent_id',
    to_jsonb(v_order) ->> 'payment_intent_id',
    to_jsonb(v_order) ->> 'stripe_payment_intent'
  );

  v_payment := jsonb_build_object(
    'intent_id', v_intent,
    'status', coalesce(v_order.payment_state, 'pending'),
    'refunded_cents', coalesce(v_order.refunded_merchandise_cents, 0)
  );

  v_items := coalesce((
    select jsonb_agg(jsonb_build_object(
             'label', coalesce(
               nullif(btrim(i ->> 'name'), ''),
               nullif(btrim(i ->> 'title'), ''),
               nullif(btrim(i ->> 'label'), ''),
               nullif(btrim(i ->> 'product_name'), ''),
               'Article'
             ),
             'qty', greatest(
               coalesce(
                 nullif(regexp_replace(coalesce(i ->> 'quantity', i ->> 'qty', '1'), '\D', '', 'g'), '')::int,
                 1
               ),
               0
             ),
             'amount_cents', round(
               coalesce(
                 case when (i ->> 'price_eur') ~ '^[0-9]+(\.[0-9]+)?$' then (i ->> 'price_eur')::numeric end,
                 case when (i ->> 'unit_price_eur') ~ '^[0-9]+(\.[0-9]+)?$' then (i ->> 'unit_price_eur')::numeric end,
                 case when (i ->> 'price') ~ '^[0-9]+(\.[0-9]+)?$' then (i ->> 'price')::numeric end,
                 0
               ) * 100
             )
           ))
      from jsonb_array_elements(
             case
               when jsonb_typeof(coalesce(v_order.items, '[]'::jsonb)) = 'array'
                 then coalesce(v_order.items, '[]'::jsonb)
               else '[]'::jsonb
             end
           ) i
  ), '[]'::jsonb);

  -- Actions proposées uniquement si l'appelant peut les lancer (admin.can).
  v_actions := coalesce((
    select jsonb_agg(a order by ord)
      from (
        select 10 as ord,
               jsonb_build_object('command', 'order_confirm', 'label', 'Confirmer la commande', 'tone', 'default') as a
         where v_order.status in ('pending', 'en_preparation')
           and admin.can((select auth.uid()), 'order_confirm')
        union all
        select 20,
               jsonb_build_object('command', 'order_ship', 'label', 'Expédier', 'tone', 'default')
         where coalesce(v_order.payment_state, 'pending') in ('paid', 'partially_refunded')
           and admin.can((select auth.uid()), 'order_ship')
        union all
        select 30,
               jsonb_build_object('command', 'order_refund', 'label', 'Rembourser', 'tone', 'danger')
         where coalesce(v_order.payment_state, 'pending') in ('paid', 'partially_refunded')
           and admin.can((select auth.uid()), 'order_refund')
        union all
        select 40,
               jsonb_build_object('command', 'order_cancel', 'label', 'Annuler la commande', 'tone', 'danger')
         where coalesce(v_order.status, '') <> 'cancelled'
           and admin.can((select auth.uid()), 'order_cancel')
      ) s
  ), '[]'::jsonb);

  return jsonb_build_object(
    'id', v_order.id,
    'number', v_order.order_number,
    'status', v_order.status,
    'total_cents', round(coalesce(v_order.total_eur, 0) * 100),
    'currency', 'EUR',
    'created_at', v_order.created_at,
    'customer', jsonb_build_object(
      'id', v_order.user_id,
      'name', coalesce(nullif(btrim(v_order.customer_name), ''), 'non renseigné')
    ),
    'payment', v_payment,
    'items', v_items,
    'actions', v_actions
  );
end;
$$;

revoke all on function admin.order_detail(uuid) from public, anon;
grant execute on function admin.order_detail(uuid) to authenticated, service_role;

comment on function admin.order_detail(uuid) is
  'LKDV Control : détail d''une commande (client, paiement, lignes, actions autorisées). Aucune donnée de document.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. admin.agent_inbox(p_pole text) — file du pôle pour le MCP, PII masquée
--    service_role uniquement : un agent ne lit jamais la file par son jeton.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.agent_inbox(p_pole text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pole   text := upper(btrim(coalesce(p_pole, '')));
  v_base   jsonb;
  v_items  jsonb;
  v_email  constant text := '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';
  v_phone  constant text := '(\+?[0-9][0-9 .-]{8,14})';
begin
  if not exists (select 1 from admin.poles p where p.code = v_pole) then
    raise exception 'CRM : pôle inconnu.' using errcode = '22023', hint = 'invalid_params';
  end if;

  v_base := admin._inbox_json(false, v_pole);

  select coalesce(jsonb_agg(jsonb_build_object(
           'key', it ->> 'key',
           'source', it ->> 'source',
           'id', it ->> 'id',
           'group', it ->> 'group',
           'title', left(
             regexp_replace(
               regexp_replace(coalesce(it ->> 'title', ''), v_email, '[e-mail masqué]', 'g'),
               v_phone, '[téléphone masqué]', 'g'
             ),
             240
           ),
           'subtitle', left(
             regexp_replace(
               regexp_replace(coalesce(it ->> 'subtitle', ''), v_email, '[e-mail masqué]', 'g'),
               v_phone, '[téléphone masqué]', 'g'
             ),
             240
           ),
           'pole', v_pole,
           'urgency', coalesce(nullif(it ->> 'urgency', ''), 'normale'),
           'due_at', coalesce(it ->> 'dueAt', it ->> 'due_at'),
           'created_at', coalesce(it ->> 'createdAt', it ->> 'created_at'),
           'badges', coalesce(it -> 'badges', '[]'::jsonb)
         )), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(coalesce(v_base -> 'items', '[]'::jsonb)) it;

  return jsonb_build_object(
    'pole', v_pole,
    'items', v_items,
    'count', jsonb_array_length(v_items),
    'unavailable', false
  );
end;
$$;

revoke all on function admin.agent_inbox(text) from public, anon, authenticated;
grant execute on function admin.agent_inbox(text) to service_role;

comment on function admin.agent_inbox(text) is
  'LKDV Control : file d''un pôle pour le serveur MCP (PII masquée, service_role uniquement). Jamais de coordonnées ni de contenu privé.';
