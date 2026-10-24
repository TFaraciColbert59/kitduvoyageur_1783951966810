-- 2026-10-22 — Revue finale I10 : l'expiration prime sur l'idempotence.
--
-- `accept_profile_invitation` renvoyait `already:true` pour une invitation
-- déjà acceptée AVANT de vérifier `expires_at`. Or `public_profiles` ne laisse
-- voir un profil privé que tant que l'invitation acceptée n'est pas expirée :
-- passé 30 jours, l'API promettait un accès qui n'existait plus.
--
-- La fonction vérifie désormais l'échéance d'abord, marque l'invitation
-- `expired` puis refuse par `invitation_expired` (409 côté route). Le reste du
-- contrat est inchangé : liaison `invitee_id = auth.uid()`, règle du
-- `pending` seul, refus `invitation_reserved` (403) pour une invitation
-- nominative d'un autre utilisateur, idempotence sur une invitation acceptée
-- non expirée, SECURITY DEFINER et `search_path` verrouillé.

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

  -- Expiration vérifiée AVANT le raccourci « déjà acceptée » : après
  -- l'échéance, `public_profiles` masque le profil, donc `already:true`
  -- annoncerait un accès disparu.
  if v.expires_at is not null and v.expires_at <= now() then
    -- Marquage de l'échéance avant le refus. Le RAISE annule cette écriture
    -- dans la transaction appelante (PostgREST), mais `public_profiles` ferme
    -- déjà l'accès sur `expires_at` et le refus reste un 409 explicite.
    update public.profile_invitations
      set status = 'expired'
      where id = v.id and status in ('pending', 'accepted');
    raise exception 'invitation_expired' using errcode='55000';
  end if;

  if v.status = 'accepted' and v.invitee_id = uid then
    return jsonb_build_object('ok', true, 'already', true, 'owner_id', v.owner_id);
  end if;
  if v.status <> 'pending' then raise exception 'invitation_not_pending' using errcode='55000'; end if;
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
