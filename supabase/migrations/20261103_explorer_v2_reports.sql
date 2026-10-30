begin;

-- Confirmation communautaire d'un signalement terrain, exposée aux clients.
-- Aucune modification des fonctions existantes : `a11_merge_terrain_report`
-- reste inchangée, on l'enveloppe et on ajoute la transition de statut.
create or replace function public.explorer_confirm_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_merged jsonb;
  v_count integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  -- Refus de confirmer son propre signalement (corroboration externe).
  if exists (
    select 1 from public.terrain_reports r
     where r.id = p_report_id and r.reporter_id = v_uid
  ) then
    return jsonb_build_object('status', 'own_report', 'report_count', null);
  end if;

  v_merged := public.a11_merge_terrain_report(
    p_report_id => p_report_id,
    p_contributor_id => v_uid
  );
  v_count := coalesce((v_merged->>'report_count')::int, 0);

  -- Deux corroborations indépendantes valent confirmation.
  update public.terrain_reports r
     set status = case when v_count >= 2 and r.status = 'pending' then 'confirmed' else r.status end,
         present_count = greatest(r.present_count, v_count),
         updated_at = now()
   where r.id = p_report_id
   returning r.status into v_status;

  return jsonb_build_object('status', v_status, 'report_count', v_count, 'merged', v_merged->'merged');
end;
$$;

grant execute on function public.explorer_confirm_report(uuid) to authenticated;

-- Signalement « disparu » : même mécanique, compteur opposé.
create or replace function public.explorer_mark_report_gone(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_gone integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  insert into public.terrain_report_contributors (report_id, user_id, first_report_at)
  values (p_report_id, v_uid, now())
  on conflict (report_id, user_id) do nothing;

  update public.terrain_reports r
     set gone_count = r.gone_count + 1,
         status = case when r.gone_count + 1 > r.present_count then 'stale' else r.status end,
         updated_at = now()
   where r.id = p_report_id
   returning r.gone_count, r.status into v_gone, v_status;

  if v_gone is null then
    raise exception 'signalement introuvable' using errcode = 'P0002';
  end if;

  return jsonb_build_object('status', v_status, 'gone_count', v_gone);
end;
$$;

grant execute on function public.explorer_mark_report_gone(uuid) to authenticated;

commit;
