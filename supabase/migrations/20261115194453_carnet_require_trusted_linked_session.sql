-- Rétablit le contrôle du propriétaire de la sortie après la séparation des
-- droits de lecture et d'édition du carnet. Un lien historique créé par un
-- tiers ne doit pas donner accès aux données privées du carnet.

create or replace function public.is_carnet_participant(p_carnet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    public.is_carnet_editor(p_carnet)
    or exists (
      select 1
      from public.hike_sessions hs
      join public.carnets c on c.id = hs.carnet_id
      join public.hike_session_participants hp on hp.session_id = hs.id
      where hs.carnet_id = p_carnet
        and hp.user_id = (select auth.uid())
        and (
          hs.user_id = c.author_id
          or exists (
            select 1 from public.carnet_collaborators cc
            where cc.carnet_id = c.id
              and cc.user_id = hs.user_id
              and cc.role in ('owner', 'contributor')
          )
        )
    )
  );
$$;

comment on function public.is_carnet_participant(uuid) is
  'Lecture du carnet : éditeur ou participant à une sortie liée tenue par l''auteur ou un collaborateur owner/contributor. Le rôle d''éditeur est vérifié séparément.';
