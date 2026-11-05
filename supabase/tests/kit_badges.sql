-- =============================================================================
-- pgTAP Security Test Suite: kit_placed_badges & Server Badge Ownership (SEC-08)
-- Tests:
-- - SEC-08: Un utilisateur ne peut PAS épingler un insigne qu'il ne possède pas
--           dans public.user_badges, ni épingler sur le kit d'autrui.
-- =============================================================================

begin;
select plan(4);

do $$
declare
  v_user_a uuid := '33333333-3333-4333-8333-333333333331';
  v_user_b uuid := '44444444-4444-4444-8444-444444444442';
  v_kit_a uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_kit_b uuid := 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
  v_owned_badge uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  v_unowned_badge uuid := 'ffffffff-ffff-4fff-8fff-fffffffffff2';
begin
  insert into auth.users (id, email)
  values
    (v_user_a, 'sec08-a@lkdv.test'),
    (v_user_b, 'sec08-b@lkdv.test')
  on conflict (id) do nothing;

  insert into public.badges (id, name, description, icon, category, points_reward)
  values
    (v_owned_badge, 'Traversée Alpine', 'Distinction terrain obtenue', 'award', 'exploration', 0),
    (v_unowned_badge, 'Hivernale Engagée', 'Distinction non obtenue', 'shield', 'exploration', 0)
  on conflict (id) do nothing;

  insert into public.user_badges (user_id, badge_id)
  values (v_user_a, v_owned_badge)
  on conflict do nothing;

  insert into public.materiel_kits (id, user_id, name, total_weight_g)
  values
    (v_kit_a, v_user_a, 'Sac A', 0),
    (v_kit_b, v_user_b, 'Sac B', 0)
  on conflict (id) do nothing;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333331', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333331","role":"authenticated"}', true);

-- 1. SEC-08 : A tente de poser un insigne qu'il ne possède PAS -> refusé 42501
select throws_ok(
  $$insert into public.kit_placed_badges (kit_id, user_id, badge_id, anchor_id, scale)
    values (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
      '33333333-3333-4333-8333-333333333331'::uuid,
      'ffffffff-ffff-4fff-8fff-fffffffffff2'::uuid,
      'badge-body-front',
      1.0
    )$$,
  '42501',
  null,
  'SEC-08: Poser un insigne non possédé est refusé en base par trg_enforce_kit_badge_ownership'
);

-- 2. SEC-08 : A tente de poser son insigne possédé sur le kit de B -> refusé 42501
select throws_ok(
  $$insert into public.kit_placed_badges (kit_id, user_id, badge_id, anchor_id, scale)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'::uuid,
      '33333333-3333-4333-8333-333333333331'::uuid,
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,
      'badge-body-front',
      1.0
    )$$,
  '42501',
  null,
  'SEC-08: Poser un insigne sur le kit d autrui est refusé en base'
);

-- 3. Pose légitime d'un insigne réellement possédé sur son propre kit -> accepté
select lives_ok(
  $$insert into public.kit_placed_badges (kit_id, user_id, badge_id, anchor_id, scale)
    values (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
      '33333333-3333-4333-8333-333333333331'::uuid,
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,
      'badge-body-front',
      1.2
    )$$,
  'Pose légitime d un insigne possédé sur son propre kit acceptée'
);

-- 4. Poser un insigne n'a créé AUCUNE attribution nouvelle dans user_badges
select is(
  (select count(*)::int from public.user_badges where user_id = '33333333-3333-4333-8333-333333333331'::uuid),
  1,
  'SEC-08: Poser un insigne ne modifie jamais le ledger user_badges'
);

select * from finish();
rollback;
