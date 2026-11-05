-- =============================================================================
-- pgTAP Security Test Suite: Group Read RLS & Privacy (SEC-01..04, SEC-09, SEC-10)
-- Tests:
-- - SEC-01: A lit materiel_kit_items de C (hors groupe) -> 0 ligne
-- - SEC-02: A lit le kit non partagé de B (même groupe, is_shared_with_group = false) -> 0 ligne
-- - SEC-03: A lit le kit partagé de B (même groupe, is_shared_with_group = true) -> lignes visibles
-- - SEC-04: A tente d'écrire (INSERT/UPDATE/DELETE) dans le kit partagé de B -> refusé
-- - SEC-09: Aucune coordonnée GPS brute exposée par get_kit_journal
-- - SEC-10: can_read_member_kit(uuid, uuid) NON exécutable par PUBLIC / anon
-- =============================================================================

begin;
select plan(8);

-- SEC-10 : Vérifie que PUBLIC et anon n'ont PAS le privilège EXECUTE sur can_read_member_kit
select is(
  has_function_privilege('anon', 'public.can_read_member_kit(uuid, uuid)', 'EXECUTE'),
  false,
  'SEC-10: anon ne peut pas exécuter can_read_member_kit(uuid, uuid)'
);

do $$
declare
  v_user_a uuid := '55555555-5555-4555-8555-555555555551';
  v_user_b uuid := '66666666-6666-4666-8666-666666666662';
  v_user_c uuid := '77777777-7777-4777-8777-777777777773';
  v_trip_ab uuid := '88888888-8888-4888-8888-888888888881';
  v_kit_b_private uuid := '99999999-9999-4999-8999-999999999991';
  v_kit_b_shared  uuid := '99999999-9999-4999-8999-999999999992';
  v_kit_c_shared  uuid := '99999999-9999-4999-8999-999999999993';
begin
  insert into auth.users (id, email)
  values
    (v_user_a, 'sec-grp-a@lkdv.test'),
    (v_user_b, 'sec-grp-b@lkdv.test'),
    (v_user_c, 'sec-grp-c@lkdv.test')
  on conflict (id) do nothing;

  insert into public.trips (id, user_id, title, slug)
  values (v_trip_ab, v_user_a, 'Expédition Écrins', 'expedition-ecrins-sec-test')
  on conflict (id) do nothing;

  insert into public.trip_participants (trip_id, user_id, role, status)
  values
    (v_trip_ab, v_user_a, 'owner', 'confirmed'),
    (v_trip_ab, v_user_b, 'member', 'confirmed')
  on conflict (trip_id, user_id) do nothing;

  insert into public.materiel_kits (id, user_id, name, is_public, is_shared_with_group, total_weight_g)
  values
    (v_kit_b_private, v_user_b, 'Kit Perso Non Partagé B', false, false, 1200),
    (v_kit_b_shared,  v_user_b, 'Kit Groupe Partagé B',    false, true,  2400),
    (v_kit_c_shared,  v_user_c, 'Kit Groupe Hors Équipage C', false, true, 1800)
  on conflict (id) do nothing;

  insert into public.materiel_kit_items (kit_id, user_id, name, category, weight_g, quantity)
  values
    (v_kit_b_private, v_user_b, 'Carnet Privé B', 'Personnel', 120, 1),
    (v_kit_b_shared,  v_user_b, 'Réchaud Collectif B', 'Cuisine', 340, 1),
    (v_kit_c_shared,  v_user_c, 'Tente Étrangère C', 'Abri', 1500, 1);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555551', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555551","role":"authenticated"}', true);

-- SEC-01 : A lit les articles de C (hors groupe, même avec is_shared_with_group = true) -> 0 ligne
select is(
  (select count(*)::int from public.materiel_kit_items where kit_id = '99999999-9999-4999-8999-999999999993'::uuid),
  0,
  'SEC-01: Lecture d un kit hors groupe renvoie 0 ligne'
);

-- SEC-02 : A lit le kit non partagé de B (même groupe, is_shared_with_group = false) -> 0 ligne
select is(
  (select count(*)::int from public.materiel_kit_items where kit_id = '99999999-9999-4999-8999-999999999991'::uuid),
  0,
  'SEC-02: Kit non partagé (is_shared_with_group = false) reste illisible même au sein du groupe'
);

-- SEC-03 : A lit le kit explicitement partagé de B (même groupe, is_shared_with_group = true) -> 1 ligne
select is(
  (select count(*)::int from public.materiel_kit_items where kit_id = '99999999-9999-4999-8999-999999999992'::uuid),
  1,
  'SEC-03: Coéquipier actif peut lire en lecture seule les articles du kit partagé au groupe'
);

-- SEC-04 (INSERT) : A tente d'insérer un article dans le kit partagé de B -> refusé par RLS
select throws_ok(
  $$insert into public.materiel_kit_items (kit_id, user_id, name, category, weight_g, quantity)
    values (
      '99999999-9999-4999-8999-999999999992'::uuid,
      '66666666-6666-4666-8666-666666666662'::uuid,
      'Injection Intrusive',
      'Sabotage',
      500,
      1
    )$$,
  '42501',
  null,
  'SEC-04: INSERT par un coéquipier dans le kit d autrui est refusé en base'
);

-- SEC-04 (UPDATE) : A tente de modifier un article du kit partagé de B -> 0 ligne affectée
with upd as (
  update public.materiel_kit_items
     set name = 'Piraté'
   where kit_id = '99999999-9999-4999-8999-999999999992'::uuid
  returning id
)
select is(
  (select count(*)::int from upd),
  0,
  'SEC-04: UPDATE par un coéquipier sur les articles d autrui n affecte 0 ligne'
);

-- SEC-04 (DELETE) : A tente de supprimer un article du kit partagé de B -> 0 ligne supprimée
with del as (
  delete from public.materiel_kit_items
   where kit_id = '99999999-9999-4999-8999-999999999992'::uuid
  returning id
)
select is(
  (select count(*)::int from del),
  0,
  'SEC-04: DELETE par un coéquipier sur les articles d autrui ne supprime 0 ligne'
);

-- SEC-09 : get_kit_journal n'expose aucune clé latitude/longitude/coords
select is(
  (
    coalesce(public.get_kit_journal('99999999-9999-4999-8999-999999999992'::uuid)::text, '{}')
    ~* '(latitude|longitude|"lat"|"lng"|"lon"|passport|identity_doc)'
  ),
  false,
  'SEC-09: Le journal de lignée du kit partagé n expose ni coordonnées GPS ni document d identité'
);

select * from finish();
rollback;
