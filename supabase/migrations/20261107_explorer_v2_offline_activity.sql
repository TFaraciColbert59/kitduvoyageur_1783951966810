begin;

-- ---------------------------------------------------------------------------
-- Fin de sortie idempotente (P7-21)
-- ---------------------------------------------------------------------------
-- Une fin de sortie peut être jouée hors ligne puis rejouée au retour du
-- réseau. On enregistre la clé d'idempotence dans le registre A13
-- (`offline_sync_operations`) : un rejeu répond `duplicate` sans réécrire.
create or replace function public.finish_activity_session_idempotent(
  p_session uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.offline_sync_operations%rowtype;
  v_summary uuid;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'clé d''idempotence invalide' using errcode = '22023';
  end if;

  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_existing.result ->> 'summaryId'
    );
  end if;

  v_summary := public.finish_activity_session(p_session);

  insert into public.offline_sync_operations (user_id, idempotency_key, store, kind, status, result)
  values (
    v_user,
    p_idempotency_key,
    'explorer',
    'activity.finish',
    'applied',
    jsonb_build_object('summaryId', v_summary, 'sessionId', p_session)
  )
  on conflict (user_id, idempotency_key) do nothing;

  return jsonb_build_object('status', 'applied', 'summaryId', v_summary);
end;
$$;

revoke all on function public.finish_activity_session_idempotent(uuid, text) from public;
grant execute on function public.finish_activity_session_idempotent(uuid, text) to authenticated;

commit;
