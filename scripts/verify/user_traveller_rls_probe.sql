-- Sonde RLS de public.user_traveller (Compas, lot P, PLAN-100 4.1).
--
-- UNE seule instruction (bloc DO) qui finit TOUJOURS par une exception : tout ce
-- qu'elle a écrit est annulé, en cas de succès comme d'échec. Le message rendu
-- EST le résultat :
--   « SONDE user_traveller : 16 contrôles passés (tout est annulé) » → conforme ;
--   « SONDE user_traveller : ÉCHEC n — … »                          → non conforme.
-- À lancer par le MCP Supabase (execute_sql), projet icxyvwzfjbflcbqukpfz SEULEMENT :
--   - avant application : UNE instruction, un DO englobant qui exécute la migration
--     puis ce bloc (construit par la commande du plan du lot P, tâche 1 ; ce fichier ne
--     doit donc contenir aucune balise dollar autre que celle du bloc) : l'exception
--     finale annule tout, quel que soit le mode de transaction de l'outil ; ensuite
--     `select to_regclass('public.user_traveller');` doit rendre null ;
--   - après application (par le contrôleur) : ce bloc seul.
-- Deux comptes réels (non anonymes) prêtent leur identifiant aux jetons simulés ;
-- rien d'autre n'est lu, et rien n'est gardé.
do $sonde$
declare
  a uuid;
  b uuid;
  c uuid := gen_random_uuid();
  n integer;
  lat numeric;
  passed integer := 0;
begin
  select id into a from auth.users where coalesce(is_anonymous, false) = false order by created_at limit 1;
  select id into b from auth.users where coalesce(is_anonymous, false) = false and id <> a order by created_at limit 1;
  if a is null or b is null then
    raise exception 'SONDE user_traveller : ÉCHEC 0 — deux comptes réels nécessaires';
  end if;

  -- 1. RLS activée.
  if not coalesce((select relrowsecurity from pg_class where oid = 'public.user_traveller'::regclass), false) then
    raise exception 'SONDE user_traveller : ÉCHEC 1 — RLS désactivée';
  end if;
  passed := passed + 1;

  -- 2. Aucun droit pour anon.
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'user_traveller' and grantee = 'anon'
  ) then
    raise exception 'SONDE user_traveller : ÉCHEC 2 — droit accordé à anon';
  end if;
  passed := passed + 1;

  -- 3. Cinq policies, toutes réservées à authenticated (aucune publique).
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'user_traveller';
  if n <> 5 or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_traveller' and roles <> array['authenticated']::name[]
  ) then
    raise exception 'SONDE user_traveller : ÉCHEC 3 — % policies, ou une policy hors authenticated', n;
  end if;
  passed := passed + 1;

  -- 4-5. anon : ni lecture, ni écriture.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform 1 from public.user_traveller;
    raise exception 'SONDE user_traveller : ÉCHEC 4 — anon lit la table';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;
  begin
    insert into public.user_traveller (user_id, nationality) values (a, 'FR');
    raise exception 'SONDE user_traveller : ÉCHEC 5 — anon écrit dans la table';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;
  execute 'reset role';

  -- 6. A écrit sa ligne ; la base arrondit le domicile à 0,01°.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.user_traveller
    (user_id, nationality, residence_country, currency, language, time_zone, home_name, home_lat, home_lon, home_country)
  values (a, 'FR', 'FR', 'EUR', 'fr', 'Europe/Paris', 'Lyon', 45.7578, 4.8320, 'FR')
  on conflict (user_id) do update set
    nationality = excluded.nationality, residence_country = excluded.residence_country,
    currency = excluded.currency, language = excluded.language, time_zone = excluded.time_zone,
    home_name = excluded.home_name, home_lat = excluded.home_lat, home_lon = excluded.home_lon,
    home_country = excluded.home_country;
  select home_lat into lat from public.user_traveller where user_id = a;
  if lat is distinct from 45.76 then
    raise exception 'SONDE user_traveller : ÉCHEC 6 — domicile non arrondi (%)', lat;
  end if;
  passed := passed + 1;

  -- 7. A n'écrit pas la ligne de B.
  begin
    insert into public.user_traveller (user_id, nationality) values (b, 'DE');
    raise exception 'SONDE user_traveller : ÉCHEC 7 — A écrit la ligne de B';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;

  -- 8-11. Formats refusés par la base.
  begin
    update public.user_traveller set nationality = 'fra' where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 8 — nationalité « fra » acceptée';
  exception when check_violation then
    passed := passed + 1;
  end;
  begin
    update public.user_traveller set currency = 'eur' where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 9 — devise « eur » acceptée';
  exception when check_violation then
    passed := passed + 1;
  end;
  begin
    update public.user_traveller set home_lat = 91 where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 10 — latitude 91 acceptée';
  exception when check_violation then
    passed := passed + 1;
  end;
  begin
    update public.user_traveller set home_name = null where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 11 — domicile sans nom accepté';
  exception when check_violation then
    passed := passed + 1;
  end;

  -- 12-14. B ne voit, ne change ni n'efface la ligne de A.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.user_traveller where user_id = a;
  if n <> 0 then
    raise exception 'SONDE user_traveller : ÉCHEC 12 — B voit la ligne de A';
  end if;
  passed := passed + 1;
  update public.user_traveller set nationality = 'DE' where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'SONDE user_traveller : ÉCHEC 13 — B modifie la ligne de A';
  end if;
  passed := passed + 1;
  delete from public.user_traveller where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'SONDE user_traveller : ÉCHEC 14 — B efface la ligne de A';
  end if;
  passed := passed + 1;

  -- 15. Essai sans compte (jeton anonyme) : aucune écriture, même sur sa propre ligne.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    insert into public.user_traveller (user_id, nationality) values (c, 'DE');
    raise exception 'SONDE user_traveller : ÉCHEC 15 — un essai sans compte écrit un profil';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;

  -- 16. A efface sa propre ligne.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.user_traveller where user_id = a;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'SONDE user_traveller : ÉCHEC 16 — A n’efface pas sa ligne';
  end if;
  passed := passed + 1;
  execute 'reset role';

  raise exception 'SONDE user_traveller : % contrôles passés (tout est annulé)', passed;
end
$sonde$;
