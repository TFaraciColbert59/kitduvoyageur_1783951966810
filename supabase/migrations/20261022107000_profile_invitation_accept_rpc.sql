-- 2026-10-22 — Acceptation d'invitation par jeton.
-- Une invitation en attente a invitee_id NULL : l'invité ne peut donc ni la
-- lire ni la mettre à jour via RLS. Cette fonction SECURITY DEFINER porte
-- l'acceptation, lie invitee_id = auth.uid() et reste réservée aux connectés.

alter table public.profile_invitations
  add column if not exists accepted_at timestamptz;

create or replace function public.accept_profile_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v public.profile_invitations; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthenticated' using errcode='42501'; end if;
  if p_token is null or btrim(p_token) = '' then raise exception 'invitation_not_found' using errcode='P0002'; end if;
  select * into v from public.profile_invitations where token = p_token for update;
  if not found then raise exception 'invitation_not_found' using errcode='P0002'; end if;
  if v.status = 'accepted' and v.invitee_id = uid then
    return jsonb_build_object('ok', true, 'already', true, 'owner_id', v.owner_id);
  end if;
  if v.status <> 'pending' then raise exception 'invitation_not_pending' using errcode='55000'; end if;
  if v.expires_at is not null and v.expires_at <= now() then
    -- Pas d'update ici : l'exception annulerait l'écriture. L'expiration
    -- reste un refus, l'invitation n'est pas marquée définitivement.
    raise exception 'invitation_expired' using errcode='55000';
  end if;
  if v.invitee_id is not null and v.invitee_id <> uid then
    raise exception 'invitation_reserved' using errcode='42501';
  end if;
  update public.profile_invitations
    set invitee_id = uid, status = 'accepted', accepted_at = coalesce(accepted_at, now())
    where id = v.id;
  return jsonb_build_object('ok', true, 'already', false, 'owner_id', v.owner_id);
end $function$;

revoke all on function public.accept_profile_invitation(text) from public, anon;
grant execute on function public.accept_profile_invitation(text) to authenticated;
