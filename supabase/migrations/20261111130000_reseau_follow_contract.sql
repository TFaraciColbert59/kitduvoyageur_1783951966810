-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Réseau — contrat de suivi authentifié et atomique
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (revue de 6e17c5a) : le service lisait `user_profiles.profile_visibility`
-- avec le client de session pour une cible arbitraire. Depuis la fermeture A10/F1
-- (20260911290000), cette table n'est plus lisible publiquement et l'acteur ne
-- peut pas décider lui-même si la cible est publique ou privée.
--
-- Cette première migration est strictement additive : elle n'ajoute que trois
-- RPC, sans modifier aucune table, policy, donnée ni grant existant.
--   • reseau_follow                  : suivre, ou demander à suivre un profil privé ;
--   • reseau_respond_follow_request  : accepter / refuser une demande reçue ;
--   • reseau_unfollow                : révoquer un suivi et ses autorisations.
--
-- Les anciens clients qui écrivent encore directement via les policies RLS
-- conservent donc leur comportement : aucune policy et aucun grant de table ne
-- sont retirés ici. Leur retrait éventuel viendra plus tard, uniquement après
-- preuve qu'aucun appelant ne les utilise.
--
-- Sécurité :
--   - `security definer`, `search_path` verrouillé ;
--   - acteur = `auth.uid()`, jamais un identifiant fourni par l'appelant ;
--   - `EXECUTE` retiré à PUBLIC/anon, accordé au seul rôle authenticated ;
--   - résultats bornés : 'following' | 'requested', 'accepted' | 'declined',
--     'unfollowed' ; les refus sont des exceptions stables ('self', 'blocked',
--     'target_not_found', 'follow_request_closed', 'request_not_found',
--     'request_not_pending', 'invalid_action').
--
-- Aucune donnée n'est migrée. Le rollback est purement schématique (voir la
-- section commentée en fin de fichier) : les policies historiques n'ont pas
-- bougé, l'ancienne application reste donc compatible.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Suivre ou demander à suivre ──────────────────────────────────────────
create or replace function public.reseau_follow(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_visibility text;
  v_status text;
  v_follow_exists boolean;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_target_id is null then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  if p_target_id = v_actor then
    raise exception 'self' using errcode = 'P0001';
  end if;

  -- Verrouille la ligne cible le temps de la décision : la visibilité ne peut
  -- pas changer entre la lecture et l'écriture.
  select p.profile_visibility
    into v_visibility
    from public.user_profiles p
   where p.id = p_target_id
   for share;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  -- Le blocage est symétrique : la cible m'a bloqué ou je l'ai bloquée.
  if exists (
    select 1
      from public.user_blocks b
     where (b.blocker_id = v_actor and b.blocked_id = p_target_id)
        or (b.blocker_id = p_target_id and b.blocked_id = v_actor)
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  -- Profil public (ou visibilité inconnue, comme l'ancien service) : suivi direct.
  if v_visibility is distinct from 'prive' then
    insert into public.user_follows (follower_id, following_id)
    values (v_actor, p_target_id)
    on conflict (follower_id, following_id) do nothing;
    return 'following';
  end if;

  -- Profil privé : une demande existante n'est jamais réécrite. En particulier,
  -- une demande acceptée puis révoquée ne doit pas redevenir `pending`, et un
  -- refus ne doit pas être rouvert.
  select r.status
    into v_status
    from public.follow_requests r
   where r.requester_id = v_actor
     and r.target_id = p_target_id
   for update;

  if found then
    if v_status = 'pending' then
      return 'requested';
    end if;
    if v_status = 'accepted' then
      select exists (
        select 1
          from public.user_follows f
         where f.follower_id = v_actor
           and f.following_id = p_target_id
      ) into v_follow_exists;
      if v_follow_exists then
        return 'following';
      end if;
    end if;
    raise exception 'follow_request_closed' using errcode = 'P0001';
  end if;

  insert into public.follow_requests (requester_id, target_id, status)
  values (v_actor, p_target_id, 'pending')
  on conflict (requester_id, target_id) do nothing;

  if found then
    return 'requested';
  end if;

  -- Une demande concurrente a gagné la course : on relit son état sous verrou
  -- et on applique exactement les mêmes règles, sans jamais la réécrire.
  select r.status
    into v_status
    from public.follow_requests r
   where r.requester_id = v_actor
     and r.target_id = p_target_id
   for update;

  if v_status = 'pending' then
    return 'requested';
  end if;
  if v_status = 'accepted' then
    select exists (
      select 1
        from public.user_follows f
       where f.follower_id = v_actor
         and f.following_id = p_target_id
    ) into v_follow_exists;
    if v_follow_exists then
      return 'following';
    end if;
  end if;
  raise exception 'follow_request_closed' using errcode = 'P0001';
end;
$$;

comment on function public.reseau_follow(uuid) is
  'Réseau : suit une cible publique ou crée une demande pour une cible privée. Acteur = auth.uid(), écriture atomique, résultat borné following/requested.';

revoke all on function public.reseau_follow(uuid) from public;
revoke all on function public.reseau_follow(uuid) from anon, authenticated;
grant execute on function public.reseau_follow(uuid) to authenticated;

-- ── 2. Accepter ou refuser une demande reçue ─────────────────────────────────
create or replace function public.reseau_respond_follow_request(
  p_request_id uuid,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_request public.follow_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_action is null or p_action not in ('accept', 'decline') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  -- Seule la cible de la demande peut la lire/la traiter ; le verrou de ligne
  -- sérialise deux réponses concurrentes.
  select r.*
    into v_request
    from public.follow_requests r
   where r.id = p_request_id
     and r.target_id = v_actor
   for update;

  if not found then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;

  if p_action = 'accept' then
    if exists (
      select 1
        from public.user_blocks b
       where (b.blocker_id = v_actor and b.blocked_id = v_request.requester_id)
          or (b.blocker_id = v_request.requester_id and b.blocked_id = v_actor)
    ) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;

    insert into public.user_follows (follower_id, following_id)
    values (v_request.requester_id, v_actor)
    on conflict (follower_id, following_id) do nothing;
  end if;

  update public.follow_requests
     set status = case when p_action = 'accept' then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_request_id;

  return case when p_action = 'accept' then 'accepted' else 'declined' end;
end;
$$;

comment on function public.reseau_respond_follow_request(uuid, text) is
  'Réseau : accepte ou refuse atomiquement une demande dont auth.uid() est la cible. Résultat borné accepted/declined ; une demande non pending est refusée.';

revoke all on function public.reseau_respond_follow_request(uuid, text) from public;
revoke all on function public.reseau_respond_follow_request(uuid, text) from anon, authenticated;
grant execute on function public.reseau_respond_follow_request(uuid, text) to authenticated;

-- ── 3. Révoquer un suivi et ses autorisations ───────────────────────────────
create or replace function public.reseau_unfollow(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_target_id is null then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  -- La révocation emporte le suivi et l'autorisation pending/accepted. Un refus
  -- (`declined`) reste conservé pour empêcher sa réouverture.
  delete from public.user_follows
   where follower_id = v_actor
     and following_id = p_target_id;

  delete from public.follow_requests
   where requester_id = v_actor
     and target_id = p_target_id
     and status in ('pending', 'accepted');

  return 'unfollowed';
end;
$$;

comment on function public.reseau_unfollow(uuid) is
  'Réseau : révoque atomiquement le suivi de auth.uid() vers la cible et ses demandes pending/accepted ; conserve un refus declined.';

revoke all on function public.reseau_unfollow(uuid) from public;
revoke all on function public.reseau_unfollow(uuid) from anon, authenticated;
grant execute on function public.reseau_unfollow(uuid) to authenticated;

-- ── Rollback (à exécuter hors de cette migration, après retour de l'app) ────
-- drop function if exists public.reseau_unfollow(uuid);
-- drop function if exists public.reseau_respond_follow_request(uuid, text);
-- drop function if exists public.reseau_follow(uuid);
--
-- Aucune table, policy, donnée ou grant existant n'est touché : le rollback
-- schématique ci-dessus suffit à revenir à l'état antérieur.
